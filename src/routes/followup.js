import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import QRCode from 'qrcode';
import { q } from '../db.js';
import { audit } from '../audit.js';
import { canSee, canSeeFull } from '../access.js';
import { HEALTH } from '../roles.js';
import { USABLE, docStatus, routineState, advance, routineView } from '../followup.js';
const svg = (rep, url) => QRCode.toString(url, { type: 'svg', margin: 1 }).then(s => rep.header('content-type', 'image/svg+xml').header('cache-control', 'private, max-age=300').send(s));
export default async function (app) {
  const uuid = z.string().uuid(), A = { preHandler: app.auth };
  app.get('/api/notifications', A, req => q('select n.id,n.kind,n.title,n.body,n.patient_id,p.name patient,n.created_at,n.read_at from notifications n left join users p on p.id=n.patient_id where n.user_id=$1 order by n.created_at desc limit 60', [req.user.sub]));
  app.get('/api/notifications/count', A, async req => ({ n: (await q('select count(*)::int n from notifications where user_id=$1 and read_at is null', [req.user.sub]))[0].n }));
  app.patch('/api/notifications/:id/read', A, async req => { await q('update notifications set read_at=now() where id=$1 and user_id=$2', [uuid.parse(req.params.id), req.user.sub]); return { ok: true }; });
  app.post('/api/notifications/read-all', A, async req => { await q('update notifications set read_at=now() where user_id=$1 and read_at is null', [req.user.sub]); return { ok: true }; });
  // Rotinas: etapas em ordem fixa, criadas por profissional de saúde
  app.post('/api/routines', { preHandler: app.role(...HEALTH) }, async (req, rep) => {
    const b = z.object({ patientId: uuid, title: z.string().min(2).max(120), items: z.array(z.object({ title: z.string().min(2).max(120), exerciseId: uuid.optional(), sessions: z.number().int().min(1).max(60) })).min(1).max(20) }).parse(req.body);
    if (!await canSeeFull(req.user, b.patientId)) return rep.code(403).send({ error: 'sem vínculo com o paciente' });
    const [r] = await q('insert into routines(patient_id,professional_id,title,token) values($1,$2,$3,$4) returning id', [b.patientId, req.user.sub, b.title, randomBytes(18).toString('base64url')]);
    for (const [i, it] of b.items.entries()) await q('insert into routine_items(routine_id,position,title,exercise_id,sessions) values($1,$2,$3,$4,$5)', [r.id, i + 1, it.title, it.exerciseId || null, it.sessions]);
    await audit(req, 'criar', 'routine', r.id, { patient: b.patientId }); return r;
  });
  app.get('/api/routines', A, async (req, rep) => {
    const id = uuid.parse(req.query.patientId); if (!await canSee(req.user, id)) return rep.code(403).send({ error: 'sem acesso' });
    const rs = await q('select id from routines where patient_id=$1 order by created_at desc limit 20', [id]); return Promise.all(rs.map(r => routineView({ id: r.id })));
  });
  app.post('/api/routines/:id/passo', A, async (req, rep) => {
    const id = uuid.parse(req.params.id), b = z.object({ acao: z.enum(['concluida', 'nao_realizada']), nota: z.string().max(200).optional() }).parse(req.body), [r] = await q('select patient_id from routines where id=$1', [id]);
    if (!r || !await canSee(req.user, r.patient_id)) return rep.code(404).send({ error: 'não encontrado' });
    const out = await advance({ id }, { ...b, nome: req.user.name }); return out.code === 200 ? out.view : rep.code(out.code).send({ error: out.error, status: out.status });
  });
  app.get('/api/routines/:id/qr.svg', A, async (req, rep) => { const [r] = await q('select token,patient_id from routines where id=$1', [uuid.parse(req.params.id)]); if (!r || !await canSee(req.user, r.patient_id)) return rep.code(404).send({ error: 'não encontrado' }); return svg(rep, `${process.env.APP_ORIGIN}/p/${r.token}`); });
  app.get('/api/documents/:id/qr.svg', A, async (req, rep) => { const [d] = await q('select token,patient_id,author_id from documents where id=$1', [uuid.parse(req.params.id)]); if (!d || !(d.author_id === req.user.sub || await canSeeFull(req.user, d.patient_id))) return rep.code(404).send({ error: 'não encontrado' }); return svg(rep, `${process.env.APP_ORIGIN}/r/${d.token}`); });
  // Seguimento: receitas/pedidos (usos) + rotinas (progresso) + últimos eventos
  app.get('/api/patients/:id/followup', A, async (req, rep) => {
    const id = uuid.parse(req.params.id); if (!await canSeeFull(req.user, id)) return rep.code(403).send({ error: 'sem acesso' });
    const [docs, ev, rs] = await Promise.all([q('select id,kind,created_at,uses,max_uses,status,valid_until from documents where patient_id=$1 and kind=any($2) order by created_at desc limit 20', [id, USABLE]), q(`select "at",action,entity from activity_log where patient_id=$1 and entity in('document','routine') order by "at" desc limit 12`, [id]), q('select id from routines where patient_id=$1 order by created_at desc limit 10', [id])]);
    await audit(req, 'read', 'patient', id, { view: 'seguimento' });
    return { receitas: docs.map(d => ({ ...d, status: docStatus(d) })), rotinas: await Promise.all(rs.map(r => routineView({ id: r.id }))), eventos: ev };
  });
}
