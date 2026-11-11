import test from 'node:test';
import assert from 'node:assert/strict';
process.env.DATA_KEY = Buffer.alloc(32, 7).toString('base64'); process.env.JWT_SECRET = 'x'.repeat(40);
const { enc, dec, sha, signGuest, verifyGuest, seal } = await import('../src/crypto.js');
test('cifra e decifra (AES-256-GCM) e detecta adulteração', () => {
  const c = enc('dado clínico'); assert.notEqual(c, 'dado clínico'); assert.equal(dec(c), 'dado clínico');
  const b = Buffer.from(c, 'base64'); b[b.length - 1] ^= 1; assert.throws(() => dec(b.toString('base64')));
});
test('cada cifragem usa IV novo', () => { assert.notEqual(enc('a'), enc('a')); });
test('hash e selo são determinísticos', () => { assert.equal(sha({ a: 1 }), sha({ a: 1 })); assert.equal(seal('x'), seal('x')); assert.notEqual(seal('x'), seal('y')); });
test('token de convidado: válido, expirado e adulterado', () => {
  const ok = signGuest({ apt: 'a' }, 60); assert.equal(verifyGuest(ok).apt, 'a');
  assert.equal(verifyGuest(signGuest({ apt: 'a' }, -1)), null);
  const [p, s] = ok.split('.'); assert.equal(verifyGuest(Buffer.from(JSON.stringify({ apt: 'b', exp: Date.now() + 1e6 })).toString('base64url') + '.' + s), null); assert.equal(verifyGuest('lixo'), null);
});
