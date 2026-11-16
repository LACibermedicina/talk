// Regras puras do grafo de contatos (sem banco): quem pode contatar quem, por tipo de conexão, e a disponibilidade para urgências.
import { HEALTH } from './roles.js';
export const NODES = ['paciente', 'cuidador', ...HEALTH, 'recepcao', 'funcionario', 'admin'];
export const KINDS = { video: 'Videochamada', chat: 'Mensagens' };
const key = (f, t) => f + '>' + t, pairs = (A, B) => A.flatMap(a => B.map(b => key(a, b)));
// Padrão enquanto o administrador não configurar: preserva o que já valia + recepção↔paciente.
export function defaults(kind) {
  if (kind === 'video') return new Set([...pairs(['paciente'], HEALTH), ...pairs(HEALTH, ['paciente']), ...pairs(HEALTH, HEALTH), ...pairs(['recepcao'], ['paciente']), ...pairs(['paciente'], ['recepcao'])]);
  return new Set(pairs(NODES, NODES.filter(n => n !== 'admin')));
}
export function normEdges(edges) {
  const out = new Set();
  for (const e of Array.isArray(edges) ? edges : []) { const [f, t] = Array.isArray(e) ? e : [e && e.from, e && e.to]; if (NODES.includes(f) && NODES.includes(t) && f !== 'admin') out.add(key(f, t)); }
  return [...out].map(s => s.split('>'));
}
// rows: linhas de contact_rules; devolve { video: Set|null, chat: Set|null } (null = não configurado → padrão).
export function makeRules(rows) {
  const r = { video: null, chat: null };
  for (const x of rows || []) { if (!(x.kind in r)) continue; if (!r[x.kind]) r[x.kind] = new Set(); if (!(x.from_role === '*' && x.to_role === '*')) r[x.kind].add(key(x.from_role, x.to_role)); }
  return r;
}
export const canContact = (rules, kind, from, to) => {
  if (from === 'admin') return true;   // o administrador contata todos
  return (((rules || {})[kind]) || defaults(kind)).has(key(from, to));
};
export const rolesFrom = (rules, kind, from) => NODES.filter(t => canContact(rules, kind, from, t));
// Urgência: 'sempre' (padrão: todos os profissionais), 'nunca' ou 'periodos' ([{d:[0..6], from:'HH:MM', to:'HH:MM'}], horário de Brasília).
export function normPeriods(p) {
  return (Array.isArray(p) ? p : []).slice(0, 14).map(x => ({ d: [...new Set((x && Array.isArray(x.d) ? x.d : []).map(Number).filter(n => n >= 0 && n <= 6))], from: /^([01]\d|2[0-3]):[0-5]\d$/.test(x && x.from) ? x.from : '00:00', to: /^([01]\d|2[0-3]):[0-5]\d$/.test(x && x.to) ? x.to : '23:59' })).filter(x => x.d.length);
}
export function urgencyOpen(mode, periods, now = new Date()) {
  if (mode === 'nunca') return false; if (mode !== 'periodos') return true;
  const f = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now), g = t => f.find(x => x.type === t).value;
  const d = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(g('weekday')), m = g('hour') + ':' + g('minute');
  return normPeriods(periods).some(p => p.d.includes(d) && (p.from <= p.to ? m >= p.from && m <= p.to : m >= p.from || m <= p.to));
}
