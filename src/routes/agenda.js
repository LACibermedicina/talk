import { z } from 'zod';
import { q, pool } from '../db.js';
import { audit } from '../audit.js';
import { logAct } from '../activity.js';
import { CARE, STAFF } from '../roles.js';
import { noshowRisk } from '../services/noshow.js';
const ST = ['agendado', 'confirmado', 'na_recepcao', 'em_atendimento', 'finalizado', 'faltou', 'cancelado'];
export default async function (app) {
  app.get('/api/agenda', { preHandler: app.auth }, async req => {
    const { from, to } = z.object({ from: z.string().datetime(), to: z.string().datetime() }).parse(req.query), u = req.user, p = [from, to];
    const f = u.role === 'paciente' ? (p.push(u.sub), ' and a.patient_id=$3') : CARE.includes(u.role) ? (p.push(u.sub), ' and a.professional_id=$3') : '';
    return q(`select a.id,a.starts_at,a.ends_at,a.status,a.noshow_risk,a.package_id,pa.name patient,pr.name professional from appointments a join users pa on pa.id=a.patient_id join users pr on pr.id=a.professional_id where a.starts_at>=$1 and a.starts_at<$2${f} order by a.starts_at`, p);
  });
  app.post('/api/agenda', { preHandler: app.role(...STAFF) }, async (req, rep) => {
    const b = z.object({ patientId: z.string().uuid(), professionalId: z.string().uuid(), startsAt: z.string().datetime(), endsAt: z.string().datetime(), packageId: z.string().uuid().optional() }).parse(req.body);
    if (new Date(b.endsAt) <= new Date(b.startsAt)) return rep.code(400).send({ error: 'horário final inválido' });
    if ((await q(`select 1 from appointments where professional_id=$1 and status not in('cancelado','faltou') and tstzrange(starts_at,ends_at)&&tstzrange($2,$3)`, [b.professionalId, b.startsAt, b.endsAt])).length) return rep.code(409).send({ error: 'horário já ocupado' });
    const risk = await noshowRisk(b.patientId, b.startsAt);
    const [a] = await q('insert into appointments(patient_id,professional_id,starts_at,ends_at,package_id,noshow_risk) values($1,$2,$3,$4,$5,$6) returning id,noshow_risk', [b.patientId, b.professionalId, b.startsAt, b.endsAt, b.packageId || null, risk]);
    await q('insert into care_team values($1,$2) on conflict do nothing', [b.patientId, b.professionalId]);
    await logAct(req, 'appointment', a.id, 'criar', b.patientId);
    await audit(req, 'criar', 'appointment', a.id); return a;
  });
  app.patch('/api/agenda/:id/status', { preHandler: app.role(...STAFF) }, async (req, rep) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params), { status } = z.object({ status: z.enum(ST) }).parse(req.body), c = await pool.connect();
    try {
      await c.query('begin');
      const { rows: [a] } = await c.query('select * from appointments where id=$1 for update', [id]);
      if (!a || (CARE.includes(req.user.role) && a.professional_id !== req.user.sub)) { await c.query('rollback'); return rep.code(404).send({ error: 'não encontrado' }); }
      if (status === 'finalizado' && a.status !== 'finalizado' && a.package_id) {
        const r = await c.query('update packages set used_sessions=used_sessions+1 where id=$1 and used_sessions<total_sessions', [a.package_id]);
        if (!r.rowCount) { await c.query('rollback'); return rep.code(409).send({ error: 'pacote sem créditos' }); }
      }
      await c.query('update appointments set status=$2 where id=$1', [id, status]); await c.query('commit');
    } catch (e) { await c.query('rollback').catch(() => {}); throw e; } finally { c.release(); }
    await logAct(req, 'appointment', id, 'status ' + status, null, { status });
    await audit(req, 'status', 'appointment', id, { status }); return { ok: true };
  });
}
