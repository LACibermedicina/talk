// Servidor de instalação (modo bootstrap): sobe quando faltam DATABASE_URL, JWT_SECRET, DATA_KEY ou APP_ORIGIN.
// Só expõe o instalador; exige o código impresso no log. Ao salvar, grava data/config.env e entrega o processo ao servidor completo.
import Fastify from 'fastify';
import stat from '@fastify/static';
import pg from 'pg';
import { timingSafeEqual } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { saveConfig, genKeys, validKey, validDbUrl, originOf, newCode, dataDir } from './config.js';
import { bootChecks } from './checks.js';
const same = (a, b) => typeof a === 'string' && b && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
/** Testa a conexão e as permissões do banco, devolvendo uma mensagem em linguagem simples. */
/** Sem TLS: remove sslmode/ssl da URL, pois o driver dá prioridade à URL sobre a opção ssl. */
export const noSslUrl = u => u.replace(/([?&])(sslmode|ssl|sslrootcert)=[^&]*&?/gi, '$1').replace(/[?&]$/, '');
export async function testDb(url, { ssl = true } = {}) {
  if (!ssl) url = noSslUrl(url);
  if (!validDbUrl(url)) return { ok: false, message: 'O endereço não parece uma connection string do PostgreSQL.', hint: 'Ela começa com postgresql:// e tem usuário, senha, servidor e nome do banco. No Neon: Dashboard → Connect → copie a "connection string".' };
  const c = new pg.Client({ connectionString: url, ssl: ssl ? { rejectUnauthorized: true } : false, connectionTimeoutMillis: 10000 });
  try {
    await c.connect(); const v = (await c.query('show server_version')).rows[0].server_version;
    let tls = false; try { tls = !!(await c.query('select ssl from pg_stat_ssl where pid=pg_backend_pid()')).rows[0]?.ssl; } catch { /* sem permissão */ }
    try { await c.query('create table if not exists _m3d_probe(x int)'); await c.query('drop table _m3d_probe'); } catch { return { ok: false, message: 'Conectou, mas este usuário não pode criar tabelas.', hint: 'O sistema cria sua estrutura sozinho. Use o usuário dono do banco (no Neon, o usuário padrão do projeto) ou conceda CREATE no schema public.' }; }
    return { ok: true, message: 'Conectado ao PostgreSQL ' + v + (tls ? ' com TLS' : ' (sem TLS)'), version: v, tls };
  } catch (e) {
    const m = String(e.message || e), hint = /ENOTFOUND|EAI_AGAIN/.test(m) ? 'O nome do servidor não foi encontrado: confira o endereço e o DNS do seu servidor.' : /password|authentication/i.test(m) ? 'Usuário ou senha incorretos. Se acabou de trocar a senha no painel, copie a connection string de novo.' : /SSL|TLS|certificate/i.test(m) ? (/@(127\.0\.0\.1|localhost|\[::1\])[:/]/.test(url) ? 'Este é um banco local com certificado autoassinado: DESMARQUE a opção "Exigir conexão criptografada (TLS)" logo abaixo do campo e teste de novo.' : 'Falha na criptografia da conexão. Para o Neon, mantenha ?sslmode=require. Em banco local sem TLS, desmarque "Exigir conexão criptografada".') : /timeout|ECONNREFUSED|ETIMEDOUT/i.test(m) ? 'Não foi possível alcançar o servidor do banco: confira firewall (porta 5432/443) e se o banco está ativo.' : 'Confira a connection string.';
    return { ok: false, message: 'Não foi possível conectar: ' + m.slice(0, 160), hint };
  } finally { await c.end().catch(() => {}); }
}
export async function runBoot(miss) {
  const codeFile = join(dataDir(), 'setup-code.txt'), okCode = c => typeof c === 'string' && /^[A-Z0-9-]{14}$/.test(c);
  let saved0 = ''; try { saved0 = readFileSync(codeFile, 'utf8').trim(); } catch { /* ainda não existe */ }
  const code = okCode(process.env.SETUP_CODE) ? process.env.SETUP_CODE : okCode(saved0) ? saved0 : newCode(); process.env.SETUP_CODE = code;
  try { mkdirSync(dataDir(), { recursive: true }); writeFileSync(codeFile, code + '\n', { mode: 0o600 }); } catch { /* sem escrita: o log continua mostrando */ }
  const app = Fastify({ logger: { redact: ['req.headers.cookie'] }, trustProxy: true, bodyLimit: 1e5 });
  let fails = 0, until = 0; const rl = new Map();
  app.addHook('onRequest', async (req, rep) => { rep.header('x-content-type-options', 'nosniff').header('referrer-policy', 'no-referrer').header('cache-control', 'no-store').header('x-frame-options', 'DENY'); });
  const lim = (req, rep, max = 30) => { const k = req.ip, n = Date.now(), a = (rl.get(k) || []).filter(t => n - t < 60000); a.push(n); rl.set(k, a); if (a.length > max) { rep.code(429).send({ error: 'Muitas tentativas. Aguarde um minuto.' }); return true; } return false; };
  const gate = async (req, rep) => { if (lim(req, rep)) return rep; if (!same(req.headers['x-setup-code'], code)) return rep.code(401).send({ error: 'Código de instalação incorreto. Ele aparece no log do servidor (PM2: pm2 logs talk | grep -i INSTALAÇÃO; Docker: docker compose logs app | grep INSTALAÇÃO) e no arquivo data/setup-code.txt (cat data/setup-code.txt).' }); };
  app.get('/api/health', { config: { rateLimit: false } }, async () => ({ ok: true, boot: true }));
  app.get('/api/setup/status', async () => ({ needed: true, boot: true, missing: miss, weakAllowed: false }));
  app.post('/api/setup/unlock', async (req, rep) => { if (lim(req, rep, 10)) return rep; if (Date.now() < until) return rep.code(429).send({ error: 'Aguarde alguns segundos e tente de novo.' }); const c = String((req.body || {}).code || '').trim().toUpperCase(); if (!same(c, code)) { if (++fails >= 5) { fails = 0; until = Date.now() + 30000; } return rep.code(401).send({ error: 'Código incorreto. Veja o log do servidor.' }); } fails = 0; return { ok: true, boot: true }; });
  app.get('/api/setup/boot/check', { preHandler: gate }, async req => ({ checks: await bootChecks(req), origin: originOf(req.headers), tz: process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone, https: String(req.headers['x-forwarded-proto'] || '').startsWith('https') }));
  app.post('/api/setup/boot/db-test', { preHandler: gate }, async req => { const b = req.body || {}; return testDb(String(b.url || '').trim(), { ssl: b.ssl !== false }); });
  app.post('/api/setup/boot/keys', { preHandler: gate }, async () => genKeys());
  let saved = false, resolveBoot; const done = new Promise(r => { resolveBoot = r; });
  app.post('/api/setup/boot/save', { preHandler: gate }, async (req, rep) => {
    if (saved) return rep.code(409).send({ error: 'A configuração já foi gravada. Aguarde o sistema iniciar.' });
    const b = req.body || {}, url = String(b.DATABASE_URL || '').trim(), origin = String(b.APP_ORIGIN || '').trim().replace(/\/+$/, ''), tz = String(b.TZ || '').trim();
    if (!validDbUrl(url)) return rep.code(400).send({ error: 'Informe uma connection string válida do PostgreSQL.' });
    if (!/^https?:\/\/[^/\s]+$/.test(origin)) return rep.code(400).send({ error: 'Endereço do sistema inválido (ex.: https://seu.dominio).' });
    if (String(b.JWT_SECRET || '').length < 32) return rep.code(400).send({ error: 'Chave de sessão ausente ou curta. Gere as chaves na etapa anterior.' });
    if (!validKey(b.DATA_KEY)) return rep.code(400).send({ error: 'Chave de criptografia inválida. Gere as chaves na etapa anterior.' });
    if (b.ack !== true) return rep.code(400).send({ error: 'Confirme que guardou uma cópia da chave de criptografia.' });
    try { Intl.DateTimeFormat('pt-BR', { timeZone: tz }); } catch { return rep.code(400).send({ error: 'Fuso horário inválido.' }); }
    const t = await testDb(url, { ssl: b.PGSSL !== 'false' }); if (!t.ok) return rep.code(400).send({ error: t.message + ' ' + (t.hint || '') });
    const cfg = { DATABASE_URL: url, JWT_SECRET: b.JWT_SECRET, DATA_KEY: b.DATA_KEY, APP_ORIGIN: origin, TZ: tz };
    if (b.PGSSL === 'false') cfg.PGSSL = 'false'; if (origin.startsWith('http://')) cfg.COOKIE_SECURE = 'false';
    try { saveConfig(cfg); } catch (e) { return rep.code(500).send({ error: 'Não foi possível gravar a configuração em data/config.env (' + e.code + '). Verifique o volume "appdata" no docker-compose.yml.' }); }
    Object.assign(process.env, cfg, { SETUP_CODE: code }); saved = true; try { rmSync(codeFile, { force: true }); } catch { /* ok */ } setTimeout(() => resolveBoot(), 400);
    return { ok: true, http: origin.startsWith('http://') };
  });
  await app.register(stat, { root: new URL('../../public/', import.meta.url).pathname, wildcard: false });
  app.setNotFoundHandler((req, rep) => req.method === 'GET' && !req.url.startsWith('/api') ? rep.sendFile('index.html') : rep.code(503).send({ error: 'O sistema está em modo de instalação. Abra o endereço no navegador para concluir.' }));
  const msg = `INSTALAÇÃO: abra o endereço do sistema e informe o código ${code}`; app.log.warn(msg); console.log('\n=============================\n' + msg + '\nFaltando: ' + miss.join(', ') + '\n=============================\n');
  await app.listen({ port: +process.env.PORT || 3000, host: '0.0.0.0' });
  await done; await app.close();
}
