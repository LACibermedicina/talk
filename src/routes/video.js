import { z } from 'zod';
import agora from 'agora-token';
const { RtcTokenBuilder, RtcRole } = agora;
import { randomBytes } from 'node:crypto';
import { q } from '../db.js';
import { enc, dec, sha, signGuest, verifyGuest } from '../crypto.js';
import { audit } from '../audit.js';
import { transcribe, translate } from '../services/ai.js';
import { HEALTH } from '../roles.js';
const uidOf = s => parseInt(sha(String(s)).slice(0, 8), 16) % 2147483646 + 1;
const token = (apt, uid, observer) => RtcTokenBuilder.buildTokenWithUid(process.env.AGORA_APP_ID, process.env.AGORA_APP_CERTIFICATE, 'apt-' + apt, uid, observer ? RtcRole.SUBSCRIBER : RtcRole.PUBLISHER, 7200, 7200);
const apptOf = async (id, u) => { const [a] = await q('select * from appointments where id=$1', [id]); return a && (a.patient_id === u.sub || a.professional_id === u.sub) ? a : null; };
const PERM = { observador: { canPublish: false, canPublishData: false }, equipe: { canPublish: true, canPublishData: true }, consultor: { canPublish: true, canPublishData: true } };
export default async function (app) {
  const uuid = z.string().uuid();
  app.post('/api/video/token', { preHandler: app.auth }, async (req, rep) => {
    const { appointmentId } = z.object({ appointmentId: uuid }).parse(req.body), a = await apptOf(appointmentId, req.user);
    if (!a || ['cancelado', 'finalizado', 'faltou'].includes(a.status)) return rep.code(404).send({ error: 'consulta indisponível' });
    await audit(req, 'video_entrar', 'appointment', a.id); const uid = uidOf(req.user.sub); return { appId: process.env.AGORA_APP_ID, channel: 'apt-' + a.id, uid, token: token(a.id, uid, false), observer: false };
  });
  app.post('/api/video/invite', { preHandler: app.role(...HEALTH) }, async (req, rep) => {
    const b = z.object({ appointmentId: uuid, name: z.string().min(2).max(80), role: z.enum(['observador', 'equipe', 'consultor']) }).parse(req.body), a = await apptOf(b.appointmentId, req.user);
    if (!a || a.professional_id !== req.user.sub || a.status !== 'em_atendimento') return rep.code(409).send({ error: 'convites só durante a consulta em andamento, pelo profissional responsável' });
    await audit(req, 'convidar', 'appointment', a.id, { role: b.role, name: b.name });
    return { link: `${process.env.APP_ORIGIN}/convite/${signGuest({ apt: a.id, n: b.name, r: b.role, jti: randomBytes(6).toString('hex') }, 7200)}` };
  });
  app.post('/api/video/guest', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req, rep) => {
    const { token: t } = z.object({ token: z.string().max(600) }).parse(req.body), g = verifyGuest(t);
    const [a] = g ? await q('select status from appointments where id=$1', [g.apt]) : [];
    if (!a || a.status !== 'em_atendimento') return rep.code(403).send({ error: 'link expirado ou consulta encerrada' });
    await audit({ ip: req.ip, user: null }, 'video_convidado', 'appointment', g.apt, { name: g.n, role: g.r });
    const uid = uidOf(g.jti); return { appId: process.env.AGORA_APP_ID, channel: 'apt-' + g.apt, uid, token: token(g.apt, uid, g.r === 'observador'), name: g.n, observer: g.r === 'observador' };
  });
  app.post('/api/consults/:id/audio', { preHandler: app.auth }, async (req, rep) => {
    const id = uuid.parse(req.params.id), { lang, to } = z.object({ lang: z.string().max(5).optional(), to: z.string().max(5).optional() }).parse(req.query), a = await apptOf(id, req.user);
    if (!a) return rep.code(404).send({ error: 'não encontrado' });
    const [cs] = await q('select transcribing,patient_consent from consult_state where appointment_id=$1', [id]);
    if (!cs || !cs.transcribing) return rep.code(409).send({ error: 'transcrição não ativada pelo profissional' });
    if (req.user.role === 'paciente') { if (cs.patient_consent !== true) return rep.code(403).send({ error: 'sem consentimento do paciente para a transcrição' }); }
    else { const [me] = await q('select ai_consent from users where id=$1', [req.user.sub]); if (!me.ai_consent) return rep.code(403).send({ error: 'consentimento para transcrição por IA necessário' }); }
    const f = await req.file(); if (!f) return rep.code(400).send({ error: 'envie o áudio' });
    const text = (await transcribe(await f.toBuffer(), f.mimetype, lang))?.trim(); if (!text) return { empty: true };
    const tr = to && to !== lang ? await translate(text, to) : null;
    await q('insert into transcripts(appointment_id,speaker_id,lang,text_enc,translated_enc,to_lang) values($1,$2,$3,$4,$5,$6)', [id, req.user.sub, lang || null, enc(text), tr ? enc(tr) : null, tr ? to : null]);
    return { speaker: req.user.name, text: req.user.role === 'paciente' ? undefined : text, translated: tr };
  });
  app.get('/api/consults/:id/transcript', { preHandler: app.role(...HEALTH) }, async (req, rep) => {
    const id = uuid.parse(req.params.id), a = await apptOf(id, req.user); if (!a) return rep.code(404).send({ error: 'não encontrado' });
    await audit(req, 'read', 'transcript', id);
    return (await q('select t.created_at,u.name speaker,u.role,t.text_enc,t.translated_enc,t.to_lang from transcripts t join users u on u.id=t.speaker_id where t.appointment_id=$1 order by t.created_at', [id])).map(r => ({ at: r.created_at, speaker: r.speaker, role: r.role, text: dec(r.text_enc), translated: r.translated_enc ? dec(r.translated_enc) : null, to: r.to_lang }));
  });
}
