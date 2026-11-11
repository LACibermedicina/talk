/* Idiomas da interface: português (Brasil), espanhol, guarani, inglês e chinês.
   Funciona sobre o HTML já pronto: dados de usuários (nomes, mensagens, notas) chegam marcados por E() e NUNCA são traduzidos nem enviados;
   textos fixos usam o dicionário (i18n-dict.js) e, quando faltam, a IA do servidor com cache. */
(function () {
  'use strict';
  const S0 = '\u2063', S1 = '\u2064', STRIP = /[\u2063\u2064]/g, SKIP = 'script,style,noscript,code,pre,textarea,[translate=no],.notr,.av';
  const LANGS = [['pt', 'Português (Brasil)', 'pt-BR'], ['es', 'Español', 'es'], ['gn', "Avañe'ẽ (Guaraní)", 'gn'], ['en', 'English', 'en'], ['zh', '中文（简体）', 'zh-CN']], IDX = { es: 0, gn: 1, en: 2, zh: 3 }, ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];
  let lang = 'pt'; try { const l = localStorage.getItem('m3d_lang'); if (LANGS.some(x => x[0] === l)) lang = l; } catch { /* sem armazenamento */ }
  const load = l => { try { return JSON.parse(localStorage.getItem('m3d_i18n_' + l)) || {}; } catch { return {}; } };
  let cache = load(lang); const regs = [], seen = new Set(), queued = new Map(); let timer = 0, retryAt = 0;
  const sensitive = s => /@|https?:\/\/|\d{8,}/i.test(s), hasLetters = s => /[A-Za-zÀ-ÿ]/.test(s.replace(/\{\d+\}/g, ''));
  const dict = () => window.I18N_DICT || {};
  function build(raw, prot) {
    const parts = String(raw).split(/([\u2063\u2064])/), vals = []; let tpl = '', pi = -1;
    for (const p of parts) {
      if (p === S0) { prot = true; pi = -1; } else if (p === S1) { prot = false; pi = -1; }
      else if (p) { if (prot) { if (pi < 0) { vals.push(''); pi = vals.length - 1; tpl += '{' + pi + '}'; } vals[pi] += p; } else tpl += p.replace(/(?<![A-Za-z\d])\d+(?:[.,:\/]\d+)*(?![A-Za-z\d])/g, m => { vals.push(m); return '{' + (vals.length - 1) + '}'; }); }
    }
    const m = tpl.match(/^(\s*)([\s\S]*?)(\s*)$/); return { lead: m[1], core: m[2], trail: m[3], vals, prot, ok: hasLetters(m[2]) };
  }
  const fill = (t, vals) => t.replace(/\{(\d+)\}/g, (x, i) => vals[i] !== undefined ? vals[i] : x);
  const pl = s => (s.match(/\{\d+\}/g) || []).sort().join(',');
  function lookup(core) {
    if (lang === 'pt') return null; const d = dict()[core]; if (d && d[IDX[lang]]) return d[IDX[lang]];
    const c = cache[core]; return c && pl(c) === pl(core) ? c : null;
  }
  function ctxOf(el) { const a = el && el.closest ? el.closest('[data-f],aside,section,header,form,nav,main,dialog,.wz-card,.pub,.cd,.pcard,.bk,.prov,.learn,.tm,#tour') : null; return ((a ? a.tagName.toLowerCase() + (a.id ? '#' + a.id : a.classList && a.classList[0] ? '.' + a.classList[0] : '') : 'página') + '; ' + (el ? el.tagName.toLowerCase() : '')).slice(0, 80); }
  function want(core, el) { if (lang === 'pt' || sensitive(core) || core.length < 3 || core.length > 300 || !/[a-zà-ÿ]/.test(core) || (!/\s/.test(core) && /[._\/:]/.test(core)) || queued.has(core)) return; if (Date.now() < retryAt) return; queued.set(core, ctxOf(el)); clearTimeout(timer); timer = setTimeout(flush, 350); }
  async function flush() {
    if (!queued.size || lang === 'pt') return; const mine = lang, items = [...queued].slice(0, 30).map(([s, c]) => ({ s, c })); items.forEach(i => queued.delete(i.s));
    try {
      const r = await fetch('/api/i18n/translate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lang: mine, items }) }); if (!r.ok) throw 0;
      const j = await r.json(); if (mine !== lang) return; let n = 0; for (const [k, v] of Object.entries(j.out || {})) if (pl(k) === pl(v)) { cache[k] = v; n++; }
      try { const keys = Object.keys(cache); if (keys.length > 4000) keys.slice(0, keys.length - 4000).forEach(k => delete cache[k]); localStorage.setItem('m3d_i18n_' + mine, JSON.stringify(cache)); } catch { /* cheio */ }
      if (n) refresh();
    } catch { retryAt = Date.now() + 60000; }
    if (queued.size) { clearTimeout(timer); timer = setTimeout(flush, 200); }
  }
  function setText(e) {
    const b = build(e.raw, e.p0), plain = String(e.raw).replace(STRIP, ''); let out = plain;
    if (b.ok) { seen.add(b.core); const t = lookup(b.core); if (t) out = b.lead + fill(t, b.vals) + b.trail; else want(b.core, e.n.parentElement); }
    if (e.n.nodeValue !== out) e.n.nodeValue = out;
  }
  function setAttr(e) {
    const b = build(e.raw, false), plain = String(e.raw).replace(STRIP, ''); let out = plain;
    if (b.ok) { seen.add(b.core); const t = lookup(b.core); if (t) out = b.lead + fill(t, b.vals) + b.trail; else want(b.core, e.el); }
    if (e.el.getAttribute(e.a) !== out) e.el.setAttribute(e.a, out);
  }
  const done = new WeakSet();
  function apply(root) {
    if (!root || !root.nodeType) return;
    if (root.nodeType === 3) { if (root.parentElement) root = root.parentElement; else return; }
    if (root.nodeType !== 1) return;
    const els = [root, ...root.querySelectorAll('*')];
    for (const el of els) for (const a of el.getAttributeNames()) { const v = el.getAttribute(a); if (!STRIP.test(v) && !(ATTRS.includes(a) && /\S/.test(v) && !el.closest('[translate=no],.notr'))) continue; STRIP.lastIndex = 0; if (ATTRS.includes(a) && !el.closest('[translate=no],.notr')) { const e = { el, a, raw: v }; regs.push(e); setAttr(e); } else el.setAttribute(a, v.replace(STRIP, '')); }
    const tw = document.createTreeWalker(root, 4); let prot = false, n;
    while ((n = tw.nextNode())) {
      if (done.has(n)) continue; done.add(n); const raw = n.nodeValue; if (!raw || !/\S|[\u2063\u2064]/.test(raw)) continue;
      const skip = n.parentElement && n.parentElement.closest(SKIP), p0 = prot, b = build(raw, prot); prot = b.prot;
      if (skip || !b.ok) { const s = raw.replace(STRIP, ''); if (s !== raw) n.nodeValue = s; continue; }
      const e = { n, raw, p0 }; regs.push(e); setText(e);
    }
  }
  function refresh() { for (let i = regs.length - 1; i >= 0; i--) { const e = regs[i]; if (e.n ? !e.n.isConnected : !e.el.isConnected) { regs.splice(i, 1); continue; } e.n ? setText(e) : setAttr(e); } }
  function set(l, quiet) {
    if (!LANGS.some(x => x[0] === l)) return; lang = l; cache = load(l); queued.clear(); try { localStorage.setItem('m3d_lang', l); } catch { /* sem armazenamento */ }
    document.documentElement.lang = LANGS.find(x => x[0] === l)[2]; document.querySelectorAll('.lgw').forEach(w => { w.outerHTML = selectHTML(); }); refresh();
    if (!quiet && window.I18N && I18N.onchange) I18N.onchange(l);
  }
  const t = s => { const b = build(String(s), false); if (!b.ok) return s; const x = lookup(b.core); if (x) return b.lead + fill(x, b.vals) + b.trail; want(b.core, null); return s; };
  const R = (x, y, w, h, c) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`;
  const FLG = {
    pt: R(0, 0, 30, 20, '#009c3b') + '<path d="M15 2.5 27 10 15 17.5 3 10Z" fill="#ffdf00"/><circle cx="15" cy="10" r="4.2" fill="#002776"/><path d="M11 9.2q4-1.2 8 1.4" stroke="#fff" stroke-width=".9" fill="none"/>',
    es: R(0, 0, 30, 20, '#aa151b') + R(0, 5, 30, 10, '#f1bf00'),
    gn: R(0, 0, 30, 7, '#d52b1e') + R(0, 7, 30, 6, '#fff') + R(0, 13, 30, 7, '#0038a8') + '<circle cx="15" cy="10" r="2.2" fill="none" stroke="#6b8e23" stroke-width=".8"/>',
    en: R(0, 0, 30, 20, '#fff') + [0, 2, 4, 6, 8, 10, 12].map(k => R(0, k * 20 / 13, 30, 20 / 13, '#b22234')).join('') + R(0, 0, 13, 10.8, '#3c3b6e'),
    zh: R(0, 0, 30, 20, '#de2910') + '<path d="m6 3 1.2 3.6h3.8l-3 2.2 1.1 3.6L6 10.2 2.900 12.400 4 8.800 1 6.600h3.800Z" fill="#ffde00"/>'
  };
  const flag = c => `<svg class="fl" viewBox="0 0 30 20" width="22" height="15" aria-hidden="true" focusable="false">${FLG[c] || ''}</svg>`;
  const selectHTML = () => { const cur = LANGS.find(x => x[0] === lang) || LANGS[0]; return `<div class="lgw" translate="no"><button type="button" class="lgb" data-lg="t" aria-haspopup="listbox" aria-expanded="false" aria-label="Idioma / Language / Idioma / Ñe'ẽ / 语言" lang="${cur[2]}">${flag(cur[0])}<span>${cur[1]}</span><i aria-hidden="true">▾</i></button><ul class="lgm" role="listbox" hidden>${LANGS.map(l => `<li role="presentation"><button type="button" role="option" data-lg="${l[0]}" lang="${l[2]}" aria-selected="${l[0] === lang}">${flag(l[0])}<span>${l[1]}</span></button></li>`).join('')}</ul></div>`; };
  const closeLg = () => document.querySelectorAll('.lgm').forEach(m => { m.hidden = true; const b = m.parentNode.querySelector('.lgb'); if (b) b.setAttribute('aria-expanded', 'false'); });
  function ui() {
    const bar = document.createElement('div'); bar.id = 'langbar'; bar.setAttribute('translate', 'no');
    bar.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></svg>${selectHTML()}`;
    document.body.append(bar); document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-lg]'); if (!b) { closeLg(); return; } const v = b.dataset.lg; if (v === 't') { const m = b.parentNode.querySelector('.lgm'), open = m.hidden; closeLg(); if (open) { m.hidden = false; b.setAttribute('aria-expanded', 'true'); m.classList.toggle('up', b.getBoundingClientRect().bottom > innerHeight - 240); } return; } closeLg(); set(v); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLg(); });
  }
  const _c = window.confirm.bind(window), _p = window.prompt.bind(window); window.confirm = m => _c(t(m)); window.prompt = (m, d) => _p(t(m), d);
  window.I18N = { get lang() { return lang; }, langs: LANGS, selectHTML, set, t, apply, refresh, seen, onchange: null, build, flush };
  document.documentElement.lang = LANGS.find(x => x[0] === lang)[2];
  const mo = new MutationObserver(recs => { for (const r of recs) for (const a of r.addedNodes) apply(a); });
  const start = () => { ui(); apply(document.body); mo.observe(document.body, { childList: true, subtree: true }); };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
