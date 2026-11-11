import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import rate from '@fastify/rate-limit';
import ws from '@fastify/websocket';
import multipart from '@fastify/multipart';
import stat from '@fastify/static';
import { q } from './db.js';
import { startJobs } from './jobs.js';
import { migrate } from './migrateLib.js';
import { loadSettings } from './settings.js';
import { initSetup } from './routes/setup.js';
import { installBilling } from './billing.js';
import { seedTest, testOn, TEST_USERS } from './testMode.js';
for (const k of ['DATABASE_URL', 'JWT_SECRET', 'DATA_KEY', 'APP_ORIGIN']) if (!process.env[k]) throw new Error('Falta variável ' + k);
if (process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET muito curto');
const app = Fastify({ logger: { redact: ['req.headers.cookie', 'req.headers.authorization'] }, trustProxy: true, bodyLimit: 1e6 });
await app.register(helmet, { contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'], fontSrc: ['https://fonts.gstatic.com'], imgSrc: ["'self'", 'data:', 'blob:'], mediaSrc: ["'self'", 'blob:'], connectSrc: ["'self'", 'https:', 'wss:'], workerSrc: ["'self'", 'blob:'], objectSrc: ["'none'"], frameSrc: ["'none'"], baseUri: ["'self'"], formAction: ["'self'"], frameAncestors: ["'none'"] } } });
await app.register(cookie);
await app.register(jwt, { secret: process.env.JWT_SECRET, cookie: { cookieName: 't', signed: false } });
await app.register(rate, { max: 300, timeWindow: '1 minute' });
await app.register(ws);
await app.register(multipart, { limits: { fileSize: 10e6, files: 1 } });
app.addHook('onRequest', async (req, rep) => { if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) { const o = req.headers.origin; if (o && o !== process.env.APP_ORIGIN) return rep.code(403).send({ error: 'origem não permitida' }); } });
app.decorate('auth', async (req, rep) => {
  try { await req.jwtVerify(); } catch { return rep.code(401).send({ error: 'não autenticado' }); }
  if (!req.user.role || !(await q('select 1 from users where id=$1 and active and (sessions_valid_after is null or sessions_valid_after < to_timestamp($2))', [req.user.sub, req.user.iat || 0])).length) return rep.code(401).send({ error: 'sessão inválida' });
  if (req.user.mc && !['/api/me', '/api/me/password', '/api/logout'].includes(req.url.split('?')[0])) return rep.code(403).send({ error: 'Troque a senha para continuar', mustChange: true });
});
app.decorate('role', (...r) => async (req, rep) => { await app.auth(req, rep); if (rep.sent) return; if (!r.includes(req.user.role)) return rep.code(403).send({ error: 'sem permissão' }); });
app.setErrorHandler((e, req, rep) => {
  if (e.name === 'ZodError') return rep.code(400).send({ error: 'dados inválidos', detalhes: e.issues.map(i => i.path.join('.') + ': ' + i.message) });
  const c = e.statusCode && e.statusCode < 500 ? e.statusCode : (e.statusCode || 500);
  if (c >= 500) req.log.error(e);
  rep.code(c).send({ error: c < 500 || c === 503 ? e.message : 'erro interno' });
});
installBilling(app);
for (const m of ['auth', 'agenda', 'chat', 'video', 'finance', 'tasks', 'clinical', 'documents', 'paypal', 'app', 'context', 'followup', 'public', 'signup', 'setup', 'integracoes', 'i18n', 'caso', 'assistente', 'consulta', 'familia', 'billing', 'admin'])
  await app.register((await import(`./routes/${m}.js`)).default);
await app.register(stat, { root: new URL('../public/', import.meta.url).pathname, wildcard: false });
app.setNotFoundHandler((req, rep) => req.method === 'GET' && !req.url.startsWith('/api') && !req.url.startsWith('/ws') ? rep.sendFile('index.html') : rep.code(404).send({ error: 'não encontrado' }));
if (process.env.AUTO_MIGRATE !== 'false') await migrate(m => app.log.info(m)).catch(e => app.log.error('migração falhou: ' + e.message));
await loadSettings();
await initSetup(app.log);
await seedTest(app.log).catch(e => app.log.error('modo de teste falhou: ' + e.message));
app.get('/api/test-users', async (req, rep) => testOn() ? TEST_USERS.map(u => ({ n: u.nome, u: u.usuario || u.email, p: u.senha })) : rep.code(404).send({ error: 'não encontrado' }));
// RUN_JOBS=false: os jobs rodam num processo à parte (src/worker.js), deixando este só com a API e o WebSocket.
if (process.env.RUN_JOBS !== 'false') startJobs(app.log);
app.get('/api/health', { config: { rateLimit: false } }, async (req, rep) => { if (req.query.deep) { try { await q('select 1'); } catch { return rep.code(503).send({ ok: false, db: false }); } } return { ok: true, up: Math.round(process.uptime()) }; });
await app.listen({ port: +process.env.PORT || 3000, host: process.env.HOST || '0.0.0.0' });
