import { z } from 'zod';
import { q, pool } from '../db.js';
import { audit } from '../audit.js';
import { HEALTH } from '../roles.js';
import { statusOf } from '../presence.js';
import { notify } from '../followup.js';
import { chatDocs } from '../services/ai.js';
import { normTerms, parsePlanJson, PLAN_SYSTEM, MAX_FILES, MAX_FILE_BYTES, fileKind, canAdminTeam, proposalOpen } from '../teamLogic.js';
const uuid = z.string().uuid();
const money = n => Number(n);
const memberOf = async uid => (await q('select tm.*,t.name team_name,t.active team_active from team_members tm join teams t on t.id=tm.team_id where tm.user_id=$1', [uid]))[0] || null;
const roleIn = async (uid, teamId) => (await q('select role from team_members where team_id=$1 and user_id=$2', [teamId, uid]))[0] || null;
// Administra a equipe: admin geral do sistema ou administrador daquela equipe.
async function adminGuard(req, rep, teamId) { const m = await roleIn(req.user.sub, teamId); if (!canAdminTeam(req.user, m)) { rep.code(403).send({ error: 'Somente o administrador da equipe pode fazer isto' }); return false; } return true; }
const teamAdmins = async (teamId, except = []) => (await q(`select user_id from team_members where team_id=$1 and role='admin' and user_id<>all($2::uuid[])`, [teamId, except])).map(r => r.user_id);
// Lê um formulário multipart: campo "data" (JSON) + até 3 arquivos (PDF/TXT/MD/CSV, 4 MB cada).
async function readForm(req) {
  const files = []; let data = {};
  for await (const p of req.parts({ limits: { files: MAX_FILES, fileSize: MAX_FILE_BYTES } })) {
    if (p.type === 'field') { if (p.fieldname === 'data') { try { data = JSON.parse(p.value); } catch { data = {}; } } continue; }
    const buf = await p.toBuffer(); if (p.file.truncated) throw Object.assign(new Error('Cada arquivo pode ter no máximo 4 MB'), { statusCode: 413 });
    const kind = fileKind(p.filename, p.mimetype); if (!kind) throw Object.assign(new Error('Use arquivos PDF ou de texto (.txt, .md, .csv)'), { statusCode: 400 });
    files.push({ name: String(p.filename || 'arquivo').slice(0, 120), mime: kind === 'pdf' ? 'application/pdf' : 'text/plain', kind, buf });
  }
  return { data, files };
}
const orNull = v => { const n = Number(String(v ?? '').replace(',', '.')); return v === null || v === undefined || v === '' || !Number.isFinite(n) ? null : n; };
// A IA lê o prompt + PDFs/textos do plano de negócios e sugere os termos; o administrador revisa antes de enviar.
async function analyze(prompt, files) {
  const texts = files.filter(f => f.kind === 'text').map(f => `--- ${f.name} ---\n${f.buf.toString('utf8').slice(0, 30000)}`);
  const pdfs = files.filter(f => f.kind === 'pdf').map(f => ({ mime: f.mime, buf: f.buf }));
  if (!prompt.trim() && !files.length) return { ai: false, error: 'Escreva o prompt do plano ou anexe um PDF/texto.' };
  const user = `Instruções do administrador (apenas contexto):\n${prompt.slice(0, 6000) || '(nenhuma)'}\n\n${texts.join('\n\n')}\n\nExtraia as condições em JSON.`;
  try {
    const { out, provider } = await chatDocs(PLAN_SYSTEM, user, pdfs, { max: 1200 }), o = parsePlanJson(out);
    if (!o) return { ai: false, error: 'A IA não devolveu termos legíveis. Preencha manualmente.', provider };
    const cur = String(o.currency || '').toUpperCase();
    return { ai: true, provider, terms: { fee: orNull(o.fee), team_pct: orNull(o.team_pct), model: o.model === 'por_paciente' ? 'por_paciente' : 'por_chamada', currency: ['BRL', 'USD', 'EUR', 'PYG'].includes(cur) ? cur : 'BRL', conditions: String(o.conditions || '').slice(0, 4000), summary: String(o.summary || '').slice(0, 1500) } };
  } catch (e) { return { ai: false, error: pdfs.length ? 'IA indisponível ou sem leitura de PDF (configure GEMINI_API_KEY ou ANTHROPIC_API_KEY). Preencha manualmente.' : 'IA indisponível no momento. Preencha manualmente.' }; }
}
export default async function (app) {
  const A = { preHandler: app.auth }, ADM = { preHandler: app.role('admin') }, PRO = { preHandler: app.role(...HEALTH) };
  // ---- equipes ----
  app.get('/api/teams/mine', A, async req => {
    const m = await memberOf(req.user.sub);
    if (!m) return { team: null, isAdmin: req.user.role === 'admin' };
    const members = await q(`select u.id,u.name,u.role,u.cargo,tm.role trole from team_members tm join users u on u.id=tm.user_id where tm.team_id=$1 and u.active order by tm.role,u.name`, [m.team_id]);
    return { team: { id: m.team_id, name: m.team_name, active: m.team_active }, role: m.role, isAdmin: m.role === 'admin' || req.user.role === 'admin', terms: m.terms, joinedAt: m.joined_at, members: members.map(x => ({ id: x.id, name: x.name, role: x.role, cargo: x.cargo, teamRole: x.trole, online: statusOf(x.id) === 'online' })) };
  });
  app.get('/api/teams', ADM, async () => q(`select t.id,t.name,t.description,t.active,(select count(*)::int from team_members where team_id=t.id) members,(select coalesce(string_agg(u.name,', '),'') from team_members tm join users u on u.id=tm.user_id where tm.team_id=t.id and tm.role='admin') admins from teams t order by t.name`));
  app.post('/api/teams', ADM, async (req, rep) => {
    const b = z.object({ name: z.string().trim().min(2).max(80), description: z.string().trim().max(500).optional(), adminId: uuid.optional() }).parse(req.body);
    if ((await q('select 1 from teams where lower(name)=lower($1)', [b.name])).length) return rep.code(409).send({ error: 'Já existe uma equipe com este nome' });
    if (b.adminId) { const [u] = await q('select role,active from users where id=$1', [b.adminId]); if (!u || !u.active || !HEALTH.includes(u.role)) return rep.code(400).send({ error: 'O administrador da equipe deve ser um profissional de saúde ativo' }); if (await memberOf(b.adminId)) return rep.code(409).send({ error: 'Este profissional já pertence a outra equipe' }); }
    const [t] = await q('insert into teams(name,description,created_by) values($1,$2,$3) returning id,name', [b.name, b.description || null, req.user.sub]);
    if (b.adminId) await q(`insert into team_members(team_id,user_id,role) values($1,$2,'admin')`, [t.id, b.adminId]);
    await audit(req, 'equipe_criada', 'team', t.id); return t;
  });
  app.patch('/api/teams/:id', A, async (req, rep) => {
    const id = uuid.parse(req.params.id); if (!(await adminGuard(req, rep, id))) return;
    const b = z.object({ name: z.string().trim().min(2).max(80).optional(), description: z.string().trim().max(500).optional(), active: z.boolean().optional() }).parse(req.body);
    if (b.active !== undefined && req.user.role !== 'admin') return rep.code(403).send({ error: 'Somente o administrador geral ativa ou desativa equipes' });
    await q('update teams set name=coalesce($2,name),description=coalesce($3,description),active=coalesce($4,active) where id=$1', [id, b.name || null, b.description ?? null, b.active ?? null]); await audit(req, 'equipe_editada', 'team', id); return { ok: true };
  });
  app.get('/api/teams/:id/candidates', A, async (req, rep) => {
    const id = uuid.parse(req.params.id); if (!(await adminGuard(req, rep, id))) return;
    const rows = await q(`select u.id,u.name,u.role,u.cargo,tm.team_id from users u left join team_members tm on tm.user_id=u.id where u.active and not u.pending and u.role=any($1) and (tm.user_id is null or tm.team_id=$2) order by u.name`, [HEALTH, id]);
    return rows.map(r => ({ id: r.id, name: r.name, role: r.role, cargo: r.cargo, member: !!r.team_id, online: statusOf(r.id) === 'online' }));
  });
  app.put('/api/teams/:id/members/:uid', A, async (req, rep) => {
    const id = uuid.parse(req.params.id), uid = uuid.parse(req.params.uid), b = z.object({ role: z.enum(['admin', 'membro']) }).parse(req.body);
    if (!(await adminGuard(req, rep, id))) return;
    const cur = await roleIn(uid, id);
    if (!cur) { // só o admin geral inclui direto; a equipe integra profissionais por proposta
      if (req.user.role !== 'admin') return rep.code(403).send({ error: 'Para integrar um profissional, envie uma proposta' });
      const [u] = await q('select role,active from users where id=$1', [uid]); if (!u || !u.active || !HEALTH.includes(u.role)) return rep.code(400).send({ error: 'Somente profissionais de saúde ativos' });
      if (await memberOf(uid)) return rep.code(409).send({ error: 'Este profissional já pertence a uma equipe' });
      await q('insert into team_members(team_id,user_id,role) values($1,$2,$3)', [id, uid, b.role]);
    } else {
      if (cur.role === 'admin' && b.role === 'membro' && (await teamAdmins(id)).length <= 1) return rep.code(409).send({ error: 'A equipe precisa de pelo menos um administrador' });
      await q('update team_members set role=$3 where team_id=$1 and user_id=$2', [id, uid, b.role]);
    }
    await audit(req, 'equipe_membro', 'team', id, { uid, role: b.role }); return { ok: true };
  });
  app.delete('/api/teams/:id/members/:uid', A, async (req, rep) => {
    const id = uuid.parse(req.params.id), uid = uuid.parse(req.params.uid), self = uid === req.user.sub;
    if (!self && !(await adminGuard(req, rep, id))) return;
    const cur = await roleIn(uid, id); if (!cur) return rep.code(404).send({ error: 'Não é membro desta equipe' });
    if (cur.role === 'admin' && (await teamAdmins(id)).length <= 1) return rep.code(409).send({ error: 'A equipe precisa de pelo menos um administrador' });
    await q('delete from team_members where team_id=$1 and user_id=$2', [id, uid]); await audit(req, self ? 'equipe_saiu' : 'equipe_removeu', 'team', id, { uid });
    if (!self) await notify(uid, 'equipe_removido', 'Você saiu de uma equipe', 'Um administrador encerrou a sua integração à equipe.', null, id);
    return { ok: true };
  });
  // ---- painel do administrador: chamadas entre profissionais ligadas à equipe ----
  app.get('/api/teams/:id/calls', A, async (req, rep) => {
    const id = uuid.parse(req.params.id); if (!(await adminGuard(req, rep, id))) return;
    const rows = await q(`select r.id,r.kind,r.status,r.created_at,r.answered_at,r.by_admin,r.block_reason,r.blocked_at,a.name rn,b.name tn,ap.status astatus,bb.name blocked_by_name,
        (select name from teams where id=(select team_id from team_members where user_id=r.requester_id)) rteam,(select name from teams where id=(select team_id from team_members where user_id=r.target_id)) tteam
      from call_requests r join users a on a.id=r.requester_id join users b on b.id=r.target_id left join appointments ap on ap.id=r.appointment_id left join users bb on bb.id=r.blocked_by
      where r.kind<>'paciente' and r.created_at>now()-interval '30 days' and (r.team_id=$1 or r.requester_id in(select user_id from team_members where team_id=$1) or r.target_id in(select user_id from team_members where team_id=$1))
      order by r.created_at desc limit 100`, [id]);
    return rows.map(r => ({ id: r.id, kind: r.kind, status: r.status, at: r.created_at, requester: r.rn, target: r.tn, requesterTeam: r.rteam, targetTeam: r.tteam, byAdmin: r.by_admin, blockedBy: r.blocked_by_name, blockReason: r.block_reason,
      ongoing: r.status === 'pendente' || (r.status === 'aceita' && r.astatus === 'em_atendimento' && r.answered_at && Date.now() - new Date(r.answered_at) < 4 * 3600e3) }));
  });
  // ---- propostas de integração ----
  app.post('/api/teams/:id/proposals/analyze', { preHandler: app.auth, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, rep) => {
    const id = uuid.parse(req.params.id); if (!(await adminGuard(req, rep, id))) return;
    const { data, files } = await readForm(req); return analyze(String(data.prompt || ''), files);
  });
  app.post('/api/teams/:id/proposals', A, async (req, rep) => {
    const id = uuid.parse(req.params.id); if (!(await adminGuard(req, rep, id))) return;
    const [team] = await q('select name,active from teams where id=$1', [id]); if (!team || !team.active) return rep.code(404).send({ error: 'Equipe não encontrada ou inativa' });
    const { data, files } = await readForm(req), pid = uuid.safeParse(data.professionalId); if (!pid.success) return rep.code(400).send({ error: 'Escolha o profissional' });
    const n = normTerms(data.terms || {}); if (!n.ok) return rep.code(400).send({ error: n.error });
    const [pro] = await q('select id,name,role,active from users where id=$1', [pid.data]);
    if (!pro || !pro.active || !HEALTH.includes(pro.role)) return rep.code(400).send({ error: 'A proposta é para um profissional de saúde ativo' });
    const m = await memberOf(pro.id); if (m && m.team_id !== id) return rep.code(409).send({ error: 'Este profissional já pertence a outra equipe' });
    if ((await q(`select 1 from team_proposals where team_id=$1 and professional_id=$2 and status='enviada' and expires_at>now()`, [id, pro.id])).length) return rep.code(409).send({ error: 'Já existe uma proposta aguardando resposta deste profissional' });
    const t = n.terms, c = await pool.connect();
    try {
      await c.query('begin');
      const { rows: [p] } = await c.query(`insert into team_proposals(team_id,professional_id,created_by,fee,currency,team_pct,model,conditions,summary,prompt,ai_provider) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id`, [id, pro.id, req.user.sub, t.fee, t.currency, t.team_pct, t.model, t.conditions || null, t.summary || null, String(data.prompt || '').slice(0, 6000) || null, data.provider ? String(data.provider).slice(0, 20) : null]);
      for (const f of files) await c.query('insert into proposal_files(proposal_id,name,mime,size,content) values($1,$2,$3,$4,$5)', [p.id, f.name, f.mime, f.buf.length, f.buf]);
      await c.query('commit');
      await notify(pro.id, 'proposta_equipe', `Proposta de integração: ${team.name}`, `${t.currency} ${t.fee.toFixed(2)} por consulta · ${t.team_pct}% para a equipe (${t.model === 'por_paciente' ? 'uma vez por paciente' : 'por chamada'}). Abra Equipes para ler as condições e responder.`, null, p.id);
      await audit(req, 'proposta_enviada', 'team', id, { pro: pro.id }); return { id: p.id };
    } catch (e) { await c.query('rollback').catch(() => {}); throw e; } finally { c.release(); }
  });
  const pview = r => ({ id: r.id, teamId: r.team_id, team: r.team_name, professionalId: r.professional_id, professional: r.pro_name, status: r.status === 'enviada' && new Date(r.expires_at) <= new Date() ? 'expirada' : r.status, fee: money(r.fee), currency: r.currency, teamPct: money(r.team_pct), model: r.model, conditions: r.conditions, summary: r.summary, declineReason: r.decline_reason, at: r.created_at, answeredAt: r.answered_at, expiresAt: r.expires_at, files: r.files || [] });
  const FILES = `(select coalesce(json_agg(json_build_object('id',f.id,'name',f.name,'size',f.size)),'[]'::json) from proposal_files f where f.proposal_id=p.id) files`;
  app.get('/api/teams/:id/proposals', A, async (req, rep) => {
    const id = uuid.parse(req.params.id); if (!(await adminGuard(req, rep, id))) return;
    return (await q(`select p.*,t.name team_name,u.name pro_name,${FILES} from team_proposals p join teams t on t.id=p.team_id join users u on u.id=p.professional_id where p.team_id=$1 order by p.created_at desc limit 100`, [id])).map(pview);
  });
  app.get('/api/proposals/mine', PRO, async req => (await q(`select p.*,t.name team_name,u.name pro_name,${FILES} from team_proposals p join teams t on t.id=p.team_id join users u on u.id=p.professional_id where p.professional_id=$1 order by p.created_at desc limit 50`, [req.user.sub])).map(pview));
  app.get('/api/proposals/:id/files/:fid', A, async (req, rep) => {
    const id = uuid.parse(req.params.id), fid = uuid.parse(req.params.fid), [p] = await q('select team_id,professional_id from team_proposals where id=$1', [id]);
    if (!p || !(p.professional_id === req.user.sub || canAdminTeam(req.user, await roleIn(req.user.sub, p.team_id)))) return rep.code(404).send({ error: 'Arquivo não encontrado' });
    const [f] = await q('select name,mime,content from proposal_files where id=$1 and proposal_id=$2', [fid, id]); if (!f) return rep.code(404).send({ error: 'Arquivo não encontrado' });
    return rep.header('content-type', f.mime).header('content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(f.name)}`).header('x-content-type-options', 'nosniff').send(f.content);
  });
  app.post('/api/proposals/:id/accept', PRO, async (req, rep) => {
    const id = uuid.parse(req.params.id), c = await pool.connect();
    try {
      await c.query('begin');
      const { rows: [p] } = await c.query('select p.*,t.name team_name from team_proposals p join teams t on t.id=p.team_id where p.id=$1 for update of p', [id]);
      if (!p || p.professional_id !== req.user.sub) { await c.query('rollback'); return rep.code(404).send({ error: 'Proposta não encontrada' }); }
      if (!proposalOpen(p)) { await c.query('rollback'); return rep.code(409).send({ error: 'Esta proposta não está mais aberta' }); }
      const { rows: [m] } = await c.query('select team_id from team_members where user_id=$1', [req.user.sub]);
      if (m && m.team_id !== p.team_id) { await c.query('rollback'); return rep.code(409).send({ error: 'Você já faz parte de outra equipe. Saia dela antes de aceitar.' }); }
      const terms = { fee: money(p.fee), team_pct: money(p.team_pct), model: p.model, currency: p.currency, conditions: p.conditions, summary: p.summary, accepted_at: new Date().toISOString() };
      await c.query(`insert into team_members(team_id,user_id,role,terms,proposal_id) values($1,$2,'membro',$3,$4) on conflict (team_id,user_id) do update set terms=excluded.terms,proposal_id=excluded.proposal_id`, [p.team_id, req.user.sub, terms, p.id]);
      await c.query(`update team_proposals set status='aceita',answered_at=now() where id=$1`, [id]);
      await c.query(`update team_proposals set status='cancelada',answered_at=now(),decline_reason='O profissional integrou outra equipe' where professional_id=$1 and status='enviada' and id<>$2`, [req.user.sub, id]);
      await c.query('commit');
      for (const a of await teamAdmins(p.team_id)) await notify(a, 'proposta_aceita', `${req.user.name} aceitou a proposta`, `Integrado(a) à equipe ${p.team_name}: ${p.currency} ${Number(p.fee).toFixed(2)} por consulta, ${money(p.team_pct)}% para a equipe.`, null, id);
      await audit(req, 'proposta_aceita', 'team', p.team_id); return { ok: true, team: p.team_name };
    } catch (e) { await c.query('rollback').catch(() => {}); throw e; } finally { c.release(); }
  });
  app.post('/api/proposals/:id/decline', PRO, async (req, rep) => {
    const id = uuid.parse(req.params.id), { reason } = z.object({ reason: z.string().trim().max(300).optional() }).parse(req.body || {});
    const [p] = await q(`update team_proposals set status='recusada',answered_at=now(),decline_reason=$3 where id=$1 and professional_id=$2 and status='enviada' returning team_id`, [id, req.user.sub, reason || null]);
    if (!p) return rep.code(404).send({ error: 'Proposta não encontrada ou já respondida' });
    for (const a of await teamAdmins(p.team_id)) await notify(a, 'proposta_recusada', `${req.user.name} recusou a proposta`, reason || 'Sem justificativa.', null, id);
    await audit(req, 'proposta_recusada', 'team', p.team_id); return { ok: true };
  });
  app.post('/api/proposals/:id/cancel', A, async (req, rep) => {
    const id = uuid.parse(req.params.id), [p] = await q('select team_id,professional_id,status from team_proposals where id=$1', [id]);
    if (!p) return rep.code(404).send({ error: 'Proposta não encontrada' }); if (!(await adminGuard(req, rep, p.team_id))) return;
    if (p.status !== 'enviada') return rep.code(409).send({ error: 'Só propostas aguardando resposta podem ser canceladas' });
    await q(`update team_proposals set status='cancelada',answered_at=now() where id=$1`, [id]); await audit(req, 'proposta_cancelada', 'team', p.team_id); return { ok: true };
  });
  // ---- repasses ----
  const sview = r => ({ id: r.call_id, at: r.created_at, professional: r.pro_name, patient: r.patient_name, currency: r.currency, fee: money(r.fee), teamPct: money(r.team_pct), teamAmount: money(r.team_amount), proAmount: money(r.pro_amount), status: r.status, model: r.model });
  app.get('/api/teams/:id/settlements', A, async (req, rep) => {
    const id = uuid.parse(req.params.id); if (!(await adminGuard(req, rep, id))) return;
    const rows = await q(`select s.*,u.name pro_name,p.name patient_name from call_settlements s join users u on u.id=s.professional_id left join users p on p.id=s.patient_id where s.team_id=$1 order by s.created_at desc limit 200`, [id]);
    const tot = {}; for (const r of rows.filter(x => x.status !== 'anulado')) { const t = tot[r.currency] ||= { team: 0, pro: 0 }; t.team += money(r.team_amount); t.pro += money(r.pro_amount); }
    return { items: rows.map(sview), totals: tot };
  });
  app.get('/api/settlements/mine', PRO, async req => {
    const rows = await q(`select s.*,t.name pro_name,p.name patient_name from call_settlements s join teams t on t.id=s.team_id left join users p on p.id=s.patient_id where s.professional_id=$1 order by s.created_at desc limit 200`, [req.user.sub]);
    return rows.map(r => ({ ...sview(r), team: r.pro_name }));
  });
  app.post('/api/settlements/:id/status', A, async (req, rep) => {
    const id = uuid.parse(req.params.id), { status } = z.object({ status: z.enum(['pago', 'pendente']) }).parse(req.body), [s] = await q('select team_id,status from call_settlements where call_id=$1', [id]);
    if (!s) return rep.code(404).send({ error: 'Repasse não encontrado' }); if (!(await adminGuard(req, rep, s.team_id))) return;
    if (s.status === 'anulado') return rep.code(409).send({ error: 'Repasse anulado (chamada bloqueada)' });
    await q('update call_settlements set status=$2 where call_id=$1', [id, status]); return { ok: true };
  });
}
