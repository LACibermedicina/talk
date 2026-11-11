import { z } from 'zod';
import argon2 from 'argon2';
import { q } from '../db.js';
import { audit } from '../audit.js';
import { STATUSES, setStatus } from '../presence.js';
export default async function (app) {
  app.post('/api/login', { config: { rateLimit: { max: 8, timeWindow: '1 minute' } } }, async (req, rep) => {
    const b = z.object({ login: z.string().trim().min(1).max(200).optional(), email: z.string().max(200).optional(), password: z.string().min(1).max(200) }).parse(req.body), id = (b.login || b.email || '').trim().toLowerCase();
    const [u] = await q('select * from users where lower(email)=$1 or lower(username)=$1 limit 1', [id]);
    const bad = async why => { if (u) await q("insert into credential_events(user_id,kind,ip) values($1,'login_falha',$2)", [u.id, req.ip]); if (u) await q("update users set failed_logins=case when failed_logins+1>=8 then 0 else failed_logins+1 end, locked_until=case when failed_logins+1>=8 then now()+interval '15 minutes' else locked_until end where id=$1", [u.id]); await audit(req, 'login_falhou', 'user', u?.id, { login: id, why }); return rep.code(401).send({ error: 'credenciais inválidas' }); };
    if (!u) { await argon2.hash(b.password); return bad('desconhecido'); }
    if (u.locked_until && new Date(u.locked_until) > new Date()) { await audit(req, 'login_bloqueado', 'user', u.id); return rep.code(429).send({ error: 'Muitas tentativas erradas. Tente de novo em alguns minutos.' }); }
    if (!(await argon2.verify(u.pw_hash, b.password))) return bad('senha');
    if (!u.active) { if (u.pending) return rep.code(403).send({ error: 'Seu cadastro ainda aguarda aprovação da clínica.' }); return bad('inativo'); }
    await q('update users set failed_logins=0,locked_until=null where id=$1', [u.id]); req.user = { sub: u.id };
    await q('update users set last_login_at=now(),last_login_ip=$2 where id=$1', [u.id, req.ip]); await q("insert into credential_events(user_id,kind,ip) values($1,'login',$2)", [u.id, req.ip]);
    await audit(req, 'login', 'user', u.id);
    rep.setCookie('t', app.jwt.sign({ sub: u.id, role: u.role, name: u.name, mc: u.must_change }, { expiresIn: '8h' }), { httpOnly: true, secure: process.env.COOKIE_SECURE !== 'false', sameSite: 'strict', path: '/', maxAge: 28800 });
    return { id: u.id, name: u.name, role: u.role, lang: u.lang };
  });
  app.post('/api/logout', { preHandler: app.auth }, async (req, rep) => { await audit(req, 'logout', 'user', req.user.sub); rep.clearCookie('t', { path: '/' }); return { ok: true }; });
  app.get('/api/me', { preHandler: app.auth }, async req => (await q('select id,name,username,role,cargo,lang,ai_consent,ask_reason,must_change,is_root,presence,country from users where id=$1', [req.user.sub]))[0]);
  app.post('/api/me/password', { preHandler: app.auth, config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (req, rep) => {
    const b = z.object({ current: z.string().min(1).max(200), next: z.string().min(12, 'A nova senha precisa ter ao menos 12 caracteres').max(200) }).parse(req.body), [u] = await q('select * from users where id=$1', [req.user.sub]);
    if (!(await argon2.verify(u.pw_hash, b.current))) return rep.code(400).send({ error: 'Senha atual incorreta' });
    if (b.current === b.next) return rep.code(400).send({ error: 'Escolha uma senha diferente da atual' });
    await q('update users set pw_hash=$2,must_change=false where id=$1', [u.id, await argon2.hash(b.next)]); await q('update users set pw_changed_at=now() where id=$1', [u.id]); await q("insert into credential_events(user_id,kind,ip) values($1,'senha_trocada',$2)", [u.id, req.ip]); await audit(req, 'trocar_senha', 'user', u.id);
    rep.setCookie('t', app.jwt.sign({ sub: u.id, role: u.role, name: u.name, mc: false }, { expiresIn: '8h' }), { httpOnly: true, secure: process.env.COOKIE_SECURE !== 'false', sameSite: 'strict', path: '/', maxAge: 28800 }); return { ok: true };
  });
  app.put('/api/me/status', { preHandler: app.auth }, async req => { const { status } = z.object({ status: z.enum(STATUSES) }).parse(req.body); await q('update users set presence=$2 where id=$1', [req.user.sub, status]); setStatus(req.user.sub, status); return { ok: true, status }; });
  app.patch('/api/me/consent', { preHandler: app.auth }, async req => { const { aiConsent } = z.object({ aiConsent: z.boolean() }).parse(req.body); await q('update users set ai_consent=$2 where id=$1', [req.user.sub, aiConsent]); await audit(req, 'consentimento_ia', 'user', req.user.sub, { aiConsent }); return { ok: true }; });
}
