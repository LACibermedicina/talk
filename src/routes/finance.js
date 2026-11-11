import { z } from 'zod';
import { q } from '../db.js';
import { audit } from '../audit.js';
import { ADMIN_STAFF } from '../roles.js';
export default async function (app) {
  const F = { preHandler: app.role('admin', ...ADMIN_STAFF) }, uuid = z.string().uuid();
  app.post('/api/packages', F, async req => { const b = z.object({ patientId: uuid, name: z.string().min(2).max(80), total: z.number().int().min(1).max(200), priceCents: z.number().int().min(0) }).parse(req.body); const [r] = await q('insert into packages(patient_id,name,total_sessions,price_cents) values($1,$2,$3,$4) returning id', [b.patientId, b.name, b.total, b.priceCents]); await audit(req, 'criar', 'package', r.id); return r; });
  app.get('/api/packages', F, req => q('select id,name,total_sessions,used_sessions,price_cents from packages where patient_id=$1 order by created_at desc', [uuid.parse(req.query.patientId)]));
  app.post('/api/payments', F, async req => {
    const b = z.object({ kind: z.enum(['entrada', 'saida']), amountCents: z.number().int().min(1), category: z.string().max(60).optional(), method: z.enum(['pix', 'dinheiro', 'cartao', 'transferencia']).optional(), note: z.string().max(300).optional(), patientId: uuid.optional(), packageId: uuid.optional() }).parse(req.body);
    const [r] = await q('insert into payments(kind,amount_cents,category,method,note,patient_id,package_id) values($1,$2,$3,$4,$5,$6,$7) returning id', [b.kind, b.amountCents, b.category || null, b.method || null, b.note || null, b.patientId || null, b.packageId || null]); await audit(req, 'criar', 'payment', r.id, { kind: b.kind, amountCents: b.amountCents }); return r;
  });
  app.get('/api/finance/summary', F, async req => {
    const { month } = z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) }).parse(req.query), a = month + '-01';
    const [t] = await q(`select coalesce(sum(amount_cents) filter(where kind='entrada'),0)::int entradas,coalesce(sum(amount_cents) filter(where kind='saida'),0)::int saidas from payments where paid_at>=$1::date and paid_at<($1::date+interval '1 month')`, [a]);
    const cat = await q(`select coalesce(category,'sem categoria') categoria,kind,sum(amount_cents)::int total from payments where paid_at>=$1::date and paid_at<($1::date+interval '1 month') group by 1,2 order by 3 desc`, [a]);
    const dev = await q(`select p.id,u.name patient,p.name package,(p.price_cents-coalesce(sum(y.amount_cents),0))::int devido_cents from packages p join users u on u.id=p.patient_id left join payments y on y.package_id=p.id and y.kind='entrada' group by p.id,u.name having p.price_cents>coalesce(sum(y.amount_cents),0) order by 4 desc`);
    return { ...t, saldo: t.entradas - t.saidas, porCategoria: cat, inadimplencia: dev };
  });
}
