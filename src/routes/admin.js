import { z } from 'zod';
import argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import { q } from '../db.js';
import { audit, verifyChain } from '../audit.js';
import { aiHealth } from '../services/ai.js';
import { ALL, ADMIN_STAFF } from '../roles.js';
import { USERNAME } from '../policy.js';
export default async function (app) {
  const A = { preHandler: app.role('admin') }, U = { preHandler: app.role('admin', ...ADMIN_STAFF) }, uuid = z.string().uuid();
  app.get('/api/users', U, req => q(`select id,name,username,pending,email,role,cargo,active,is_root,must_change,last_login_at,failed_logins,(locked_until>now()) bloqueada,pw_changed_at,reg_conselho,reg_numero,reg_uf,icp_ref,(sign_img is not null) tem_assinatura from users ${req.user.role === 'admin' ? '' : "where role<>'admin'"} order by role,name`));
  // Administrador cria qualquer tipo (administrador só o root); recepção/funcionário administrativo cria apenas pacientes.
  app.post('/api/users', U, async (req, rep) => {
    const b = z.object({ name: z.string().min(2).max(120), email: z.string().email(), phone: z.string().max(20).optional(), role: z.enum(ALL), cargo: z.string().max(60).optional(), username: z.string().regex(USERNAME, 'Usuário: letras minúsculas, números, ponto, hífen ou sublinhado (3 a 30)').optional(), password: z.string().min(12).max(200).optional(), lang: z.string().max(5).default('pt') }).parse(req.body);
    if (req.user.role !== 'admin' && b.role !== 'paciente') return rep.code(403).send({ error: 'Seu perfil só cadastra pacientes' });
    if (b.role === 'admin') { const [me] = await q('select is_root from users where id=$1', [req.user.sub]); if (!me.is_root) return rep.code(403).send({ error: 'Somente o root cria administradores' }); }
    const pw = b.password || randomBytes(12).toString('base64url');
    try { const [r] = await q('insert into users(role,name,email,phone,cargo,pw_hash,lang,must_change,username) values($1,$2,$3,$4,$5,$6,$7,true,$8) returning id', [b.role, b.name, b.email.toLowerCase(), b.phone || null, b.cargo || null, await argon2.hash(pw), b.lang, req.user.role === 'admin' ? b.username || null : null]); await audit(req, 'criar', 'user', r.id, { role: b.role }); return b.password ? r : { ...r, tempPassword: pw }; }
    catch (e) { if (e.code === '23505') return rep.code(409).send({ error: 'e-mail ou usuário já cadastrado' }); throw e; }
  });
  app.patch('/api/users/:id/approve', U, async (req, rep) => { const id = uuid.parse(req.params.id), r = await q('update users set active=true,pending=false where id=$1 and pending returning id', [id]); if (!r.length) return rep.code(404).send({ error: 'Cadastro pendente não encontrado' }); await audit(req, 'aprovar_cadastro', 'user', id); return { ok: true }; });
  app.delete('/api/users/:id/pending', U, async (req, rep) => { const id = uuid.parse(req.params.id), r = await q('delete from users where id=$1 and pending returning id', [id]); if (!r.length) return rep.code(404).send({ error: 'Cadastro pendente não encontrado' }); await audit(req, 'recusar_cadastro', 'user', id); return { ok: true }; });
  app.patch('/api/users/:id/active', A, async (req, rep) => {
    const { id } = z.object({ id: uuid }).parse(req.params), { active } = z.object({ active: z.boolean() }).parse(req.body), [t] = await q('select is_root from users where id=$1', [id]);
    if (!t) return rep.code(404).send({ error: 'não encontrado' }); if (t.is_root || id === req.user.sub) return rep.code(403).send({ error: 'O usuário root e a própria conta não podem ser bloqueados' });
    await q('update users set active=$2 where id=$1', [id, active]); await audit(req, active ? 'reativar' : 'bloquear', 'user', id); return { ok: true };
  });
  // Registro profissional (CRM etc.) e imagem de assinatura. A validação do número no conselho (ex.: CFM) é externa e não é feita aqui.
  // Credenciais: redefinição por administrador (senha temporária + troca obrigatória, sessões antigas deixam de valer), desbloqueio e histórico.
  app.post('/api/users/:id/reset-password', A, async (req, rep) => {
    const id = uuid.parse(req.params.id), [t] = await q('select is_root from users where id=$1', [id]); if (!t) return rep.code(404).send({ error: 'Usuário não encontrado' });
    if (t.is_root && id !== req.user.sub) return rep.code(403).send({ error: 'Somente o próprio root redefine a senha do root' });
    const pw = randomBytes(12).toString('base64url'); await q('update users set pw_hash=$2,must_change=true,failed_logins=0,locked_until=null,sessions_valid_after=now(),pw_changed_at=now() where id=$1', [id, await argon2.hash(pw)]);
    await q("insert into credential_events(user_id,kind,ip,by_user) values($1,'senha_redefinida',$2,$3)", [id, req.ip, req.user.sub]); await audit(req, 'redefinir_senha', 'user', id); return { tempPassword: pw };
  });
  app.post('/api/users/:id/unlock', A, async (req) => { const id = uuid.parse(req.params.id); await q('update users set failed_logins=0,locked_until=null where id=$1', [id]); await q("insert into credential_events(user_id,kind,ip,by_user) values($1,'desbloqueio',$2,$3)", [id, req.ip, req.user.sub]); await audit(req, 'desbloquear', 'user', id); return { ok: true }; });
  app.post('/api/users/:id/revoke-sessions', A, async (req) => { const id = uuid.parse(req.params.id); await q('update users set sessions_valid_after=now() where id=$1', [id]); await q("insert into credential_events(user_id,kind,ip,by_user) values($1,'sessao_revogada',$2,$3)", [id, req.ip, req.user.sub]); await audit(req, 'revogar_sessoes', 'user', id); return { ok: true }; });
  app.get('/api/users/:id/credential-events', A, req => q('select e.kind,e.ip,e.at,b.name por from credential_events e left join users b on b.id=e.by_user where e.user_id=$1 order by e.id desc limit 50', [uuid.parse(req.params.id)]));
  app.patch('/api/users/:id/registro', A, async req => {
    const id = uuid.parse(req.params.id), b = z.object({ conselho: z.enum(['CRM', 'CREFITO', 'COREN', 'CRN', 'CRF', 'CRP', 'OUTRO']), numero: z.string().regex(/^[0-9A-Za-z.\-]{3,12}$/, 'Número inválido'), uf: z.string().regex(/^[A-Z]{2}$/, 'UF inválida'), icpRef: z.string().max(120).optional(), assinatura: z.string().max(250000).regex(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/).nullable().optional() }).parse(req.body);
    await q('update users set reg_conselho=$2,reg_numero=$3,reg_uf=$4,icp_ref=$5,sign_img=case when $6::boolean then $7 else sign_img end where id=$1', [id, b.conselho, b.numero, b.uf, b.icpRef || null, b.assinatura !== undefined, b.assinatura ?? null]);
    await audit(req, 'registro_profissional', 'user', id, { conselho: b.conselho, uf: b.uf, assinatura: b.assinatura === undefined ? 'inalterada' : b.assinatura ? 'definida' : 'removida' }); return { ok: true };
  });
  app.post('/api/care-team', U, async req => { const b = z.object({ patientId: uuid, professionalId: uuid }).parse(req.body); await q('insert into care_team values($1,$2) on conflict do nothing', [b.patientId, b.professionalId]); await audit(req, 'vincular', 'care_team', b.patientId, b); return { ok: true }; });
  app.get('/api/alerts', A, () => q('select a.*,u.name user_name,p.name patient_name from alerts a left join users u on u.id=a.user_id left join users p on p.id=a.patient_id where not a.ack order by a.created_at desc limit 200'));
  app.patch('/api/alerts/:id/ack', A, async req => { await q('update alerts set ack=true where id=$1', [uuid.parse(req.params.id)]); return { ok: true }; });
  app.get('/api/audit', A, async req => { const n = z.coerce.number().int().min(1).max(500).default(100).parse(req.query.limit); await audit(req, 'consultar_auditoria', 'audit_log'); return q('select id,"at",user_id,action,entity,entity_id,ip,meta from audit_log order by id desc limit $1', [n]); });
  app.get('/api/ai/health', A, () => aiHealth());
  app.get('/api/audit/verify', A, () => verifyChain());
}
