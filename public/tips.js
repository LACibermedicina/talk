/* Dicas ao passar o mouse: logo em seguida o nome do ícone; se o mouse demorar, aparece também o resumo do que há dentro da funcionalidade. */
(() => {
  const SHORT = 400, LONG = 1700, SEL = '.happ,.rb,.dk,.pstk,.tbi,.mhome,[data-tip],button[aria-label],[data-a][title],a[title],[role=button][aria-label]';
  const TIPD = { gohome: 'Volta ao desktop com todas as funcionalidades.', menu: 'Abre o menu lateral com contatos, conversas e atalhos.', ntp: 'Lista os avisos e alertas recentes; marque como lidos.', rdesk: 'Restaura quadros, post-its, dock e menu lateral para o padrão.', tcall: 'Envia um pedido de videochamada; quem recebe pode atender ou recusar.', eqblk: 'Encerra a chamada em curso e anula o repasse.' };
  let tip, timer1, timer2, cur = null;
  const el = () => { if (!tip) { tip = document.createElement('div'); tip.id = 'tipx'; tip.setAttribute('role', 'tooltip'); tip.innerHTML = '<b></b><small></small>'; document.body.append(tip); } return tip; };
  const T = s => { try { return typeof ES === 'function' ? ES(s) : s; } catch { return s; } };
  function info(t) {
    let label = t.dataset.tip || '', d = t.dataset.tipd || '';
    const h = t.querySelector('.htip b'); if (h) label = label || h.textContent;
    if (!label) { const ti = t.getAttribute('title'); if (ti) { t.dataset.tt = ti; t.removeAttribute('title'); } label = t.dataset.tt || ''; }
    if (!label) { label = t.getAttribute('aria-label') || ''; if (t.classList.contains('happ')) label = label.split(':')[0]; }
    if (!d) {
      const a = t.dataset.a, p = t.dataset.p;
      if (t.classList.contains('happ') && typeof HDESC !== 'undefined') d = HDESC[p] || '';
      if (!d) d = TIPD[a] || '';
      if (!d && t.classList.contains('rb')) { const r = t.closest('.rib'); d = r ? 'Ação de: ' + r.getAttribute('aria-label') : ''; }
      if (!d && t.classList.contains('dk')) { const v = typeof S !== 'undefined' && S.view; d = 'Painel desta funcionalidade; clique para abrir ou minimizar.' + (v && typeof HDESC !== 'undefined' && HDESC[v] ? ' Aqui: ' + HDESC[v] + '.' : ''); }
      if (!d && a === 'view' && typeof HDESC !== 'undefined') d = HDESC[p] || '';
    }
    return { label: label.trim(), d: d.trim() };
  }
  function place(t) {
    const x = el(), r = t.getBoundingClientRect(), w = x.offsetWidth, h = x.offsetHeight;
    let top = r.top - h - 10; if (top < 6) top = r.bottom + 10; if (top + h > innerHeight - 6) top = Math.max(6, innerHeight - h - 6);
    let left = r.left + r.width / 2 - w / 2; left = Math.max(6, Math.min(left, innerWidth - w - 6));
    x.style.top = top + 'px'; x.style.left = left + 'px';
  }
  function hide() { clearTimeout(timer1); clearTimeout(timer2); cur = null; if (tip) tip.className = ''; }
  function start(t) {
    if (t === cur) return; hide(); const i = info(t); if (!i.label) return; cur = t;
    timer1 = setTimeout(() => { if (cur !== t || !t.isConnected) return; const x = el(); x.querySelector('b').textContent = i.label; x.querySelector('small').textContent = ''; x.className = 'on'; place(t); }, SHORT);
    if (i.d) timer2 = setTimeout(() => { if (cur !== t || !t.isConnected) return; const x = el(); x.querySelector('small').textContent = T(i.d); x.className = 'on lg'; place(t); }, LONG);
  }
  document.addEventListener('pointerover', e => { if (e.pointerType && e.pointerType !== 'mouse') return; const t = e.target.closest && e.target.closest(SEL); if (t) start(t); else if (cur) hide(); });
  document.addEventListener('focusin', e => { const t = e.target.closest && e.target.closest(SEL); if (t && t.matches(':focus-visible')) start(t); });
  for (const ev of ['pointerdown', 'keydown', 'scroll', 'focusout']) document.addEventListener(ev, hide, true);
  document.addEventListener('pointerleave', hide, true);
})();
