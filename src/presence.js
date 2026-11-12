// Quem está online: conexões WebSocket abertas por usuário (uma instância; jobs e sockets in-process).
// O usuário também escolhe como aparece para os outros: online, ocupado ou offline (invisível).
const on = new Map(), st = new Map();
export const STATUSES = ['online', 'busy', 'offline'];
export const connect = id => on.set(id, (on.get(id) || 0) + 1);
export const disconnect = id => { const n = (on.get(id) || 0) - 1; if (n > 0) on.set(id, n); else on.delete(id); };
// Online = conexão WebSocket aberta OU atividade HTTP recente (batimento do app): funciona mesmo se o proxy bloquear o WebSocket.
const seen = new Map(), SEEN_MS = 90000;
export const touch = id => { seen.set(id, Date.now()); if (!st.has(id)) loadStatus(id); };
export const forget = id => { seen.delete(id); };
export const isOnline = id => on.has(id) || (Date.now() - (seen.get(id) || 0) < SEEN_MS);
export const setStatus = (id, s) => { if (STATUSES.includes(s)) st.set(id, s); };
export const statusOf = id => (!isOnline(id) || st.get(id) === 'offline') ? 'offline' : st.get(id) || 'online';
export const withOnline = rows => rows.map(r => { const status = statusOf(r.id); return { ...r, online: status !== 'offline', status }; });
export async function loadStatus(id) { if (st.has(id)) return; try { const { q } = await import('./db.js'), [u] = await q('select presence from users where id=$1', [id]); st.set(id, u ? u.presence : 'online'); } catch { /* sem banco */ } }

// Conexões abertas por usuário: permitem derrubar na hora quem foi inativado.
const socks = new Map();
export function track(id, sock) { if (!socks.has(id)) socks.set(id, new Set()); socks.get(id).add(sock); sock.on('close', () => { const s = socks.get(id); if (s) { s.delete(sock); if (!s.size) socks.delete(id); } }); }
export function kick(id) { for (const s of [...(socks.get(id) || [])]) { try { s.close(1008, 'conta inativada'); } catch { /* já fechado */ } } socks.delete(id); }
