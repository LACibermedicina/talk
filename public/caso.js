/* Caso clínico: resumo de apresentação, sugestão de conduta (diretrizes do país), alternativas internacionais, SOAP e estudo de caso.
   As saídas da IA abrem em janelas (movíveis, minimizáveis para ícones ao lado do painel, ou fixadas no desktop) e exportam PDF.
   Texto da IA é conteúdo do usuário: vem marcado com E() e nunca passa pelo tradutor de interface. */
const CK = {
  conduta: ['Conduta', '#2a9d8f', 'C', 'Sugerir conduta e próximos passos'],
  intl: ['Alternativas internacionais', '#7c6bd6', 'I', 'Alternativas (diretrizes internacionais)'],
  soap: ['SOAP', '#2481cc', 'S', 'Gerar SOAP'],
  estudo: ['Estudo de caso', '#d19a1a', 'E', 'Estudo de caso (PDF)']
};
const CCODES = [['BR', 'Brasil'], ['PY', 'Paraguai'], ['AR', 'Argentina'], ['UY', 'Uruguai'], ['CL', 'Chile'], ['CO', 'Colômbia'], ['MX', 'México'], ['PE', 'Peru'], ['PT', 'Portugal'], ['ES', 'Espanha'], ['US', 'Estados Unidos'], ['GB', 'Reino Unido'], ['CN', 'China']];
let CW = [], cwz = 60, cwBusy = '';
RBP.push(() => { const o = CW.filter(w => w.st === 'open').sort((a, b) => b.z - a.z)[0]; return o ? { pri: 1000 + o.z, key: 'c:' + o.id, close: () => A.cwx(o.id), html: RIB('Resultado do caso', o.title, [['pdf', 'Exportar PDF', 'cwpdf', o.id], ['copy', 'Copiar texto', 'cwcopy', o.id], ['pin', 'Fixar no desktop', 'cwpin', o.id]]) } : null; });
const cpid = () => (typeof pid === 'function' ? pid() : S.pp);
const ccountry = () => (S.cs && S.cs.country) || (S.me && S.me.country) || 'BR';
// Markdown simples e seguro: tudo que vem da IA passa por E() (escape + marca de dado do usuário)
function mdH(md) {
  const it = t => { const a = String(t).split('*'); return a.length > 1 && a.length % 2 === 1 ? a.map((p, i) => i % 2 ? `<i>${E(p)}</i>` : E(p)).join('') : E(t); };
  const inl = t => String(t).split('**').map((p, i) => i % 2 ? `<b>${it(p)}</b>` : it(p)).join('');
  let out = '', ul = false; const close = () => { if (ul) { out += '</ul>'; ul = false; } };
  for (const raw of String(md || '').split('\n')) {
    const l = raw.trimEnd(); let m;
    if (!l.trim()) { close(); continue; }
    if ((m = l.match(/^(#{1,4})\s+(.*)$/))) { close(); const n = Math.min(4, m[1].length + 1); out += `<h${n}>${inl(m[2])}</h${n}>`; continue; }
    if ((m = l.match(/^\s*[-*•]\s+(.*)$/)) || (m = l.match(/^\s*\d+[.)]\s+(.*)$/))) { if (!ul) { out += '<ul>'; ul = true; } out += `<li>${inl(m[1])}</li>`; continue; }
    close(); out += `<p>${inl(l)}</p>`;
  }
  close(); return out;
}
// resumo de apresentação montado no navegador: frases fixas (traduzíveis) + dados do paciente marcados por E()
function presH(c) {
  const f = c.facts, L = [], p = x => L.push(`<p>${x}</p>`), j = a => a.map(String).join(', ');
  if (f.team.length) p(`Em acompanhamento com ${E(f.team.map(t => t.name + ' (' + t.role + ')').join(', '))}.`);
  if (f.queixas.length) p(`Queixa e registros clínicos aprovados: ${E((c.full ? f.queixas : f.queixas.slice(-3)).join(' | '))}.`);
  if (f.sintomas.length) p(`Sintomas relatados: ${E(j(f.sintomas))}.`);
  if (f.eva) p(`Dor (EVA): ${E(f.eva.first)}/10 em ${E(f.eva.firstAt)} → ${E(f.eva.last)}/10 em ${E(f.eva.lastAt)} (${f.eva.trend}).`);
  if (f.goal) p(`Meta terapêutica: ${E(f.goal.description)} (dor ≤ ${E(f.goal.target)} até ${E(f.goal.due)}).`);
  if (f.adesao.length) p(`Adesão aos exercícios (últimos 7 dias): ${E(f.adesao.map(a => a.title + ' ' + a.feitas + '/' + a.freq).join('; '))}.`);
  if (f.consultas.total) p(`Consultas: ${E(f.consultas.total)} registradas, ${E(f.consultas.finalizadas)} finalizadas, ${E(f.consultas.faltas)} faltas; última em ${E(f.consultas.ultima)}.`);
  if (f.alerts.length) p(`Alertas ativos: ${E(j(f.alerts))}.`);
  return L.join('') || '<p class="mu">Sem registros clínicos aprovados ainda.</p>';
}
/* ---------- aba "Caso clínico" no painel do paciente ---------- */
const _pcs = panelH;
panelH = function () {
  const h = _pcs(), id = cpid();
  if (!S.me || !HLT(S.me.role) || !id) return h;
  const btn = `<button class="${S.tab === 'caso' ? 'on' : ''}" data-a="tab" data-p="caso">Caso clínico</button>`;
  let o = h.replace('</div><div class="pb">', btn + '</div><div class="pb">');
  if (S.tab === 'caso') o = o.replace(/<div class="pb">[\s\S]*$/, '<div class="pb">' + casoH() + '</div>');
  return o;
};
function casoH() {
  const c = S.cs; if (!c || c.pid !== cpid()) return '<div class="cd mu">Carregando o resumo do caso…</div>';
  const f = c.facts, nm = c.patient.name, lst = a => (a && a.length ? a.map(E).join(', ') : '–');
  const ev = f.eva ? `${f.eva.first}/10 → ${f.eva.last}/10 (${E(f.eva.trend)})` : '–';
  const pres = presH(c), sum = `<div class="cd csum"><div class="ah"><h3>Resumo de apresentação do caso</h3></div><div class="cpres">${pres}</div>
    <div class="cfacts"><div><span class="mu">Alergias</span><b>${lst(f.allergies)}</b></div><div><span class="mu">Crônicas</span><b>${lst(f.chronic)}</b></div><div><span class="mu">Medicação</span><b>${lst(f.meds)}</b></div><div><span class="mu">Dor (EVA)</span><b>${ev}</b></div></div>
    <p class="mu" style="margin:6px 0 0;font-size:12px">${E(c.counts.registros)} registros aprovados · ${E(c.counts.evolucoes)} evoluções · ${E(c.counts.consultas)} consultas · ${E(c.counts.documentos)} documentos${c.full ? '' : ' (caso atual)'}</p></div>`;
  const opts = `<div class="cd"><h3>Sugestões e documentos</h3>
    <label class="crow"><input type="checkbox" data-a="csfull" ${S.csFull ? 'checked' : ''}> <span>História clínica completa</span></label>
    <label class="crow"><input type="checkbox" data-a="csanon" ${S.csAnon !== false ? 'checked' : ''}> <span>Anonimizar o estudo de caso (recomendado)</span></label>
    <label class="crow"><span>País das diretrizes</span><select data-i="cscountry" aria-label="País das diretrizes">${CCODES.map(([k, n]) => `<option value="${k}" ${k === ccountry() ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    ${c.aiConsent ? '' : '<p class="cwarn">Para gerar sugestões com IA, ative o consentimento de IA em <button class="lk" data-a="view" data-p="cfg">Configurações</button>.</p>'}
    <div class="cbtns">${Object.entries(CK).map(([k, v]) => `<button class="cb" style="--pc:${v[1]}" data-a="csgen" data-p="${k}" ${cwBusy ? 'disabled' : ''}><i>${v[2]}</i><span>${cwBusy === k ? 'Gerando…' : v[3]}</span></button>`).join('')}</div><div class="cbtns"><button class="cb" style="--pc:#7c6bd6" data-a="famo" data-p="genograma"><i>${ic('<circle cx="8" cy="7" r="3"/><circle cx="17" cy="7" r="3"/><path d="M3 20v-3a4 4 0 014-4h2M12 20v-3a4 4 0 014-4h1a4 4 0 014 4v3M12.5 13V20"/>', 16)}</i><span>Familiograma</span></button><button class="cb" style="--pc:#2a9d8f" data-a="famo" data-p="ecomapa"><i>${ic('<circle cx="12" cy="12" r="3"/><circle cx="5" cy="5" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><path d="M7 7l3 3M17 7l-3 3M7 17l3-3M17 17l-3-3"/>', 16)}</i><span>Ecomapa</span></button></div>
    <p class="mu" style="font-size:12px;margin:8px 0 0">As sugestões são rascunhos de apoio à decisão e exigem validação do médico. A IA recebe só o conteúdo clínico aprovado, sem nome, e-mail ou telefone.</p></div>`;
  return sum + opts;
}
async function loadCase() {
  const id = cpid(); if (!id || !S.me || !HLT(S.me.role)) return;
  try { const c = await api(`/patients/${id}/case?full=${S.csFull ? 1 : 0}`); S.cs = { ...c, pid: id }; } catch { S.cs = null; }
  render();
}
const _tab0 = A.tab; A.tab = p => { _tab0(p); if (p === 'caso') loadCase(); };
const _lp0 = loadPanel; loadPanel = async function () { await _lp0(); if (S.tab === 'caso' && S.me && HLT(S.me.role)) loadCase(); };
document.addEventListener('change', e => {
  const t = e.target, a = t.dataset && t.dataset.a;
  if (a === 'csfull') { S.csFull = t.checked; loadCase(); }
  else if (a === 'csanon') { S.csAnon = t.checked; }
  else if (t.dataset && t.dataset.i === 'cscountry') { api('/me/country', { m: 'PUT', b: { country: t.value } }).then(() => { if (S.cs) S.cs.country = t.value; S.me.country = t.value; toast('País das diretrizes atualizado'); }).catch(() => toast('Não foi possível salvar o país')); }
});
/* ---------- geração e janelas ---------- */
const clang = () => (window.I18N && I18N.lang) || 'pt';
A.csgen = k => run(async () => {
  if (cwBusy || !CK[k]) return; const id = cpid(), full = S.csFull || k === 'estudo'; cwBusy = k; render();
  try {
    const r = await api(`/patients/${id}/case/ai`, { m: 'POST', b: { kind: k, full: !!full, lang: clang(), anonymize: S.csAnon !== false } });
    let data = S.cs && S.cs.full === !!full && S.cs.pid === id ? S.cs : null; if (!data && (full || k === 'estudo')) { try { data = { ...(await api(`/patients/${id}/case?full=1`)), pid: id }; } catch { data = S.cs; } }
    const nm = S.cs ? S.cs.patient : { name: '', initials: '' };
    cwOpen({ id: 'w' + Date.now().toString(36), kind: k, pid: id, patient: nm.initials, title: CK[k][0] + (k === 'conduta' ? ' · ' + (CCODES.find(c => c[0] === r.country) || [0, r.country])[1] : '') + (full && k === 'soap' ? ' + história completa' : ''), md: r.md, at: r.generatedAt, lang: r.lang, country: r.country, full: !!full, anon: S.csAnon !== false, data });
  } catch (e) { toast(e.message || 'IA indisponível no momento'); } finally { cwBusy = ''; render(); }
});
function cwOpen(w) { CW.forEach(x => { if (x.st === 'open') x.st = 'min'; }); if (window.CONSULTA) CONSULTA.closeAll(); const n = CW.length, W = innerWidth, H = innerHeight, ww = Math.min(560, W - 24), hh = Math.min(540, H - 90), panelOn = !!document.querySelector('aside.panel') && getComputedStyle(document.querySelector('aside.panel')).display !== 'none'; Object.assign(w, { st: 'open', w: ww, h: hh, x: Math.max(12, (panelOn ? W - 400 - ww - 54 : W - ww - 54) - (n % 4) * 26), y: 64 + (n % 4) * 28, z: ++cwz }); CW.push(w); cwRender(); }
function cwRender() {
  let lay = document.getElementById('cwl'); if (!lay) { lay = document.createElement('div'); lay.id = 'cwl'; document.body.append(lay); }
  const panel = document.querySelector('aside.panel'), pr = panel && getComputedStyle(panel).display !== 'none' ? panel.getBoundingClientRect() : null, right = pr ? innerWidth - pr.left + 6 : 6;
  lay.innerHTML = CW.filter(w => w.st === 'open').map(w => `<article class="cw" data-cw="${w.id}" style="left:${w.x}px;top:${w.y}px;width:${w.w}px;height:${w.h}px;z-index:${w.z};--pc:${CK[w.kind][1]}" role="dialog" aria-label="${E(w.title)}"><header class="cwh" data-cwd><i class="cwi">${CK[w.kind][2]}</i><b>${E(w.title)}</b><small class="mu">${E(w.patient)}</small><span class="sp"></span>
    <button data-a="cwpdf" data-p="${w.id}" title="Exportar PDF" aria-label="Exportar PDF">PDF</button><button data-a="cwcopy" data-p="${w.id}" title="Copiar texto" aria-label="Copiar texto">⧉</button><button data-a="cwpin" data-p="${w.id}" title="Fixar no desktop" aria-label="Fixar no desktop">📌</button><button data-a="cwmin" data-p="${w.id}" title="Minimizar para o ícone ao lado do painel" aria-label="Minimizar">▁</button><button data-a="cwx" data-p="${w.id}" title="Fechar" aria-label="Fechar">×</button></header>
    <div class="cwb">${mdH(w.md)}<p class="cwf">${E('')}Sugestão gerada por IA em ${E(dt(w.at))}. Rascunho de apoio à decisão: revisar e validar antes de qualquer uso clínico.</p></div></article>`).join('')
    + `<nav class="cwd" style="right:${right}px" aria-label="Janelas do caso">${CW.map(w => `<button class="cwk ${w.st === 'open' ? 'on' : ''}" style="--pc:${CK[w.kind][1]}" data-a="cwtog" data-p="${w.id}" title="${E(w.title)}" aria-label="${E(w.title)}"><i>${CK[w.kind][2]}</i></button>`).join('')}</nav>`;
  lay.querySelector('.cwd').style.display = CW.length ? '' : 'none';
}
const cwGet = id => CW.find(w => w.id === id);
A.cwmin = id => { const w = cwGet(id); if (w) { w.st = 'min'; cwRender(); } };
A.cwtog = id => { const w = cwGet(id); if (w) { if (w.st !== 'open') { CW.forEach(x => { if (x.st === 'open') x.st = 'min'; }); if (window.CONSULTA) CONSULTA.closeAll(); } w.st = w.st === 'open' ? 'min' : 'open'; w.z = ++cwz; cwRender(); } };
A.cwx = id => { CW = CW.filter(w => w.id !== id); cwRender(); };
A.cwcopy = id => { const w = cwGet(id); if (w && navigator.clipboard) navigator.clipboard.writeText(w.md).then(() => toast('Texto copiado'), () => toast('Não foi possível copiar')); };
const pinKey = () => 'm3d_cpins_' + (S.me ? S.me.id : '');
const PINS = { get() { try { return JSON.parse(sessionStorage.getItem(pinKey())) || []; } catch { return []; } }, set(a) { try { sessionStorage.setItem(pinKey(), JSON.stringify(a.slice(0, 12))); } catch { toast('Não foi possível fixar neste navegador'); } } };
A.cwpin = id => { const w = cwGet(id); if (!w) return; const { data, ...rest } = w; PINS.set([{ ...rest, pinned: true }, ...PINS.get().filter(p => p.id !== id)]); toast('Fixado no desktop (somente nesta sessão do navegador)'); };
A.cwunpin = id => { PINS.set(PINS.get().filter(p => p.id !== id)); if (isHome()) render(); };
A.cwopenpin = id => { const p = PINS.get().find(x => x.id === id); if (!p) return; const ex = cwGet(id); if (ex) { ex.st = 'open'; ex.z = ++cwz; cwRender(); } else cwOpen({ ...p }); };
// mover janelas pelo título e guardar o tamanho após redimensionar
let cwd = null;
document.addEventListener('pointerdown', e => {
  const art = e.target.closest && e.target.closest('.cw'); if (!art) return; const w = cwGet(art.dataset.cw); if (!w) return; w.z = ++cwz; art.style.zIndex = w.z;
  const hd = e.target.closest('[data-cwd]'); if (!hd || e.target.closest('button')) return; cwd = { w, art, x0: e.clientX, y0: e.clientY, ox: w.x, oy: w.y }; hd.setPointerCapture(e.pointerId); e.preventDefault();
});
document.addEventListener('pointermove', e => { if (!cwd) return; cwd.w.x = Math.max(0, Math.min(innerWidth - 120, cwd.ox + e.clientX - cwd.x0)); cwd.w.y = Math.max(0, Math.min(innerHeight - 40, cwd.oy + e.clientY - cwd.y0)); cwd.art.style.left = cwd.w.x + 'px'; cwd.art.style.top = cwd.w.y + 'px'; });
document.addEventListener('pointerup', () => { if (cwd) { const r = cwd.art.getBoundingClientRect(); cwd.w.w = r.width; cwd.w.h = r.height; cwd = null; } });
document.addEventListener('dblclick', e => { const h = e.target.closest && e.target.closest('[data-cwd]'); if (h && !e.target.closest('button')) A.cwmin(h.closest('.cw').dataset.cw); });
addEventListener('resize', () => { if (CW.length) cwRender(); });
// ao trocar de paciente ou sair, as janelas do caso anterior saem de cena
const _lo0 = A.out; if (_lo0) A.out = (...a) => { CW = []; cwRender(); return _lo0(...a); };
/* ---------- fixados no desktop ---------- */
const _hh0 = homeH; homeH = function () {
  const h = _hh0(), P = PINS.get(); if (!P.length) return h;
  const brief = P.map(p => `<div class="cpin"><button class="sn-r" data-a="cwopenpin" data-p="${p.id}"><b>${E(p.title)}</b><small>${E(p.patient || '')} · ${E(dt(p.at))}</small></button><button class="cpx" data-a="cwunpin" data-p="${p.id}" aria-label="Desafixar" title="Desafixar">×</button></div>`).join('');
  const det = P.map(p => `<div class="sn-card"><b>${E(p.title)}</b><small>${E(p.patient || '')} · ${E(dt(p.at))}</small><div class="cpv">${mdH(String(p.md || '').slice(0, 900))}</div><div class="cpin"><button class="sn-m" data-a="cwopenpin" data-p="${p.id}">${ES('Abrir janela')} →</button><button class="cpx" data-a="cwunpin" data-p="${p.id}" aria-label="Desafixar" title="Desafixar">×</button></div></div>`).join('');
  return h.replace(/(<div class="sns" id="sns">)([\s\S]*?)(<\/div><\/div>\s*<div class="pstack")/, (m, a, b, d) => a + b + pitCard('cs', 'pt-c', -1, 'Casos fixados', brief, det) + d);
};
/* ---------- PDF (estudo de caso em padrão científico) ---------- */
const cTr = s => (window.I18N && I18N.t ? I18N.t(s) : s), cesc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mdPrint = md => mdH(md).replace(/[⁣⁤]/g, '');
function appendixH(w) {
  const d = w.data; if (!d) return '';
  const f = d.facts, tl = (d.timeline || []).map(t => `<tr><td>${cesc(new Date(t.at).toISOString().slice(0, 10))}</td><td>${cesc(cTr({ registro: 'Registro clínico', evolucao: 'Evolução', consulta: 'Consulta', documento: 'Documento' }[t.type] || t.type))}</td><td>${cesc(t.text)}</td></tr>`).join('');
  const kv = (k, v) => `<tr><th>${cesc(cTr(k))}</th><td>${cesc(v)}</td></tr>`;
  return `<section class="apx"><h2>${cesc(cTr('Apêndice: dados vinculados ao paciente'))}</h2><table class="kv">${kv('Alergias', (f.allergies || []).join(', ') || '–')}${kv('Condições crônicas', (f.chronic || []).join(', ') || '–')}${kv('Medicações em uso', (f.meds || []).join(', ') || '–')}${f.eva ? kv('Dor (EVA)', `${f.eva.first}/10 (${f.eva.firstAt}) → ${f.eva.last}/10 (${f.eva.lastAt})`) : ''}${f.goal ? kv('Meta terapêutica', `${f.goal.description} (≤ ${f.goal.target}/10, ${f.goal.due})`) : ''}</table>
    ${tl ? `<h3>${cesc(cTr('Linha do tempo'))}</h3><table class="tl"><thead><tr><th>${cesc(cTr('Data'))}</th><th>${cesc(cTr('Tipo'))}</th><th>${cesc(cTr('Descrição'))}</th></tr></thead><tbody>${tl}</tbody></table>` : ''}</section>`;
}
A.cwpdf = id => {
  const w = cwGet(id); if (!w) return; const who = w.anon ? w.patient : ((w.data && w.data.patient.name) || w.patient), lang = w.lang || clang();
  const root = document.createElement('div'); root.id = 'printroot'; root.setAttribute('lang', lang);
  root.innerHTML = `<header class="pr-h"><div>Talk.M3D</div><div>${cesc(cTr(CK[w.kind][0]))}</div></header><h1 class="pr-t">${cesc(w.title)}</h1><p class="pr-m">${cesc(cTr('Paciente'))}: ${cesc(who)} · ${cesc(cTr('Data'))}: ${cesc(new Date(w.at).toISOString().slice(0, 10))} · ${cesc(cTr('País das diretrizes'))}: ${cesc((CCODES.find(c => c[0] === w.country) || [0, w.country])[1])}</p><div class="pr-b">${mdPrint(w.md)}</div>${w.kind === 'estudo' || w.full ? appendixH(w) : ''}<p class="pr-f">${cesc(cTr('Sugestão gerada por IA. Rascunho de apoio à decisão: revisar e validar antes de qualquer uso clínico.'))}</p>`;
  document.body.append(root); document.body.classList.add('printing');
  const done = () => { document.body.classList.remove('printing'); root.remove(); removeEventListener('afterprint', done); }; addEventListener('afterprint', done);
  const t0 = document.title; document.title = (w.title + ' - ' + who).replace(/[\\/:*?"<>|]/g, ' '); setTimeout(() => { window.print(); document.title = t0; }, 60);
};
