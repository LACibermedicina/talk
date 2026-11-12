import test from 'node:test';
import assert from 'node:assert/strict';
import { pairOk, declineText, callInfo, apptStatusFor, DEFAULT_DECLINE } from '../src/callLogic.js';
import { connect, disconnect, isOnline, statusOf, touch, forget, setStatus } from '../src/presence.js';
test('pareamento: só paciente↔profissional de saúde', () => {
  assert.ok(pairOk('paciente', 'medico') && pairOk('medico', 'paciente') && pairOk('fisio', 'paciente'));
  assert.ok(!pairOk('paciente', 'paciente') && !pairOk('medico', 'medico') && !pairOk('paciente', 'recepcao') && !pairOk('admin', 'paciente'));
});
test('justificativa: personalizada > padrão do médico > texto base', () => {
  assert.equal(declineText('Em cirurgia', 'Padrão'), 'Em cirurgia');
  assert.equal(declineText('  ', 'Padrão'), 'Padrão');
  assert.equal(declineText('', null), DEFAULT_DECLINE);
  assert.equal(declineText('x'.repeat(500)).length, 300);
});
test('registro na agenda descreve tentativa e desfecho', () => {
  const i = callInfo('recusada', { requester: 'Ana', target: 'Dr. Bruno', reason: 'dor', justification: 'Em atendimento', at: '2026-11-12T15:00:00Z' });
  assert.match(i, /Ana a Dr\. Bruno/); assert.match(i, /recusada/); assert.match(i, /Justificativa: Em atendimento/); assert.match(i, /Motivo: dor/);
  assert.ok(!/Justificativa/.test(callInfo('aceita', { requester: 'A', target: 'B', justification: 'x', at: Date.now() })));
  assert.equal(apptStatusFor('aceita'), 'em_atendimento'); assert.equal(apptStatusFor('recusada'), 'cancelado');
});
test('presença por batimento HTTP: online sem WebSocket; ocupado/offline respeitados; logout limpa', () => {
  touch('h1'); assert.ok(isOnline('h1')); assert.equal(statusOf('h1'), 'online');
  setStatus('h1', 'busy'); assert.equal(statusOf('h1'), 'busy'); setStatus('h1', 'offline'); assert.equal(statusOf('h1'), 'offline');
  setStatus('h1', 'online'); forget('h1'); assert.equal(statusOf('h1'), 'offline');
  connect('h2'); assert.equal(statusOf('h2'), 'online'); disconnect('h2'); assert.equal(statusOf('h2'), 'offline');
});
