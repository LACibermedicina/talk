import { z } from 'zod';
import { q } from '../db.js';
import { enc, dec } from '../crypto.js';
import { audit } from '../audit.js';
import { chat } from '../services/ai.js';
import { HEALTH } from '../roles.js';
import { canSeeFull } from '../access.js';
import { statusOf } from '../presence.js';
import { loadCase } from '../caseLoad.js';
import { compileCase, countryOf } from '../caseLogic.js';
import { minuteBuckets, transcriptText, orderLibrary, libraryContext, findInteractions, findRisks, planConsults, buildStructurePrompt, buildReportPrompt, buildSupportPrompt, parseJson, brief } from '../consultLogic.js';
// Ferramentas da teleconsulta: SÓ para o profissional responsável. O paciente apenas vê/aceita o aviso de transcrição.
export default async function (app) {
  const PRO = { preHandler: app.role(...HEALTH) }, uuid = z.string().uuid(), LANGS = z.enum(['pt', 'es', 'gn', 'en', 'zh']).default('pt'), caseCache = new Map();
  const apptOf = async (id, u) => { const [a] = await q('select * from appointments where id=$1', [id]); return a && (a.patient_id === u.sub || a.professional_id === u.sub) ? a : null; };
  const myAppt = async (id, u) => { const a = await apptOf(id, u); return a && a.professional_id === u.sub ? a : null; };
  const stateOf = async id => (await q('select * from consult_state where appointment_id=$1', [id]))[0] || { transcribing: false, patient_consent: null, started_at: null };
  const aiOk = async u => { const [m] = await q('select ai_consent,country,clinical_prefs from users where id=$1', [u.sub]); return m && m.ai_consent ? m : null; };
  async function segments(id, since) {
    const rows = await q('select t.created_at "at",u.role,t.text_enc from transcripts t join users u on u.id=t.speaker_id where t.appointment_id=$1 and ($2::timestamptz is null or t.created_at>$2) order by t.created_at', [id, since || null]);
    return rows.map(r => ({ at: r.at, role: r.role, text: dec(r.text_enc) }));
  }
  async function caseOf(a) { // resumo aprovado do prontuário (cache curto: é pesado e quase não muda durante a consulta)
    const c = caseCache.get(a.id); if (c && Date.now() - c.t < 60000) return c; const data = await loadCase(a.patient_id), comp = compileCase(data, { full: false }), v = { t: Date.now(), text: comp.text, name: data.patient.name }; caseCache.set(a.id, v); return v;
  }
  /* --- estado e consentimento --- */
  app.get('/api/consults/:id/state', { preHandler: app.auth }, async (req, rep) => {
    const id = uuid.parse(req.params.id), a = await apptOf(id, req.user); if (!a) return rep.code(404).send({ error: 'não encontrado' }); const s = await stateOf(id);
    if (req.user.role === 'paciente') return { transcribing: s.transcribing, needsConsent: s.transcribing && s.patient_consent === null, consent: s.patient_consent };
    return { transcribing: s.transcribing, patientConsent: s.patient_consent, startedAt: s.started_at, hasReport: !!s.report_enc, isOwner: a.professional_id === req.user.sub };
  });
  app.put('/api/consults/:id/transcription', PRO, async (req, rep) => {
    const id = uuid.parse(req.params.id), { on } = z.object({ on: z.boolean() }).parse(req.body), a = await myAppt(id, req.user); if (!a) return rep.code(404).send({ error: 'não encontrado' });
    if (on && !await aiOk(req.user)) return rep.code(403).send({ error: 'Ative o consentimento para uso de IA nas configurações para transcrever.' });
    await q(`insert into consult_state(appointment_id,transcribing,started_at) values($1,$2,case when $2 then now() end) on conflict(appointment_id) do update set transcribing=$2, started_at=coalesce(consult_state.started_at, case when $2 then now() end)`, [id, on]);
    await audit(req, on ? 'transcricao_on' : 'transcricao_off', 'appointment', id); return { ok: true, transcribing: on };
  });
  app.put('/api/consults/:id/consent', { preHandler: app.auth }, async (req, rep) => {
    const id = uuid.parse(req.params.id), { consent } = z.object({ consent: z.boolean() }).parse(req.body), a = await apptOf(id, req.user);
    if (!a || a.patient_id !== req.user.sub) return rep.code(404).send({ error: 'não encontrado' });
    await q('insert into consult_state(appointment_id,patient_consent) values($1,$2) on conflict(appointment_id) do update set patient_consent=$2', [id, consent]); await audit(req, consent ? 'consent_transcricao' : 'recusa_transcricao', 'appointment', id); return { ok: true };
  });
  /* --- ao vivo: novas falas + alertas imediatos (sem IA) --- */
  app.get('/api/consults/:id/live', { ...PRO, config: { rateLimit: { max: 40, timeWindow: '1 minute' } } }, async (req, rep) => {
    const id = uuid.parse(req.params.id), a = await myAppt(id, req.user); if (!a) return rep.code(404).send({ error: 'não encontrado' });
    const since = z.string().datetime().optional().parse(req.query.since), all = await segments(id), fresh = since ? all.filter(s => new Date(s.at) > new Date(since)) : all, text = all.map(s => s.text).join('\n');
    const c = await caseOf(a).catch(() => ({ text: '' }));
    return { segments: fresh.map(s => ({ at: s.at, who: s.role === 'paciente' ? 'Paciente' : 'Profissional', text: s.text })), interactions: findInteractions({ consulta: text, prontuario: c.text }), risks: findRisks(text), now: new Date().toISOString() };
  });
  /* --- histórico integral por minuto --- */
  app.get('/api/consults/:id/minutes', { ...PRO, config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req, rep) => {
    const id = uuid.parse(req.params.id), a = await myAppt(id, req.user); if (!a) return rep.code(404).send({ error: 'não encontrado' }); const s = await stateOf(id), segs = await segments(id);
    await audit(req, 'read', 'transcript', id, { view: 'minutos' }); return { startedAt: s.started_at || (segs[0] && segs[0].at) || null, minutes: minuteBuckets(segs, s.started_at), total: segs.length };
  });
  async function aiJson(res, fn) { try { return await fn(); } catch (e) { res.code(503); return { error: e.message }; } }
  /* --- estruturação dinâmica --- */
  app.post('/api/consults/:id/structure', { ...PRO, config: { rateLimit: { max: 12, timeWindow: '1 minute' } } }, async (req, rep) => {
    const id = uuid.parse(req.params.id), { lang } = z.object({ lang: LANGS }).parse(req.body || {}), a = await myAppt(id, req.user), me = a && await aiOk(req.user);
    if (!a) return rep.code(404).send({ error: 'não encontrado' }); if (!me) return rep.code(403).send({ error: 'Ative o consentimento para uso de IA nas configurações.' });
    const s = await stateOf(id), segs = await segments(id); if (!segs.length) return { structured: null, empty: true }; const c = await caseOf(a).catch(() => ({ name: '' }));
    return aiJson(rep, async () => { const p = buildStructurePrompt({ transcript: transcriptText(segs, s.started_at, [c.name]), lang, country: countryOf(me.country) }), out = await chat(p.system, p.user, { max: 1500, ms: 40000 }), j = parseJson(out); if (j) await q('update consult_state set structured_enc=$2, structured_at=now() where appointment_id=$1', [id, enc(JSON.stringify(j))]); return { structured: j, raw: j ? undefined : String(out).slice(0, 2000) }; });
  });
  /* --- relatório de evolução --- */
  app.post('/api/consults/:id/report', { ...PRO, config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (req, rep) => {
    const id = uuid.parse(req.params.id), { lang } = z.object({ lang: LANGS }).parse(req.body || {}), a = await myAppt(id, req.user), me = a && await aiOk(req.user);
    if (!a) return rep.code(404).send({ error: 'não encontrado' }); if (!me) return rep.code(403).send({ error: 'Ative o consentimento para uso de IA nas configurações.' });
    const s = await stateOf(id), segs = await segments(id); if (!segs.length) return rep.code(409).send({ error: 'Sem transcrição para gerar o relatório.' });
    const c = await caseOf(a).catch(() => ({ text: '', name: '' })), mins = Math.max(1, Math.round((new Date(segs[segs.length - 1].at) - new Date(s.started_at || segs[0].at)) / 60000));
    return aiJson(rep, async () => { const p = buildReportPrompt({ transcript: transcriptText(segs, s.started_at, [c.name]), caso: c.text, lang, country: countryOf(me.country), duration: mins + ' min' }), md = String(await chat(p.system, p.user, { max: 5000, ms: +process.env.AI_LONG_TIMEOUT_MS || 90000 })).trim(); await q('update consult_state set report_enc=$2, report_at=now() where appointment_id=$1', [id, enc(md)]); await audit(req, 'relatorio_consulta', 'appointment', id, { lang }); return { md, generatedAt: new Date().toISOString() }; });
  });
  app.get('/api/consults/:id/report', PRO, async (req, rep) => {
    const id = uuid.parse(req.params.id), a = await myAppt(id, req.user); if (!a) return rep.code(404).send({ error: 'não encontrado' }); const s = await stateOf(id);
    await audit(req, 'read', 'report', id); return { md: s.report_enc ? dec(s.report_enc) : null, at: s.report_at, patient: (await caseOf(a).catch(() => ({ name: '' }))).name, appointmentAt: a.starts_at };
  });
  app.put('/api/consults/:id/report', PRO, async (req, rep) => {
    const id = uuid.parse(req.params.id), { md } = z.object({ md: z.string().min(1).max(40000) }).parse(req.body), a = await myAppt(id, req.user); if (!a) return rep.code(404).send({ error: 'não encontrado' });
    await q('insert into consult_state(appointment_id,report_enc,report_at) values($1,$2,now()) on conflict(appointment_id) do update set report_enc=$2, report_at=now()', [id, enc(md)]); await audit(req, 'relatorio_editado', 'appointment', id); return { ok: true };
  });
  /* --- apoio cognitivo --- */
  app.post('/api/consults/:id/support', { ...PRO, config: { rateLimit: { max: 8, timeWindow: '1 minute' } } }, async (req, rep) => {
    const id = uuid.parse(req.params.id), { lang } = z.object({ lang: LANGS }).parse(req.body || {}), a = await myAppt(id, req.user), me = a && await aiOk(req.user);
    if (!a) return rep.code(404).send({ error: 'não encontrado' }); if (!me) return rep.code(403).send({ error: 'Ative o consentimento para uso de IA nas configurações.' });
    if (!await canSeeFull(req.user, a.patient_id)) return rep.code(403).send({ error: 'sem vínculo com o paciente' });
    const s = await stateOf(id), segs = await segments(id), country = countryOf(me.country), c = await caseOf(a).catch(() => ({ text: '', name: '' })), text = segs.map(x => x.text).join('\n');
    const items = await q('select * from library_items where owner_id=$1 or shared or tier<>\'personal\'', [req.user.sub]), lib = libraryContext(orderLibrary(items, { userId: req.user.sub, country, order: process.env.PROTOCOL_ORDER }));
    const prefs = ((me.clinical_prefs || {}).local || []).slice(0, 20), inter = findInteractions({ consulta: text, prontuario: c.text }), risks = findRisks(text);
    return aiJson(rep, async () => {
      const p = buildSupportPrompt({ transcript: transcriptText(segs, s.started_at, [c.name]) || '(sem falas ainda)', caso: c.text, lib: lib.text, prefs, lang, country, alerts: [...inter.map(i => `${i.a} + ${i.b}: ${i.msg}`), ...risks] });
      const out = await chat(p.system, p.user, { max: 3500, ms: +process.env.AI_LONG_TIMEOUT_MS || 90000 }), j = parseJson(out) || { resumo: String(out).slice(0, 1500) };
      const [team, pros] = await Promise.all([q('select u.id,u.name,u.role,u.cargo from care_team t join users u on u.id=t.professional_id where t.patient_id=$1 and u.active', [a.patient_id]), q('select id,name,role,cargo from users where active and role = any($1) and id<>$2', [HEALTH, req.user.sub])]);
      const st = r => r.map(x => ({ ...x, status: statusOf(x.id) }));
      await audit(req, 'apoio_cognitivo', 'appointment', id, { lang, lib: lib.used });
      return { ...j, interacoes: inter, riscos: risks, interconsultas: planConsults(j.interconsultas || [], st(team), st(pros), req.user.sub), fontes: lib.used, generatedAt: new Date().toISOString() };
    });
  });
  /* --- biblioteca e preferências --- */
  app.get('/api/library', PRO, async req => {
    const [me] = await q('select country from users where id=$1', [req.user.sub]), items = await q('select i.id,i.owner_id,i.tier,i.shared,i.country,i.title,i.body,u.name owner from library_items i join users u on u.id=i.owner_id where i.owner_id=$1 or i.shared or i.tier<>\'personal\'', [req.user.sub]);
    return orderLibrary(items, { userId: req.user.sub, country: countryOf(me && me.country), order: process.env.PROTOCOL_ORDER }).map(i => ({ id: i.id, tier: i.eff, title: i.title, country: i.country, shared: i.shared, mine: i.owner_id === req.user.sub, owner: i.owner, preview: brief(i.body, 200), body: i.owner_id === req.user.sub || i.tier !== 'personal' || i.shared ? i.body : undefined }));
  });
  app.post('/api/library', PRO, async (req, rep) => {
    const b = z.object({ tier: z.enum(['ministerio', 'sociedade', 'oms', 'personal']).default('personal'), title: z.string().min(2).max(160), body: z.string().min(10).max(30000), country: z.string().regex(/^[A-Z]{2}$/).optional(), shared: z.boolean().default(false) }).parse(req.body);
    if (b.tier !== 'personal' && req.user.role !== 'admin') return rep.code(403).send({ error: 'Fontes oficiais (Ministério, sociedades, OMS) são cadastradas pelo administrador. Salve como material pessoal.' });
    const [r] = await q('insert into library_items(owner_id,tier,shared,country,title,body) values($1,$2,$3,$4,$5,$6) returning id', [req.user.sub, b.tier, b.shared, b.country || null, b.title, b.body]); await audit(req, 'library_add', 'library', r.id, { tier: b.tier }); return { id: r.id };
  });
  app.delete('/api/library/:id', { preHandler: app.auth }, async (req, rep) => {
    const id = uuid.parse(req.params.id), [it] = await q('select owner_id,tier from library_items where id=$1', [id]); if (!it || (it.owner_id !== req.user.sub && req.user.role !== 'admin')) return rep.code(404).send({ error: 'não encontrado' });
    await q('delete from library_items where id=$1', [id]); await audit(req, 'library_del', 'library', id); return { ok: true };
  });
  app.get('/api/me/clinical-prefs', PRO, async req => { const [m] = await q('select clinical_prefs from users where id=$1', [req.user.sub]); return { local: ((m && m.clinical_prefs) || {}).local || [] }; });
  app.put('/api/me/clinical-prefs', PRO, async req => {
    const { local } = z.object({ local: z.array(z.object({ topic: z.string().min(1).max(80), text: z.string().min(1).max(600) })).max(30) }).parse(req.body);
    await q('update users set clinical_prefs=$2 where id=$1', [req.user.sub, JSON.stringify({ local })]); await audit(req, 'prefs_clinicas', 'user', req.user.sub, { n: local.length }); return { ok: true };
  });
}
