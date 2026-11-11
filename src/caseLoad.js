import { q } from './db.js';
import { dec } from './crypto.js';
// Dados vinculados ao paciente (aprovados ou não; compileCase decide o que entra).
export async function loadCase(id) {
  const [pt] = await q('select name from users where id=$1', [id]), [sm] = await q('select content_enc from patient_summary where patient_id=$1', [id]);
  const [clinical, evolution, goal, adesao, appointments, documents, alerts, team] = await Promise.all([
    q('select e.created_at,e.kind,e.approved,u.name author,e.content_enc from clinical_entries e join users u on u.id=e.author_id where e.patient_id=$1 order by e.created_at', [id]),
    q('select "at",eva,note from evolution where patient_id=$1 order by "at"', [id]),
    q('select description,target,due from goals where patient_id=$1 and active limit 1', [id]),
    q(`select e.title,s.freq_per_week,(select count(*) from task_logs t where t.assignment_id=s.id and t.done_at>now()-interval '7 days')::int feitas_7d from assignments s join exercises e on e.id=s.exercise_id where s.patient_id=$1 and s.active`, [id]),
    q('select a.starts_at,a.status,u.name professional from appointments a join users u on u.id=a.professional_id where a.patient_id=$1 order by a.starts_at', [id]),
    q('select d.kind,d.created_at,u.name author from documents d join users u on u.id=d.author_id where d.patient_id=$1 order by d.created_at', [id]),
    q('select kind from alerts where patient_id=$1 and not ack', [id]),
    q('select u.name,u.role from care_team c join users u on u.id=c.professional_id where c.patient_id=$1', [id])]);
  return { patient: { name: pt ? pt.name : 'Paciente' }, summary: sm ? JSON.parse(dec(sm.content_enc)) : {}, clinical: clinical.map(({ content_enc, ...r }) => ({ ...r, content: JSON.parse(dec(content_enc)) })), evolution, goal: goal[0] || null, adesao, appointments, documents, alerts, team };
}
