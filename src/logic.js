// Regras puras (sem banco): estado de receitas e rotinas. Testadas em tests/logic.test.js.
export const USABLE = ['receita', 'pedido_exames'];
export const nm = n => { const p = String(n || '').trim().split(/\s+/); return p.length > 1 ? `${p[0]} ${p[1][0]}.` : p[0] || ''; };
export function docStatus(d) {
  if (d.status === 'cancelada') return 'cancelada'; if (d.uses >= d.max_uses) return 'esgotada';
  if (d.valid_until && new Date(d.valid_until) < new Date()) return 'vencida'; return 'ativa';
}
// Etapas em ordem fixa: só a primeira etapa incompleta pode receber execução.
export function routineState(items) {
  const s = [...items].sort((a, b) => a.position - b.position), total = s.reduce((a, i) => a + i.sessions, 0), done = s.reduce((a, i) => a + Math.min(i.done, i.sessions), 0), cur = s.find(i => i.done < i.sessions) || null;
  return { total, done, percent: total ? Math.round(done / total * 100) : 0, current: cur, complete: !cur && s.length > 0, steps: s.length, stepsDone: s.filter(i => i.done >= i.sessions).length, items: s };
}
