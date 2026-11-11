import { q } from '../db.js';
// Heurística transparente (suavização bayesiana sobre o histórico); calibrar com dados reais da clínica.
export async function noshowRisk(pid, startsAt) {
  const [r] = await q(`select count(*) filter(where status='faltou')::int f, count(*) filter(where status in('finalizado','faltou'))::int n from appointments where patient_id=$1 and starts_at<now()`, [pid]);
  let s = (r.f + 1) / (r.n + 4);
  const lead = (new Date(startsAt) - Date.now()) / 864e5, h = new Date(startsAt).getHours();
  if (lead > 14) s += 0.1; if (h < 8 || h >= 18) s += 0.05;
  return Math.min(0.95, +s.toFixed(2));
}
