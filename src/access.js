import { q } from './db.js';
import { CARE, HEALTH } from './roles.js';
export async function canSee(u, pid) {
  if (u.role === 'paciente') return u.sub === pid;
  if (!CARE.includes(u.role)) return false;
  return (await q('select 1 from care_team where patient_id=$1 and professional_id=$2', [pid, u.sub])).length > 0;
}
// Acesso clínico completo (resumo, história, documentos): exclui cuidador.
export async function canSeeFull(u, pid) { return u.role === 'paciente' ? u.sub === pid : HEALTH.includes(u.role) && canSee(u, pid); }
