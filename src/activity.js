import { q } from './db.js';
// Histórico de atividades (quem, quando, o quê, motivo). Não guarda conteúdo clínico.
export const logAct = (req, entity, id, action, patientId = null, detail = {}, reason = null) =>
  q('insert into activity_log(user_id,entity,entity_id,action,patient_id,detail,reason) values($1,$2,$3,$4,$5,$6,$7)', [req.user.sub, entity, String(id), action, patientId, JSON.stringify(detail), reason]);
export const logSys = (userId, entity, id, action, patientId = null, detail = {}) =>
  q('insert into activity_log(user_id,entity,entity_id,action,patient_id,detail) values($1,$2,$3,$4,$5,$6)', [userId || null, entity, String(id), action, patientId, JSON.stringify(detail)]);
