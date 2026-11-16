import test from 'node:test';
import assert from 'node:assert/strict';
import { NODES, defaults, normEdges, makeRules, canContact, rolesFrom, urgencyOpen, normPeriods } from '../src/contactLogic.js';
test('padrão de vídeo: recepção↔paciente permitido, recepção→médico não; administrador contata todos', () => {
  assert.ok(canContact(null, 'video', 'recepcao', 'paciente')); assert.ok(canContact(null, 'video', 'paciente', 'recepcao'));
  assert.ok(!canContact(null, 'video', 'recepcao', 'medico')); assert.ok(!canContact(null, 'video', 'paciente', 'paciente'));
  for (const n of NODES) assert.ok(canContact(null, 'video', 'admin', n));
  assert.ok(canContact(null, 'video', 'medico', 'paciente') && canContact(null, 'video', 'medico', 'fisio'));
});
test('grafo configurado substitui o padrão (e o administrador continua contatando todos)', () => {
  const rules = makeRules([{ kind: 'video', from_role: '*', to_role: '*' }, { kind: 'video', from_role: 'recepcao', to_role: 'medico' }]);
  assert.ok(canContact(rules, 'video', 'recepcao', 'medico')); assert.ok(!canContact(rules, 'video', 'recepcao', 'paciente')); assert.ok(!canContact(rules, 'video', 'medico', 'paciente'));
  assert.ok(canContact(rules, 'video', 'admin', 'paciente')); assert.ok(canContact(rules, 'chat', 'medico', 'paciente'), 'chat segue o padrão enquanto não configurado');
  assert.deepEqual(rolesFrom(rules, 'video', 'recepcao').sort(), ['medico']);
});
test('arestas inválidas são descartadas e o administrador não é origem editável', () => {
  assert.deepEqual(normEdges([['medico', 'paciente'], ['medico', 'paciente'], ['x', 'paciente'], ['admin', 'medico'], 'lixo']), [['medico', 'paciente']]);
  assert.ok(defaults('chat').has('medico>paciente') && !defaults('chat').has('medico>admin'));
});
test('urgência: padrão sempre disponível; nunca; períodos em horário de Brasília', () => {
  assert.ok(urgencyOpen('sempre', [])); assert.ok(urgencyOpen(undefined, undefined)); assert.ok(!urgencyOpen('nunca', []));
  const seg10h = new Date('2026-11-16T13:00:00Z'), seg22h = new Date('2026-11-17T01:00:00Z'); // segunda 10:00 e segunda 22:00 em Brasília
  const per = [{ d: [1], from: '08:00', to: '18:00' }];
  assert.ok(urgencyOpen('periodos', per, seg10h)); assert.ok(!urgencyOpen('periodos', per, seg22h)); assert.ok(!urgencyOpen('periodos', [], seg10h));
  assert.ok(urgencyOpen('periodos', [{ d: [1], from: '20:00', to: '06:00' }], seg22h), 'período que cruza a meia-noite');
  assert.deepEqual(normPeriods([{ d: [1, 9, 'a'], from: '25:00', to: '10:00' }, { d: [] }]), [{ d: [1], from: '00:00', to: '10:00' }]);
});
