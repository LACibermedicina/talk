import { z } from 'zod';
import { q } from '../db.js';
import { enc, dec } from '../crypto.js';
import { audit } from '../audit.js';
import { canSee, canSeeFull } from '../access.js';
import { noshowRisk } from '../services/noshow.js';
import { logAct } from '../activity.js';
import { CARE, HEALTH, STAFF } from '../roles.js';
import { withOnline } from '../presence.js';
const PRO = CARE, uuid = z.string().uuid(), list = z.array(z.string().max(80)).max(30);
export default async function (app) {
  app.get('/api/contacts', { preHandler: app.auth }, async req => withOnline(await contacts(req)));
  const contacts = req => {
    const u = req.user;
    if (u.role === 'paciente') return q(`select x.id,x.name,x.role,x.cargo from users x where x.active and (x.role='recepcao' or x.id in(select professional_id from care_team where patient_id=$1)) order by x.name`, [u.sub]);
    if (PRO.includes(u.role)) return q(`select x.id,x.name,x.role,x.cargo from users x where x.active and x.id<>$1 and x.role<>'admin' and (x.role<>'paciente' or x.id in(select patient_id from care_team where professional_id=$1)) order by x.role,x.name`, [u.sub]);
    return q(`select id,name,role,cargo from users where active and id<>$1 and role<>'admin' order by role,name`, [u.sub]);
  };
  app.get('/api/agenda/week', { preHandler: app.auth }, async req => {
    const { from, to } = z.object({ from: z.string().datetime(), to: z.string().datetime() }).parse(req.query), u = req.user, p = [from, to];
    const f = u.role === 'paciente' ? (p.push(u.sub), ' and a.patient_id=$3') : PRO.includes(u.role) ? (p.push(u.sub), ' and a.professional_id=$3') : '';
    const rows = await q(`select a.id,a.patient_id,a.professional_id,a.starts_at,a.ends_at,a.status,a.noshow_risk,a.package_id,a.note_enc,pa.name patient,pr.name professional from appointments a join users pa on pa.id=a.patient_id join users pr on pr.id=a.professional_id where a.starts_at>=$1 and a.starts_at<$2${f} order by a.starts_at`, p);
    const notes = u.role === 'paciente' ? [] : await q('select id,title,body_enc,starts_at from agenda_notes where owner_id=$1 and starts_at>=$2 and starts_at<$3 order by starts_at', [u.sub, from, to]);
    await audit(req, 'read', 'agenda');
    return { appointments: rows.map(({ note_enc, ...r }) => ({ ...r, note: u.role === 'paciente' || !note_enc ? '' : dec(note_enc) })), notes: notes.map(({ body_enc, ...n }) => ({ ...n, body: dec(body_enc) })) };
  });
  app.get('/api/agenda/current', { preHandler: app.auth }, async (req, rep) => {
    const w = uuid.parse(req.query.with), u = req.user, mine = u.role === 'paciente' ? 'patient_id=$1 and professional_id=$2' : 'professional_id=$1 and patient_id=$2';
    const [a] = await q(`select id,starts_at,status from appointments where ${mine} and status not in('cancelado','finalizado','faltou') and starts_at between now()-interval '3 hours' and now()+interval '24 hours' order by abs(extract(epoch from starts_at-now())) limit 1`, [u.sub, w]);
    return a || rep.code(404).send({ error: 'Nenhuma consulta agendada com este contato para agora' });
  });
  app.patch('/api/agenda/:id', { preHandler: app.role(...STAFF) }, async (req, rep) => {
    const id = uuid.parse(req.params.id), b = z.object({ startsAt: z.string().datetime().optional(), professionalId: uuid.optional(), note: z.string().max(4000).optional(), reason: z.string().max(300).optional() }).parse(req.body);
    const [a] = await q('select * from appointments where id=$1', [id]);
    if (!a || (PRO.includes(req.user.role) && a.professional_id !== req.user.sub)) return rep.code(404).send({ error: 'não encontrado' });
    const dur = a.ends_at - a.starts_at, s = b.startsAt || a.starts_at.toISOString(), e = new Date(+new Date(s) + dur).toISOString(), pr = b.professionalId || a.professional_id, moved = !!(b.startsAt || b.professionalId);
    const [me] = await q('select ask_reason from users where id=$1', [req.user.sub]);
    if (moved && me.ask_reason && !(b.reason && b.reason.trim())) return rep.code(428).send({ error: 'Informe a justificativa da alteração', needReason: true });
    if (moved && (await q(`select 1 from appointments where id<>$1 and professional_id=$2 and status not in('cancelado','faltou') and tstzrange(starts_at,ends_at)&&tstzrange($3,$4)`, [id, pr, s, e])).length) return rep.code(409).send({ error: 'horário já ocupado para este profissional' });
    const risk = moved ? await noshowRisk(a.patient_id, s) : a.noshow_risk;
    await q('update appointments set starts_at=$2,ends_at=$3,professional_id=$4,noshow_risk=$5,note_enc=$6,reminded_at=case when $7 then null else reminded_at end where id=$1', [id, s, e, pr, risk, b.note !== undefined ? enc(b.note) : a.note_enc, moved]);
    if (b.professionalId) await q('insert into care_team values($1,$2) on conflict do nothing', [a.patient_id, pr]);
    if (moved) await logAct(req, 'appointment', id, 'mover', a.patient_id, { de: a.starts_at, para: s, trocouProfissional: pr !== a.professional_id }, b.reason || null);
    await audit(req, 'alterar', 'appointment', id, { campos: Object.keys(b) }); return { ok: true, noshowRisk: risk };
  });
  const N = { preHandler: app.role(...STAFF) };
  app.post('/api/agenda/notes', N, async req => { const b = z.object({ title: z.string().max(80).default('Nota'), body: z.string().max(4000).default(''), startsAt: z.string().datetime() }).parse(req.body); const [r] = await q('insert into agenda_notes(owner_id,title,body_enc,starts_at) values($1,$2,$3,$4) returning id', [req.user.sub, b.title, enc(b.body), b.startsAt]); await audit(req, 'criar', 'agenda_note', r.id); return r; });
  app.patch('/api/agenda/notes/:id', N, async (req, rep) => {
    const id = uuid.parse(req.params.id), b = z.object({ title: z.string().max(80).optional(), body: z.string().max(4000).optional(), startsAt: z.string().datetime().optional() }).parse(req.body);
    const [n] = await q('select * from agenda_notes where id=$1 and owner_id=$2', [id, req.user.sub]); if (!n) return rep.code(404).send({ error: 'não encontrado' });
    await q('update agenda_notes set title=$2,body_enc=$3,starts_at=$4 where id=$1', [id, b.title ?? n.title, b.body !== undefined ? enc(b.body) : n.body_enc, b.startsAt || n.starts_at]); await audit(req, 'alterar', 'agenda_note', id); return { ok: true };
  });
  app.delete('/api/agenda/notes/:id', N, async req => { const id = uuid.parse(req.params.id); await q('delete from agenda_notes where id=$1 and owner_id=$2', [id, req.user.sub]); await audit(req, 'excluir', 'agenda_note', id); return { ok: true }; });
  app.get('/api/patients/:id/summary', { preHandler: app.auth }, async (req, rep) => {
    const id = uuid.parse(req.params.id); if (!await canSeeFull(req.user, id)) return rep.code(403).send({ error: 'sem acesso' });
    const [s] = await q('select content_enc from patient_summary where patient_id=$1', [id]); await audit(req, 'read', 'patient', id, { view: 'resumo' });
    return s ? JSON.parse(dec(s.content_enc)) : { allergies: [], chronic: [], meds: [] };
  });
  app.put('/api/patients/:id/summary', { preHandler: app.role(...HEALTH) }, async (req, rep) => {
    const id = uuid.parse(req.params.id), b = z.object({ allergies: list, chronic: list, meds: list }).parse(req.body); if (!await canSeeFull(req.user, id)) return rep.code(403).send({ error: 'sem vínculo com o paciente' });
    await q(`insert into patient_summary(patient_id,content_enc,updated_by) values($1,$2,$3) on conflict(patient_id) do update set content_enc=$2,updated_by=$3,updated_at=now()`, [id, enc(JSON.stringify(b)), req.user.sub]); await audit(req, 'alterar', 'patient_summary', id); return { ok: true };
  });
  app.get('/api/patients/:id/documents', { preHandler: app.auth }, async (req, rep) => {
    const id = uuid.parse(req.params.id); if (!await canSeeFull(req.user, id)) return rep.code(403).send({ error: 'sem acesso' });
    return q('select d.id,d.kind,d.hash,d.created_at,d.uses,d.max_uses,d.status,d.valid_until,a.name author from documents d join users a on a.id=d.author_id where d.patient_id=$1 order by d.created_at desc', [id]);
  });
}
