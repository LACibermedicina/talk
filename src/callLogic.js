// Teleconsulta sob demanda: regras puras (sem banco) para pareamento, mensagens e registro na agenda.
import { HEALTH } from './roles.js';
export const CALL_WINDOW_MIN = 30, RING_SECONDS = 60;
export const DEFAULT_DECLINE = 'No momento não consigo atender esta chamada. Por favor, tente novamente mais tarde ou agende uma consulta.';
export const NO_ANSWER = 'Sem resposta: o profissional não atendeu a chamada a tempo.';
// Paciente chama profissional de saúde; profissional chama paciente (do seu vínculo de cuidado). Mais ninguém.
export const pairOk = (a, b) => (a === 'paciente' && HEALTH.includes(b)) || (HEALTH.includes(a) && b === 'paciente');
export const declineText = (custom, preset) => String(custom || '').trim().slice(0, 300) || String(preset || '').trim().slice(0, 300) || DEFAULT_DECLINE;
const LBL = { aceita: 'atendida', recusada: 'recusada', cancelada: 'cancelada por quem chamou', sem_resposta: 'sem resposta' };
export const outcomeLabel = s => LBL[s] || s;
// Texto que fica na agenda dos dois lados.
export const callInfo = (status, { requester, target, reason, justification, at }) => {
  const hh = new Date(at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
  return `Teleconsulta solicitada por ${requester} a ${target} às ${hh} — ${outcomeLabel(status)}.` + (reason ? ` Motivo: ${reason}.` : '') + (justification && status !== 'aceita' ? ` Justificativa: ${justification}` : '');
};
export const apptStatusFor = s => s === 'aceita' ? 'em_atendimento' : 'cancelado';
