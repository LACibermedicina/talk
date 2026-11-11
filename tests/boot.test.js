import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseEnv, serializeEnv, missing, genKeys, validKey, validDbUrl, originOf, newCode, saveConfig, loadConfig, cfgFile } from '../src/boot/config.js';
import { bootChecks } from '../src/boot/checks.js';
test('missing: lista o que falta e valida formato', () => {
  assert.deepEqual(missing({}), ['DATABASE_URL', 'JWT_SECRET', 'DATA_KEY', 'APP_ORIGIN']);
  const k = genKeys(); assert.deepEqual(missing({ DATABASE_URL: 'postgresql://u:p@h/db', JWT_SECRET: k.JWT_SECRET, DATA_KEY: k.DATA_KEY, APP_ORIGIN: 'http://1.2.3.4:7001' }), []);
  assert.ok(missing({ DATABASE_URL: 'mysql://x', JWT_SECRET: 'curto', DATA_KEY: 'abc', APP_ORIGIN: 'ftp://x' }).length === 4);
});
test('chaves geradas têm o tamanho certo', () => { const k = genKeys(); assert.ok(validKey(k.DATA_KEY)); assert.ok(k.JWT_SECRET.length >= 32); assert.notEqual(genKeys().DATA_KEY, k.DATA_KEY); });
test('env: ida e volta, ignora comentário e valor com quebra de linha', () => {
  const t = serializeEnv({ AA: 'x=y&z', BB: 'a\nb', CC: '' }); const o = parseEnv(t); assert.equal(o.AA, 'x=y&z'); assert.equal(o.BB, undefined); assert.equal(o.CC, undefined);
});
test('config gravada com permissão 600 e carregada sem sobrescrever o ambiente', () => {
  const d = mkdtempSync(join(tmpdir(), 'm3d-')); process.env.DATA_DIR = d; delete process.env.XTEST; process.env.KEEP = 'amb';
  saveConfig({ XTEST: 'v1', KEEP: 'arquivo' }); assert.equal(statSync(cfgFile()).mode & 0o777, 0o600); loadConfig();
  assert.equal(process.env.XTEST, 'v1'); assert.equal(process.env.KEEP, 'amb'); assert.match(readFileSync(cfgFile(), 'utf8'), /XTEST=v1/);
  saveConfig({ Y: '2' }); assert.equal(parseEnv(readFileSync(cfgFile(), 'utf8')).XTEST, 'v1');
});
test('validDbUrl e originOf', () => {
  assert.ok(validDbUrl('postgresql://u:p@ep-x.neon.tech/neondb?sslmode=require')); assert.ok(!validDbUrl('postgresql://u:p@h')); assert.ok(!validDbUrl('http://x/db'));
  assert.equal(originOf({ host: '10.0.0.5:7001' }), 'http://10.0.0.5:7001'); assert.equal(originOf({ host: 'a.b', 'x-forwarded-proto': 'https' }), 'https://a.b'); assert.equal(originOf({ host: 'a b<script>' }), '');
});
test('código de instalação no formato esperado', () => { assert.match(newCode(), /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/); assert.notEqual(newCode(), newCode()); });
test('checks: cada item traz justificativa (why) e solução (fix)', async () => {
  process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'm3d-')); const c = await bootChecks({ headers: { host: '1.2.3.4:7001' } });
  assert.ok(c.length >= 8); for (const x of c) { assert.ok(x.why && x.why.length > 20, x.id); assert.ok(x.fix, x.id); assert.ok(['req', 'rec'].includes(x.level)); }
  assert.equal(c.find(x => x.id === 'proxy').ok, false); assert.equal(c.find(x => x.id === 'data').ok, true);
});
