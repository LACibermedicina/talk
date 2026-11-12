import { z } from 'zod';
import { readdirSync, createReadStream, existsSync } from 'node:fs';
import { q, pool } from '../db.js';
import { audit } from '../audit.js';
import { HEALTH } from '../roles.js';
import { statusOf, touch } from '../presence.js';
import { CALL_WINDOW_MIN, RING_SECONDS, pairOk, declineText, callInfo, apptStatusFor, NO_ANSWER } from '../callLogic.js';
const uuid = z.string().uuid();
const W = `${CALL_WINDOW_MIN} minutes`;
// Disponível = estado "online" (não trocou para ocupado/offline) + sem consulta na agenda na janela da chamada + sem outra chamada tocando.
async function available(u) {
  const rows = u.role === 'paciente'
    ? await q(`select id,name,role,cargo from users where active and not pending and role=any($1) and id<>$2 order by name`, [HEALTH, u.sub])
    : await q(`select x.id,x.name,x.role,x.cargo from users x join care_team c on c.patient_id=x.id where c.professional_id=$1 and x.active and not x.pending and x.role='paciente' order by x.name`, [u.sub]);
  const on = rows.filter(r => statusOf(r.id) === 'online'); if (!on.length) return [];
  const ids = on.map(r => r.id);
  const busy = new Set([
    ...(await q(`select patient_id a,professional_id b from appointments where status not in('cancelado','faltou','finalizado') and tstzrange(starts_at,ends_at)&&tstzrange(now(),now()+interval '${W}') and (patient_id=any($1) or professional_id=any($1))`, [ids])).flatMap(r => [r.a, r.b]),
    ...(await q(`select target_id from call_requests where status='pendente' and expires_at>now() and target_id=any($1)`, [ids])).map(r => r.target_id)]);
  return on.filter(r => !busy.has(r.id));
}
// Grava a tentativa e o desfecho como item de agenda dos dois lados (consulta com call_info) e fecha a solicitação, uma única vez.
async function settle(id, status, justification, by) {
  const c = await pool.connect();
  try {
    await c.query('begin');
    const { rows: [r] } = await c.query(`select r.*,a.name rn,a.role rrole,b.name tn from call_requests r join users a on a.id=r.requester_id join users b on b.id=r.target_id where r.id=$1 for update of r`, [id]);
    if (!r || r.status !== 'pendente') { await c.query('rollback'); return null; }
    const pat = r.rrole === 'paciente' ? r.requester_id : r.target_id, pro = r.rrole === 'paciente' ? r.target_id : r.requester_id;
    const info = callInfo(status, { requester: r.rn, target: r.tn, reason: r.reason, justification, at: r.created_at });
    const { rows: [a] } = await c.query(`insert into appointments(patient_id,professional_id,starts_at,ends_at,status,call_id,call_info) values($1,$2,$3,$4,$5,$6,$7) returning id`, [pat, pro, r.created_at, new Date(new Date(r.created_at).getTime() + CALL_WINDOW_MIN * 60000), apptStatusFor(status), id, info]);
    await c.query('update call_requests set status=$2,decline_reason=$3,answered_at=now(),appointment_id=$4 where id=$1', [id, status, justification || null, a.id]);
    if (status === 'aceita') await c.query('insert into care_team values($1,$2) on conflict do nothing', [pat, pro]);
    await c.query('commit'); return { ...r, status, appointment_id: a.id, decline_reason: justification || null, by };
  } catch (e) { await c.query('rollback').catch(() => {}); throw e; } finally { c.release(); }
}
const expireOld = async () => { for (const r of await q(`select id from call_requests where status='pendente' and expires_at<=now()`)) await settle(r.id, 'sem_resposta', NO_ANSWER); };
const view = r => ({ id: r.id, status: r.status, reason: r.reason, declineReason: r.decline_reason, appointmentId: r.appointment_id, at: r.created_at, expiresAt: r.expires_at });
// SDK de vídeo: se o passo de instalação (postinstall) não copiou para public/vendor, serve direto do node_modules.
const sdkPath = () => { const d = new URL('../../node_modules/agora-rtc-sdk-ng/', import.meta.url).pathname; if (!existsSync(d)) return null; const f = readdirSync(d).find(x => /^AgoraRTC_N.*\.js$/.test(x)); return f ? d + f : null; };
export default async function (app) {
  const A = { preHandler: app.auth };
  app.get('/vendor/agora.js', async (req, rep) => { const f = sdkPath(); if (!f) return rep.code(404).type('text/plain').send('SDK de vídeo ausente: execute npm install no servidor'); return rep.type('application/javascript').header('cache-control', 'public, max-age=86400').send(createReadStream(f)); });
  app.get('/api/calls/available', A, async req => { if (req.user.role !== 'paciente' && !HEALTH.includes(req.user.role)) return []; return available(req.user); });
  app.post('/api/calls', A, async (req, rep) => {
    const b = z.object({ targetId: uuid, reason: z.string().trim().max(200).optional() }).parse(req.body), u = req.user;
    const [t] = await q('select id,name,role from users where id=$1 and active and not pending', [b.targetId]);
    if (!t || !pairOk(u.role, t.role)) return rep.code(403).send({ error: 'Chamada não permitida para este usuário' });
    await expireOld();
    if ((await q(`select 1 from call_requests where requester_id=$1 and status='pendente' and expires_at>now()`, [u.sub])).length) return rep.code(409).send({ error: 'Você já tem uma chamada em andamento' });
    if (!(await available(u)).some(x => x.id === t.id)) return rep.code(409).send({ error: 'Este usuário não está disponível agora' });
    const [r] = await q(`insert into call_requests(requester_id,target_id,reason,expires_at) values($1,$2,$3,now()+interval '${RING_SECONDS} seconds') returning *`, [u.sub, t.id, b.reason || null]);
    await audit(req, 'chamada_solicitada', 'user', t.id); return view(r);
  });
  // Batimento: marca presença, expira chamadas sem resposta e devolve o que mudou (recebidas e enviadas).
  app.get('/api/calls/poll', A, async req => {
    touch(req.user.sub); await expireOld();
    const incoming = await q(`select r.id,r.reason,r.created_at,r.expires_at,u.name,u.role,u.cargo from call_requests r join users u on u.id=r.requester_id where r.target_id=$1 and r.status='pendente' and r.expires_at>now() order by r.created_at`, [req.user.sub]);
    const [out] = await q(`select r.*,u.name target_name from call_requests r join users u on u.id=r.target_id where r.requester_id=$1 and r.created_at>now()-interval '10 minutes' order by r.created_at desc limit 1`, [req.user.sub]);
    return { incoming: incoming.map(r => ({ id: r.id, from: r.name, cargo: r.cargo, role: r.role, reason: r.reason, expiresAt: r.expires_at })), outgoing: out ? { ...view(out), target: out.target_name } : null };
  });
  app.post('/api/calls/:id/accept', A, async (req, rep) => {
    const id = uuid.parse(req.params.id), [r] = await q('select * from call_requests where id=$1', [id]);
    if (!r || r.target_id !== req.user.sub) return rep.code(404).send({ error: 'Chamada não encontrada' });
    if (r.status !== 'pendente' || new Date(r.expires_at) <= new Date()) return rep.code(409).send({ error: 'Esta chamada já terminou' });
    const s = await settle(id, 'aceita', null, req.user.sub); if (!s) return rep.code(409).send({ error: 'Esta chamada já terminou' });
    await audit(req, 'chamada_aceita', 'appointment', s.appointment_id); return { appointmentId: s.appointment_id };
  });
  app.post('/api/calls/:id/decline', A, async (req, rep) => {
    const id = uuid.parse(req.params.id), { message } = z.object({ message: z.string().max(300).optional() }).parse(req.body || {}), [r] = await q('select * from call_requests where id=$1', [id]);
    if (!r || r.target_id !== req.user.sub) return rep.code(404).send({ error: 'Chamada não encontrada' });
    const [me] = await q('select decline_msg from users where id=$1', [req.user.sub]), text = declineText(message, me && me.decline_msg);
    const s = await settle(id, 'recusada', text, req.user.sub); if (!s) return rep.code(409).send({ error: 'Esta chamada já terminou' });
    await audit(req, 'chamada_recusada', 'user', r.requester_id); return { ok: true, message: text };
  });
  app.post('/api/calls/:id/cancel', A, async (req, rep) => {
    const id = uuid.parse(req.params.id), [r] = await q('select * from call_requests where id=$1', [id]);
    if (!r || r.requester_id !== req.user.sub) return rep.code(404).send({ error: 'Chamada não encontrada' });
    const s = await settle(id, 'cancelada', 'Chamada cancelada por quem solicitou.', req.user.sub); if (!s) return rep.code(409).send({ error: 'Esta chamada já terminou' });
    return { ok: true };
  });
  // Mensagem de recusa pré-configurada (usada quando o profissional recusa sem escrever outra).
  app.put('/api/me/decline-msg', { preHandler: app.role(...HEALTH) }, async req => { const { message } = z.object({ message: z.string().trim().max(300) }).parse(req.body); await q('update users set decline_msg=$2 where id=$1', [req.user.sub, message || null]); return { ok: true }; });
}
