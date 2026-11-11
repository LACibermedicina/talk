import test from 'node:test';
import assert from 'node:assert/strict';
import { hash, placeholders, sensitive, eligible, validOut, parseAI, limit } from '../src/i18nLogic.js';
test('textos com e-mail, link ou número longo nunca são enviados à IA', () => { assert.ok(sensitive('ana@x.com')); assert.ok(sensitive('https://x.com')); assert.ok(sensitive('CPF 12345678901')); assert.ok(!eligible('Salvar alterações ana@x.com')); assert.ok(eligible('Salvar alterações')); });
test('marcadores {n} devem ser preservados na tradução', () => { assert.equal(placeholders('{1} e {0}'), '{0},{1}'); assert.ok(validOut('Paciente {0} chegou', 'Patient {0} arrived')); assert.ok(!validOut('Paciente {0} chegou', 'Patient arrived')); assert.ok(!validOut('Olá', '')); });
test('resposta da IA é lida mesmo com cerca de código e lixo vira objeto vazio', () => { assert.deepEqual(parseAI('```json\n{"a":"b"}\n```'), { a: 'b' }); assert.deepEqual(parseAI('não é json'), {}); assert.deepEqual(parseAI('[1]'), {}); });
test('hash estável e limite diário padrão', () => { assert.equal(hash('x'), hash('x')); assert.notEqual(hash('x'), hash('y')); const o = process.env.I18N_DAILY_LIMIT; delete process.env.I18N_DAILY_LIMIT; assert.equal(limit(), 3000); if (o) process.env.I18N_DAILY_LIMIT = o; });
