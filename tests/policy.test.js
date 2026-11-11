import test from 'node:test';
import assert from 'node:assert/strict';
import { weakAllowed, minPw, USERNAME, signupMode } from '../src/policy.js';
const env = (o, f) => { const old = { ...process.env }; Object.assign(process.env, o); try { return f(); } finally { for (const k of Object.keys(o)) { if (old[k] === undefined) delete process.env[k]; else process.env[k] = old[k]; } } };
test('servidor público (https) exige senha forte', () => env({ APP_ORIGIN: 'https://clinica.exemplo.com.br', ALLOW_WEAK_PASSWORDS: '' }, () => { assert.equal(weakAllowed(), false); assert.equal(minPw(), 12); }));
test('servidor local aceita senha de teste curta', () => env({ APP_ORIGIN: 'http://localhost:3000', ALLOW_WEAK_PASSWORDS: '' }, () => { assert.equal(weakAllowed(), true); assert.equal(minPw(), 6); }));
test('opt-in explícito libera senha fraca', () => env({ APP_ORIGIN: 'https://x.com', ALLOW_WEAK_PASSWORDS: 'true' }, () => assert.equal(weakAllowed(), true)));
test('nomes de usuário válidos e inválidos', () => { assert.ok(USERNAME.test('root')); assert.ok(USERNAME.test('ana.costa')); assert.ok(!USERNAME.test('Root')); assert.ok(!USERNAME.test('1ana')); assert.ok(!USERNAME.test('ab')); assert.ok(!USERNAME.test('a b c')); });
test('cadastro público desligado por padrão e valores inesperados', () => { env({ SIGNUP_MODE: '' }, () => assert.equal(signupMode(), 'off')); env({ SIGNUP_MODE: 'open' }, () => assert.equal(signupMode(), 'open')); env({ SIGNUP_MODE: 'approval' }, () => assert.equal(signupMode(), 'approval')); env({ SIGNUP_MODE: 'qualquer' }, () => assert.equal(signupMode(), 'off')); });
