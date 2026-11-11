// Créditos, planos, tokens, embaixadores e gestão administrativa. Valores de preço vêm SEMPRE do servidor.
import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import { q } from '../db.js';
import { audit } from '../audit.js';
import { saveSettings } from '../settings.js';
import { enforce, billingRow, addCredits, activatePlan, ensureBilling, bust } from '../billing.js';
import { accessState, FEATURES, ambLimits, checkGroup, genCode, normCode, validCode, redeemCheck, redeemEffect, planPrice } from '../billingLogic.js';
const uuid = z.string().uuid(), cyc = z.enum(['week', 'month']);
const PB = () => process.env.PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
const paypalOn = () => !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
async function ptok() { const r = await fetch(PB() + '/v1/oauth2/token', { method: 'POST', headers: { authorization: 'Basic ' + Buffer.from(process.env.PAYPAL_CLIENT_ID + ':' + process.env.PAYPAL_CLIENT_SECRET).toString('base64'), 'content-type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials', signal: AbortSignal.timeout(15000) }); if (!r.ok) throw Object.assign(new Error('PayPal indisponível'), { statusCode: 503 }); return (await r.json()).access_token; }
const bad = (rep, m, c = 400) => rep.code(c).send({ error: m });
export default async function (app) {
  const AUTH = { preHandler: app.auth }, ADM = { preHandler: app.role('admin') };
  const view = async req => {
    const row = await billingRow(req.user.sub), st = accessState(row, { role: req.user.role, enforce: enforce() });
    const [plan] = row && row.plan_id ? await q('select id,name,tier,features from plans where id=$1', [row.plan_id]) : [];
    return { enforced: enforce(), metered: !!row, access: st, balance: row ? row.balance : null, plan: plan || null, cycle: row ? row.cycle : null, trial_ends: row ? row.trial_ends : null, plan_ends: row ? row.plan_ends : null, ambassador: !!(row && row.ambassador), paypal: paypalOn() };
  };
  app.get('/api/billing/me', AUTH, view);
  app.get('/api/billing/plans', AUTH, async () => ({ plans: await q('select id,name,tier,description,price_week,price_month,credits_week,credits_month,features from plans where active order by sort,tier'), costs: await q('select c.feature,c.label,c.cost from credit_costs c order by c.feature') }));
  app.get('/api/billing/ledger', AUTH, req => q('select id,delta,balance_after,kind,feature,note,created_at from credit_ledger where user_id=$1 order by id desc limit 60', [req.user.sub]));
  // Compra: plano gratuito ativa na hora; pago usa PayPal (se configurado) ou fica pendente para o administrador confirmar o pagamento.
  app.post('/api/billing/checkout', { ...AUTH, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, rep) => {
    const b = z.object({ plan: z.string().max(30), cycle: cyc }).parse(req.body), [p] = await q('select * from plans where id=$1 and active', [b.plan]); if (!p) return bad(rep, 'Plano não encontrado.', 404);
    const price = planPrice(p, b.cycle);
    if (price <= 0) { await activatePlan(req.user.sub, p, b.cycle, { note: 'plano gratuito' }); await audit(req, 'plano_ativado', 'user', req.user.sub, { plano: p.id }); return { active: true }; }
    const [o] = await q("insert into billing_orders(user_id,plan_id,cycle,amount,method) values($1,$2,$3,$4,$5) returning id", [req.user.sub, p.id, b.cycle, price, paypalOn() ? 'paypal' : 'manual']);
    if (!paypalOn()) return { orderId: o.id, manual: true, message: 'Pedido registrado. O administrador confirma o pagamento e libera seu plano.' };
    const r = await fetch(PB() + '/v2/checkout/orders', { method: 'POST', headers: { authorization: 'Bearer ' + await ptok(), 'content-type': 'application/json' }, body: JSON.stringify({ intent: 'CAPTURE', purchase_units: [{ reference_id: 'bo' + o.id, description: `Talk.M3D ${p.name} (${b.cycle === 'week' ? 'semanal' : 'mensal'})`, amount: { currency_code: 'BRL', value: price.toFixed(2) } }] }), signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw Object.assign(new Error('PayPal indisponível'), { statusCode: 503 }); const j = await r.json(); await q('update billing_orders set note=$2 where id=$1', [o.id, 'paypal:' + j.id]); return { orderId: o.id, paypalId: j.id };
  });
  app.post('/api/billing/orders/:id/capture', AUTH, async (req, rep) => {
    const id = z.coerce.number().int().positive().parse(req.params.id), [o] = await q("select * from billing_orders where id=$1 and user_id=$2 and status='pendente' and method='paypal'", [id, req.user.sub]); if (!o) return bad(rep, 'Pedido não encontrado.', 404);
    const pid = (o.note || '').replace('paypal:', ''); if (!/^[A-Z0-9]{10,30}$/.test(pid)) return bad(rep, 'Pedido inválido.');
    const r = await fetch(`${PB()}/v2/checkout/orders/${pid}/capture`, { method: 'POST', headers: { authorization: 'Bearer ' + await ptok(), 'content-type': 'application/json' }, signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw Object.assign(new Error('PayPal indisponível'), { statusCode: 503 }); const j = await r.json(), cap = j.purchase_units?.[0]?.payments?.captures?.[0];
    if (j.status !== 'COMPLETED' || !cap || cap.amount.currency_code !== 'BRL' || Math.abs(parseFloat(cap.amount.value) - Number(o.amount)) > 0.01) return bad(rep, 'Pagamento não confirmado.', 402);
    const done = await q("update billing_orders set status='pago',paid_at=now() where id=$1 and status='pendente' returning plan_id,cycle", [id]); if (!done.length) return bad(rep, 'Pedido já processado.', 409);
    const [p] = await q('select * from plans where id=$1', [done[0].plan_id]); await activatePlan(req.user.sub, p, done[0].cycle, { note: 'PayPal' }); await audit(req, 'plano_pago_paypal', 'order', String(id), { plano: p.id }); return { ok: true };
  });
  // Token informado depois do cadastro (ex.: convite recebido depois): soma teste/créditos uma única vez por token.
  app.post('/api/billing/redeem', { ...AUTH, config: { rateLimit: { max: 8, timeWindow: '10 minutes' } } }, async (req, rep) => {
    const code = normCode(z.object({ code: z.string().max(40) }).parse(req.body).code), [t] = validCode(code) ? await q('select * from signup_tokens where code=$1', [code]) : [];
    const chk = redeemCheck(t, { signupMode: 'approval' }); if (!chk.ok) return bad(rep, chk.error);
    if (t.owner_id === req.user.sub) return bad(rep, 'Você não pode usar o seu próprio token.');
    const claimed = await q('insert into token_uses(code,user_id) values($1,$2) on conflict do nothing returning 1', [code, req.user.sub]); if (!claimed.length) return bad(rep, 'Você já usou este token.', 409);
    const used = await q('update signup_tokens set uses=uses+1 where code=$1 and active and (max_uses is null or uses<max_uses) returning 1', [code]); if (!used.length) { await q('delete from token_uses where code=$1 and user_id=$2', [code, req.user.sub]); return bad(rep, 'Este token já atingiu o limite de usos.'); }
    const fx = redeemEffect(t); await ensureBilling(req.user.sub);
    if (fx.trial_ends) await q('update user_billing set trial_ends=greatest(coalesce(trial_ends,now()),$2),plan_id=coalesce(plan_id,$3) where user_id=$1', [req.user.sub, fx.trial_ends, fx.plan_id]);
    if (fx.credits) await addCredits(req.user.sub, fx.credits, 'token', { note: code }); if (fx.ownerReward) await addCredits(t.owner_id, fx.ownerReward, 'indicacao', { note: `${code} usado` }); bust(req.user.sub);
    return { ok: true, credits: fx.credits, trial_ends: fx.trial_ends };
  });
  // ---------- embaixador ----------
  const amb = async (req, rep) => { const row = await billingRow(req.user.sub); if (!row || !row.ambassador) { bad(rep, 'Disponível apenas para embaixadores.', 403); return null; } return row; };
  app.get('/api/billing/ambassador', AUTH, async (req, rep) => {
    if (!(await amb(req, rep))) return; const lim = ambLimits(process.env);
    const groups = await q(`select group_id,min(label) label,count(*)::int tokens,sum(uses)::int usos,sum(coalesce(max_uses,0))::int capacidade,min(created_at) criado,json_agg(json_build_object('code',code,'uses',uses,'max',max_uses,'active',active) order by code) lista from signup_tokens where owner_id=$1 and group_id is not null group by group_id order by min(created_at) desc`, [req.user.sub]);
    const [r] = await q("select coalesce(sum(delta),0)::int ganho from credit_ledger where user_id=$1 and kind='indicacao'", [req.user.sub]);
    return { limits: lim, groups, ganho: r.ganho, restante: Math.max(0, lim.maxGroups - groups.length) };
  });
  app.post('/api/billing/ambassador/groups', { ...AUTH, config: { rateLimit: { max: 6, timeWindow: '1 hour' } } }, async (req, rep) => {
    if (!(await amb(req, rep))) return; const lim = ambLimits(process.env);
    const g = z.object({ label: z.string().trim().max(60).default(''), count: z.number().int().min(1).max(1000), max_uses: z.number().int().min(1).max(1000), credits: z.number().int().min(0).max(1e6).default(0), trial_days: z.number().int().min(0).max(365).default(0) }).parse(req.body);
    const [{ n }] = await q('select count(distinct group_id)::int n from signup_tokens where owner_id=$1 and group_id is not null', [req.user.sub]), err = checkGroup(g, lim, { groupsSoFar: n }); if (err) return bad(rep, err);
    const plan = process.env.AMB_PLAN || 'basico', gid = 'G' + randomBytes(4).toString('hex').toUpperCase(), codes = [];
    for (let i = 0; i < g.count; i++) { const code = genCode(randomBytes(6), 'AMB-'); codes.push(code); await q('insert into signup_tokens(code,kind,label,trial_days,plan_id,credits,reward_owner,owner_id,group_id,max_uses,created_by) values($1,$2,$3,$4,(select id from plans where id=$5),$6,$7,$8,$9,$10,$8) on conflict do nothing', [code, 'embaixador', g.label || 'Grupo ' + gid, g.trial_days, plan, g.credits, lim.reward, req.user.sub, gid, g.max_uses]); }
    await audit(req, 'grupo_tokens', 'user', req.user.sub, { grupo: gid, qtd: g.count }); return { group_id: gid, codes };
  });
  app.patch('/api/billing/ambassador/tokens/:code', AUTH, async (req, rep) => { if (!(await amb(req, rep))) return; const { active } = z.object({ active: z.boolean() }).parse(req.body); const r = await q('update signup_tokens set active=$3 where code=$1 and owner_id=$2 and kind=$4 returning code', [normCode(req.params.code), req.user.sub, active, 'embaixador']); return r.length ? { ok: true } : bad(rep, 'Token não encontrado.', 404); });
  // ---------- administração ----------
  app.get('/api/admin/billing/overview', ADM, async () => {
    const [c] = await q(`select count(*)::int medidos, count(*) filter (where blocked)::int bloqueados, count(*) filter (where plan_ends>now())::int com_plano, count(*) filter (where (plan_ends is null or plan_ends<=now()) and trial_ends>now())::int em_teste, count(*) filter (where ambassador)::int embaixadores, coalesce(sum(balance),0)::int saldo_total from user_billing`);
    const [o] = await q("select count(*)::int pendentes from billing_orders where status='pendente'");
    const keys = ['BILLING_ENFORCE', 'AMB_MAX_GROUPS', 'AMB_MAX_TOKENS', 'AMB_MAX_USES', 'AMB_MAX_CREDITS', 'AMB_MAX_TRIAL_DAYS', 'AMB_REWARD', 'AMB_PLAN'];
    return { ...c, pedidos_pendentes: o.pendentes, settings: Object.fromEntries(keys.map(k => [k, process.env[k] || null])), limits: ambLimits(process.env), features: FEATURES.map(f => ({ key: f[0], label: f[1], group: f[2] })) };
  });
  app.put('/api/admin/billing/settings', ADM, async (req) => { const b = z.object({ BILLING_ENFORCE: z.enum(['true', 'false']).optional(), AMB_MAX_GROUPS: z.coerce.number().int().min(0).max(999).optional(), AMB_MAX_TOKENS: z.coerce.number().int().min(0).max(9999).optional(), AMB_MAX_USES: z.coerce.number().int().min(0).max(9999).optional(), AMB_MAX_CREDITS: z.coerce.number().int().min(0).max(999999).optional(), AMB_MAX_TRIAL_DAYS: z.coerce.number().int().min(0).max(365).optional(), AMB_REWARD: z.coerce.number().int().min(0).max(999999).optional(), AMB_PLAN: z.string().regex(/^[a-z][a-z0-9_-]{2,29}$/).optional() }).parse(req.body); await saveSettings(Object.fromEntries(Object.entries(b).map(([k, v]) => [k, String(v)]))); bust(); await audit(req, 'billing_config', 'settings', 'billing', b); return { ok: true }; });
  app.get('/api/admin/billing/plans', ADM, () => q('select * from plans order by sort,tier'));
  app.put('/api/admin/billing/plans/:id', ADM, async (req) => {
    const id = z.string().regex(/^[a-z][a-z0-9_-]{2,29}$/).parse(req.params.id), b = z.object({ name: z.string().trim().min(2).max(40), tier: z.number().int().min(1).max(20), description: z.string().max(240).default(''), price_week: z.number().min(0).max(1e6), price_month: z.number().min(0).max(1e6), credits_week: z.number().int().min(0).max(1e7), credits_month: z.number().int().min(0).max(1e7), features: z.record(z.union([z.string().max(60), z.number(), z.boolean()])).default({}), active: z.boolean().default(true), sort: z.number().int().min(0).max(99).default(0) }).parse(req.body);
    await q(`insert into plans(id,name,tier,description,price_week,price_month,credits_week,credits_month,features,active,sort) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) on conflict(id) do update set name=$2,tier=$3,description=$4,price_week=$5,price_month=$6,credits_week=$7,credits_month=$8,features=$9,active=$10,sort=$11`, [id, b.name, b.tier, b.description, b.price_week, b.price_month, b.credits_week, b.credits_month, JSON.stringify(b.features), b.active, b.sort]); await audit(req, 'plano_editado', 'plan', id, {}); return { ok: true };
  });
  app.get('/api/admin/billing/costs', ADM, () => q('select feature,label,cost from credit_costs order by feature'));
  app.put('/api/admin/billing/costs', ADM, async (req) => { const b = z.array(z.object({ feature: z.string().max(40), cost: z.number().int().min(0).max(1e6) })).max(50).parse(req.body); for (const c of b) await q('update credit_costs set cost=$2 where feature=$1', [c.feature, c.cost]); bust(); await audit(req, 'custos_creditos', 'settings', 'costs', { n: b.length }); return { ok: true }; });
  app.get('/api/admin/billing/users', ADM, req => { const s = String(req.query.q || '').trim().slice(0, 60); return q(`select u.id,u.name,u.email,u.role,u.active,u.pending,b.plan_id,b.cycle,b.balance,b.trial_ends,b.plan_ends,b.blocked,b.blocked_reason,b.ambassador,b.token_used,(b.user_id is not null) medido from users u left join user_billing b on b.user_id=u.id where u.role<>'admin' and ($1='' or u.name ilike '%'||$1||'%' or u.email ilike '%'||$1||'%') order by u.name limit 200`, [s]); });
  app.post('/api/admin/billing/users/:id', ADM, async (req, rep) => {
    const id = uuid.parse(req.params.id), b = z.object({ action: z.enum(['credits', 'plan', 'trial', 'block', 'unblock', 'ambassador', 'meter']), credits: z.number().int().min(-1e7).max(1e7).optional(), plan: z.string().max(30).optional(), cycle: cyc.optional(), days: z.number().int().min(0).max(3650).optional(), reason: z.string().max(200).optional(), on: z.boolean().optional(), note: z.string().max(200).optional() }).parse(req.body);
    if (!(await q('select 1 from users where id=$1', [id])).length) return bad(rep, 'Usuário não encontrado.', 404); await ensureBilling(id);
    if (b.action === 'credits') { const n = await addCredits(id, b.credits || 0, b.credits < 0 ? 'ajuste' : 'concessao', { note: b.note || null, by: req.user.sub }); if (n === null) return bad(rep, 'O saldo não pode ficar negativo.'); }
    if (b.action === 'plan') { const [p] = await q('select * from plans where id=$1', [b.plan]); if (!p) return bad(rep, 'Plano não encontrado.'); await activatePlan(id, p, b.cycle || 'month', { by: req.user.sub, note: 'concedido pelo administrador' }); }
    if (b.action === 'trial') await q("update user_billing set trial_ends=now()+make_interval(days=>$2) where user_id=$1", [id, b.days || 0]);
    if (b.action === 'block') await q('update user_billing set blocked=true,blocked_reason=$2 where user_id=$1', [id, b.reason || null]); if (b.action === 'unblock') await q('update user_billing set blocked=false,blocked_reason=null where user_id=$1', [id]);
    if (b.action === 'ambassador') await q('update user_billing set ambassador=$2 where user_id=$1', [id, b.on !== false]);
    bust(id); await audit(req, 'billing_usuario', 'user', id, { acao: b.action }); return { ok: true };
  });
  app.post('/api/admin/billing/distribute', ADM, async (req, rep) => {
    const b = z.object({ credits: z.number().int().min(1).max(1e6), role: z.string().max(20).optional(), plan: z.string().max(30).optional(), note: z.string().max(120).default('distribuição') }).parse(req.body);
    const ids = await q(`select b.user_id from user_billing b join users u on u.id=b.user_id where u.active and not b.blocked and ($1::text is null or u.role=$1) and ($2::text is null or b.plan_id=$2) limit 5000`, [b.role || null, b.plan || null]);
    for (const r of ids) await addCredits(r.user_id, b.credits, 'distribuicao', { note: b.note, by: req.user.sub }); await audit(req, 'distribuicao_creditos', 'settings', 'billing', { n: ids.length, credits: b.credits }); return { usuarios: ids.length };
  });
  app.get('/api/admin/billing/ledger', ADM, req => { const u = req.query.user ? uuid.parse(req.query.user) : null; return q(`select l.id,l.delta,l.balance_after,l.kind,l.feature,l.note,l.created_at,u.name from credit_ledger l join users u on u.id=l.user_id where ($1::uuid is null or l.user_id=$1) order by l.id desc limit 100`, [u]); });
  app.get('/api/admin/billing/tokens', ADM, () => q(`select t.*,o.name owner_name from signup_tokens t left join users o on o.id=t.owner_id order by t.kind,t.created_at desc limit 500`));
  app.post('/api/admin/billing/tokens', ADM, async (req, rep) => {
    const b = z.object({ code: z.string().max(24).optional(), label: z.string().max(80).default(''), trial_days: z.number().int().min(0).max(3650).default(0), plan_id: z.string().max(30).nullable().default(null), credits: z.number().int().min(0).max(1e7).default(0), reward_owner: z.number().int().min(0).max(1e7).default(0), owner_id: uuid.nullable().default(null), max_uses: z.number().int().min(1).max(1e6).nullable().default(null), expires_at: z.string().datetime().nullable().default(null) }).parse(req.body);
    const code = b.code ? normCode(b.code) : genCode(randomBytes(6), 'PRO-'); if (!validCode(code)) return bad(rep, 'Código inválido: use 3 a 24 letras, números ou hífen.');
    try { await q('insert into signup_tokens(code,kind,label,trial_days,plan_id,credits,reward_owner,owner_id,max_uses,expires_at,created_by) values($1,$2,$3,$4,(select id from plans where id=$5),$6,$7,$8,$9,$10,$11)', [code, 'promo', b.label, b.trial_days, b.plan_id, b.credits, b.reward_owner, b.owner_id, b.max_uses, b.expires_at, req.user.sub]); } catch (e) { if (e.code === '23505') return bad(rep, 'Já existe um token com este código.', 409); throw e; }
    await audit(req, 'token_criado', 'token', code, {}); return { code };
  });
  app.patch('/api/admin/billing/tokens/:code', ADM, async (req, rep) => { const b = z.object({ active: z.boolean().optional(), max_uses: z.number().int().min(1).nullable().optional(), trial_days: z.number().int().min(0).max(3650).optional(), credits: z.number().int().min(0).optional(), reward_owner: z.number().int().min(0).optional() }).parse(req.body), code = normCode(req.params.code); const cur = await q('select * from signup_tokens where code=$1', [code]); if (!cur.length) return bad(rep, 'Token não encontrado.', 404); const n = { ...cur[0], ...b }; await q('update signup_tokens set active=$2,max_uses=$3,trial_days=$4,credits=$5,reward_owner=$6 where code=$1', [code, n.active, n.max_uses, n.trial_days, n.credits, n.reward_owner]); await audit(req, 'token_editado', 'token', code, b); return { ok: true }; });
  app.get('/api/admin/billing/orders', ADM, () => q(`select o.id,o.status,o.method,o.amount,o.cycle,o.plan_id,o.created_at,o.paid_at,u.name,u.email from billing_orders o join users u on u.id=o.user_id order by (o.status='pendente') desc,o.id desc limit 100`));
  app.post('/api/admin/billing/orders/:id/:acao', ADM, async (req, rep) => {
    const id = z.coerce.number().int().positive().parse(req.params.id), acao = z.enum(['approve', 'cancel']).parse(req.params.acao);
    const r = await q("update billing_orders set status=$2,paid_at=case when $2='pago' then now() else null end where id=$1 and status='pendente' returning user_id,plan_id,cycle", [id, acao === 'approve' ? 'pago' : 'cancelado']); if (!r.length) return bad(rep, 'Pedido não está pendente.', 409);
    if (acao === 'approve') { const [p] = await q('select * from plans where id=$1', [r[0].plan_id]); await activatePlan(r[0].user_id, p, r[0].cycle, { by: req.user.sub, note: 'pagamento confirmado' }); } await audit(req, 'pedido_' + acao, 'order', String(id), {}); return { ok: true };
  });
}
