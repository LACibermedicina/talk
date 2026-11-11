import test from 'node:test';
import assert from 'node:assert/strict';
import { connect, disconnect, isOnline, withOnline } from '../src/presence.js';
test('presença: online enquanto houver conexão aberta e offline ao fechar a última', () => {
  connect('u1'); connect('u1'); assert.ok(isOnline('u1'));
  disconnect('u1'); assert.ok(isOnline('u1'), 'ainda há uma aba aberta');
  disconnect('u1'); assert.ok(!isOnline('u1'));
});
test('contatos recebem o campo online', () => {
  connect('p1'); const r = withOnline([{ id: 'p1', name: 'A' }, { id: 'p2', name: 'B' }]); disconnect('p1');
  assert.deepEqual(r.map(x => x.online), [true, false]);
});
test('desconectar quem não está online não deixa contador negativo', () => { disconnect('zz'); connect('zz'); assert.ok(isOnline('zz')); disconnect('zz'); assert.ok(!isOnline('zz')); });
import { setStatus, statusOf } from '../src/presence.js';
test('estado escolhido: ocupado aparece ocupado; offline (invisível) esconde quem está conectado', () => {
  connect('s1'); assert.equal(statusOf('s1'), 'online');
  setStatus('s1', 'busy'); assert.equal(statusOf('s1'), 'busy'); assert.equal(withOnline([{ id: 's1' }])[0].online, true);
  setStatus('s1', 'offline'); assert.equal(statusOf('s1'), 'offline'); assert.equal(withOnline([{ id: 's1' }])[0].online, false);
  setStatus('s1', 'xx'); assert.equal(statusOf('s1'), 'offline', 'valor inválido é ignorado');
  disconnect('s1'); setStatus('s1', 'busy'); assert.equal(statusOf('s1'), 'offline', 'desconectado sempre offline');
});
