import { z } from 'zod';
import { q, pool } from '../db.js';
import { audit } from '../audit.js';
import { HEALTH } from '../roles.js';
import { NODES, KINDS, defaults, normEdges, makeRules, normPeriods, urgencyOpen } from '../contactLogic.js';
export const loadRules = async () => makeRules(await q('select kind,from_role,to_role from contact_rules'));
export default async function (app) {
  const ADM = { preHandler: app.role('admin') };
  const view = rules => Object.fromEntries(Object.keys(KINDS).map(k => [k, { configured: !!rules[k], edges: [...(rules[k] || defaults(k))].map(s => s.split('>')) }]));
  // Grafo: nós = níveis de usuário; arestas orientadas "quem pode contatar quem", uma camada por tipo de conexão.
  app.get('/api/admin/contact-rules', ADM, async () => ({ nodes: NODES, kinds: KINDS, rules: view(await loadRules()) }));
  app.put('/api/admin/contact-rules', ADM, async (req, rep) => {
    const b = z.object({ kind: z.enum(Object.keys(KINDS)), edges: z.array(z.array(z.string().max(30)).length(2)).max(400) }).parse(req.body), edges = normEdges(b.edges), c = await pool.connect();
    try { await c.query('begin'); await c.query('delete from contact_rules where kind=$1', [b.kind]); await c.query("insert into contact_rules(kind,from_role,to_role) values($1,'*','*')", [b.kind]); for (const [f, t] of edges) await c.query('insert into contact_rules(kind,from_role,to_role) values($1,$2,$3)', [b.kind, f, t]); await c.query('commit'); } catch (e) { await c.query('rollback').catch(() => {}); throw e; } finally { c.release(); }
    await audit(req, 'grafo_contatos', 'settings', b.kind, { arestas: edges.length }); return { ok: true, edges };
  });
  app.delete('/api/admin/contact-rules/:kind', ADM, async (req, rep) => { const kind = z.enum(Object.keys(KINDS)).parse(req.params.kind); await q('delete from contact_rules where kind=$1', [kind]); await audit(req, 'grafo_contatos_padrao', 'settings', kind); return { ok: true }; });
  // Urgência: por padrão todo profissional atende; só deixa de atender quem indicar (nunca / só em períodos).
  app.get('/api/me/urgency', { preHandler: app.role(...HEALTH) }, async req => { const [u] = await q('select urgency_mode mode,urgency_periods periods,urgency_set "set" from users where id=$1', [req.user.sub]); return { ...u, openNow: urgencyOpen(u.mode, u.periods) }; });
  app.put('/api/me/urgency', { preHandler: app.role(...HEALTH) }, async req => {
    const b = z.object({ mode: z.enum(['sempre', 'nunca', 'periodos']), periods: z.array(z.any()).max(14).optional() }).parse(req.body), p = normPeriods(b.periods);
    await q('update users set urgency_mode=$2,urgency_periods=$3,urgency_set=true where id=$1', [req.user.sub, b.mode, JSON.stringify(p)]); await audit(req, 'urgencia_config', 'user', req.user.sub, { mode: b.mode }); return { ok: true, mode: b.mode, periods: p, openNow: urgencyOpen(b.mode, p) };
  });
}
