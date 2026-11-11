// Receitas e rotinas: baixa por QR, ordem das etapas, notificações ao profissional e seguimento do paciente.
import { pool, q } from './db.js';
import { logSys } from './activity.js';
import { USABLE, nm, docStatus, routineState } from './logic.js';
export { USABLE, nm, docStatus, routineState };
export const notify = (userId, kind, title, body, patientId, ref) => q('insert into notifications(user_id,kind,title,body,patient_id,ref) values($1,$2,$3,$4,$5,$6)', [userId, kind, title, body || null, patientId || null, ref || null]);
const reg = u => u.reg_conselho ? `${u.reg_conselho} ${u.reg_numero}/${u.reg_uf}` : null;
export async function docView(token) {
  const [d] = await q('select d.*,a.name doctor,a.reg_conselho,a.reg_numero,a.reg_uf,p.name patient from documents d join users a on a.id=d.author_id join users p on p.id=d.patient_id where d.token=$1', [token]); if (!d) return null;
  const hist = await q('select "at",action from document_uses where document_id=$1 order by "at" desc limit 10', [d.id]);
  return { tipo: d.kind, medico: { nome: d.doctor, registro: reg(d) }, paciente: nm(d.patient), emitidaEm: d.created_at, validade: d.valid_until, usos: { usados: d.uses, max: d.max_uses }, status: docStatus(d), usavel: USABLE.includes(d.kind), texto: d.texto, historico: hist };
}
export async function useDocument(token, { acao, nome, lugar, ip }) {
  const c = await pool.connect(); let d, uses;
  try {
    await c.query('begin');
    const { rows: [x] } = await c.query('select d.*,p.name patient from documents d join users p on p.id=d.patient_id where d.token=$1 for update of d', [token]);
    if (!x) { await c.query('rollback'); return { code: 404, error: 'Documento não encontrado' }; }
    if (!USABLE.includes(x.kind)) { await c.query('rollback'); return { code: 400, error: 'Este documento não admite baixa' }; }
    const st = docStatus(x); if (st !== 'ativa') { await c.query('rollback'); return { code: 409, error: st === 'esgotada' ? 'Número máximo de usos já utilizado' : st === 'vencida' ? 'Documento vencido' : 'Documento cancelado', status: st }; }
    await c.query('insert into document_uses(document_id,action,by_name,by_place,ip) values($1,$2,$3,$4,$5)', [x.id, acao, nome, lugar || null, ip]); uses = x.uses;
    if (acao === 'utilizada') { uses++; await c.query("update documents set uses=$2,status=case when $2>=max_uses then 'esgotada' else status end where id=$1", [x.id, uses]); }
    await c.query('commit'); d = x;
  } catch (e) { await c.query('rollback').catch(() => {}); throw e; } finally { c.release(); }
  const tipo = d.kind === 'receita' ? 'Receita' : 'Pedido de exames', por = `${nome}${lugar ? ' · ' + lugar : ''}`;
  if (acao === 'utilizada') await notify(d.author_id, uses >= d.max_uses ? 'receita_esgotada' : 'receita_utilizada', `${tipo} de ${nm(d.patient)} utilizado (${uses}/${d.max_uses})`, `Confirmado por ${por}. ${uses >= d.max_uses ? 'Número máximo de usos atingido. ' : ''}Revise o manejo das indicações.`, d.patient_id, d.id);
  else await notify(d.author_id, 'receita_nao_utilizada', `${tipo} de ${nm(d.patient)} registrado como não utilizado`, `Informado por ${por}.`, d.patient_id, d.id);
  await logSys(null, 'document', d.id, acao === 'utilizada' ? `${d.kind} utilizada ${uses}/${d.max_uses}` : `${d.kind} não utilizada`, d.patient_id, { por });
  return { code: 200, view: await docView(token) };
}
export async function routineView(key) {
  const [r] = await q(`select r.*,a.name doctor,a.reg_conselho,a.reg_numero,a.reg_uf,p.name patient from routines r join users a on a.id=r.professional_id join users p on p.id=r.patient_id where r.${key.token ? 'token' : 'id'}=$1`, [key.token || key.id]); if (!r) return null;
  const st = routineState(await q('select * from routine_items where routine_id=$1', [r.id])), ev = await q('select e.at,e.action,i.title from routine_events e join routine_items i on i.id=e.item_id where i.routine_id=$1 order by e.at desc limit 10', [r.id]);
  return { id: r.id, titulo: r.title, medico: { nome: r.doctor, registro: reg(r) }, paciente: nm(r.patient), status: r.status, percent: st.percent, concluida: r.status === 'concluida', etapas: st.items.map(i => ({ posicao: i.position, titulo: i.title, sessoes: i.sessions, feitas: Math.min(i.done, i.sessions), estado: i.done >= i.sessions ? 'concluida' : st.current && st.current.id === i.id ? 'atual' : 'pendente' })), historico: ev };
}
export async function advance(key, { acao, nome, nota }) {
  const c = await pool.connect(); let rt, cur, itemDone = false, finished = false, items;
  try {
    await c.query('begin');
    const { rows: [r] } = await c.query(`select r.*,p.name patient from routines r join users p on p.id=r.patient_id where r.${key.token ? 'token' : 'id'}=$1 for update of r`, [key.token || key.id]);
    if (!r) { await c.query('rollback'); return { code: 404, error: 'Rotina não encontrada' }; }
    if (r.status !== 'ativa') { await c.query('rollback'); return { code: 409, error: r.status === 'concluida' ? 'Todas as atividades concluídas' : 'Rotina cancelada', status: r.status }; }
    items = (await c.query('select * from routine_items where routine_id=$1 order by position for update', [r.id])).rows; cur = routineState(items).current;
    await c.query('insert into routine_events(item_id,action,by_name,note) values($1,$2,$3,$4)', [cur.id, acao, nome, nota || null]);
    if (acao === 'concluida') { cur.done++; await c.query('update routine_items set done=$2 where id=$1', [cur.id, cur.done]); itemDone = cur.done >= cur.sessions; if (routineState(items).complete) { finished = true; await c.query("update routines set status='concluida',finished_at=now() where id=$1", [r.id]); } }
    await c.query('commit'); rt = r;
  } catch (e) { await c.query('rollback').catch(() => {}); throw e; } finally { c.release(); }
  const st = routineState(items), who = nm(rt.patient);
  if (acao === 'concluida') {
    if (finished) await notify(rt.professional_id, 'rotina_concluida', `Rotina de ${who} concluída`, `Todas as atividades de “${rt.title}” foram concluídas. Revise o manejo das indicações.`, rt.patient_id, rt.id);
    else if (itemDone) await notify(rt.professional_id, 'rotina_etapa', `Etapa concluída: ${cur.title}`, `“${rt.title}” de ${who} está em ${st.percent}% (${st.stepsDone} de ${st.steps} etapas).`, rt.patient_id, rt.id);
  }
  await logSys(null, 'routine', rt.id, acao === 'concluida' ? `rotina ${st.percent}% concluída${finished ? ' (todas as atividades)' : ''}` : 'etapa não realizada', rt.patient_id, { por: nome, etapa: cur.title });
  return { code: 200, view: await routineView({ id: rt.id }) };
}
