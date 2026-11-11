// Camada de banco dos créditos: razão (ledger), cobrança por funcionalidade e bloqueio de acesso. Tudo ligado por hooks globais,
// então nenhuma rota de negócio precisa ser alterada. Sem BILLING_ENFORCE e sem custo definido, nada muda para ninguém.
import { q } from './db.js';
import { accessState, featureFor, isOpenWhenLocked } from './billingLogic.js';
const TTL = 30e3, cache = { u: new Map(), costs: null, at: 0 };
export const enforce = () => process.env.BILLING_ENFORCE === 'true';
export const bust = uid => { if (uid) cache.u.delete(uid); else { cache.u.clear(); cache.costs = null; } };
export async function billingRow(uid) {
  const c = cache.u.get(uid); if (c && Date.now() - c.at < TTL) return c.row;
  const [row] = await q('select * from user_billing where user_id=$1', [uid]); cache.u.set(uid, { row: row || null, at: Date.now() }); return row || null;
}
async function costs() { if (!cache.costs || Date.now() - cache.at > TTL) { cache.costs = Object.fromEntries((await q('select feature,cost from credit_costs')).map(r => [r.feature, r.cost])); cache.at = Date.now(); } return cache.costs; }
export async function ensureBilling(uid, init = {}) {
  await q('insert into user_billing(user_id,plan_id,trial_ends,balance,referred_by,token_used) values($1,$2,$3,0,$4,$5) on conflict do nothing', [uid, init.plan_id || null, init.trial_ends || null, init.referred_by || null, init.token || null]); bust(uid);
}
/** Soma (ou subtrai) créditos de forma atômica e registra no razão. Retorna o novo saldo, ou null se o saldo ficaria negativo. */
export async function addCredits(uid, delta, kind, { feature = null, note = null, by = null } = {}) {
  await ensureBilling(uid);
  const r = await q(`with u as (update user_billing set balance=balance+$2,updated_at=now() where user_id=$1 and balance+$2>=0 returning balance)
    insert into credit_ledger(user_id,delta,balance_after,kind,feature,note,created_by) select $1,$2,u.balance,$3,$4,$5,$6 from u returning balance_after`, [uid, delta, kind, feature, note, by]);
  bust(uid); return r.length ? r[0].balance_after : null;
}
/** Ativa/renova um plano: soma o tempo e entrega os créditos do ciclo. */
export async function activatePlan(uid, plan, cycle, { by = null, note = null } = {}) {
  const { planEnds, planCredits } = await import('./billingLogic.js'); await ensureBilling(uid);
  const [b] = await q('select plan_ends from user_billing where user_id=$1', [uid]);
  await q('update user_billing set plan_id=$2,cycle=$3,plan_ends=$4,updated_at=now() where user_id=$1', [uid, plan.id, cycle, planEnds(cycle, b && b.plan_ends)]);
  const n = planCredits(plan, cycle); if (n > 0) await addCredits(uid, n, 'plano', { note: `${plan.name} (${cycle === 'week' ? 'semanal' : 'mensal'})` + (note ? ' · ' + note : ''), by }); bust(uid);
}
export function installBilling(app) {
  app.addHook('preHandler', async (req, rep) => {
    const path = req.url.split('?')[0]; if (!path.startsWith('/api/') || isOpenWhenLocked(path)) return;
    const f = featureFor(req.method, path), on = enforce();
    if (!on && !f) return;
    let u; try { await req.jwtVerify(); u = req.user; } catch { return; } // sem sessão: a rota responde 401 por conta própria
    if (!u || !u.sub || u.role === 'admin') return;
    const row = await billingRow(u.sub);
    const st = accessState(row, { role: u.role, enforce: on });
    if (!st.ok) return rep.code(402).send({ error: st.message, locked: true, reason: st.reason });
    if (!f || !row) return;
    const cost = (await costs())[f] | 0; if (cost <= 0) return;
    const bal = await addCredits(u.sub, -cost, 'uso', { feature: f });
    if (bal === null) return rep.code(402).send({ error: 'Créditos insuficientes para esta ação.', needCredits: true, cost, balance: row.balance });
    req.m3dCharge = { uid: u.sub, cost, feature: f };
  });
  app.addHook('onResponse', async req => { const c = req.m3dCharge; if (c && req.raw.statusCode >= 400) await addCredits(c.uid, c.cost, 'estorno', { feature: c.feature, note: 'ação não concluída' }).catch(() => {}); });
}
/** Renovação automática: planos vencidos com saldo/automação são renovados no mesmo ciclo apenas se o plano for gratuito. Os pagos expiram. */
export async function renewals() {
  const rows = await q(`select b.user_id,b.cycle,b.plan_id from user_billing b join plans p on p.id=b.plan_id where b.auto_renew and b.plan_ends is not null and b.plan_ends<now() and b.cycle is not null and p.price_week=0 and p.price_month=0 and not b.blocked`);
  for (const r of rows) { const [p] = await q('select * from plans where id=$1', [r.plan_id]); if (p && p.active) await activatePlan(r.user_id, p, r.cycle, { note: 'renovação automática' }); }
  return rows.length;
}
