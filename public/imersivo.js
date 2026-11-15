"use strict";
/* Cena 3D imersiva da tela de entrada: abre ao clicar na logo. Plataforma de vidro, painel de login, teclado,
   balão e o Secreto-Bot num banquinho. Arraste para girar tudo, role/pince para aproximar, Esc fecha.
   A cena é CSS 3D; o mascote é o mesmo 3D de /mascote.html, que recebe o ângulo do giro (rv3dYaw) para girar junto. */
(function () {
  const ORI = location.origin && location.origin !== 'null' ? location.origin : '*';
  const D2R = Math.PI / 180, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const BOT = { x: -185, z: 70, w: 250, h: 284 };   // posição do mascote na cena e tamanho da camada dele
  let ov = null, st = null;

  // face plana: w×h, centrada na origem da cena, com a transformação dada
  const face = (cls, w, h, tf, inner = '') => `<div class="f ${cls}" style="width:${w}px;height:${h}px;margin:${-h / 2}px 0 0 ${-w / 2}px;transform:${tf}">${inner}</div>`;
  const slab = (w, d, t) => face('top', w, d, 'translate3d(0,0,0) rotateX(90deg)')
    + face('sd', w, t, `translate3d(0,${t / 2}px,${d / 2}px)`) + face('sd', w, t, `translate3d(0,${t / 2}px,${-d / 2}px) rotateY(180deg)`)
    + face('sd', d, t, `translate3d(${-w / 2}px,${t / 2}px,0) rotateY(-90deg)`) + face('sd', d, t, `translate3d(${w / 2}px,${t / 2}px,0) rotateY(90deg)`);
  const two = (cls, w, h, pos, front, back = '') => face(cls + ' fr', w, h, pos, front) + face(cls + ' bk', w, h, pos + ' rotateY(180deg)', back || front);

  function cena() {
    const keys = Array.from({ length: 48 }, (_, i) => `<i${i === 20 || i === 21 ? ' class="on"' : ''}></i>`).join('');
    const panelF = `<label>Usuário ou e-mail</label><div class="in"></div><label>Senha</label><div class="in pw"><span></span><span></span><span></span><span></span><span></span></div><div class="go">Entrar</div>`;
    const logo = `<img src="/logo.png" alt=""><span translate="no">Talk<b>.M3D</b></span>`;
    const leg = a => face('leg', 7, 62, `translate3d(${Math.sin(a) * 26}px,-31px,${Math.cos(a) * 26}px)`) + face('leg', 7, 62, `translate3d(${Math.sin(a) * 26}px,-31px,${Math.cos(a) * 26}px) rotateY(90deg)`);
    const stool = face('seat', 90, 90, 'translate3d(0,-62px,0) rotateX(90deg)') + [0, 2.09, 4.19].map(leg).join('');
    return `<div class="sc" id="imv-sc">${slab(560, 560, 44)}
      <div class="obj" style="transform:translate3d(${BOT.x}px,0,${BOT.z - 6}px)">${stool}</div>
      ${face('kb', 360, 150, 'translate3d(25px,-1px,125px) rotateX(90deg)', `<div class="keys">${keys}</div>`)}
      ${face('hint', 320, 40, 'translate3d(25px,-1px,235px) rotateX(90deg)', '<span>Ainda não tem conta? <u>Criar conta</u></span>')}
      <div class="ringw" id="imv-ring" style="transform:translate3d(60px,-2px,110px) rotateX(90deg)"><b></b><b></b><b></b></div>
      <div class="obj" style="transform:translate3d(130px,0,-130px) rotateY(-14deg)">
        ${two('panel', 310, 250, 'translate3d(0,-125px,0)', `<div class="pn">${panelF}</div>`, '<div class="pn bkp"></div>')}
        ${two('logo', 420, 80, 'translate3d(30px,-325px,0)', logo)}
        ${two('chip', 190, 40, 'translate3d(-120px,-470px,30px) rotateY(18deg)', '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></svg><em></em><span>Português</span>')}
      </div>
      <div class="obj" style="transform:translate3d(${BOT.x + 5}px,-415px,${BOT.z + 60}px) rotateY(14deg)">${two('say', 250, 96, 'translate3d(0,0,0)', '<span id="imv-t"></span>')}</div>
      <div class="obj" id="imv-bot" style="transform:translate3d(${BOT.x}px,${-14 - BOT.h / 2}px,${BOT.z}px)"><div class="bot" style="width:${BOT.w}px;height:${BOT.h}px;margin:${-BOT.h / 2}px 0 0 ${-BOT.w / 2}px"><iframe src="/mascote.html?pose=sit" title="Secreto-Bot" tabindex="-1" aria-hidden="true"></iframe></div></div>
    </div>`;
  }

  const FALAS = ['Arraste para girar tudo em 3D!', 'Role o mouse para aproximar ou afastar.', 'Este é o consultório digital do Talk.M3D.', 'Esc fecha e volta ao login.'];
  const PLAYS = [
    { a: 'estetoscopio', t: 'Auscultando o teclado… tudo em ordem!' }, { a: 'acena', t: 'Olá! Seja bem-vindo(a)!' },
    { a: 'termometro', t: 'Febre de senha esquecida? Peça ao administrador!' }, { a: 'martelo', t: 'Teste de reflexo no painel. Tudo certo!' },
    { a: 'lanterna', t: 'Deixa eu iluminar a nossa logomarca!' }, { a: 'balao', t: 'Gostou da vista? Gire para ver todos os lados!' }
  ];

  function open() {
    if (ov) return;
    const prev = document.activeElement;
    ov = document.createElement('div'); ov.id = 'imv'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'Vista 3D imersiva do Talk.M3D');
    ov.innerHTML = `<div class="imv-bg"></div><div class="imv-stage">${cena()}</div>
      <button class="imv-x" type="button" aria-label="Fechar">✕</button><button class="imv-r" type="button">Reiniciar vista</button>
      <p class="imv-h">Clique e arraste para girar · role para aproximar · Esc para fechar</p>`;
    document.body.appendChild(ov); document.body.classList.add('imv-on');
    st = { yaw: -30 * D2R, tilt: 56 * D2R, zoom: 1, vy: 0, drag: null, pts: new Map(), pinch: 0, point: false, f: 0, prev, timers: [] };
    const sc = ov.querySelector('#imv-sc'), bot = ov.querySelector('#imv-bot'), fr = ov.querySelector('iframe'), ring = ov.querySelector('#imv-ring'), say = ov.querySelector('#imv-t');
    const post = m => { try { fr.contentWindow.postMessage(m, ORI); } catch { /* sem iframe */ } };
    const fit = () => Math.min(innerWidth / 1100, innerHeight / 860, 1.1);
    let lastYaw = null;
    function draw() {
      const k = fit() * st.zoom, yawD = st.yaw / D2R, tiltD = st.tilt / D2R;
      sc.style.transform = `scale(${k}) rotateX(${-tiltD}deg) rotateY(${yawD}deg)`;
      bot.firstChild.style.transform = `rotateY(${-yawD}deg) rotateX(${tiltD}deg)`;
      if (lastYaw !== st.yaw) { lastYaw = st.yaw; post({ rv3dYaw: st.yaw }); }
    }
    const fala = t => { say.textContent = (window.I18N && I18N.t) ? I18N.t(t) : t; };
    function aim() { if (!st.point) return; const r = ring.getBoundingClientRect(), q = fr.getBoundingClientRect(), x = r.left + r.width / 2 - q.left, y = r.top + r.height / 2 - q.top; post({ rv3dPoint: [x, y] }); post({ rv3dMouse: [x, y, 300] }); }
    function play(i) { const p = PLAYS[i % PLAYS.length]; fala(p.t); post({ rv3dAct: p.a }); st.point = (i % 2 === 0); if (!st.point) post({ rv3dPoint: null }); aim(); }
    let n = 0; const tp = setInterval(() => { if (!ov) return; n++; if (n % 2) fala(FALAS[(n >> 1) % FALAS.length]); else play(n >> 1); }, 5200);
    const ta = setInterval(aim, 140); st.timers.push(tp, ta);
    fr.addEventListener('load', () => { post({ rv3dPose: 'sit' }); lastYaw = null; draw(); setTimeout(() => { fala('Bem-vindo(a) ao Talk.M3D em 3D! Arraste para girar.'); post({ rv3dAct: 'acena' }); }, 700); });
    fala('Bem-vindo(a) ao Talk.M3D em 3D! Arraste para girar.');

    // arrastar para girar (com inércia), roda e pinça para aproximar
    ov.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; ov.setPointerCapture(e.pointerId); st.pts.set(e.pointerId, [e.clientX, e.clientY]); st.drag = [e.clientX, e.clientY]; st.vy = 0; ov.classList.add('grab'); if (st.pts.size === 2) st.pinch = dist(); });
    const dist = () => { const a = [...st.pts.values()]; return a.length < 2 ? 0 : Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]); };
    ov.addEventListener('pointermove', e => {
      if (!st.pts.has(e.pointerId)) return; st.pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (st.pts.size === 2) { const d = dist(); if (st.pinch) st.zoom = clamp(st.zoom * d / st.pinch, .55, 1.8); st.pinch = d; draw(); return; }
      if (!st.drag) return; const dx = e.clientX - st.drag[0], dy = e.clientY - st.drag[1]; st.drag = [e.clientX, e.clientY];
      st.yaw += dx * .009; st.vy = dx * .009; st.tilt = clamp(st.tilt + dy * .006, 18 * D2R, 86 * D2R); draw();
    });
    const up = e => { st.pts.delete(e.pointerId); st.pinch = 0; if (!st.pts.size) { st.drag = null; ov.classList.remove('grab'); } };
    ov.addEventListener('pointerup', up); ov.addEventListener('pointercancel', up);
    ov.addEventListener('wheel', e => { e.preventDefault(); st.zoom = clamp(st.zoom * (e.deltaY < 0 ? 1.08 : .926), .55, 1.8); draw(); }, { passive: false });
    const tick = () => { if (!ov) return; if (!st.drag && Math.abs(st.vy) > .0004) { st.yaw += st.vy; st.vy *= .94; draw(); } st.f = requestAnimationFrame(tick); }; tick();
    const onkey = e => {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowLeft') { st.yaw -= .12; draw(); } else if (e.key === 'ArrowRight') { st.yaw += .12; draw(); }
      else if (e.key === 'ArrowUp') { st.tilt = clamp(st.tilt + .06, 18 * D2R, 86 * D2R); draw(); } else if (e.key === 'ArrowDown') { st.tilt = clamp(st.tilt - .06, 18 * D2R, 86 * D2R); draw(); }
      else if (e.key === 'Tab') { e.preventDefault(); ov.querySelector('.imv-x').focus(); }
    };
    document.addEventListener('keydown', onkey, true); st.onkey = onkey;
    const onres = () => draw(); addEventListener('resize', onres); st.onres = onres;
    ov.querySelector('.imv-x').addEventListener('click', close);
    ov.querySelector(".imv-r").addEventListener('click', () => { st.yaw = -30 * D2R; st.tilt = 56 * D2R; st.zoom = 1; st.vy = 0; draw(); });
    draw(); ov.querySelector('.imv-x').focus();
  }

  function close() {
    if (!ov) return; cancelAnimationFrame(st.f); st.timers.forEach(clearInterval);
    document.removeEventListener('keydown', st.onkey, true); removeEventListener('resize', st.onres);
    const p = st.prev; ov.remove(); ov = null; document.body.classList.remove('imv-on'); try { p && p.focus && p.focus(); } catch { /* ok */ }
  }

  window.imersivo = { open, close };
  const hit = e => e.target.closest && e.target.closest('.login .brand img, [data-imv]');
  document.addEventListener('click', e => { if (hit(e)) { e.preventDefault(); open(); } });
  document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.login .brand img')) { e.preventDefault(); open(); } });
  // deixa a logo da tela de entrada com cara de botão
  const mk = () => document.querySelectorAll('.login .brand img:not([data-imv])').forEach(i => { i.dataset.imv = '1'; i.tabIndex = 0; i.setAttribute('role', 'button'); i.setAttribute('aria-label', 'Ver o Talk.M3D em 3D imersivo'); i.title = 'Clique para ver em 3D'; });
  new MutationObserver(mk).observe(document.body, { childList: true, subtree: true }); mk();
})();
