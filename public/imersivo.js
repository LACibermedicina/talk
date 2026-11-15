"use strict";
/* Cena 3D imersiva da tela de entrada: abre ao clicar na logo. Plataforma de vidro, painel de login, teclado,
   balão e o Secreto-Bot num banquinho. Arraste para girar tudo, role/pince para aproximar, Esc fecha.
   A cena é CSS 3D; o mascote é o mesmo 3D de /mascote.html, que recebe o ângulo do giro (rv3dYaw) para girar junto. */
(function () {
  const ORI = location.origin && location.origin !== 'null' ? location.origin : '*';
  const D2R = Math.PI / 180, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const BOT = { x: -215, z: 95, w: 250, h: 284 };   // posição do mascote na cena e tamanho da camada dele
  let ov = null, st = null;

  // face plana: w×h, centrada na origem da cena, com a transformação dada
  const face = (cls, w, h, tf, inner = '') => `<div class="f ${cls}" style="width:${w}px;height:${h}px;margin:${-h / 2}px 0 0 ${-w / 2}px;transform:${tf}">${inner}</div>`;
  const slab = (w, d, t) => face('top', w, d, 'translate3d(0,0,0) rotateX(90deg)')
    + face('sd', w, t, `translate3d(0,${t / 2}px,${d / 2}px)`) + face('sd', w, t, `translate3d(0,${t / 2}px,${-d / 2}px) rotateY(180deg)`)
    + face('sd', d, t, `translate3d(${-w / 2}px,${t / 2}px,0) rotateY(-90deg)`) + face('sd', d, t, `translate3d(${w / 2}px,${t / 2}px,0) rotateY(90deg)`);
  const two = (cls, w, h, pos, front, back = '') => face(cls + ' fr', w, h, pos, front) + face(cls + ' bk', w, h, pos + ' rotateY(180deg)', back || front);

  const KEYS = [['1','2','3','4','5','6','7','8','9','0','⌫'], 'qwertyuiop'.split(''), 'asdfghjkl@'.split(''), ['⇧', ...'zxcvbnm'.split(''), '.', '-'], ['_', '␣', '⏎']];
  const KW = { '⌫': 1.6, '⇧': 1.6, '␣': 6, '⏎': 2.2 }, KD = { '⌫': 'Backspace', '⇧': 'Shift', '␣': ' ', '⏎': 'Enter' };
  const keysHTML = () => `<div class="keys">${KEYS.map(r => `<div class="kr">${r.map(k => `<button type="button" tabindex="-1" data-k="${KD[k] || k}" aria-label="${KD[k] || k}" style="flex:${KW[k] || 1}">${k === '␣' ? '' : k}</button>`).join('')}</div>`).join('')}</div>`;

  function cena() {
    const panelF = `<form class="pn" id="imv-f" autocomplete="off" novalidate><label for="imv-u">Usuário ou e-mail</label><input id="imv-u" type="text" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="254"><label for="imv-p">Senha</label><input id="imv-p" type="password" autocomplete="off" maxlength="200"><button class="go" id="imv-go" type="submit">Entrar</button></form>`;
    const logo = `<button type="button" id="imv-lg" class="lg" aria-label="Voltar à versão normal" title="Clique para voltar à versão normal"><img src="/logo.png" alt=""></button><span translate="no">Talk<b>.M3D</b></span>`;
    const leg = a => face('leg', 7, 62, `translate3d(${Math.sin(a) * 26}px,-31px,${Math.cos(a) * 26}px)`) + face('leg', 7, 62, `translate3d(${Math.sin(a) * 26}px,-31px,${Math.cos(a) * 26}px) rotateY(90deg)`);
    const stool = face('seat', 90, 90, 'translate3d(0,-62px,0) rotateX(90deg)') + [0, 2.09, 4.19].map(leg).join('');
    return `<div class="sc" id="imv-sc">${slab(560, 560, 44)}
      <div class="obj" style="transform:translate3d(${BOT.x}px,0,${BOT.z - 6}px)">${stool}</div>
      <div class="obj" style="transform:translate3d(60px,-1px,30px)"><div class="obj kbr">${face('kb', 420, 190, 'translate3d(0,0,95px) rotateX(90deg)', keysHTML())}</div></div>
      ${face('hint', 320, 40, 'translate3d(60px,-1px,252px) rotateX(90deg)', '<button type="button" id="imv-cr">Ainda não tem conta? <u>Criar conta</u></button>')}
      <div class="ringw" id="imv-ring" style="transform:translate3d(60px,-2px,125px) rotateX(90deg)"><b></b><b></b><b></b></div>
      <div class="obj" style="transform:translate3d(60px,0,-170px) rotateY(-14deg)">
        ${two('panel', 340, 270, 'translate3d(0,-135px,0)', panelF, '<div class="pn bkp"></div>')}
        ${two('logo', 440, 80, 'translate3d(20px,-350px,0)', logo)}
        ${two('chip', 190, 40, 'translate3d(-150px,-490px,30px) rotateY(18deg)', '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></svg><em></em><span>Português</span>')}
      </div>
      <div class="obj" style="transform:translate3d(${BOT.x - 80}px,-425px,${BOT.z + 40}px) rotateY(30deg)">${two('say', 215, 96, 'translate3d(0,0,0)', '<span id="imv-t"></span>')}</div>
      <div class="obj" id="imv-bot" style="transform:translate3d(${BOT.x}px,${-14 - BOT.h / 2}px,${BOT.z}px)"><div class="bot" style="width:${BOT.w}px;height:${BOT.h}px;margin:${-BOT.h / 2}px 0 0 ${-BOT.w / 2}px"><iframe src="/mascote.html?pose=sit" title="Secreto-Bot" tabindex="-1" aria-hidden="true"></iframe></div></div>
    </div>`;
  }

  const FALAS = ['Arraste para girar tudo em 3D!', 'Role o mouse para aproximar ou afastar.', 'Este é o consultório digital do Talk.M3D.', 'Esc fecha e volta ao login.'];
  const PLAYS = [
    { a: 'estetoscopio', t: 'Auscultando o teclado… tudo em ordem!' }, { a: 'acena', t: 'Olá! Seja bem-vindo(a)!' },
    { a: 'termometro', t: 'Febre de senha esquecida? Peça ao administrador!' }, { a: 'martelo', t: 'Teste de reflexo no painel. Tudo certo!' },
    { a: 'lanterna', t: 'Deixa eu iluminar a nossa logomarca!' }, { a: 'balao', t: 'Gostou da vista? Gire para ver todos os lados!' }
  ];

  const VIEW = { yaw: 14 * D2R, tilt: 50 * D2R };   // vista inicial: painel de login de frente, bem legível
  const tx = t => (window.I18N && I18N.t) ? I18N.t(t) : t;

  function open(auto) {
    if (ov) return;
    if (!auto) { pref('3d'); fechado = false; }
    const prev = document.activeElement;
    ov = document.createElement('div'); ov.id = 'imv'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'Vista 3D imersiva do Talk.M3D');
    ov.innerHTML = `<div class="imv-bg"></div><div class="imv-stage">${cena()}</div>
      <button class="imv-x" type="button" aria-label="Fechar">✕</button><button class="imv-r" type="button">Reiniciar vista</button>
      <p class="imv-h">Arraste para girar · dê 2 cliques num campo (ou Tab) para digitar · role para aproximar · clique na logo para voltar à versão normal</p>`;
    ov.classList.add('wait');   // fica invisível até o mascote 3D carregar; se não carregar, some e a versão normal continua
    document.body.appendChild(ov); document.body.classList.add('imv-on');
    st = { auto: !!auto, ok: false, yaw: VIEW.yaw, tilt: VIEW.tilt, zoom: 1, vy: 0, drag: null, cand: null, pts: new Map(), pinch: 0, point: false, tgt: null, f: 0, prev, timers: [], cur: null, shift: false, sub: false, until: 0 };
    const $q = q => ov.querySelector(q);
    const sc = $q('#imv-sc'), bot = $q('#imv-bot'), fr = $q('iframe'), ring = $q('#imv-ring'), say = $q('#imv-t');
    const iu = $q('#imv-u'), ip = $q('#imv-p'), go = $q('#imv-go'), cr = $q('#imv-cr'), form = $q('#imv-f'), xb = $q('.imv-x'), rb = $q('.imv-r');
    st.cur = iu;
    try { const ru = document.querySelector('#em'); if (ru && ru.value) iu.value = ru.value; } catch { /* sem campo */ }
    const post = m => { try { fr.contentWindow.postMessage(m, ORI); } catch { /* sem iframe */ } };
    const fit = () => Math.min(innerWidth / 1100, innerHeight / 860, 1.1);
    let lastYaw = null;
    function draw() {
      const k = fit() * st.zoom, yawD = st.yaw / D2R, tiltD = st.tilt / D2R;
      sc.style.transform = `scale(${k}) rotateX(${-tiltD}deg) rotateY(${yawD}deg)`;
      bot.firstChild.style.transform = `rotateY(${-yawD}deg) rotateX(${tiltD}deg)`;
      if (lastYaw !== st.yaw) { lastYaw = st.yaw; post({ rv3dYaw: st.yaw }); }
    }
    const fala = t => { say.textContent = tx(t); };
    const busy = () => { const a = document.activeElement; return a === iu || a === ip || Date.now() < st.until; };

    // o braço do mascote acompanha o alvo (tecla apertada, botão ou o anel do teclado); com a senha em foco ele olha para o outro lado
    function aim() {
      if (st.flip) { post({ rv3dPoint: null }); post({ rv3dMouse: [-500, -80, 300] }); return; }
      if (!st.point) return;
      const el = st.tgt || ring, r = el.getBoundingClientRect(), q = fr.getBoundingClientRect(), x = r.left + r.width / 2 - q.left, y = r.top + r.height / 2 - q.top;
      post({ rv3dPoint: [x, y] }); post({ rv3dMouse: [x, y, 300] });
    }
    function toca(el, ms = 1700) { if (!el) return; st.tgt = el; st.point = true; st.until = Date.now() + ms + 1500; aim(); clearTimeout(st.pt); st.pt = setTimeout(() => { st.tgt = null; st.point = false; post({ rv3dPoint: null }); }, ms); }
    const keyEl = k => { try { return $q(`.keys [data-k="${CSS.escape(k.length === 1 ? k.toLowerCase() : k)}"]`); } catch { return null; } };
    function aperta(k) { const el = keyEl(k); if (!el) return; el.classList.add('hit'); setTimeout(() => el.classList.remove('hit'), 140); toca(el); }

    // digitação pelo teclado virtual (só no campo de usuário; a senha só pelo teclado físico, com o virtual virado)
    function digita(k) {
      const el = st.cur === ip ? iu : (st.cur || iu); if (el === ip) return;
      if (k === 'Shift') { st.shift = !st.shift; ov.classList.toggle('caps', st.shift); aperta(k); return; }
      if (k === 'Enter') { aperta(k); enviar(); return; }
      const s0 = el.selectionStart == null ? el.value.length : el.selectionStart, e0 = el.selectionEnd == null ? s0 : el.selectionEnd;
      if (k === 'Backspace') { if (s0 === e0 && s0 > 0) el.setRangeText('', s0 - 1, e0, 'end'); else if (s0 !== e0) el.setRangeText('', s0, e0, 'end'); }
      else { const c = k === ' ' ? ' ' : (st.shift ? k.toUpperCase() : k); el.setRangeText(c, s0, e0, 'end'); if (st.shift) { st.shift = false; ov.classList.remove('caps'); } }
      el.dispatchEvent(new Event('input', { bubbles: true })); aperta(k);
      if (document.activeElement !== el) st.cur = el;
    }
    ov.addEventListener('mousedown', e => { if (e.target.closest && e.target.closest('.keys button')) e.preventDefault(); });   // tecla não rouba o foco
    ov.addEventListener('click', e => { const b = e.target.closest && e.target.closest('.keys button'); if (b) digita(b.dataset.k); });

    iu.addEventListener('focus', () => { st.cur = iu; fala('Pode digitar aqui ou no teclado virtual. Eu anoto!'); });
    ip.addEventListener('focus', () => { st.cur = ip; ov.classList.add('flip'); st.flip = true; st.point = false; st.tgt = null; fala('Virei o teclado para baixo: não espio a sua senha!'); aim(); });
    const solta = () => { if (!st.flip) return; st.flip = false; ov.classList.remove('flip'); post({ rv3dMouse: null }); };
    ip.addEventListener('blur', () => { if (st.flip) { solta(); fala('Pronto! Teclado de volta.'); } });
    [iu, ip].forEach(i => { i.addEventListener('mousedown', e => { if (document.activeElement !== i) e.preventDefault(); }); });   // 1 clique gira a cena; 2 cliques (ou Tab) focam
    ov.addEventListener('dblclick', e => { const i = e.target.closest && e.target.closest('#imv-u,#imv-p'); if (i) i.focus(); });
    iu.addEventListener('keydown', e => { if (e.key === 'Tab' || e.key === 'Escape') return; if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Enter') aperta(e.key === ' ' ? ' ' : e.key); });

    function enviar() {
      const u = iu.value.trim(), p = ip.value;
      if (!u || !p) { fala('Preencha o usuário e a senha para entrar.'); (u ? ip : iu).focus(); return; }
      const f = document.querySelector('form[data-f="login"]');
      if (!f) { fala('A tela de login não está aberta. Feche esta vista e volte ao login.'); return; }
      ip.blur(); solta();
      f.querySelector('#em').value = u; f.querySelector('#pw').value = p;
      fala('Entrando… cruzando os dedos!'); post({ rv3dAct: 'pulo' }); toca(go, 1200);
      st.sub = true; st.errEl = document.querySelector('.login .err');
      f.requestSubmit ? f.requestSubmit() : f.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    }
    form.addEventListener('submit', e => { e.preventDefault(); enviar(); });
    cr.addEventListener('click', () => {
      fala('Vamos criar a sua conta!'); post({ rv3dAct: 'pulo' }); toca(cr, 1500);
      setTimeout(() => { const b = document.querySelector('[data-a="gosignup"]'); close(true); if (b) b.click(); }, 1500);
    });

    // brincadeiras do mascote quando ninguém está digitando
    const FALAS_ = FALAS; let n = 0;
    function play(i) { const p = PLAYS[i % PLAYS.length]; fala(p.t); post({ rv3dAct: p.a }); st.point = (i % 2 === 0); st.tgt = null; if (!st.point) post({ rv3dPoint: null }); aim(); }
    const tp = setInterval(() => { if (!ov || busy() || st.sub) return; n++; if (n % 2) fala(FALAS_[(n >> 1) % FALAS_.length]); else play(n >> 1); }, 5200);
    const ta = setInterval(() => {
      aim();
      if (!document.querySelector('.login')) { close(true); return; }   // entrou no sistema
      if (st.sub) { const e = document.querySelector('.login .err'); if (e && e !== st.errEl) { st.sub = false; fala('Ops! Confira os dados e tente de novo.'); post({ rv3dAct: 'inclina' }); ip.value = ''; } }
    }, 140);
    st.timers.push(tp, ta);
    const falha = () => { if (!ov || st.ok) return; failed = true; close(true); };
    const onmsg = e => { if (!ov || e.source !== fr.contentWindow || !e.data) return; if (e.data.rv3d === 'ok' && !st.ok) { st.ok = true; ov.classList.remove('wait'); if (st.auto && !matchMedia('(pointer:coarse)').matches) { try { iu.focus(); } catch { /* ok */ } } } else if (e.data.rv3d === 'sem') falha(); };
    addEventListener('message', onmsg); st.onmsg = onmsg; st.timers.push(setTimeout(falha, 8000));
    fr.addEventListener('load', () => { post({ rv3dPose: 'sit' }); lastYaw = null; draw(); setTimeout(() => { fala('Bem-vindo(a) ao Talk.M3D em 3D! Arraste para girar.'); post({ rv3dAct: 'acena' }); }, 700); });
    fala('Bem-vindo(a) ao Talk.M3D em 3D! Arraste para girar.');

    // arrastar para girar (começa depois de 5 px, para não atrapalhar cliques), roda e pinça para aproximar
    const dist = () => { const a = [...st.pts.values()]; return a.length < 2 ? 0 : Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]); };
    ov.addEventListener('pointerdown', e => {
      if (e.target.closest('.imv-x,.imv-r,.keys button,#imv-cr,#imv-go,#imv-lg')) return;
      st.pts.set(e.pointerId, [e.clientX, e.clientY]); st.cand = { id: e.pointerId, x: e.clientX, y: e.clientY }; st.vy = 0; if (st.pts.size === 2) st.pinch = dist();
    });
    ov.addEventListener('pointermove', e => {
      if (!st.pts.has(e.pointerId)) return; st.pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (st.pts.size === 2) { const d = dist(); if (st.pinch) st.zoom = clamp(st.zoom * d / st.pinch, .55, 1.8); st.pinch = d; draw(); return; }
      if (st.cand && !st.drag) { if (Math.hypot(e.clientX - st.cand.x, e.clientY - st.cand.y) < 5) return; try { ov.setPointerCapture(e.pointerId); } catch { /* ok */ } st.drag = [st.cand.x, st.cand.y]; ov.classList.add('grab'); }
      if (!st.drag) return; const dx = e.clientX - st.drag[0], dy = e.clientY - st.drag[1]; st.drag = [e.clientX, e.clientY];
      st.yaw += dx * .009; st.vy = dx * .009; st.tilt = clamp(st.tilt + dy * .006, 18 * D2R, 86 * D2R); draw();
    });
    const up = e => { st.pts.delete(e.pointerId); st.pinch = 0; if (!st.pts.size) { st.drag = null; st.cand = null; ov.classList.remove('grab'); } };
    ov.addEventListener('pointerup', up); ov.addEventListener('pointercancel', up);
    ov.addEventListener('wheel', e => { e.preventDefault(); st.zoom = clamp(st.zoom * (e.deltaY < 0 ? 1.08 : .926), .55, 1.8); draw(); }, { passive: false });
    const tick = () => { if (!ov) return; if (!st.drag && Math.abs(st.vy) > .0004) { st.yaw += st.vy; st.vy *= .94; draw(); } st.f = requestAnimationFrame(tick); }; tick();

    const lg = $q('#imv-lg'); lg.addEventListener('click', () => { pref('2d'); close(); });
    const ordem = () => [xb, rb, lg, iu, ip, go, cr];
    const onkey = e => {
      const a = document.activeElement, typing = a === iu || a === ip;
      if (e.key === 'Escape') { e.preventDefault(); pref('2d'); close(); }
      else if (e.key === 'Tab') { e.preventDefault(); const l = ordem(); let i = l.indexOf(a); i = (i + (e.shiftKey ? -1 : 1) + l.length) % l.length; l[i].focus(); }
      else if (typing) return;
      else if (e.key === 'ArrowLeft') { st.yaw -= .12; draw(); } else if (e.key === 'ArrowRight') { st.yaw += .12; draw(); }
      else if (e.key === 'ArrowUp') { st.tilt = clamp(st.tilt + .06, 18 * D2R, 86 * D2R); draw(); } else if (e.key === 'ArrowDown') { st.tilt = clamp(st.tilt - .06, 18 * D2R, 86 * D2R); draw(); }
    };
    document.addEventListener('keydown', onkey, true); st.onkey = onkey;
    const onres = () => draw(); addEventListener('resize', onres); st.onres = onres;
    xb.addEventListener('click', () => { pref('2d'); close(); });
    rb.addEventListener('click', () => { st.yaw = VIEW.yaw; st.tilt = VIEW.tilt; st.zoom = 1; st.vy = 0; draw(); });
    draw(); xb.focus();
  }

  function close(soft) {
    if (!ov) return; fechado = true; cancelAnimationFrame(st.f); st.timers.forEach(t => { clearInterval(t); clearTimeout(t); });
    removeEventListener('message', st.onmsg);
    document.removeEventListener('keydown', st.onkey, true); removeEventListener('resize', st.onres);
    const p = st.prev; ov.remove(); ov = null; document.body.classList.remove('imv-on'); try { p && p.focus && p.focus(); } catch { /* ok */ }
  }

  // modo padrão = 3D; a versão normal é o plano B (sem WebGL/CSS 3D, falha ao carregar o mascote ou erro) e também uma escolha do usuário
  let failed = false, fechado = false;
  const pref = v => { try { if (v) localStorage.setItem('m3d_view', v); else return localStorage.getItem('m3d_view'); } catch { /* sem armazenamento */ } return null; };
  const suporta = () => { try { if (!(window.CSS && CSS.supports && CSS.supports('transform-style', 'preserve-3d'))) return false; const c = document.createElement('canvas'); return !!(c.getContext('webgl') || c.getContext('experimental-webgl')); } catch { return false; } };
  function auto() {
    const login = !!document.querySelector('form[data-f="login"]');
    if (!login) { fechado = false; return; }   // saiu do login: na próxima volta abre de novo
    if (ov || fechado || failed || pref() === '2d') return;
    if (!suporta()) { failed = true; return; }
    try { open(true); } catch (e) { failed = true; try { close(true); } catch { /* ok */ } }
  }
  window.imersivo = { open, close };
  const hit = e => e.target.closest && e.target.closest('.login .brand img, [data-imv]');
  document.addEventListener('click', e => { if (hit(e)) { e.preventDefault(); open(); } });
  document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.login .brand img')) { e.preventDefault(); open(); } });
  // deixa a logo da tela de entrada com cara de botão
  const mk = () => document.querySelectorAll('.login .brand img:not([data-imv])').forEach(i => { i.dataset.imv = '1'; i.tabIndex = 0; i.setAttribute('role', 'button'); i.setAttribute('aria-label', 'Ver o Talk.M3D em 3D imersivo'); i.title = 'Clique para ver em 3D'; });
  let tm = 0; new MutationObserver(() => { mk(); clearTimeout(tm); tm = setTimeout(auto, 250); }).observe(document.body, { childList: true, subtree: true }); mk(); tm = setTimeout(auto, 600);
})();
