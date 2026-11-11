import { q } from '../db.js';
const tz = process.env.TZ || 'America/Sao_Paulo', N = +process.env.ANOM_PATIENTS_10MIN || 30;
async function raise(kind, sev, patient, user, detail) {
  const d = await q(`select 1 from alerts where kind=$1 and patient_id is not distinct from $2::uuid and user_id is not distinct from $3::uuid and created_at>now()-interval '12 hours'`, [kind, patient, user]);
  if (!d.length) await q('insert into alerts(kind,severity,patient_id,user_id,detail) values($1,$2,$3,$4,$5)', [kind, sev, patient, user, JSON.stringify(detail)]);
}
const slope = p => { const n = p.length, mx = p.reduce((a, x) => a + x.d, 0) / n, my = p.reduce((a, x) => a + x.eva, 0) / n; const v = p.reduce((a, x) => a + (x.d - mx) ** 2, 0); return v ? p.reduce((a, x) => a + (x.d - mx) * (x.eva - my), 0) / v : 0; };
export async function anomalies() {
  for (const r of await q(`select user_id,count(distinct entity_id)::int n from audit_log where action='read' and entity='patient' and "at">now()-interval '10 minutes' and user_id is not null group by user_id having count(distinct entity_id)>$1`, [N])) {
    await q(`update users set active=false where id=$1 and role<>'admin'`, [r.user_id]);
    await raise('acesso_em_massa', 'alta', null, r.user_id, { pacientes: r.n, acao: 'conta bloqueada preventivamente' });
  }
  for (const r of await q(`select user_id,count(*)::int n from audit_log where action='read' and entity='patient' and "at">now()-interval '1 hour' and user_id is not null and (extract(hour from "at" at time zone $1)>=22 or extract(hour from "at" at time zone $1)<6) group by user_id having count(*)>=10`, [tz]))
    await raise('acesso_fora_do_horario', 'media', null, r.user_id, { leituras: r.n });
  for (const g of await q('select patient_id,target,due from goals where active')) {
    const pts = (await q('select (extract(epoch from "at")/86400)::float8 d,eva from evolution where patient_id=$1 order by "at" desc limit 6', [g.patient_id])).reverse();
    if (pts.length >= 3) {
      const s = slope(pts), last = pts.at(-1), proj = last.eva + s * (g.due.getTime() / 864e5 - last.d);
      if (s >= 0) await raise('sem_progresso', 'media', g.patient_id, null, { inclinacao: +s.toFixed(3) });
      else if (proj > g.target) await raise('meta_em_risco', 'media', g.patient_id, null, { projecao: +proj.toFixed(1), meta: g.target });
      if (last.eva - pts.at(-2).eva >= 3) await raise('piora_dor', 'alta', g.patient_id, null, { de: pts.at(-2).eva, para: last.eva });
    }
    const [a] = await q(`select coalesce(sum(freq_per_week),0)::int esp,(select count(*) from task_logs t join assignments s on s.id=t.assignment_id where s.patient_id=$1 and t.done_at>now()-interval '7 days')::int feito from assignments where patient_id=$1 and active`, [g.patient_id]);
    if (a.esp > 0 && a.feito < a.esp * 0.5) await raise('baixa_adesao', 'media', g.patient_id, null, a);
  }
}
