// Quem está online: conexões WebSocket abertas por usuário (uma instância; jobs e sockets in-process).
// O usuário também escolhe como aparece para os outros: online, ocupado ou offline (invisível).
const on = new Map(), st = new Map();
export const STATUSES = ['online', 'busy', 'offline'];
export const connect = id => on.set(id, (on.get(id) || 0) + 1);
export const disconnect = id => { const n = (on.get(id) || 0) - 1; if (n > 0) on.set(id, n); else on.delete(id); };
export const isOnline = id => on.has(id);
export const setStatus = (id, s) => { if (STATUSES.includes(s)) st.set(id, s); };
export const statusOf = id => (!on.has(id) || st.get(id) === 'offline') ? 'offline' : st.get(id) || 'online';
export const withOnline = rows => rows.map(r => { const status = statusOf(r.id); return { ...r, online: status !== 'offline', status }; });
export async function loadStatus(id) { if (st.has(id)) return; try { const { q } = await import('./db.js'), [u] = await q('select presence from users where id=$1', [id]); st.set(id, u ? u.presence : 'online'); } catch { /* sem banco */ } }
