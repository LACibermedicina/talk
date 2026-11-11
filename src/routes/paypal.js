import { z } from 'zod';
import { q } from '../db.js';
import { audit } from '../audit.js';
import { ADMIN_STAFF } from '../roles.js';
const B = () => process.env.PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
const fail = () => Object.assign(new Error('PayPal indisponível'), { statusCode: 503 });
async function tok() {
  const r = await fetch(B() + '/v1/oauth2/token', { method: 'POST', headers: { authorization: 'Basic ' + Buffer.from(process.env.PAYPAL_CLIENT_ID + ':' + process.env.PAYPAL_CLIENT_SECRET).toString('base64'), 'content-type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials', signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw fail(); return (await r.json()).access_token;
}
const pkg = async id => (await q(`select p.id,p.patient_id,p.name,(p.price_cents-coalesce((select sum(amount_cents) from payments y where y.package_id=p.id and y.kind='entrada'),0))::int due from packages p where p.id=$1`, [id]))[0];
export default async function (app) {
  const P = { preHandler: app.role('paciente', 'admin', ...ADMIN_STAFF) };
  // O valor vem SEMPRE do servidor (saldo devido do pacote), nunca do cliente.
  app.post('/api/paypal/orders', P, async (req, rep) => {
    const { packageId } = z.object({ packageId: z.string().uuid() }).parse(req.body), p = await pkg(packageId);
    if (!p || (req.user.role === 'paciente' && p.patient_id !== req.user.sub)) return rep.code(404).send({ error: 'pacote não encontrado' });
    if (p.due <= 0) return rep.code(409).send({ error: 'pacote já quitado' });
    const r = await fetch(B() + '/v2/checkout/orders', { method: 'POST', headers: { authorization: 'Bearer ' + await tok(), 'content-type': 'application/json' }, body: JSON.stringify({ intent: 'CAPTURE', purchase_units: [{ reference_id: p.id, description: p.name.slice(0, 120), amount: { currency_code: 'BRL', value: (p.due / 100).toFixed(2) } }] }), signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw fail(); return { id: (await r.json()).id };
  });
  app.post('/api/paypal/orders/:id/capture', P, async (req, rep) => {
    const id = z.string().regex(/^[A-Z0-9]{10,30}$/).parse(req.params.id);
    if ((await q('select 1 from payments where note=$1', ['paypal:' + id])).length) return rep.code(409).send({ error: 'pedido já registrado' });
    const r = await fetch(`${B()}/v2/checkout/orders/${id}/capture`, { method: 'POST', headers: { authorization: 'Bearer ' + await tok(), 'content-type': 'application/json' }, signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw fail(); const j = await r.json(), u = j.purchase_units?.[0], cap = u?.payments?.captures?.[0], p = u && await pkg(u.reference_id);
    if (j.status !== 'COMPLETED' || !cap || cap.amount.currency_code !== 'BRL' || !p || (req.user.role === 'paciente' && p.patient_id !== req.user.sub)) return rep.code(402).send({ error: 'pagamento não confirmado' });
    const cents = Math.round(parseFloat(cap.amount.value) * 100);
    await q(`insert into payments(kind,amount_cents,category,method,note,patient_id,package_id) values('entrada',$1,'pacote','paypal',$2,$3,$4)`, [cents, 'paypal:' + id, p.patient_id, p.id]);
    await audit(req, 'pagamento_paypal', 'package', p.id, { cents, order: id }); return { ok: true };
  });
}
