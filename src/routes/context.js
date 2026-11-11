import { z } from 'zod';
import { q } from '../db.js';
import { audit } from '../audit.js';
import { logAct } from '../activity.js';
import { CARE, HEALTH, STAFF } from '../roles.js';
const uuid = z.string().uuid(), PRO = CARE, clinical = r => HEALTH.includes(r);
export default async function (app) {
  const S = { preHandler: app.role(...STAFF) };
  // Cards resumidos de pacientes (profissional vê só os vinculados; recepção/admin não veem dado clínico)
  app.get('/api/overview', S, async req => {
    const u = req.user, rows = await q(`select p.id,p.name,
      (select eva from evolution e where e.patient_id=p.id order by e."at" desc limit 1) last_eva,
      (select eva from evolution e where e.patient_id=p.id order by e."at" asc limit 1) first_eva,
      (select target from goals g where g.patient_id=p.id and g.active limit 1) goal,
      (select coalesce(sum(freq_per_week),0) from assignments s where s.patient_id=p.id and s.active)::int esp,
      (select count(*) from task_logs t join assignments s on s.id=t.assignment_id where s.patient_id=p.id and t.done_at>now()-interval '7 days')::int feito,
      (select count(*) from appointments a where a.patient_id=p.id and a.status='agendado' and a.starts_at between now() and now()+interval '7 days')::int pend_ag,
      (select count(*) from clinical_entries c where c.patient_id=p.id and not c.approved)::int pend_cl,
      (select array_agg(x.eva order by x."at") from (select e.eva,e."at" from evolution e where e.patient_id=p.id order by e."at" desc limit 8) x) serie
      from users p where p.role='paciente' and p.active and ($2::boolean or p.id in(select patient_id from care_team where professional_id=$1)) order by p.name`, [u.sub, !PRO.includes(u.role)]);
    return rows.map(r => clinical(u.role) ? { ...r, serie: r.serie || [] } : { ...r, last_eva: null, first_eva: null, goal: null, esp: 0, feito: 0, pend_cl: 0, serie: [] });
  });
  // Plantão: triagem, equipe, atendidos x pendentes e movimentos
  app.get('/api/shift', S, async req => {
    const [days, staff, hist, triage, mov] = await Promise.all([
      q(`select starts_at::date d,count(*) filter(where status='finalizado')::int atendidos,count(*) filter(where status in('agendado','confirmado','na_recepcao','em_atendimento'))::int pendentes,count(*) filter(where status='faltou')::int faltas from appointments where starts_at>now()-interval '6 days' and starts_at<now()+interval '1 day' group by 1 order by 1`),
      q(`select u.id,u.name,u.role,count(a.id) filter(where a.starts_at::date=current_date)::int hoje,count(a.id) filter(where a.status='em_atendimento')::int agora from users u left join appointments a on a.professional_id=u.id where u.role=any($1::text[]) and u.active group by u.id order by u.name`, [HEALTH]),
      q(`select professional_id id,starts_at::date d,count(*)::int n from appointments where starts_at>now()-interval '6 days' and starts_at<now()+interval '1 day' group by 1,2`),
      q(`select distinct on (u.id) u.id,u.name,'mensagem urgente' motivo,'alta' nivel,m.created_at as "at" from messages m join users u on u.id=m.sender_id where m.urgent and u.role='paciente' and m.created_at>now()-interval '24 hours' order by u.id,m.created_at desc`),
      q(`select l.at,l.action,l.entity,l.reason,u.name usuario,p.name paciente from activity_log l left join users u on u.id=l.user_id left join users p on p.id=l.patient_id order by l.at desc limit 15`)]);
    const alerts = await q(`select p.id,p.name,a.kind motivo,a.severity nivel,a.created_at as "at" from alerts a join users p on p.id=a.patient_id where not a.ack order by a.created_at desc limit 10`);
    return { days, staff: staff.map(s => ({ ...s, hist: hist.filter(h => h.id === s.id).map(h => ({ d: h.d, n: h.n })) })), triage: [...triage, ...alerts.map(a => ({ ...a, nivel: a.nivel === 'alta' ? 'alta' : 'media' }))], movements: mov };
  });
  app.get('/api/tasks', S, req => q(`select t.id,t.title,t.status,t.channel,to_char(t.due,'YYYY-MM-DD') due,t.assignee_id,t.created_by,a.name assignee,p.name patient,t.patient_id from tasks t left join users a on a.id=t.assignee_id left join users p on p.id=t.patient_id order by t.created_at desc limit 200`));
  app.post('/api/tasks', S, async req => {
    const b = z.object({ title: z.string().min(2).max(160), channel: z.string().max(40).optional(), assigneeId: uuid.optional(), patientId: uuid.optional(), due: z.string().date().optional() }).parse(req.body);
    const [r] = await q('insert into tasks(title,channel,assignee_id,patient_id,due,created_by) values($1,$2,$3,$4,$5,$6) returning id', [b.title, b.channel || null, b.assigneeId || null, b.patientId || null, b.due || null, req.user.sub]);
    await logAct(req, 'task', r.id, 'criar', b.patientId || null, { titulo: b.title }); return r;
  });
  app.patch('/api/tasks/:id', S, async (req, rep) => {
    const id = uuid.parse(req.params.id), b = z.object({ status: z.enum(['todo', 'doing', 'done']).optional(), title: z.string().min(2).max(160).optional(), assigneeId: uuid.nullable().optional() }).parse(req.body);
    const [t] = await q('select * from tasks where id=$1', [id]); if (!t) return rep.code(404).send({ error: 'não encontrado' });
    await q('update tasks set status=$2,title=$3,assignee_id=$4 where id=$1', [id, b.status || t.status, b.title || t.title, b.assigneeId === undefined ? t.assignee_id : b.assigneeId]);
    if (b.status && b.status !== t.status) await logAct(req, 'task', id, 'status ' + b.status, t.patient_id, { titulo: t.title }); return { ok: true };
  });
  app.delete('/api/tasks/:id', S, async req => { const id = uuid.parse(req.params.id); await q('delete from tasks where id=$1', [id]); await logAct(req, 'task', id, 'excluir'); return { ok: true }; });
  // Histórico de atividades + quem está sem justificativa (admin restabelece)
  app.get('/api/activity', S, async req => {
    const u = req.user, n = z.coerce.number().int().min(1).max(300).default(100).parse(req.query.limit), all = !PRO.includes(u.role);
    const items = await q(`select l.id,l.at,l.user_id,u.name usuario,l.entity,l.action,l.patient_id,p.name paciente,l.detail,l.reason from activity_log l left join users u on u.id=l.user_id left join users p on p.id=l.patient_id where $2::boolean or l.user_id=$1 or l.patient_id in(select patient_id from care_team where professional_id=$1) order by l.at desc limit $3`, [u.sub, all, n]);
    const sem = u.role === 'admin' ? await q('select id,name from users where not ask_reason order by name') : [];
    await audit(req, 'read', 'activity'); return { items, semJustificativa: sem };
  });
  app.patch('/api/me/ask-reason', { preHandler: app.auth }, async req => { z.object({ ask: z.literal(false) }).parse(req.body); await q('update users set ask_reason=false where id=$1', [req.user.sub]); await audit(req, 'justificativa_desativada', 'user', req.user.sub); return { ok: true }; });
  app.patch('/api/users/:id/ask-reason', { preHandler: app.role('admin') }, async req => { const id = uuid.parse(req.params.id); await q('update users set ask_reason=true where id=$1', [id]); await audit(req, 'justificativa_restabelecida', 'user', id); return { ok: true }; });
  // Grafo de relações (3 níveis de complexidade)
  app.get('/api/graph', S, async req => {
    const u = req.user, lv = z.coerce.number().int().min(1).max(3).default(1).parse(req.query.level), all = !PRO.includes(u.role);
    const pats = await q(`select id,name from users where role='paciente' and active and ($2::boolean or id in(select patient_id from care_team where professional_id=$1))`, [u.sub, all]), ids = pats.map(p => p.id);
    const N = new Map(), Ed = [], add = (id, label, type, role) => N.has(id) || N.set(id, { id, label, type, role });
    pats.forEach(p => add(p.id, p.name, 'patient'));
    for (const c of await q('select c.patient_id,c.professional_id,x.name,x.role from care_team c join users x on x.id=c.professional_id where c.patient_id=any($1::uuid[])', [ids])) { add(c.professional_id, c.name, 'staff', c.role); Ed.push([c.professional_id, c.patient_id, 'equipe']); }
    if (lv >= 2) for (const a of await q(`select id,patient_id,professional_id,starts_at,status from appointments where patient_id=any($1::uuid[]) and starts_at between now()-interval '14 days' and now()+interval '14 days' order by starts_at limit 80`, [ids])) { add('a' + a.id, new Date(a.starts_at).toLocaleDateString('pt-BR') + ' ' + a.status, 'appt'); Ed.push([a.patient_id, 'a' + a.id, 'consulta']); if (N.has(a.professional_id)) Ed.push(['a' + a.id, a.professional_id, 'atende']); }
    if (lv >= 3 && clinical(u.role) || lv >= 3 && u.role === 'admin') {
      for (const t of await q('select s.patient_id,e.title from assignments s join exercises e on e.id=s.exercise_id where s.active and s.patient_id=any($1::uuid[])', [ids])) { add('t' + t.title, t.title, 'therapy'); Ed.push([t.patient_id, 't' + t.title, 'terapia']); }
      for (const d of await q('select patient_id,kind from documents where patient_id=any($1::uuid[]) group by 1,2', [ids])) { add('r' + d.kind, d.kind, 'request'); Ed.push([d.patient_id, 'r' + d.kind, 'solicitação']); }
      for (const a of await q(`select user_id,patient_id,count(*)::int n from activity_log where patient_id=any($1::uuid[]) and user_id is not null and "at">now()-interval '30 days' group by 1,2`, [ids])) if (N.has(a.user_id)) Ed.push([a.user_id, a.patient_id, 'atividade', a.n]);
    }
    await audit(req, 'read', 'graph', null, { level: lv }); return { nodes: [...N.values()], edges: Ed };
  });
}
