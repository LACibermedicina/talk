import { z } from 'zod';
import { q } from '../db.js';
import { dec } from '../crypto.js';
import { audit } from '../audit.js';
import { canSeeFull } from '../access.js';
import { chat } from '../services/ai.js';
import { HEALTH } from '../roles.js';
import { loadCase as load } from '../caseLoad.js';
import { compileCase, buildPrompt, KINDS, COUNTRIES, countryOf } from '../caseLogic.js';
// Caso clínico: resumo compilado do que está vinculado ao paciente + sugestões da IA (rascunhos para o profissional).
export default async function (app) {
  const PRO = { preHandler: app.role(...HEALTH) }, uuid = z.string().uuid();
  app.get('/api/case/countries', { preHandler: app.auth }, async () => Object.entries(COUNTRIES).map(([code, v]) => ({ code, name: v[0] })));
  app.put('/api/me/country', { preHandler: app.auth }, async req => { const { country } = z.object({ country: z.string().regex(/^[A-Z]{2}$/) }).parse(req.body); if (!COUNTRIES[country]) return { ok: false }; await q('update users set country=$2 where id=$1', [req.user.sub, country]); return { ok: true, country }; });
  app.get('/api/patients/:id/case', PRO, async (req, rep) => {
    const id = uuid.parse(req.params.id); if (!await canSeeFull(req.user, id)) return rep.code(403).send({ error: 'sem vínculo com o paciente' });
    const full = req.query.full === '1', c = compileCase(await load(id), { full }); await audit(req, 'read', 'patient', id, { view: 'caso', full });
    const [me] = await q('select country,ai_consent from users where id=$1', [req.user.sub]); const { text, ...out } = c;
    return { ...out, country: countryOf(me && me.country), aiConsent: !!(me && me.ai_consent) };
  });
  app.post('/api/patients/:id/case/ai', { ...PRO, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, rep) => {
    const id = uuid.parse(req.params.id), b = z.object({ kind: z.enum(KINDS), full: z.boolean().default(false), lang: z.enum(['pt', 'es', 'gn', 'en', 'zh']).default('pt'), anonymize: z.boolean().default(true) }).parse(req.body);
    if (!await canSeeFull(req.user, id)) return rep.code(403).send({ error: 'sem vínculo com o paciente' });
    const [me] = await q('select country,ai_consent from users where id=$1', [req.user.sub]); if (!me || !me.ai_consent) return rep.code(403).send({ error: 'Ative o consentimento para uso de IA nas configurações para gerar sugestões.' });
    const full = b.full || b.kind === 'estudo', c = compileCase(await load(id), { full }), p = buildPrompt(b.kind, { text: c.text, full, lang: b.lang, country: countryOf(me.country), anonymize: b.anonymize });
    let out; try { out = await chat(p.system, p.user, { max: b.kind === 'estudo' ? 6000 : 3500, ms: +process.env.AI_LONG_TIMEOUT_MS || 90000 }); } catch (e) { return rep.code(503).send({ error: e.message }); }
    await audit(req, 'caso_ia', 'patient', id, { kind: b.kind, full, lang: b.lang, country: countryOf(me.country) });
    return { kind: b.kind, full, lang: b.lang, country: countryOf(me.country), md: String(out).trim(), generatedAt: new Date().toISOString() };
  });
}
