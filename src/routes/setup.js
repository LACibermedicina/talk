// Assistente de primeira instalação. Só funciona enquanto NÃO existe usuário nem "setup_done"; exige o código impresso no log do servidor.
import { z } from 'zod';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import os from 'node:os';
import { existsSync, renameSync } from 'node:fs';
import argon2 from 'argon2';
import { audit } from '../audit.js';
import { cfgFile } from '../boot/config.js';
import { q } from '../db.js';
import { testService } from '../setupTests.js';
import { saveSettings, KEYS } from '../settings.js';
import { createUsers } from '../setupLib.js';
import { migrate, pending } from '../migrateLib.js';
import { ALL } from '../roles.js';
import { weakAllowed } from '../policy.js';
let code = null, done = false;
let reconf = false;
export const reconfiguring = () => reconf;
export async function needed() {
  if (reconf) return true;
  if (done) return false;
  try { if ((await q("select 1 from app_settings where key='setup_reset'")).length) { reconf = true; return true; } if ((await q('select count(*)::int n from users'))[0].n > 0) return !(done = true) && false; if ((await q("select 1 from app_settings where key='setup_done'")).length) return !(done = true) && false; } catch { /* banco sem tabelas: instalação necessária */ }
  return true;
}
const WHY = {
  node: 'O sistema usa recursos modernos do Node (módulos ES, fetch e criptografia nativa). Versões antigas falham ao iniciar.',
  db: 'Usuários, mensagens e prontuários ficam no banco. Sem ele nada funciona.',
  dbssl: 'Sem TLS, senhas e dados de saúde cruzam a rede em texto aberto entre o servidor e o banco.',
  mig: 'As tabelas precisam existir e estar na versão que este código espera, senão telas e rotas quebram.',
  jwt: 'Assina os logins. Se for curta ou previsível, alguém poderia forjar uma sessão de administrador.',
  key: 'Cifra as credenciais e dados sensíveis no banco. Perdê-la torna esses dados irrecuperáveis.',
  weak: 'Contas de saúde são alvo de ataques de senha; senhas fracas facilitam o acesso indevido.',
  https: 'Sem HTTPS, a senha e o prontuário trafegam sem proteção e o navegador bloqueia câmera e microfone.',
  host: 'Cookies seguros só funcionam quando você acessa pelo mesmo endereço configurado.',
  proxy: 'O proxy (Nginx ou Caddy) termina o HTTPS e protege o app da internet direta; ele precisa informar ao app que a conexão original era HTTPS.',
  cookie: 'Cookies Secure impedem que a sessão vaze em conexões sem criptografia.',
  root: 'Se o app for invadido, um processo sem privilégios limita o estrago ao contêiner.',
  sdk: 'É o componente de vídeo do navegador. Sem ele não há teleconsulta com vídeo.',
  mem: 'Criptografia de senhas e geração de PDFs consomem memória; abaixo de 512 MB o servidor pode ser encerrado pelo sistema.',
  tz: 'Lembretes, agenda e relatórios usam a hora local; sem fuso, horários saem em UTC.'
};
export async function initSetup(log) {
  if (!(await needed())) return; const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', b = randomBytes(12);
  code = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(process.env.SETUP_CODE || '') ? process.env.SETUP_CODE : [0, 4, 8].map(i => [...b.subarray(i, i + 4)].map(x => A[x % A.length]).join('')).join('-');
  const msg = `INSTALAÇÃO: abra o endereço do sistema e informe o código ${code}`; log.warn(msg); console.log('\n=============================\n' + msg + '\n=============================\n');
}
const same = (a, b) => typeof a === 'string' && b && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
/** Guarda uma cópia de data/config.env (com a DATA_KEY!) e libera o servidor para refazer banco/chaves no próximo início. */
async function backupBootConfig() { try { const f = cfgFile(); if (!existsSync(f)) return null; const b = f + '.bak-' + new Date().toISOString().replace(/[:.]/g, '-'); renameSync(f, b); return b; } catch { return null; } }
export async function resetInstall(log) {
  const rows = await q("select key from app_settings where key not in ('setup_done','setup_reset')"); for (const r of rows) delete process.env[r.key];
  await q("delete from app_settings where key not in ('setup_done','setup_reset')"); await q("insert into app_settings(key,value_enc) values('setup_reset','x') on conflict do nothing");
  reconf = true; done = false; const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', b = randomBytes(12);
  code = [0, 4, 8].map(i => [...b.subarray(i, i + 4)].map(x => A[x % A.length]).join('')).join('-'); const msg = `INSTALAÇÃO (restauração pedida pelo root): informe o código ${code}`; log.warn(msg); console.log('\n=============================\n' + msg + '\n=============================\n'); return { code, apagadas: rows.length };
}
export default async function (app) {
  const rl = { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } };
  const gate = async (req, rep) => { if (!(await needed())) return rep.code(410).send({ error: 'Instalação já concluída' }); if (!same(req.headers['x-setup-code'], code)) return rep.code(401).send({ error: 'Código de instalação inválido' }); };
  const G = { preHandler: gate, ...rl };
  // Restauração das configurações originais: somente o root, reconfirmando a própria senha. Dados (usuários, prontuário, créditos) não são apagados.
  const rootOnly = async (req, rep) => { await app.role('admin')(req, rep); if (rep.sent) return; const [u] = await q('select is_root from users where id=$1', [req.user.sub]); if (!u || !u.is_root) return rep.code(403).send({ error: 'Somente o root pode restaurar a configuração' }); };
  app.post('/api/admin/reset-install', { preHandler: rootOnly, config: { rateLimit: { max: 3, timeWindow: '10 minutes' } } }, async (req, rep) => {
    const b = z.object({ password: z.string().min(1).max(200), confirm: z.literal('RESTAURAR'), server: z.boolean().default(false) }).parse(req.body);
    const [u] = await q('select pw_hash from users where id=$1', [req.user.sub]); if (!(await argon2.verify(u.pw_hash, b.password))) { await audit(req, 'reset_install_negado', 'settings', 'install'); return rep.code(403).send({ error: 'Senha do root incorreta' }); }
    const r = await resetInstall(app.log); await audit(req, 'reset_install', 'settings', 'install', { apagadas: r.apagadas, servidor: b.server });
    if (b.server) { const bk = await backupBootConfig(); r.backup = bk; if (bk) setTimeout(() => process.exit(0), 800); }
    return { ok: true, code: r.code, reiniciando: !!r.backup };
  });
  app.post('/api/admin/cancel-reset', { preHandler: rootOnly }, async () => { await q("delete from app_settings where key='setup_reset'"); reconf = false; done = true; code = null; return { ok: true }; });
  app.get('/api/setup/status', rl, async () => ({ needed: await needed(), weakAllowed: weakAllowed(), reconfig: reconf }));
  app.post('/api/setup/unlock', rl, async (req, rep) => { if (!(await needed())) return rep.code(410).send({ error: 'Instalação já concluída' }); const { code: c } = z.object({ code: z.string().max(20) }).parse(req.body); return same(c.trim().toUpperCase(), code) ? { ok: true } : rep.code(401).send({ error: 'Código incorreto. Confira o log do servidor.' }); });
  app.post('/api/setup/migrate', G, async () => ({ aplicadas: await migrate(() => {}) }));
  app.get('/api/setup/check', G, async req => {
    const C = [], add = (id, t, ok, level, detail, fix) => C.push({ id, t, ok: !!ok, level, detail, fix });
    add('node', 'Node.js 22 ou superior', +process.versions.node.split('.')[0] >= 22, 'req', 'Versão ' + process.versions.node, 'Use a imagem node:22 do Dockerfile.');
    try { const [v] = await q('show server_version'), [s] = await q('select coalesce((select ssl from pg_stat_ssl where pid=pg_backend_pid()),false) ssl'); add('db', 'Banco de dados acessível', true, 'req', 'PostgreSQL ' + v.server_version); const loop = /@(127\.0\.0\.1|localhost|\[::1\])(:|\/|$)/i.test(process.env.DATABASE_URL || ''); add('dbssl', 'Conexão com o banco usa TLS', s.ssl || loop, 'rec', s.ssl ? 'Criptografada' : loop ? 'Banco na própria máquina: o tráfego não sai do servidor, TLS dispensado' : 'Sem TLS', 'Use a connection string do Neon com ?sslmode=require.'); }
    catch { add('db', 'Banco de dados acessível', false, 'req', 'Não foi possível conectar', 'Confira DATABASE_URL no .env (Neon: termina com ?sslmode=require) e reinicie.'); }
    try { const p = await pending(); add('mig', 'Estrutura do banco atualizada', !p.length, 'req', p.length ? `${p.length} migração(ões) pendente(s)` : 'Tudo aplicado', 'Clique em “Aplicar migrações”.'); } catch { add('mig', 'Estrutura do banco atualizada', false, 'req', 'Não verificável sem banco', 'Resolva o banco primeiro.'); }
    add('jwt', 'JWT_SECRET forte (32+ caracteres)', (process.env.JWT_SECRET || '').length >= 32, 'req', 'Segredo de sessão', 'Gere com: openssl rand -base64 48');
    add('key', 'Chave de criptografia (DATA_KEY) carregada', true, 'req', '32 bytes', 'Guarde uma cópia em cofre separado: sem ela os dados cifrados são irrecuperáveis.');
    add('weak', 'Senhas fracas bloqueadas', !weakAllowed(), 'rec', weakAllowed() ? 'Modo de teste: senhas curtas aceitas' : 'Mínimo de 12 caracteres', 'Em servidor público não use ALLOW_WEAK_PASSWORDS. Em teste local, a senha de teste só vale até o primeiro login.');
    add('https', 'APP_ORIGIN usa HTTPS', /^https:\/\//.test(process.env.APP_ORIGIN || ''), 'rec', process.env.APP_ORIGIN, 'Defina APP_ORIGIN=https://seu.dominio');
    let host = ''; try { host = new URL(process.env.APP_ORIGIN).host; } catch { /* inválido */ }
    const acc = req.headers['x-forwarded-host'] || req.headers.host; add('host', 'Você acessa pelo endereço configurado', host === acc, 'rec', 'Acessando por ' + acc, 'Abra o sistema pelo domínio de APP_ORIGIN (senão os cookies seguros falham).');
    add('proxy', 'Proxy HTTPS (Nginx ou Caddy) detectado', req.headers['x-forwarded-proto'] === 'https', 'rec', req.headers['x-forwarded-proto'] || 'o proxy não envia X-Forwarded-Proto', 'Nginx: no bloco location / do site inclua proxy_set_header X-Forwarded-Proto $scheme; e rode nginx -t && systemctl reload nginx (ou use deploy/vps-fix-proxy.sh). Caddy/Docker: mantenha o Caddy na frente do app.');
    add('cookie', 'Cookies seguros ativos', process.env.COOKIE_SECURE !== 'false', 'rec', 'Secure + SameSite=Strict', 'Remova COOKIE_SECURE=false em produção.');
    add('root', 'Roda sem privilégio de root', typeof process.getuid === 'function' && process.getuid() !== 0, 'rec', 'uid ' + (process.getuid ? process.getuid() : '?'), 'Docker: mantenha USER node no Dockerfile. Sem Docker (PM2) é opcional e pode ficar para depois.');
    add('sdk', 'SDK de vídeo (Agora) presente', existsSync(new URL('../../public/vendor/agora.js', import.meta.url)), 'rec', 'public/vendor/agora.js', 'Refaça o build: docker compose build --no-cache app');
    add('mem', 'Memória de 512 MB ou mais', os.totalmem() >= 512 * 2 ** 20, 'rec', Math.round(os.totalmem() / 2 ** 20) + ' MB', 'Use um servidor com mais memória.');
    add('tz', 'Fuso horário definido (TZ)', !!process.env.TZ, 'rec', process.env.TZ || 'não definido', 'Defina TZ=America/Sao_Paulo no .env (lembretes e relatórios usam a hora local).');
    await Promise.all([['generativelanguage.googleapis.com', 'Gemini'], ['api.openai.com', 'OpenAI'], ['api.anthropic.com', 'Anthropic']].map(async ([h, n]) => { let ok = false; try { await fetch('https://' + h, { method: 'HEAD', signal: AbortSignal.timeout(4000) }); ok = true; } catch { /* sem rota */ } add('net-' + n, `Saída de rede para ${n}`, ok, 'rec', h, 'Libere HTTPS de saída (porta 443) no firewall/provedor.'); }));
    for (const x of C) x.why = x.why || WHY[x.id] || (x.id.startsWith('net-') ? 'O servidor precisa alcançar este provedor de IA para transcrever e traduzir. Sem rota de saída, apenas a IA fica indisponível; o restante funciona.' : '');
    return C;
  });
  app.post('/api/setup/test', G, async req => { const b = z.object({ service: z.enum(['agora', 'gemini', 'openai', 'anthropic', 'paypal', 'twilio']), values: z.record(z.string().max(400)) }).parse(req.body); return testService(b.service, b.values); });
  app.post('/api/setup/save', G, async req => { const { settings } = z.object({ settings: z.record(z.string().max(400)) }).parse(req.body); await saveSettings(settings); return { ok: true, chaves: Object.keys(settings).length }; });
  app.post('/api/setup/finish', G, async req => {
    const b = z.object({ root: z.object({ usuario: z.string().max(30).optional(), nome: z.string().min(2).max(120), email: z.string().email(), senha: z.string().min(1).max(200).optional() }), signup: z.enum(['off', 'approval', 'open']).default('off'), equipe: z.array(z.object({ tipo: z.enum(ALL).refine(t => t !== 'admin'), nome: z.string().min(2).max(120), email: z.string().email(), cargo: z.string().max(60).optional() })).max(30).default([]), vincular: z.boolean().default(true) }).parse(req.body);
    if (reconf) {
      // Restauração pedida pelo root: o root já existe; só entram pessoas novas e o modo de cadastro.
      const have = new Set((await q('select lower(email) e from users')).map(r => r.e)), novos = b.equipe.filter(u => !have.has(u.email.toLowerCase())), rep2 = novos.length ? await createUsers(novos.map(u => ({ usuario: undefined, nome: u.nome, email: u.email, tipo: u.tipo, cargo: u.cargo }))) : [];
      await saveSettings({ SIGNUP_MODE: b.signup }); await q("delete from app_settings where key='setup_reset'"); reconf = false; done = true; code = null; return { credenciais: rep2, reconfig: true };
    }
    const list = [{ usuario: b.root.usuario || 'root', nome: b.root.nome, email: b.root.email, tipo: 'admin', root: true, senha: b.root.senha }, ...b.equipe];
    if (new Set(list.map(u => u.email.toLowerCase())).size !== list.length) throw Object.assign(new Error('Há e-mails repetidos na lista'), { statusCode: 400 });
    const rep = await createUsers(list);
    if (b.vincular) { const ps = await q("select id from users where role='paciente'"), fs = await q("select id from users where role in('medico','fisio','enfermeiro','nutricionista','farmaceutico','profissional','cuidador')"); for (const p of ps) for (const f of fs) await q('insert into care_team values($1,$2) on conflict do nothing', [p.id, f.id]); }
    await saveSettings({ SIGNUP_MODE: b.signup });
    await q("insert into app_settings(key,value_enc) values('setup_done','x') on conflict do nothing"); done = true; code = null; return { credenciais: rep };
  });
}
