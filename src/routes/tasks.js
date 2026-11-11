import { z } from 'zod';
import { q } from '../db.js';
import { audit } from '../audit.js';
import { canSee } from '../access.js';
import { CARE, HEALTH } from '../roles.js';
export default async function (app) {
  const PRO = { preHandler: app.role(...HEALTH) }, CAREP = { preHandler: app.role(...CARE) }, uuid = z.string().uuid(), deny = rep => rep.code(403).send({ error: 'sem vínculo com o paciente' });
  app.get('/api/exercises', { preHandler: app.auth }, () => q('select id,title,description,steps,video_url from exercises order by title'));
  app.post('/api/exercises', PRO, async req => {
    const b = z.object({ title: z.string().min(2).max(120), description: z.string().max(2000), steps: z.array(z.string().max(300)).max(15), videoUrl: z.string().url().startsWith('https://').optional() }).parse(req.body);
    const [r] = await q('insert into exercises(title,description,steps,video_url,created_by) values($1,$2,$3,$4,$5) returning id', [b.title, b.description, JSON.stringify(b.steps), b.videoUrl || null, req.user.sub]); await audit(req, 'criar', 'exercise', r.id); return r;
  });
  app.post('/api/assignments', PRO, async (req, rep) => {
    const b = z.object({ patientId: uuid, exerciseId: uuid, freq: z.number().int().min(1).max(14), sets: z.number().int().min(1).max(10), reps: z.number().int().min(1).max(100), start: z.string().date(), end: z.string().date(), goal: z.string().max(300).optional() }).parse(req.body);
    if (!await canSee(req.user, b.patientId)) return deny(rep);
    const [r] = await q('insert into assignments(patient_id,exercise_id,professional_id,freq_per_week,sets,reps,start_date,end_date,goal) values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id', [b.patientId, b.exerciseId, req.user.sub, b.freq, b.sets, b.reps, b.start, b.end, b.goal || null]); await audit(req, 'prescrever', 'assignment', r.id, { patient: b.patientId }); return r;
  });
  app.get('/api/me/tasks', { preHandler: app.role('paciente') }, req => q(`select s.id,s.sets,s.reps,s.freq_per_week,s.goal,e.title,e.description,e.steps,e.video_url,(select count(*) from task_logs t where t.assignment_id=s.id and t.done_at>=date_trunc('week',now()))::int feitas_na_semana from assignments s join exercises e on e.id=s.exercise_id where s.patient_id=$1 and s.active and current_date between s.start_date and s.end_date`, [req.user.sub]));
  app.post('/api/assignments/:id/log', { preHandler: app.role('paciente') }, async (req, rep) => {
    const id = uuid.parse(req.params.id), b = z.object({ pain: z.number().int().min(0).max(10).optional(), note: z.string().max(300).optional() }).parse(req.body);
    if (!(await q('select 1 from assignments where id=$1 and patient_id=$2 and active', [id, req.user.sub])).length) return rep.code(404).send({ error: 'não encontrado' });
    await q('insert into task_logs(assignment_id,pain,note) values($1,$2,$3)', [id, b.pain ?? null, b.note || null]);
    if (b.pain != null) await q(`insert into evolution(patient_id,eva,note,source) values($1,$2,$3,'paciente')`, [req.user.sub, b.pain, b.note || null]);
    return { ok: true };
  });
  app.post('/api/patients/:id/evolution', CAREP, async (req, rep) => { const id = uuid.parse(req.params.id), b = z.object({ eva: z.number().int().min(0).max(10), note: z.string().max(500).optional() }).parse(req.body); if (!await canSee(req.user, id)) return deny(rep); await q('insert into evolution(patient_id,eva,note) values($1,$2,$3)', [id, b.eva, b.note || null]); await audit(req, 'create', 'evolution', id); return { ok: true }; });
  app.post('/api/patients/:id/goal', PRO, async (req, rep) => { const id = uuid.parse(req.params.id), b = z.object({ description: z.string().min(2).max(300), target: z.number().int().min(0).max(10), due: z.string().date() }).parse(req.body); if (!await canSee(req.user, id)) return deny(rep); await q('update goals set active=false where patient_id=$1', [id]); await q('insert into goals(patient_id,description,target,due) values($1,$2,$3,$4)', [id, b.description, b.target, b.due]); await audit(req, 'create', 'goal', id); return { ok: true }; });
  app.get('/api/patients/:id/dashboard', { preHandler: app.auth }, async (req, rep) => {
    const id = uuid.parse(req.params.id); if (!await canSee(req.user, id)) return deny(rep);
    await audit(req, 'read', 'patient', id, { view: 'dashboard' });
    const [evolution, goal, adesao, alerts] = await Promise.all([
      q('select "at",eva,note,source from evolution where patient_id=$1 order by "at"', [id]),
      q('select description,target,due from goals where patient_id=$1 and active', [id]),
      q(`select e.title,s.freq_per_week,(select count(*) from task_logs t where t.assignment_id=s.id and t.done_at>now()-interval '7 days')::int feitas_7d from assignments s join exercises e on e.id=s.exercise_id where s.patient_id=$1 and s.active`, [id]),
      req.user.role === 'paciente' ? [] : q('select kind,severity,detail,created_at from alerts where patient_id=$1 and not ack order by created_at desc', [id])]);
    return { evolution, goal: goal[0] || null, adesao, alerts };
  });
}
