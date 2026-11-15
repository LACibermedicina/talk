import test from 'node:test';
import assert from 'node:assert/strict';
import { proPair, classify, split, settlementFor, normTerms, parsePlanJson, fileKind, canAdminTeam, proposalOpen } from '../src/teamLogic.js';

test('proPair: só profissionais de saúde entre si', () => {
  assert.ok(proPair('medico', 'fisio')); assert.ok(!proPair('medico', 'paciente')); assert.ok(!proPair('admin', 'medico')); assert.ok(!proPair('recepcao', 'medico'));
});
test('classify: interna, externa e livre', () => {
  assert.deepEqual(classify('A', 'A'), { kind: 'interna', team: 'A', teams: ['A'] });
  assert.deepEqual(classify('A', 'B'), { kind: 'externa', team: 'A', teams: ['A', 'B'] });
  assert.deepEqual(classify('A', null), { kind: 'externa', team: 'A', teams: ['A'] });
  assert.deepEqual(classify(null, 'B'), { kind: 'externa', team: 'B', teams: ['B'] });
  assert.deepEqual(classify(null, null), { kind: 'livre', team: null, teams: [] });
});
test('split: percentual da equipe com centavos', () => {
  assert.deepEqual(split(200, 15), { team: 30, pro: 170 }); assert.deepEqual(split(99.99, 33.33), { team: 33.33, pro: 66.66 });
  assert.deepEqual(split(100, 150), { team: 100, pro: 0 }); assert.deepEqual(split(-5, 10), { team: 0, pro: 0 });
});
test('settlementFor: por_chamada e por_paciente', () => {
  const t = { fee: 200, team_pct: 20, model: 'por_chamada' };
  assert.deepEqual(settlementFor(t, { firstWithPatient: false }), { fee: 200, pct: 20, team: 40, pro: 160 });
  const p = { ...t, model: 'por_paciente' };
  assert.equal(settlementFor(p, { firstWithPatient: true }).team, 40);
  assert.deepEqual(settlementFor(p, { firstWithPatient: false }), { fee: 200, pct: 0, team: 0, pro: 200 });
  assert.equal(settlementFor(null, { firstWithPatient: true }), null);
});
test('normTerms: valida e aceita formatos brasileiros', () => {
  assert.deepEqual(normTerms({ fee: '1.234,50', team_pct: '12,5', model: 'por_paciente', currency: 'usd' }).terms, { fee: 1234.5, team_pct: 12.5, model: 'por_paciente', currency: 'USD', conditions: '', summary: '' });
  assert.equal(normTerms({ fee: 'abc', team_pct: 10 }).ok, false); assert.equal(normTerms({ fee: 100, team_pct: 120 }).ok, false); assert.equal(normTerms({ fee: -1, team_pct: 1 }).ok, false);
  assert.equal(normTerms({ fee: 80, team_pct: 10, model: 'xx', currency: 'zzz' }).terms.model, 'por_chamada');
});
test('parsePlanJson: tolera cerca de código e texto em volta', () => {
  assert.deepEqual(parsePlanJson('```json\n{"fee": 90, "team_pct": 15}\n```'), { fee: 90, team_pct: 15 });
  assert.deepEqual(parsePlanJson('Segue: {"fee":1}. Fim'), { fee: 1 }); assert.equal(parsePlanJson('sem json'), null); assert.equal(parsePlanJson('{quebrado'), null);
});
test('fileKind', () => { assert.equal(fileKind('plano.PDF', ''), 'pdf'); assert.equal(fileKind('a.txt', 'text/plain'), 'text'); assert.equal(fileKind('a.exe', 'application/octet-stream'), null); });
test('canAdminTeam e proposalOpen', () => {
  assert.ok(canAdminTeam({ role: 'admin' }, null)); assert.ok(canAdminTeam({ role: 'medico' }, { role: 'admin' })); assert.ok(!canAdminTeam({ role: 'medico' }, { role: 'membro' })); assert.ok(!canAdminTeam({ role: 'medico' }, null));
  assert.ok(proposalOpen({ status: 'enviada', expires_at: new Date(Date.now() + 1e6) })); assert.ok(!proposalOpen({ status: 'aceita', expires_at: new Date(Date.now() + 1e6) })); assert.ok(!proposalOpen({ status: 'enviada', expires_at: new Date(Date.now() - 1) }));
});
