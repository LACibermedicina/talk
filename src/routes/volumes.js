import { z } from 'zod';
import { q } from '../db.js';
import { enc, dec } from '../crypto.js';
import { audit } from '../audit.js';
import { chat } from '../services/ai.js';
import { loadCase } from '../caseLoad.js';
import { gate, buildDossier, skeletonMd, careChecklist, buildVolumePrompt, renderHtml, apiPayload } from '../volumeLogic.js';
const uuid = z.string().uuid(), CONSENT_VER = 'v1', PRIV = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|.*\.(local|internal|localdomain)$)/i;
const sj = v => { try { return JSON.parse(v); } catch { return null; } };
// Volumes: criação, geração e envio restritos ao administrador do sistema; dados sempre anonimizados antes de sair daqui.
export default async function (app) {
  const ADM = { preHandler: app.role('admin') }, A = { preHandler: app.auth };
  const volOf = async id => (await q('select v.*,p.research_consent,p.name patient_name from case_volumes v join users p on p.id=v.patient_id where v.id=$1', [id]))[0];
  const view = v => ({ id: v.id, code: v.code, title: v.title, status: v.status, patient: v.patient_name, patientConsent: v.research_consent === true, t0: v.t0 ? String(v.t0).slice(0, 10) : null, t0Label: v.t0_label, extraTerms: v.extra_terms || [], tcleOk: v.tcle_ok, tcleAt: v.tcle_at, cepNumber: v.cep_number, cepBody: v.cep_body, cepApprovedAt: v.cep_approved_at ? String(v.cep_approved_at).slice(0, 10) : null, cepNotes: v.cep_notes, version: v.version, generatedAt: v.generated_at, apiRef: v.api_ref, apiSentAt: v.api_sent_at, apiStatus: v.api_status, createdAt: v.created_at });
  const gateOf = (v, user) => gate({ user, patient: { research_consent: v.research_consent }, vol: { tcle_ok: v.tcle_ok, cep_number: v.cep_number, cep_approved_at: v.cep_approved_at } });
  // ---- concordância do paciente (termo de uso de dados para material científico, anonimizado) ----
  app.patch('/api/me/research-consent', A, async (req, rep) => {
    if (req.user.role !== 'paciente') return rep.code(403).send({ error: 'Somente o paciente responde a este termo' });
    const { accept } = z.object({ accept: z.boolean() }).parse(req.body);
    await q('update users set research_consent=$2,research_consent_at=now(),research_consent_ver=$3 where id=$1', [req.user.sub, accept, CONSENT_VER]);
    if (!accept) await q(`update case_volumes set status='suspenso' where patient_id=$1 and status<>'suspenso'`, [req.user.sub]);
    await audit(req, accept ? 'pesquisa_consentiu' : 'pesquisa_revogou', 'user', req.user.sub, { ver: CONSENT_VER }); return { ok: true, research_consent: accept };
  });
  // ---- volumes (admin) ----
  app.get('/api/volumes', ADM, async () => (await q('select v.*,p.research_consent,p.name patient_name from case_volumes v join users p on p.id=v.patient_id order by v.created_at desc limit 200')).map(view));
  app.get('/api/volumes/eligible', ADM, async () => (await q(`select p.id,p.name,(select count(*)::int from clinical_entries e where e.patient_id=p.id and e.approved) registros,(select count(*)::int from appointments a where a.patient_id=p.id) consultas from users p where p.role='paciente' and p.active and p.research_consent is true order by p.name`)));
  app.post('/api/volumes', ADM, async (req, rep) => {
    const b = z.object({ patientId: uuid, title: z.string().trim().min(3).max(160), t0: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).parse(req.body);
    const [p] = await q(`select research_consent from users where id=$1 and role='paciente' and active`, [b.patientId]); if (!p) return rep.code(404).send({ error: 'Paciente não encontrado' });
    if (p.research_consent !== true) return rep.code(409).send({ error: 'Este paciente não autorizou o uso anonimizado dos dados para material científico' });
    const [v] = await q('insert into case_volumes(patient_id,created_by,title,t0) values($1,$2,$3,$4) returning id,code', [b.patientId, req.user.sub, b.title, b.t0 || null]);
    await audit(req, 'volume_criado', 'volume', v.id, { code: v.code }); return v;
  });
  app.get('/api/volumes/:id', ADM, async (req, rep) => {
    const v = await volOf(uuid.parse(req.params.id)); if (!v) return rep.code(404).send({ error: 'Volume não encontrado' });
    const vers = await q('select version,created_at,provider from volume_versions where volume_id=$1 order by version desc', [v.id]), [last] = await q('select content_enc,checklist from volume_versions where volume_id=$1 order by version desc limit 1', [v.id]);
    return { ...view(v), gate: gateOf(v, req.user), versions: vers, md: last ? dec(last.content_enc) : null, checklist: last ? last.checklist : null };
  });
  app.get('/api/volumes/:id/versions/:n', ADM, async (req, rep) => { const [r] = await q('select content_enc,checklist from volume_versions where volume_id=$1 and version=$2', [uuid.parse(req.params.id), +req.params.n | 0]); if (!r) return rep.code(404).send({ error: 'Versão não encontrada' }); return { md: dec(r.content_enc), checklist: r.checklist }; });
  app.patch('/api/volumes/:id', ADM, async (req, rep) => {
    const id = uuid.parse(req.params.id), v = await volOf(id); if (!v) return rep.code(404).send({ error: 'Volume não encontrado' });
    const b = z.object({ title: z.string().trim().min(3).max(160), t0: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(), t0Label: z.string().trim().max(120).nullable(), extraTerms: z.array(z.string().trim().min(2).max(80)).max(40), tcleOk: z.boolean(), cepNumber: z.string().trim().max(60).nullable(), cepBody: z.string().trim().max(120).nullable(), cepApprovedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(), cepNotes: z.string().trim().max(500).nullable() }).partial().parse(req.body);
    const m = { title: v.title, t0: v.t0, t0_label: v.t0_label, extra_terms: v.extra_terms, tcle_ok: v.tcle_ok, cep_number: v.cep_number, cep_body: v.cep_body, cep_approved_at: v.cep_approved_at, cep_notes: v.cep_notes };
    if ('title' in b) m.title = b.title; if ('t0' in b) m.t0 = b.t0; if ('t0Label' in b) m.t0_label = b.t0Label; if ('extraTerms' in b) m.extra_terms = JSON.stringify(b.extraTerms); if ('tcleOk' in b) m.tcle_ok = b.tcleOk; if ('cepNumber' in b) m.cep_number = b.cepNumber || null; if ('cepBody' in b) m.cep_body = b.cepBody || null; if ('cepApprovedAt' in b) m.cep_approved_at = b.cepApprovedAt; if ('cepNotes' in b) m.cep_notes = b.cepNotes || null;
    if (typeof m.extra_terms !== 'string') m.extra_terms = JSON.stringify(m.extra_terms || []);
    const status = ['gerado', 'enviado', 'suspenso'].includes(v.status) ? v.status : m.cep_number && m.cep_approved_at && m.tcle_ok ? 'aprovado' : m.cep_number ? 'aguardando_cep' : 'rascunho';
    await q('update case_volumes set title=$2,t0=$3,t0_label=$4,extra_terms=$5::jsonb,tcle_ok=$6,tcle_at=case when $6 and not tcle_ok then now() else tcle_at end,tcle_by=case when $6 and not tcle_ok then $11 else tcle_by end,cep_number=$7,cep_body=$8,cep_approved_at=$9,cep_notes=$10,status=$12 where id=$1',
      [id, m.title, m.t0, m.t0_label, m.extra_terms, m.tcle_ok, m.cep_number, m.cep_body, m.cep_approved_at, m.cep_notes, req.user.sub, status]);
    await audit(req, 'volume_editado', 'volume', id, { campos: Object.keys(b) }); return { ok: true };
  });
  app.post('/api/volumes/:id/suspend', ADM, async req => { const id = uuid.parse(req.params.id); await q(`update case_volumes set status='suspenso' where id=$1`, [id]); await audit(req, 'volume_suspenso', 'volume', id); return { ok: true }; });
  app.post('/api/volumes/:id/generate', { ...ADM, config: { rateLimit: { max: 4, timeWindow: '1 minute' } } }, async (req, rep) => {
    const id = uuid.parse(req.params.id), { ai, lang } = z.object({ ai: z.boolean().default(true), lang: z.enum(['pt', 'es', 'en']).default('pt') }).parse(req.body || {}), v = await volOf(id);
    if (!v) return rep.code(404).send({ error: 'Volume não encontrado' }); if (v.status === 'suspenso') return rep.code(409).send({ error: 'Volume suspenso (consentimento revogado ou decisão do administrador)' });
    const g = gateOf(v, req.user); if (!g.ok) return rep.code(409).send({ error: 'Liberação pendente', missing: g.missing });
    if (!v.t0) return rep.code(409).send({ error: 'Defina o marco temporal (T0): as datas viram tempo relativo a ele', missing: ['Defina o marco temporal (T0)'] });
    const data = await loadCase(v.patient_id);
    const cons = await q(`select a.starts_at "at",c.structured_enc,c.report_enc from consult_state c join appointments a on a.id=c.appointment_id where a.patient_id=$1 and (c.structured_enc is not null or c.report_enc is not null) order by a.starts_at`, [v.patient_id]);
    data.consults = cons.map(c => ({ at: c.at, structured: c.structured_enc ? sj(dec(c.structured_enc)) : null, report: c.report_enc ? dec(c.report_enc) : null }));
    const vol = { ...view(v), t0: v.t0, tcle_ok: v.tcle_ok, cep_number: v.cep_number, version: v.version + 1, t0_label: v.t0_label }, dos = buildDossier(data, { t0: String(v.t0).slice(0, 10), extra: v.extra_terms || [] });
    let md = skeletonMd(dos, vol), provider = null, note = null;
    if (ai) {
      const [me] = await q('select ai_consent from users where id=$1', [req.user.sub]);
      if (!me || !me.ai_consent) note = 'IA não usada: ative o consentimento para IA nas configurações. Gerado apenas o esqueleto determinístico.';
      else { try { const p = buildVolumePrompt(dos, vol, { lang }); const out = String(await chat(p.system, p.user, { max: 6000, ms: +process.env.AI_LONG_TIMEOUT_MS || 120000 })).trim(); md += '\n\n' + out.replace(/^#\s.*\n/, ''); provider = 'IA'; } catch (e) { note = 'A IA não respondeu (' + e.message + '). Gerado apenas o esqueleto determinístico.'; } }
    }
    const checklist = careChecklist(vol, dos, md), ver = v.version + 1;
    await q('insert into volume_versions(volume_id,version,by_user,provider,content_enc,checklist) values($1,$2,$3,$4,$5,$6)', [id, ver, req.user.sub, provider, enc(md), JSON.stringify(checklist)]);
    await q(`update case_volumes set version=$2,generated_at=now(),status='gerado' where id=$1`, [id, ver]);
    await audit(req, 'volume_gerado', 'volume', id, { version: ver, ai: !!provider, eventos: dos.events.length }); return { version: ver, md, checklist, note };
  });
  app.get('/api/volumes/:id/document', ADM, async (req, rep) => {
    const id = uuid.parse(req.params.id), v = await volOf(id); if (!v) return rep.code(404).send({ error: 'Volume não encontrado' });
    const [r] = await q('select content_enc,checklist,provider,created_at from volume_versions where volume_id=$1 order by version desc limit 1', [id]); if (!r) return rep.code(409).send({ error: 'Gere o volume primeiro' });
    if (v.research_consent !== true || v.status === 'suspenso') return rep.code(409).send({ error: 'Consentimento revogado ou volume suspenso' });
    await audit(req, 'volume_documento', 'volume', id);
    const html = renderHtml({ title: v.title, code: v.code, version: v.version, cep_number: v.cep_number, cep_body: v.cep_body }, dec(r.content_enc), r.checklist || [], { provider: r.provider ? 'apoio de IA' : null, at: new Date(r.created_at).toLocaleDateString('pt-BR') });
    rep.type('text/html; charset=utf-8'); if (req.query.download === '1') rep.header('content-disposition', `attachment; filename="${v.code}-v${v.version}.html"`); return html;
  });
  // ---- plataforma de estudos de caso (API) ----
  app.post('/api/volumes/:id/send', { ...ADM, config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (req, rep) => {
    const id = uuid.parse(req.params.id), v = await volOf(id); if (!v) return rep.code(404).send({ error: 'Volume não encontrado' });
    const g = gateOf(v, req.user); if (!g.ok || v.status === 'suspenso') return rep.code(409).send({ error: 'Liberação pendente ou volume suspenso', missing: g.missing });
    const url = process.env.STUDY_API_URL, key = process.env.STUDY_API_KEY; if (!url || !key) return rep.code(409).send({ error: 'Plataforma de estudos de caso não configurada (Integrações e chaves)' });
    let host = ''; try { host = new URL(url).hostname; } catch { /* inválida */ } if (!/^https:\/\//.test(url) || !host || PRIV.test(host)) return rep.code(409).send({ error: 'Endereço da plataforma inválido: use HTTPS público' });
    const [r] = await q('select content_enc,checklist from volume_versions where volume_id=$1 order by version desc limit 1', [id]); if (!r) return rep.code(409).send({ error: 'Gere o volume primeiro' });
    const md = dec(r.content_enc), data = { events: [], counts: {}, t0: v.t0 };
    const body = JSON.stringify(apiPayload({ code: v.code, title: v.title, version: v.version, tcle_ok: v.tcle_ok, cep_number: v.cep_number, cep_body: v.cep_body, cep_approved_at: v.cep_approved_at }, md, r.checklist || [], data));
    let status = 0, ref = null, msg = null;
    try { const res = await fetch(url.replace(/\/$/, '') + '/volumes', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key, 'idempotency-key': `${v.code}-v${v.version}` }, body, signal: AbortSignal.timeout(30000) }); status = res.status; const j = await res.json().catch(() => ({})); ref = String(j.id || j.reference || j.ref || '').slice(0, 120) || null; msg = j.message || j.error || null; } catch (e) { msg = 'Sem conexão com a plataforma'; }
    const okk = status >= 200 && status < 300;
    await q('update case_volumes set api_status=$2,api_ref=coalesce($3,api_ref),api_sent_at=now(),status=case when $4 then \'enviado\' else status end where id=$1', [id, okk ? 'enviado' : `erro ${status || 'rede'}`, ref, okk]);
    await audit(req, 'volume_enviado', 'volume', id, { status, version: v.version });
    if (!okk) return rep.code(502).send({ error: `A plataforma recusou o envio (${status || 'sem conexão'})${msg ? ': ' + String(msg).slice(0, 200) : ''}` }); return { ok: true, ref };
  });
}
