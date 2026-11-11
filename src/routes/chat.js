import { connect, disconnect, loadStatus } from '../presence.js';
import { z } from 'zod';
import { q } from '../db.js';
import { enc, dec } from '../crypto.js';
import { audit } from '../audit.js';
import { translate } from '../services/ai.js';
import { STAFF } from '../roles.js';
const rooms = new Map(), URG = /dor no peito|desmai|falta de ar|crise hipertensiva|sangramento|piorou muito/i;
async function allowed(u, k) {
  if (k.startsWith('ch:')) return u.role !== 'paciente' && (await q('select 1 from channels where id=$1', [k.slice(3)])).length > 0;
  if (!k.startsWith('dm:')) return false;
  const [, a, b] = k.split(':'); if (![a, b].includes(u.sub)) return false;
  const [o] = await q('select id,role from users where id=$1 and active', [a === u.sub ? b : a]); if (!o) return false;
  if (u.role !== 'paciente' && o.role !== 'paciente') return true;
  const mine = u.role === 'paciente', pat = mine ? u.sub : o.id, pro = mine ? o.id : u.sub, pr = mine ? o.role : u.role;
  return pr === 'recepcao' || (await q('select 1 from care_team where patient_id=$1 and professional_id=$2', [pat, pro])).length > 0;
}
export default async function (app) {
  const room = z.string().regex(/^(ch:[0-9a-f-]{36}|dm:[0-9a-f-]{36}:[0-9a-f-]{36})$/);
  app.get('/api/channels', { preHandler: app.role(...STAFF) }, () => q('select id,name from channels order by name'));
  app.post('/api/channels', { preHandler: app.role('admin') }, async req => { const { name } = z.object({ name: z.string().regex(/^[a-z0-9-]{2,40}$/) }).parse(req.body); const [r] = await q('insert into channels(name) values($1) returning id', [name]); return r; });
  app.get('/api/messages', { preHandler: app.auth }, async (req, rep) => {
    const { key } = z.object({ key: room }).parse(req.query); if (!await allowed(req.user, key)) return rep.code(403).send({ error: 'sem acesso' });
    const rows = await q('select m.id,m.sender_id,u.name sender,m.body_enc,m.lang,m.pinned,m.urgent,m.created_at from messages m join users u on u.id=m.sender_id where m.room=$1 order by m.created_at desc limit 100', [key]);
    await audit(req, 'read', 'messages', null, { key });
    return rows.reverse().map(({ body_enc, ...r }) => ({ ...r, body: dec(body_enc) }));
  });
  app.post('/api/messages', { preHandler: app.auth }, async (req, rep) => {
    const b = z.object({ key: room, body: z.string().min(1).max(4000), lang: z.string().max(5).optional() }).parse(req.body);
    if (!await allowed(req.user, b.key)) return rep.code(403).send({ error: 'sem acesso' });
    const urgent = URG.test(b.body), [m] = await q('insert into messages(room,sender_id,body_enc,lang,urgent) values($1,$2,$3,$4,$5) returning id,created_at', [b.key, req.user.sub, enc(b.body), b.lang || null, urgent]);
    const out = JSON.stringify({ id: m.id, key: b.key, sender: req.user.name, senderId: req.user.sub, body: b.body, lang: b.lang, urgent, at: m.created_at });
    rooms.get(b.key)?.forEach(s => s.readyState === 1 && s.send(out)); return { id: m.id, urgent };
  });
  app.patch('/api/messages/:id/pin', { preHandler: app.role(...STAFF) }, async (req, rep) => {
    const { pinned } = z.object({ pinned: z.boolean() }).parse(req.body), r = await q(`update messages set pinned=$2 where id=$1 and room like 'ch:%' returning id`, [z.string().uuid().parse(req.params.id), pinned]);
    return r.length ? { ok: true } : rep.code(404).send({ error: 'só mensagens de canal podem ser fixadas' });
  });
  app.get('/api/messages/:id/translate', { preHandler: app.auth }, async (req, rep) => {
    const to = z.string().min(2).max(10).parse(req.query.to), [m] = await q('select room,body_enc from messages where id=$1', [z.string().uuid().parse(req.params.id)]);
    if (!m || !await allowed(req.user, m.room)) return rep.code(404).send({ error: 'não encontrado' });
    return { translated: await translate(dec(m.body_enc), to) };
  });
  app.get('/ws', { websocket: true, preHandler: app.auth }, (sock, req) => {
    if (req.headers.origin !== process.env.APP_ORIGIN) return sock.close();
    const mine = new Set(); connect(req.user.sub); loadStatus(req.user.sub);
    sock.on('message', async raw => { try { const m = JSON.parse(raw); if (m.join && room.safeParse(m.join).success && await allowed(req.user, m.join)) { if (!rooms.has(m.join)) rooms.set(m.join, new Set()); rooms.get(m.join).add(sock); mine.add(m.join); } } catch {} });
    sock.on('close', () => { disconnect(req.user.sub); mine.forEach(k => rooms.get(k)?.delete(sock)); });
  });
}
