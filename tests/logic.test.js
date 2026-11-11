import test from 'node:test';
import assert from 'node:assert/strict';
import { nm, docStatus, routineState, USABLE } from '../src/logic.js';
import { ALL, HEALTH, CARE, STAFF, DOCS, ADMIN_STAFF } from '../src/roles.js';
const it = (p, s, d) => ({ id: 'i' + p, position: p, sessions: s, done: d });

test('nome do paciente é abreviado na página pública', () => { assert.equal(nm('Sofia Almeida Costa'), 'Sofia A.'); assert.equal(nm('Sofia'), 'Sofia'); });
test('receita: ativa, esgotada, vencida e cancelada', () => {
  assert.equal(docStatus({ status: 'ativa', uses: 0, max_uses: 2 }), 'ativa');
  assert.equal(docStatus({ status: 'ativa', uses: 2, max_uses: 2 }), 'esgotada');
  assert.equal(docStatus({ status: 'ativa', uses: 0, max_uses: 1, valid_until: '2020-01-01' }), 'vencida');
  assert.equal(docStatus({ status: 'cancelada', uses: 0, max_uses: 1 }), 'cancelada');
  assert.deepEqual(USABLE, ['receita', 'pedido_exames']);
});
test('rotina: só a primeira etapa incompleta é a atual (ordem fixa)', () => {
  const s = routineState([it(2, 2, 0), it(1, 3, 3), it(3, 1, 0)]);
  assert.equal(s.current.position, 2); assert.equal(s.percent, 50); assert.equal(s.complete, false);
});
test('rotina: todas as etapas concluídas', () => {
  const s = routineState([it(1, 2, 2), it(2, 1, 1)]); assert.equal(s.complete, true); assert.equal(s.percent, 100); assert.equal(s.current, null);
});
test('rotina: execuções além do previsto não passam de 100%', () => { assert.equal(routineState([it(1, 2, 5)]).percent, 100); });
test('papéis: sem duplicados e com a hierarquia esperada', () => {
  assert.equal(new Set(ALL).size, ALL.length);
  assert.ok(CARE.includes('cuidador') && !HEALTH.includes('cuidador'));
  assert.ok(Object.keys(DOCS).every(r => HEALTH.includes(r)));
  assert.ok(ADMIN_STAFF.every(r => STAFF.includes(r) && !CARE.includes(r)));
  assert.ok(ALL.includes('paciente') && !STAFF.includes('paciente'));
});
