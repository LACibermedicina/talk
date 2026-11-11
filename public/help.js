/* Ajuda e guia passo a passo.
   - Evidencia a área explicada: o resto da tela fica com overlay e desfoque; a área em foco continua clicável.
   - O descritivo aparece junto da área em foco. Dois cliques fora da caixa (e fora da área em foco) fecham o guia.
   - Reabre pelo botão de ajuda (?) do menu, pelo botão flutuante ou com Alt+G.
   Usado pelo app instalado (HELP.runApp) e pelo HTML de demonstração (HELP.run com os passos da demonstração). */
(function () {
  'use strict';
  const E = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const css = document.createElement('style');
  css.textContent = `.hp{position:fixed;z-index:68;background:rgba(8,15,24,.58);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);cursor:pointer}.hp.nob{-webkit-backdrop-filter:none;backdrop-filter:none;background:rgba(8,15,24,.38)}
#hring{position:fixed;z-index:69;pointer-events:none;border-radius:12px;border:2px solid #7fe3ff;box-shadow:0 0 0 3px rgba(127,227,255,.25),0 0 22px 4px rgba(127,227,255,.55);animation:hpulse 1.8s ease-in-out infinite}
@keyframes hpulse{50%{box-shadow:0 0 0 6px rgba(127,227,255,.12),0 0 30px 8px rgba(127,227,255,.35)}}
#hbox{position:fixed;z-index:70;width:min(380px,calc(100vw - 24px));background:#0e1621;color:#e8f1f4;border:1px solid #5eb5f7aa;border-radius:16px;box-shadow:0 12px 40px #000a;font:14px/1.45 Inter,system-ui,sans-serif}
#hbox .th{display:flex;align-items:center;gap:8px;padding:10px 12px;cursor:pointer}#hbox .th b{flex:1}
#hbox button{font:inherit;color:inherit;border:1px solid #ffffff44;background:#ffffff14;border-radius:10px;padding:6px 12px;cursor:pointer;min-height:36px}
#hbox button.pri{background:#1f88c0;border-color:#5eb5f7;font-weight:600}#hbox button:disabled{opacity:.4;cursor:default}
#hbox .bd{padding:0 14px 12px;max-height:52vh;overflow:auto}#hbox h2{font-size:16px;margin:2px 0 6px}#hbox .why{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#8fd0ff}
#hbox ul{margin:6px 0;padding-left:18px;color:#cfe3ea}#hbox .pg{height:4px;background:#ffffff22;border-radius:2px;margin:0 14px 8px}#hbox .pg i{display:block;height:100%;background:#4bab9d;border-radius:2px;transition:width .4s}
#hbox .nv{display:flex;gap:8px;padding:0 14px 12px;flex-wrap:wrap}#hbox .nv .sp{flex:1}#hbox select{width:100%;margin:0 0 8px;padding:6px;border-radius:8px;background:#17212b;color:#fff;border:1px solid #ffffff33}
#hbox .hint{margin:0 14px 10px;padding:7px 10px;border-radius:10px;background:#f1c40f22;border:1px solid #f1c40f88;color:#ffe9a6;font-size:13px}
#hbox :focus-visible,#helpfab:focus-visible{outline:3px solid #8fd0ff;outline-offset:2px}
#helpfab{position:fixed;right:16px;bottom:16px;z-index:60;display:none;align-items:center;gap:8px;font:600 14px Inter,system-ui,sans-serif;color:#fff;background:#1f88c0;border:1px solid #5eb5f7;border-radius:99px;padding:10px 16px;cursor:pointer;box-shadow:0 6px 20px #0006}
@media (prefers-reduced-motion:reduce){#hring{animation:none}#hbox .pg i{transition:none}}`;
  document.head.append(css);
  const panes = [0, 1, 2, 3].map(() => { const d = document.createElement('div'); d.className = 'hp'; d.hidden = true; d.setAttribute('aria-hidden', 'true'); document.body.append(d); return d; });
  const ring = document.createElement('div'); ring.id = 'hring'; ring.hidden = true; document.body.append(ring);
  const box = document.createElement('div'); box.id = 'hbox'; box.hidden = true; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Guia passo a passo'); document.body.append(box);
  const fab = document.createElement('button'); fab.id = 'helpfab'; fab.type = 'button'; fab.setAttribute('aria-label', 'Abrir a ajuda e o guia passo a passo');
  fab.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 114 2c-1 .6-1.5 1-1.5 2M12 17v.5"/></svg><span>Ajuda</span>'; document.body.append(fab);

  let cfg = null, i = 0, open = true, shown = false, side = 'l', outside = 0, outT = 0, raf = 0, lastKey = '';
  const pad = 8, qs = s => { try { return document.querySelector(s); } catch { return null; } };
  function target(s) {
    if (!s) return null; const list = Array.isArray(s) ? s : [s];
    for (const x of list) { const el = typeof x === 'function' ? x() : qs(x); if (!el) continue; const r = el.getBoundingClientRect(); if (r.width > 8 && r.height > 8 && getComputedStyle(el).visibility !== 'hidden') return el; }
    return null;
  }
  function paneRects(r) {
    const W = innerWidth, H = innerHeight; if (!r) return [[0, 0, W, H], null, null, null];
    const x1 = Math.max(0, r.left - pad), y1 = Math.max(0, r.top - pad), x2 = Math.min(W, r.right + pad), y2 = Math.min(H, r.bottom + pad);
    return [[0, 0, W, y1], [0, y2, W, H - y2], [0, y1, x1, y2 - y1], [x2, y1, W - x2, y2 - y1]];
  }
  function place(r) {
    const W = innerWidth, H = innerHeight, bw = box.offsetWidth, bh = box.offsetHeight, m = 14, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    box.style.right = box.style.bottom = 'auto';
    if (r) {
      const t = { x1: r.left - pad, y1: r.top - pad, x2: r.right + pad, y2: r.bottom + pad }, opts = [
        [t.x2 + m, clamp(t.y1, 8, H - bh - 8), t.x2 + m + bw <= W - 8], [t.x1 - m - bw, clamp(t.y1, 8, H - bh - 8), t.x1 - m - bw >= 8],
        [clamp(t.x1, 8, W - bw - 8), t.y2 + m, t.y2 + m + bh <= H - 8], [clamp(t.x1, 8, W - bw - 8), t.y1 - m - bh, t.y1 - m - bh >= 8]];
      const ok = opts.find(o => o[2]); if (ok) { box.style.left = ok[0] + 'px'; box.style.top = ok[1] + 'px'; return; }
      const cx = (r.left + r.right) / 2; box.style.left = (cx > W / 2 ? 12 : W - bw - 12) + 'px'; box.style.top = Math.max(8, H - bh - 12) + 'px'; return;
    }
    box.style.left = (side === 'l' ? 12 : Math.max(8, W - bw - 12)) + 'px'; box.style.top = Math.max(8, H - bh - 12) + 'px';
  }
  function layout() {
    raf = 0; if (!shown || !cfg) return; const s = cfg.steps[i], el = target(s.sel), r = el ? el.getBoundingClientRect() : null;
    const rects = paneRects(r); panes.forEach((p, k) => { const q = rects[k]; p.hidden = !q || q[2] <= 0 || q[3] <= 0; if (q) { p.style.left = q[0] + 'px'; p.style.top = q[1] + 'px'; p.style.width = q[2] + 'px'; p.style.height = q[3] + 'px'; } p.classList.toggle('nob', !r); });
    ring.hidden = !r; if (r) { ring.style.left = r.left - pad + 'px'; ring.style.top = r.top - pad + 'px'; ring.style.width = r.width + pad * 2 + 'px'; ring.style.height = r.height + pad * 2 + 'px'; }
    place(r);
  }
  const queue = () => { if (!raf) raf = requestAnimationFrame(layout); };
  function draw() {
    if (!cfg) return; const s = cfg.steps[i], n = cfg.steps.length;
    fab.style.display = !shown && cfg.fab ? 'flex' : 'none';
    for (const p of panes) p.hidden = !shown; ring.hidden = !shown; box.hidden = !shown; if (!shown) { clearTimeout(outT); return; }
    const hint = outside ? '<div class="hint" role="status">Clique mais uma vez fora da caixa para sair do guia.</div>' : '';
    box.innerHTML = `<div class="th" data-hg="toggle" role="button" tabindex="0" aria-expanded="${open}"><b>${E(cfg.title || 'Guia')} · etapa ${i + 1} de ${n}</b><button data-hg="close" aria-label="Fechar o guia" title="Fechar o guia (Alt+G reabre)">×</button></div><div class="pg"><i style="width:${(i + 1) / n * 100}%"></i></div>${hint}${open ? `<div class="bd" aria-live="polite"><div class="why">${s.why || ''}</div><h2>${E(s.t)}</h2><p>${s.x || ''}</p>${s.e && s.e.length ? `<b>Experimente</b><ul>${s.e.map(t => `<li>${t}</li>`).join('')}</ul>` : ''}</div><div class="nv"><button data-hg="prev" ${i ? '' : 'disabled'}>Anterior</button><span class="sp"></span>${s.go && cfg.reopen ? '<button data-hg="reopen" title="Abrir a tela desta etapa de novo">Reabrir tela</button>' : ''}<button class="pri" data-hg="${i < n - 1 ? 'next' : 'close'}">${i < n - 1 ? 'Próximo' : 'Concluir'}</button></div>${n > 3 ? `<div class="bd" style="padding-top:0"><select data-hg="sel" aria-label="Ir para a etapa">${cfg.steps.map((x, k) => `<option value="${k}" ${k === i ? 'selected' : ''}>${E(x.t)}</option>`).join('')}</select></div>` : ''}` : ''}`;
    queue();
  }
  async function go(n) {
    if (!cfg) return; i = Math.max(0, Math.min(cfg.steps.length - 1, n)); side = cfg.steps[i].side || side; outside = 0; shown = true; draw();
    try { if (cfg.steps[i].go) await cfg.steps[i].go(); } catch (e) { console.error(e); }
    await new Promise(r => setTimeout(r, 60)); const el = target(cfg.steps[i].sel); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    draw(); const nb = box.querySelector('.pri'); if (nb) nb.focus({ preventScroll: true });
  }
  function close() { shown = false; outside = 0; draw(); if (cfg && cfg.fab) fab.focus({ preventScroll: true }); if (cfg && cfg.onclose) cfg.onclose(); }
  function reopen() { if (!cfg) return; shown = true; outside = 0; draw(); const nb = box.querySelector('.pri'); if (nb) nb.focus({ preventScroll: true }); }
  // Dois cliques fora (fora da caixa e fora da área em foco) encerram o guia.
  for (const p of panes) p.addEventListener('click', () => {
    outside++; clearTimeout(outT); if (outside >= 2) return close(); draw(); outT = setTimeout(() => { outside = 0; draw(); }, 5000);
  });
  box.addEventListener('click', e => {
    const t = e.target.closest('[data-hg]'); outside = 0; if (!t) return; const a = t.dataset.hg;
    if (a === 'toggle' && !e.target.closest('button')) { open = !open; draw(); return; }
    if (a === 'close') return close(); if (a === 'prev') go(i - 1); if (a === 'next') go(i + 1); if (a === 'reopen') go(i);
  });
  box.addEventListener('change', e => { if (e.target.dataset.hg === 'sel') go(+e.target.value); });
  box.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.dataset.hg === 'toggle') { open = !open; draw(); } });
  fab.addEventListener('click', () => reopen());
  document.addEventListener('keydown', e => {
    if (e.altKey && (e.key === 'g' || e.key === 'G')) { shown ? close() : (cfg ? reopen() : HELP.runApp()); }
    if (!shown) return; if (e.key === 'Escape') close(); if (e.altKey && e.key === 'ArrowRight') go(i + 1); if (e.altKey && e.key === 'ArrowLeft') go(i - 1);
  });
  addEventListener('resize', queue); document.addEventListener('scroll', queue, true);
  new MutationObserver(() => { if (shown) queue(); }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });

  const app = () => {
    const mob = innerWidth < 900, openList = () => { if (typeof S !== 'undefined' && mob && S.me) { S.lo = true; render(); } };
    return [
      { t: 'Bem-vindo ao Talk.M3D', why: 'Visão geral', x: 'Este guia mostra, uma área por vez, onde ficam as principais funções. Na tela, apenas a área explicada fica nítida e clicável. <b>Clique duas vezes fora da caixa para sair</b>; o botão <b>?</b> do menu abre o guia de novo quando você precisar.', e: ['Use Próximo e Anterior para andar pelas áreas.'] },
      { t: 'Seções do menu', sel: ['.rail', '.rail2'], why: 'Barra de ícones', x: 'Cada ícone abre um grupo no menu: <b>Usuários, Gestão, Canais internos, Relatórios e Conta</b>.', e: ['Clique em um ícone para trocar os blocos ao lado.'], go: openList },
      { t: 'Blocos como caixa de e-mail', sel: ['aside.list .bk', 'aside.list'], why: 'Menu lateral', x: 'Os tópicos aparecem em <b>blocos coloridos</b> que você recolhe ou expande, como as pastas de uma caixa de e-mail. Em Usuários, veja quem está <b>online</b>; você também cria grupos e arrasta pessoas entre eles.', e: ['Recolha um bloco no título.', 'Use “Recolher tudo” para deixar só os títulos.'], go: openList },
      { t: 'Área de trabalho', sel: ['section.chat'], why: 'Centro da tela', x: 'Aqui ficam a conversa, a agenda, o mapa de relações, as anotações e as demais telas escolhidas no menu.', e: ['Abra “Agenda Visual” em Gestão.'] },
      { t: 'Painel, tarefas e calendário', sel: ['aside.panel'], why: 'Lado direito', x: 'O painel mostra o <b>calendário de tarefas</b> em post-its, as pendências de hoje (com destaque para o paciente em foco) e o resumo de evolução. Você pode minimizar ou ampliar o calendário.', e: ['Clique em um dia para ver as tarefas dele.', 'Marque uma tarefa como feita no quadradinho.'], go: () => { if (typeof S !== 'undefined' && S.np) { S.np = false; render(); } } },
      { t: 'Mapa de relações', sel: ['#g3', 'aside.list'], why: 'Relatórios', x: 'O mapa liga equipe, pacientes, consultas e terapias. A <b>legenda</b> explica cores e tipos de linha, e ao clicar em um item aparece o detalhe, que você pode <b>salvar nas anotações</b>.', e: ['Em Relatórios, abra “Relações (3D)”.'], go: async () => { if (typeof A !== 'undefined' && typeof S !== 'undefined' && S.me && S.me.role !== 'paciente') { await A.view('grafo'); } } },
      { t: 'Ajuda sempre à mão', sel: ['.helpbtn'], why: 'Para voltar aqui', x: 'O botão <b>?</b> no topo do menu reabre este guia a qualquer momento (atalho: Alt+G).', e: [] }
    ];
  };
  window.HELP = {
    run(steps, o = {}) { cfg = { steps, title: o.title || 'Guia', fab: o.fab !== false, reopen: !!o.reopen, onclose: o.onclose }; i = 0; open = true; shown = true; go(o.start || 0); },
    runApp() { this.run(app(), { title: 'Ajuda', fab: false }); },
    open() { cfg ? reopen() : this.runApp(); }, close, go, get active() { return shown; }
  };
})();
