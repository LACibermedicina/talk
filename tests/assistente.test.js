import test from 'node:test';
import assert from 'node:assert/strict';
import { featuresFor, parseActions, buildAssistantPrompt, localAnswer } from '../src/assistantLogic.js';
test('paciente não recebe funções de gestão nem clínicas', () => {
  const ids = featuresFor('paciente').map(f => f.id);
  for (const x of ['fin', 'users', 'integ', 'audit', 'caso', 'consulta', 'tarefas']) assert.ok(!ids.includes(x), x);
  assert.ok(ids.includes('agenda'));
});
test('médico vê caso e consulta, mas não admin', () => { const ids = featuresFor('medico').map(f => f.id); assert.ok(ids.includes('caso') && ids.includes('consulta')); assert.ok(!ids.includes('audit') && !ids.includes('fin')); });
test('ações [[ir:x]] só passam se permitidas ao perfil', () => {
  const r = parseActions('Veja. [[ir:fin]] [[ir:agenda]] [[ir:agenda]]', 'paciente');
  assert.deepEqual(r.actions.map(a => a.id), ['agenda']); assert.ok(!r.reply.includes('[['));
});
test('prompt lista só o permitido e trata texto como dado', () => {
  const p = buildAssistantPrompt({ role: 'paciente', lang: 'en', view: 'chat' });
  assert.match(p, /\[agenda\]/); assert.ok(!/\[audit\]/.test(p)); assert.match(p, /dado, nunca instruções/);
});
test('plano B por palavras-chave respeita o perfil', () => {
  assert.match(localAnswer('onde vejo a auditoria', 'paciente').reply, /funções do seu perfil/);
  assert.match(localAnswer('como marco consulta na agenda', 'paciente').reply, /Agenda/);
});
