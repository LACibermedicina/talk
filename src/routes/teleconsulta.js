import { z } from 'zod';
import { readdirSync, createReadStream, existsSync } from 'node:fs';
import { q, pool } from '../db.js';
import { audit } from '../audit.js';
import { HEALTH } from '../roles.js';
import { statusOf, touch, pushTo } from '../presence.js';
import { randomUUID } from 'node:crypto';
import { NODES, canContact, urgencyOpen } from '../contactLogic.js';
import { loadRules } from './contatos.js';
import { notify } from '../followup.js';
import { proPair, classify, settlementFor } from '../teamLogic.js';
import { CALL_WINDOW_MIN, RING_SECONDS, pairOk, declineText, callInfo, apptStatusFor, NO_ANSWER } from '../callLogic.js';
const uuid = z.string().uuid();
const W = `${CALL_WINDOW_MIN} minutes`;
// Disponível = estado "online" (não trocou para ocupado/offline) + sem consulta na agenda na janela da chamada + sem outra chamada tocando.
const teamOf = async id => ((await q('select team_id from team_members where user_id=$1', [id]))[0] || {}).team_id || null;
async function available(u) {
  const rules = await loadRules(), roles = NODES.filter(n => canContact(rules, 'video', u.role, n)); if (!roles.length) return [];
  const mine = HEALTH.includes(u.role), me = mine ? await teamOf(u.sub) : null;
  const rows = (await q(`select x.id,x.name,x.role,x.cargo,tm.team_id,t.name team_name from users x left join team_members tm on tm.user_id=x.id left join teams t on t.id=tm.team_id where x.active and not x.pending and x.id<>$2 and x.role=any($1) and (x.role<>'paciente' or $3::boolean or x.id in (select patient_id from care_team where professional_id=$2)) order by x.name`, [roles, u.sub, !mine]))
    .map(r => ({ id: r.id, name: r.name, role: r.role, cargo: r.cargo, grp: r.role === 'paciente' ? 'paciente' : mine && HEALTH.includes(r.role) ? (me && r.team_id === me ? 'equipe' : 'externo') : 'staff', team: r.team_name || null }));
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
    const { rows: [r] } = await c.query(`select r.*,a.name rn,a.role rrole,b.name tn,b.role trole from call_requests r join users a on a.id=r.requester_id join users b on b.id=r.target_id where r.id=$1 for update of r`, [id]);
    if (!r || r.status !== 'pendente') { await c.query('rollback'); return null; }
    const pp = r.kind && r.kind !== 'paciente'; // entre profissionais: quem chama ocupa o lugar de "paciente" só para reaproveitar a sala de vídeo
    const pat = pp || r.rrole === 'paciente' ? r.requester_id : r.target_id, pro = pp || r.rrole === 'paciente' ? r.target_id : r.requester_id;
    const info = callInfo(status, { requester: r.rn, target: r.tn, reason: r.reason, justification, at: r.created_at });
    const { rows: [a] } = await c.query(`insert into appointments(patient_id,professional_id,starts_at,ends_at,status,call_id,call_info) values($1,$2,$3,$4,$5,$6,$7) returning id`, [pat, pro, r.created_at, new Date(new Date(r.created_at).getTime() + CALL_WINDOW_MIN * 60000), apptStatusFor(status), id, info]);
    await c.query('update call_requests set status=$2,decline_reason=$3,answered_at=now(),appointment_id=$4 where id=$1', [id, status, justification || null, a.id]);
    if (status === 'aceita' && !pp && HEALTH.includes(r.rrole === 'paciente' ? r.trole : r.rrole)) {
      await c.query('insert into care_team values($1,$2) on conflict do nothing', [pat, pro]);
      // Repasse da equipe: só quando o profissional integrou uma equipe por proposta aceita (termos congelados).
      const { rows: [m] } = await c.query('select team_id,terms from team_members where user_id=$1 and terms is not null', [pro]);
      if (m) {
        const { rows: [prev] } = await c.query(`select 1 from call_settlements where professional_id=$1 and patient_id=$2 and status<>'anulado' limit 1`, [pro, pat]);
        const sf = settlementFor(m.terms, { firstWithPatient: !prev });
        if (sf) await c.query('insert into call_settlements(call_id,team_id,professional_id,patient_id,model,currency,fee,team_pct,team_amount,pro_amount) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) on conflict do nothing', [id, m.team_id, pro, pat, m.terms.model, m.terms.currency || 'BRL', sf.fee, sf.pct, sf.team, sf.pro]);
      }
    }
    await c.query('commit'); return { ...r, status, appointment_id: a.id, decline_reason: justification || null, by };
  } catch (e) { await c.query('rollback').catch(() => {}); throw e; } finally { c.release(); }
}
// Chamada de urgência vai a vários profissionais de uma vez: só UM registro de agenda por tentativa (o atendido, ou o último desfecho sem atendimento).
async function finish(id, status, text, by) {
  const [r] = await q('select urgent,urgent_group from call_requests where id=$1', [id]); if (!r || !r.urgent) return settle(id, status, text, by);
  const [o] = await q(`select count(*)::int n, count(appointment_id)::int ap from call_requests where urgent_group=$1 and id<>$2 and ((status='pendente' and expires_at>now()) or status='aceita' or appointment_id is not null)`, [r.urgent_group, id]);
  if (!o.n && !o.ap) return settle(id, status, text, by);
  const u = await q(`update call_requests set status=$2,decline_reason=$3,answered_at=now() where id=$1 and status='pendente' returning id`, [id, status, text || null]); return u.length ? { plain: true } : null;
}
const expireOld = async () => { for (const r of await q(`select id,requester_id from call_requests where status='pendente' and expires_at<=now()`)) { await finish(r.id, 'sem_resposta', NO_ANSWER); pushTo([r.requester_id], { ev: 'call' }); } };
// Urgência: todo profissional de saúde online que não indicou o contrário (nunca / só em períodos) e que a regra de contatos permita.
async function urgentCandidates(u) {
  const rules = await loadRules();
  const rows = await q(`select id,name,role,cargo,urgency_mode,urgency_periods from users where active and not pending and role=any($1) and id<>$2 and id not in (select target_id from call_requests where status='pendente' and expires_at>now())`, [HEALTH, u.sub]);
  return rows.filter(r => canContact(rules, 'video', u.role, r.role) && statusOf(r.id) === 'online' && urgencyOpen(r.urgency_mode, r.urgency_periods)).sort((a, b) => (a.role === 'medico' ? 0 : 1) - (b.role === 'medico' ? 0 : 1) || a.name.localeCompare(b.name)).slice(0, 15);
}
const view = r => ({ id: r.id, status: r.status, reason: r.reason, declineReason: r.decline_reason, appointmentId: r.appointment_id, at: r.created_at, expiresAt: r.expires_at });
// SDK de vídeo: se o passo de instalação (postinstall) não copiou para public/vendor, serve direto do node_modules.
const sdkPath = () => { const d = new URL('../../node_modules/agora-rtc-sdk-ng/', import.meta.url).pathname; if (!existsSync(d)) return null; const f = readdirSync(d).find(x => /^AgoraRTC_N.*\.js$/.test(x)); return f ? d + f : null; };
export default async function (app) {
  const A = { preHandler: app.auth };
  // Só registra se o arquivo não existir em public/: o @fastify/static (wildcard:false) já cria a rota de cada arquivo e uma rota repetida derruba o servidor na partida.
  if (!existsSync(new URL('../../public/vendor/agora.js', import.meta.url).pathname)) app.get('/vendor/agora.js', async (req, rep) => { const f = sdkPath(); if (!f) return rep.code(404).type('text/plain').send('SDK de vídeo ausente: execute npm install no servidor'); return rep.type('application/javascript').header('cache-control', 'public, max-age=86400').send(createReadStream(f)); });
  app.get('/api/calls/available', A, async req => { if (req.user.role !== 'paciente' && !HEALTH.includes(req.user.role)) return []; return available(req.user); });
  app.post('/api/calls', A, async (req, rep) => {
    const b = z.object({ targetId: uuid, reason: z.string().trim().max(200).optional() }).parse(req.body), u = req.user;
    const [t] = await q('select id,name,role from users where id=$1 and active and not pending', [b.targetId]);
    if (!t || !canContact(await loadRules(), 'video', u.role, t.role)) return rep.code(403).send({ error: 'Chamada não permitida para este usuário' });
    await expireOld();
    if ((await q(`select 1 from call_requests where requester_id=$1 and status='pendente' and expires_at>now()`, [u.sub])).length) return rep.code(409).send({ error: 'Você já tem uma chamada em andamento' });
    if (!(await available(u)).some(x => x.id === t.id)) return rep.code(409).send({ error: 'Este usuário não está disponível agora' });
    const pp = proPair(u.role, t.role), rt = pp ? await teamOf(u.sub) : null, tt = pp ? await teamOf(t.id) : null, k = pp ? classify(rt, tt) : t.role === 'paciente' || u.role === 'paciente' ? { kind: 'paciente', team: null, teams: [] } : { kind: 'livre', team: null, teams: [] };
    const byAdmin = pp && !!rt && !!(await q(`select 1 from team_members where user_id=$1 and role='admin'`, [u.sub])).length;
    const [r] = await q(`insert into call_requests(requester_id,target_id,reason,kind,team_id,by_admin,expires_at) values($1,$2,$3,$4,$5,$6,now()+interval '${RING_SECONDS} seconds') returning *`, [u.sub, t.id, b.reason || null, k.kind, k.team, byAdmin]);
    // Administradores das equipes envolvidas são avisados (sem impedir a chamada); podem bloqueá-la a qualquer momento.
    for (const tm of k.teams) for (const a of (await q(`select user_id from team_members where team_id=$1 and role='admin' and user_id<>all($2::uuid[])`, [tm, [u.sub, t.id]]))) await notify(a.user_id, 'chamada_equipe', `Chamada ${k.kind === 'interna' ? 'interna' : 'externa'}: ${u.name || 'profissional'} → ${t.name}`, `Você pode acompanhar e bloquear em Equipes. ${b.reason ? 'Motivo: ' + b.reason : ''}`.trim(), null, r.id);
    await audit(req, 'chamada_solicitada', 'user', t.id, { de: u.role, para: t.role }); pushTo([t.id], { ev: 'call' }); return view(r);
  });
  // Batimento: marca presença, expira chamadas sem resposta e devolve o que mudou (recebidas e enviadas).
  app.get('/api/calls/poll', A, async req => {
    touch(req.user.sub); await expireOld();
    const incoming = await q(`select r.id,r.reason,r.kind,r.created_at,r.expires_at,r.urgent,u.name,u.role,u.cargo,(select t.name from team_members m join teams t on t.id=m.team_id where m.user_id=r.requester_id) team from call_requests r join users u on u.id=r.requester_id where r.target_id=$1 and r.status='pendente' and r.expires_at>now() order by r.created_at`, [req.user.sub]);
    const [out] = await q(`select r.*,u.name target_name from call_requests r join users u on u.id=r.target_id where r.requester_id=$1 and r.created_at>now()-interval '10 minutes' order by (r.status='aceita') desc,(r.status='pendente') desc,r.created_at desc limit 1`, [req.user.sub]);
    const bl = await q(`select r.id,r.block_reason,r.appointment_id,u.name from call_requests r left join users u on u.id=r.blocked_by where r.status='bloqueada' and r.blocked_at>now()-interval '3 minutes' and (r.requester_id=$1 or r.target_id=$1) order by r.blocked_at desc limit 1`, [req.user.sub]);
    const blocked = bl[0] ? { id: bl[0].id, by: bl[0].name, reason: bl[0].block_reason, appointmentId: bl[0].appointment_id } : null;
    return { incoming: incoming.map(r => ({ id: r.id, from: r.name, cargo: r.cargo, role: r.role, reason: r.reason, kind: r.kind, team: r.team, urgent: r.urgent, expiresAt: r.expires_at })), blocked, outgoing: out ? { ...view(out), urgent: out.urgent, target: out.urgent && out.status === 'pendente' ? 'um profissional disponível (urgência)' : out.target_name } : null };
  });
  app.get('/api/calls/urgent', A, async req => { const l = await urgentCandidates(req.user); return { count: l.length, pros: l.map(x => ({ id: x.id, name: x.name, role: x.role, cargo: x.cargo })) }; });
  app.post('/api/calls/urgent', A, async (req, rep) => {
    const b = z.object({ reason: z.string().trim().max(200).optional() }).parse(req.body || {}), u = req.user; await expireOld();
    if ((await q(`select 1 from call_requests where requester_id=$1 and status='pendente' and expires_at>now()`, [u.sub])).length) return rep.code(409).send({ error: 'Você já tem uma chamada em andamento' });
    const l = await urgentCandidates(u); if (!l.length) return rep.code(409).send({ error: 'Nenhum profissional disponível para urgência agora. Tente agendar uma consulta.' });
    const g = randomUUID(), reason = ('URGÊNCIA' + (b.reason ? ': ' + b.reason : '')).slice(0, 200), kind = u.role === 'paciente' ? 'paciente' : 'livre';
    for (const t of l) await q(`insert into call_requests(requester_id,target_id,reason,kind,urgent,urgent_group,expires_at) values($1,$2,$3,$4,true,$5,now()+interval '${RING_SECONDS} seconds')`, [u.sub, t.id, reason, kind, g]);
    await audit(req, 'urgencia_solicitada', 'user', u.sub, { profissionais: l.length, grupo: g }); pushTo(l.map(x => x.id), { ev: 'call', urgent: true }); return { ok: true, count: l.length };
  });
  app.post('/api/calls/:id/accept', A, async (req, rep) => {
    const id = uuid.parse(req.params.id), [r] = await q('select * from call_requests where id=$1', [id]);
    if (!r || r.target_id !== req.user.sub) return rep.code(404).send({ error: 'Chamada não encontrada' });
    if (r.status !== 'pendente' || new Date(r.expires_at) <= new Date()) return rep.code(409).send({ error: 'Esta chamada já terminou' });
    const s = await settle(id, 'aceita', null, req.user.sub); if (!s) return rep.code(409).send({ error: 'Esta chamada já terminou' });
    if (r.urgent_group) await q(`update call_requests set status='cancelada',answered_at=now(),decline_reason='Chamada de urgência atendida por outro profissional.' where urgent_group=$1 and id<>$2 and status='pendente'`, [r.urgent_group, id]);
    await audit(req, 'chamada_aceita', 'appointment', s.appointment_id); pushTo([r.requester_id], { ev: 'call' }); return { appointmentId: s.appointment_id };
  });
  app.post('/api/calls/:id/decline', A, async (req, rep) => {
    const id = uuid.parse(req.params.id), { message } = z.object({ message: z.string().max(300).optional() }).parse(req.body || {}), [r] = await q('select * from call_requests where id=$1', [id]);
    if (!r || r.target_id !== req.user.sub) return rep.code(404).send({ error: 'Chamada não encontrada' });
    const [me] = await q('select decline_msg from users where id=$1', [req.user.sub]), text = declineText(message, me && me.decline_msg);
    const s = await finish(id, 'recusada', text, req.user.sub); if (!s) return rep.code(409).send({ error: 'Esta chamada já terminou' });
    await audit(req, 'chamada_recusada', 'user', r.requester_id); pushTo([r.requester_id], { ev: 'call' }); return { ok: true, message: text };
  });
  app.post('/api/calls/:id/cancel', A, async (req, rep) => {
    const id = uuid.parse(req.params.id), [r] = await q('select * from call_requests where id=$1', [id]);
    if (!r || r.requester_id !== req.user.sub) return rep.code(404).send({ error: 'Chamada não encontrada' });
    const s = r.urgent_group ? (await q(`update call_requests set status='cancelada',answered_at=now(),decline_reason='Chamada cancelada por quem solicitou.' where urgent_group=$1 and status='pendente' returning id`, [r.urgent_group])).length : await settle(id, 'cancelada', 'Chamada cancelada por quem solicitou.', req.user.sub); if (!s) return rep.code(409).send({ error: 'Esta chamada já terminou' });
    await audit(req, 'chamada_cancelada', 'user', r.target_id);
    return { ok: true };
  });
  // Administrador da equipe (ou geral) bloqueia a chamada a qualquer momento: encerra a em curso e anula o repasse.
  app.post('/api/calls/:id/block', A, async (req, rep) => {
    const id = uuid.parse(req.params.id), { reason } = z.object({ reason: z.string().trim().max(300).optional() }).parse(req.body || {});
    const [r] = await q('select * from call_requests where id=$1', [id]);
    if (!r || r.kind === 'paciente') return rep.code(404).send({ error: 'Chamada não encontrada' });
    const ok = req.user.role === 'admin' || (await q(`select 1 from team_members where user_id=$1 and role='admin' and team_id=any($2::uuid[])`, [req.user.sub, [await teamOf(r.requester_id), await teamOf(r.target_id)].filter(Boolean)])).length > 0;
    if (!ok) return rep.code(403).send({ error: 'Somente o administrador da equipe pode bloquear' });
    if (!['pendente', 'aceita'].includes(r.status)) return rep.code(409).send({ error: 'Esta chamada já terminou' });
    const txt = (reason || '').trim() || 'Bloqueada pelo administrador da equipe.', c = await pool.connect();
    try {
      await c.query('begin');
      await c.query(`update call_requests set status='bloqueada',blocked_by=$2,blocked_at=now(),block_reason=$3 where id=$1`, [id, req.user.sub, txt]);
      if (r.appointment_id) await c.query(`update appointments set status='cancelado',call_info=coalesce(call_info,'')||$2 where id=$1`, [r.appointment_id, ' Chamada bloqueada pelo administrador da equipe: ' + txt]);
      await c.query(`update call_settlements set status='anulado' where call_id=$1`, [id]);
      await c.query('commit');
    } catch (e) { await c.query('rollback').catch(() => {}); throw e; } finally { c.release(); }
    for (const uid of [r.requester_id, r.target_id]) await notify(uid, 'chamada_bloqueada', 'Chamada encerrada pelo administrador da equipe', txt, null, id);
    await audit(req, 'chamada_bloqueada', 'user', r.target_id); return { ok: true };
  });
  // Mensagem de recusa pré-configurada (usada quando o profissional recusa sem escrever outra).
  app.put('/api/me/decline-msg', { preHandler: app.role(...HEALTH) }, async req => { const { message } = z.object({ message: z.string().trim().max(300) }).parse(req.body); await q('update users set decline_msg=$2 where id=$1', [req.user.sub, message || null]); return { ok: true }; });
}
