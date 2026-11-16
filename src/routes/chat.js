import { connect, disconnect, loadStatus, track } from '../presence.js';
import { z } from 'zod';
import { q } from '../db.js';
import { enc, dec } from '../crypto.js';
import { audit } from '../audit.js';
import { translate } from '../services/ai.js';
import { STAFF } from '../roles.js';
import { limit } from '../i18nLogic.js';
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
  // Tradução automática das mensagens recebidas: só para quem ligou a opção e deu consentimento de IA; cache cifrado por mensagem e idioma; mesmo limite diário da tradução da interface.
  app.patch('/api/me/auto-translate', { preHandler: app.auth }, async (req, rep) => {
    const { on } = z.object({ on: z.boolean() }).parse(req.body), [u] = await q('select ai_consent from users where id=$1', [req.user.sub]);
    if (on && !u.ai_consent) return rep.code(400).send({ error: 'Ative antes o consentimento para uso de IA.' });
    await q('update users set auto_translate=$2 where id=$1', [req.user.sub, on]); await audit(req, on ? 'traducao_auto_on' : 'traducao_auto_off', 'user', req.user.sub); return { ok: true, on };
  });
  app.post('/api/messages/translate', { preHandler: app.auth, config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req, rep) => {
    const b = z.object({ ids: z.array(z.string().uuid()).min(1).max(20), to: z.enum(['pt', 'es', 'gn', 'en', 'zh']) }).parse(req.body), [u] = await q('select ai_consent,auto_translate from users where id=$1', [req.user.sub]);
    if (!u.auto_translate || !u.ai_consent) return rep.code(403).send({ error: 'tradução automática desligada' });
    const rows = await q('select id,room,sender_id,body_enc,lang from messages where id=any($1)', [b.ids]), out = {};
    const todo = []; for (const m of rows) { if (m.sender_id === req.user.sub || (m.lang && m.lang === b.to) || !(await allowed(req.user, m.room))) continue; todo.push(m); }
    const cached = await q('select message_id,text_enc from message_translations where lang=$1 and message_id=any($2)', [b.to, todo.map(m => m.id)]), got = new Map(cached.map(r => [r.message_id, dec(r.text_enc)]));
    const miss = todo.filter(m => !got.has(m.id)); for (const m of todo) if (got.has(m.id)) out[m.id] = got.get(m.id);
    if (miss.length) {
      const [us] = await q('insert into i18n_usage(user_id,n) values($1,$2) on conflict(day,user_id) do update set n=i18n_usage.n+$2 returning n', [req.user.sub, miss.length]);
      if (us.n > limit()) return rep.code(429).send({ error: 'limite diário de traduções por IA atingido' });
      for (const m of miss) { try { const t = (await translate(dec(m.body_enc), b.to))?.trim(); if (!t) continue; out[m.id] = t; await q('insert into message_translations(message_id,lang,text_enc) values($1,$2,$3) on conflict do nothing', [m.id, b.to, enc(t)]); } catch (e) { if (!Object.keys(out).length) return rep.code(503).send({ error: e.message }); } }
    }
    return { out };
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
    { const o = req.headers.origin, h = req.headers['x-forwarded-host'] || req.headers.host; let same = false; try { same = !!o && new URL(o).host === h; } catch { /* origem inválida */ } if (o !== process.env.APP_ORIGIN && !same) return sock.close(); }
    const mine = new Set(); track(req.user.sub, sock); connect(req.user.sub); loadStatus(req.user.sub);
    sock.on('message', async raw => { try { const m = JSON.parse(raw); if (m.join && room.safeParse(m.join).success && await allowed(req.user, m.join)) { if (!rooms.has(m.join)) rooms.set(m.join, new Set()); rooms.get(m.join).add(sock); mine.add(m.join); } } catch {} });
    sock.on('close', () => { disconnect(req.user.sub); mine.forEach(k => rooms.get(k)?.delete(sock)); });
  });
}
