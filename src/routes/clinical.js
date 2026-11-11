import { z } from 'zod';
import { q } from '../db.js';
import { enc, dec } from '../crypto.js';
import { audit } from '../audit.js';
import { canSeeFull as canSee } from '../access.js';
import { structure } from '../services/ai.js';
import { HEALTH } from '../roles.js';
export default async function (app) {
  const PRO = { preHandler: app.role(...HEALTH) }, uuid = z.string().uuid();
  // IA gera RASCUNHO; nada entra na história clínica sem aprovação do profissional.
  app.post('/api/patients/:id/structure', PRO, async (req, rep) => {
    const id = uuid.parse(req.params.id), b = z.object({ source: z.enum(['transcript', 'chat']), appointmentId: uuid.optional() }).parse(req.body);
    if (!await canSee(req.user, id)) return rep.code(403).send({ error: 'sem vínculo com o paciente' });
    let text;
    if (b.source === 'transcript') {
      if (!b.appointmentId) return rep.code(400).send({ error: 'appointmentId obrigatório' });
      text = (await q(`select u.name,t.text_enc from transcripts t join users u on u.id=t.speaker_id join appointments a on a.id=t.appointment_id where t.appointment_id=$1 and a.patient_id=$2 order by t.created_at`, [b.appointmentId, id])).map(r => `${r.name}: ${dec(r.text_enc)}`).join('\n');
    } else {
      const k = 'dm:' + [id, req.user.sub].sort().join(':');
      text = (await q(`select u.name,m.body_enc from messages m join users u on u.id=m.sender_id where m.room=$1 and m.created_at>now()-interval '14 days' order by m.created_at`, [k])).map(r => `${r.name}: ${dec(r.body_enc)}`).join('\n');
    }
    if (!text) return rep.code(404).send({ error: 'sem conteúdo para estruturar' });
    const { draft, provider } = await structure(text), [e] = await q(`insert into clinical_entries(patient_id,author_id,kind,source,content_enc) values($1,$2,'estruturado',$3,$4) returning id`, [id, req.user.sub, b.source, enc(JSON.stringify(draft))]);
    await audit(req, 'estruturar_ia', 'patient', id, { source: b.source, entry: e.id, provider }); return { id: e.id, approved: false, draft };
  });
  app.post('/api/clinical/:id/approve', PRO, async (req, rep) => {
    const [e] = await q('select * from clinical_entries where id=$1', [uuid.parse(req.params.id)]); if (!e || !await canSee(req.user, e.patient_id)) return rep.code(404).send({ error: 'não encontrado' });
    const { content } = z.object({ content: z.record(z.any()).optional() }).parse(req.body || {});
    await q('update clinical_entries set approved=true,approved_by=$2,content_enc=coalesce($3,content_enc) where id=$1', [e.id, req.user.sub, content ? enc(JSON.stringify(content)) : null]);
    await audit(req, 'aprovar', 'clinical_entry', e.id, { editado: !!content }); return { ok: true };
  });
  app.get('/api/patients/:id/clinical', { preHandler: app.auth }, async (req, rep) => {
    const id = uuid.parse(req.params.id); if (!await canSee(req.user, id)) return rep.code(403).send({ error: 'sem acesso' });
    await audit(req, 'read', 'patient', id, { view: 'historia_clinica' });
    const rows = await q(`select e.id,e.kind,e.source,e.approved,e.created_at,e.content_enc,u.name author from clinical_entries e join users u on u.id=e.author_id where e.patient_id=$1 ${req.user.role === 'paciente' ? 'and e.approved' : ''} order by e.created_at desc`, [id]);
    return rows.map(({ content_enc, ...r }) => ({ ...r, content: JSON.parse(dec(content_enc)) }));
  });
}
