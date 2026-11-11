import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import { q } from '../db.js';
import { enc, sha, seal } from '../crypto.js';
import { audit } from '../audit.js';
import { canSeeFull as canSee } from '../access.js';
import { renderPdf } from '../services/pdf.js';
import { sendSms } from '../services/sms.js';
import { DOCS } from '../roles.js';
import { USABLE } from '../followup.js';
export default async function (app) {
  const uuid = z.string().uuid();
  // Assinatura eletrônica simples: HMAC do servidor + SHA-256 + imagem de assinatura e registro (CRM etc.) configurados pelo administrador.
  app.post('/api/documents', { preHandler: app.role(...Object.keys(DOCS)) }, async (req, rep) => {
    const b = z.object({ patientId: uuid, kind: z.enum(['receita', 'atestado', 'pedido_exames', 'relatorio']), texto: z.string().min(3).max(5000), maxUses: z.number().int().min(1).max(12).default(1), validDays: z.number().int().min(1).max(365).optional() }).parse(req.body);
    if (!(DOCS[req.user.role] || []).includes(b.kind)) return rep.code(403).send({ error: 'tipo de documento não permitido para sua profissão' });
    if (!await canSee(req.user, b.patientId)) return rep.code(403).send({ error: 'sem vínculo com o paciente' });
    const [me] = await q('select reg_conselho,reg_numero,reg_uf from users where id=$1', [req.user.sub]);
    if (b.kind === 'receita' && !(me.reg_conselho && me.reg_numero && me.reg_uf)) return rep.code(409).send({ error: 'Registro profissional (ex.: CRM) não configurado. Peça ao administrador.' });
    const at = new Date().toISOString(), valid = USABLE.includes(b.kind) ? new Date(Date.now() + (b.validDays || 30) * 864e5).toISOString() : null, token = randomBytes(18).toString('base64url');
    const hash = sha({ p: b.patientId, a: req.user.sub, k: b.kind, t: b.texto, at, m: b.maxUses, v: valid });
    const [d] = await q('insert into documents(patient_id,author_id,kind,texto,hash,seal,created_at,token,max_uses,valid_until) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id', [b.patientId, req.user.sub, b.kind, b.texto, hash, seal(hash), at, token, USABLE.includes(b.kind) ? b.maxUses : 1, valid]);
    const room = 'dm:' + [b.patientId, req.user.sub].sort().join(':');
    await q('insert into messages(room,sender_id,body_enc) values($1,$2,$3)', [room, req.user.sub, enc(`Documento disponível (${b.kind}): ${process.env.APP_ORIGIN}/api/documents/${d.id}/pdf`)]);
    const [p] = await q('select phone from users where id=$1', [b.patientId]); if (p?.phone) await sendSms(p.phone, 'Você recebeu um novo documento no app.');
    await audit(req, 'emitir', 'document', d.id, { kind: b.kind, patient: b.patientId, maxUses: b.maxUses }); return { id: d.id, hash };
  });
  app.get('/api/documents/:id/pdf', { preHandler: app.auth }, async (req, rep) => {
    const [d] = await q('select d.*,p.name patient,a.name author,a.reg_conselho,a.reg_numero,a.reg_uf,a.sign_img from documents d join users p on p.id=d.patient_id join users a on a.id=d.author_id where d.id=$1', [uuid.parse(req.params.id)]);
    if (!d || !(req.user.sub === d.author_id || await canSee(req.user, d.patient_id))) return rep.code(404).send({ error: 'não encontrado' });
    await audit(req, 'read', 'document', d.id);
    const reg = d.reg_conselho ? `${d.reg_conselho} ${d.reg_numero}/${d.reg_uf}` : '';
    return rep.header('content-type', 'application/pdf').header('content-disposition', `inline; filename="${d.kind}-${d.id.slice(0, 8)}.pdf"`).send(await renderPdf(d, d.patient, { name: d.author, reg, img: d.sign_img }));
  });
  app.get('/api/verify/:id', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req, rep) => {
    const [d] = await q('select d.id,d.kind,d.hash,d.seal,d.created_at,a.name author from documents d join users a on a.id=d.author_id where d.id=$1', [uuid.parse(req.params.id)]);
    if (!d) return rep.code(404).send({ valido: false });
    return { valido: d.seal === seal(d.hash), tipo: d.kind, emitidoPor: d.author, emitidoEm: d.created_at, hash: d.hash };
  });
}
