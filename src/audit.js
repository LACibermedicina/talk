import { pool } from './db.js';
import { sha } from './crypto.js';
const rec = (u, action, entity, entityId, meta, ip, t) => ({ u, action, entity, entityId, meta, ip, t });
export async function audit(req, action, entity, entityId = null, meta = {}) {
  const c = await pool.connect();
  try {
    await c.query('begin'); await c.query('select pg_advisory_xact_lock(7001)');
    const { rows } = await c.query('select hash from audit_log order by id desc limit 1');
    const prev = rows[0]?.hash || 'GENESIS', t = new Date().toISOString(), u = req.user?.sub || null, id = entityId ? String(entityId) : null;
    await c.query('insert into audit_log(at,user_id,action,entity,entity_id,ip,meta,prev_hash,hash) values($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [t, u, action, entity, id, req.ip, JSON.stringify(meta), prev, sha(prev + JSON.stringify(rec(u, action, entity, id, meta, req.ip, t)))]);
    await c.query('commit');
  } catch (e) { await c.query('rollback').catch(() => {}); throw e; } finally { c.release(); }
}
export async function verifyChain() {
  const { rows } = await pool.query('select * from audit_log order by id'); let prev = 'GENESIS';
  for (const r of rows) {
    const h = sha(prev + JSON.stringify(rec(r.user_id, r.action, r.entity, r.entity_id, r.meta, r.ip, r.at.toISOString())));
    if (r.prev_hash !== prev || r.hash !== h) return { ok: false, brokenAt: Number(r.id) };
    prev = r.hash;
  }
  return { ok: true, entries: rows.length };
}
