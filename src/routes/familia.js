import { z } from 'zod';
import { q } from '../db.js';
import { enc, dec } from '../crypto.js';
import { audit } from '../audit.js';
import { chat } from '../services/ai.js';
import { HEALTH } from '../roles.js';
import { canSeeFull } from '../access.js';
import { loadCase } from '../caseLoad.js';
import { compileCase, countryOf } from '../caseLogic.js';
import { orderLibrary, libraryContext, parseJson, parseOrder, DEFAULT_ORDER, TIER_LABEL } from '../consultLogic.js';
import { sanitizeMap } from '../familyLogic.js';
import { buildFamilyPrompt } from '../familyLogic.js';
import { saveSettings } from '../settings.js';
// Familiograma e ecomapa: gerados a partir da história clínica pela IA (rascunho) e editáveis pelo profissional.
export default async function (app) {
  const PRO = { preHandler: app.role(...HEALTH) }, uuid = z.string().uuid(), KIND = z.enum(['genograma', 'ecomapa']), LANGS = z.enum(['pt', 'es', 'gn', 'en', 'zh']).default('pt');
  const load = async (pid, kind) => { const [r] = await q('select data_enc,source,lib_used,updated_at from family_maps where patient_id=$1 and kind=$2', [pid, kind]); return r ? { data: sanitizeMap(kind, JSON.parse(dec(r.data_enc))), source: r.source, libUsed: r.lib_used, updatedAt: r.updated_at } : null; };
  const save = (pid, kind, data, source, lib, uid) => q('insert into family_maps(patient_id,kind,data_enc,source,lib_used,updated_by) values($1,$2,$3,$4,$5,$6) on conflict(patient_id,kind) do update set data_enc=$3,source=$4,lib_used=$5,updated_by=$6,updated_at=now()', [pid, kind, enc(JSON.stringify(data)), source, lib, uid]);
  app.get('/api/patients/:id/family-map', PRO, async (req, rep) => {
    const id = uuid.parse(req.params.id), { kind } = z.object({ kind: KIND }).parse(req.query); if (!await canSeeFull(req.user, id)) return rep.code(403).send({ error: 'sem vínculo com o paciente' });
    await audit(req, 'read', 'patient', id, { view: kind }); return (await load(id, kind)) || { data: null };
  });
  app.post('/api/patients/:id/family-map/generate', { ...PRO, config: { rateLimit: { max: 6, timeWindow: '1 minute' } } }, async (req, rep) => {
    const id = uuid.parse(req.params.id), b = z.object({ kind: KIND, lang: LANGS }).parse(req.body || {});
    if (!await canSeeFull(req.user, id)) return rep.code(403).send({ error: 'sem vínculo com o paciente' });
    const [me] = await q('select country,ai_consent from users where id=$1', [req.user.sub]); if (!me || !me.ai_consent) return rep.code(403).send({ error: 'Ative o consentimento para uso de IA nas configurações.' });
    const country = countryOf(me.country), c = compileCase(await loadCase(id), { full: true });
    const items = await q('select * from library_items where owner_id=$1 or shared or tier<>\'personal\'', [req.user.sub]), lib = libraryContext(orderLibrary(items, { userId: req.user.sub, country, order: process.env.PROTOCOL_ORDER }));
    const prev = await load(id, b.kind), p = buildFamilyPrompt(b.kind, { text: c.text, lib: lib.text, lang: b.lang, country, current: prev && prev.source === 'manual' ? prev.data : null });
    let out; try { out = await chat(p.system, p.user, { max: 3500, ms: +process.env.AI_LONG_TIMEOUT_MS || 90000 }); } catch (e) { return rep.code(503).send({ error: e.message }); }
    const j = parseJson(out); if (!j) return rep.code(502).send({ error: 'A IA não devolveu um mapa válido. Tente novamente.' });
    const data = sanitizeMap(b.kind, j); await save(id, b.kind, data, 'ia', lib.used, req.user.sub); await audit(req, 'familia_ia', 'patient', id, { kind: b.kind, lib: lib.used });
    return { data, source: 'ia', libUsed: lib.used, updatedAt: new Date().toISOString() };
  });
  app.put('/api/patients/:id/family-map', PRO, async (req, rep) => {
    const id = uuid.parse(req.params.id), b = z.object({ kind: KIND, data: z.any() }).parse(req.body || {}); if (!await canSeeFull(req.user, id)) return rep.code(403).send({ error: 'sem vínculo com o paciente' });
    const data = sanitizeMap(b.kind, b.data); await save(id, b.kind, data, 'manual', 0, req.user.sub); await audit(req, 'familia_edit', 'patient', id, { kind: b.kind }); return { data, source: 'manual' };
  });
  app.get('/api/protocol-order', { preHandler: app.auth }, async () => ({ order: parseOrder(process.env.PROTOCOL_ORDER), labels: TIER_LABEL }));
  /* hierarquia protocolar (administração): vale para apoio cognitivo, familiograma e ecomapa */
  app.get('/api/admin/protocol-order', { preHandler: app.role('admin') }, async () => ({ order: parseOrder(process.env.PROTOCOL_ORDER), labels: TIER_LABEL, default: DEFAULT_ORDER, custom: parseOrder(process.env.PROTOCOL_ORDER).join() !== DEFAULT_ORDER.join() }));
  app.put('/api/admin/protocol-order', { preHandler: app.role('admin') }, async req => {
    const { order } = z.object({ order: z.array(z.enum(['ministerio', 'sociedade', 'oms', 'personal', 'geral'])).length(5) }).parse(req.body || {}); if (new Set(order).size !== 5) throw Object.assign(new Error('A ordem precisa conter as 5 fontes, sem repetição'), { statusCode: 400 });
    await saveSettings({ PROTOCOL_ORDER: order.join(',') }); await audit(req, 'protocol_order', 'settings', null, { order }); return { order };
  });
}
