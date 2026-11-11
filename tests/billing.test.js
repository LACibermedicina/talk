import test from 'node:test';
import assert from 'node:assert/strict';
import { accessState, redeemCheck, redeemEffect, ambLimits, checkGroup, planEnds, featureFor, isOpenWhenLocked, normCode, validCode, genCode, PLAN_SEED, FEATURES, planPrice, planCredits } from '../src/billingLogic.js';
const now = new Date('2026-11-10T12:00:00Z'), day = n => new Date(now.getTime() + n * 864e5).toISOString();
test('acesso: livre quando não há cobrança, admin ou usuário não medido', () => {
  assert.equal(accessState({ blocked: true }, { role: 'paciente', enforce: false, now }).ok, true);
  assert.equal(accessState({ blocked: true }, { role: 'admin', enforce: true, now }).ok, true);
  assert.equal(accessState(null, { role: 'medico', enforce: true, now }).ok, true);
});
test('acesso: teste, plano, expirado, sem plano e bloqueio', () => {
  const o = { role: 'paciente', enforce: true, now };
  assert.deepEqual([accessState({ trial_ends: day(3) }, o).via, accessState({ plan_ends: day(1), trial_ends: day(-1) }, o).via], ['teste', 'plano']);
  assert.equal(accessState({ trial_ends: day(-1) }, o).reason, 'expirado'); assert.equal(accessState({ plan_ends: day(-1) }, o).reason, 'expirado');
  assert.equal(accessState({}, o).reason, 'sem_plano'); const b = accessState({ blocked: true, blocked_reason: 'x', plan_ends: day(9) }, o); assert.equal(b.reason, 'bloqueado'); assert.equal(b.message, 'x');
});
test('token TALK: 7 dias no Básico, sem créditos; só vale com cadastro público ligado', () => {
  const t = { code: 'TALK', kind: 'default', active: true, trial_days: 7, plan_id: 'basico', credits: 0, uses: 99, max_uses: null };
  assert.equal(redeemCheck(t, { signupMode: 'off', now }).ok, false); assert.equal(redeemCheck(t, { signupMode: 'approval', now }).ok, true);
  const e = redeemEffect(t, now); assert.equal(e.credits, 0); assert.equal(e.plan_id, 'basico'); assert.equal(e.trial_ends, day(7)); assert.equal(e.ownerReward, 0);
});
test('token: limites de uso, validade, desativado; convite funciona com cadastro desligado', () => {
  const base = { active: true, kind: 'promo', uses: 0, max_uses: 2 };
  assert.equal(redeemCheck({ ...base, uses: 2 }, { signupMode: 'off', now }).ok, false); assert.equal(redeemCheck({ ...base, expires_at: day(-1) }, { now }).ok, false);
  assert.equal(redeemCheck({ ...base, active: false }, { now }).ok, false); assert.equal(redeemCheck(base, { signupMode: 'off', now }).ok, true); assert.equal(redeemCheck(null, { now }).ok, false);
});
test('indicação: recompensa só existe se o token tem dono', () => {
  assert.equal(redeemEffect({ trial_days: 0, credits: 20, reward_owner: 10, owner_id: 'u1' }, now).ownerReward, 10);
  assert.equal(redeemEffect({ trial_days: 0, credits: 20, reward_owner: 10 }, now).ownerReward, 0);
});
test('embaixador: grupo respeita limites definidos pelo administrador', () => {
  const lim = ambLimits({ AMB_MAX_TOKENS: '10', AMB_MAX_USES: '2', AMB_MAX_CREDITS: '5', AMB_MAX_TRIAL_DAYS: '3', AMB_MAX_GROUPS: '2' });
  const ok = { count: 10, max_uses: 2, credits: 5, trial_days: 3 };
  assert.equal(checkGroup(ok, lim), null); assert.ok(checkGroup({ ...ok, count: 11 }, lim)); assert.ok(checkGroup({ ...ok, max_uses: 3 }, lim)); assert.ok(checkGroup({ ...ok, credits: 6 }, lim)); assert.ok(checkGroup({ ...ok, trial_days: 4 }, lim)); assert.ok(checkGroup(ok, lim, { groupsSoFar: 2 }));
  assert.equal(ambLimits({}).maxGroups, 5);
});
test('planos: renovação soma ao tempo restante', () => {
  assert.equal(planEnds('week', null, now), day(7)); assert.equal(planEnds('month', day(5), now), day(35)); assert.equal(planEnds('week', day(-3), now), day(7));
});
test('catálogo de planos coerente: escalonado em preço, créditos e vantagens', () => {
  for (let i = 1; i < PLAN_SEED.length; i++) { const a = PLAN_SEED[i - 1], b = PLAN_SEED[i]; assert.ok(b.price_month > a.price_month && b.credits_month > a.credits_month && b.features.pacientes > a.features.pacientes, b.id); }
  for (const p of PLAN_SEED) { assert.ok(p.price_week <= p.price_month * 0.35 + 0.01 || p.price_month === 0, p.id + ' semanal'); assert.ok(p.credits_week < p.credits_month); }
  assert.equal(PLAN_SEED[0].features.ia, false); assert.equal(PLAN_SEED[2].features.protocolos, true); assert.equal(planPrice(PLAN_SEED[1], 'week'), 19); assert.equal(planCredits(PLAN_SEED[1], 'month'), 400);
});
test('rotas medidas e rotas liberadas quando bloqueado', () => {
  assert.equal(featureFor('POST', '/api/consults/abc/report'), 'consulta_relatorio'); assert.equal(featureFor('GET', '/api/consults/abc/report'), null); assert.equal(featureFor('POST', '/api/patients/x/family-map/generate'), 'familia_ia');
  assert.ok(isOpenWhenLocked('/api/billing/plans') && isOpenWhenLocked('/api/me') && isOpenWhenLocked('/api/logout')); assert.ok(!isOpenWhenLocked('/api/chat/rooms'));
  assert.equal(new Set(FEATURES.map(f => f[0])).size, FEATURES.length);
});
test('códigos', () => { assert.equal(normCode(' tal k '), 'TALK'); assert.ok(validCode('TALK') && validCode('AMB-K7P2QX') && !validCode('a b') && !validCode('x')); assert.match(genCode(Buffer.from([1, 2, 3, 4, 5, 6]), 'AMB-'), /^AMB-[A-Z2-9]{6}$/); });
