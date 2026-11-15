"use strict";
/* Tela de carregamento com o Secreto-Bot: aparece enquanto o app (e a vista 3D do login) não estão prontos.
   O mascote segue o ponteiro e reage a toques. Sai sozinha quando tudo está pronto (ou após 15 s, por segurança). */
(function () {
  const b = document.getElementById('boot'); if (!b) return;
  const ORI = location.origin && location.origin !== 'null' ? location.origin : '*';
  const fr = b.querySelector('iframe'), bar = document.getElementById('bpi'), msg = document.getElementById('bm'), bb = b.querySelector('.bb');
  const t0 = Date.now(); let pct = 8, viewOk = false, appOk = false, gone = false, last = 0, n = 0;
  const post = m => { try { fr.contentWindow.postMessage(m, ORI); } catch { /* sem iframe */ } };
  const say = t => { msg.textContent = t; };
  const set = p => { pct = Math.max(pct, p); bar.style.width = pct + '%'; };
  const ACTS = ['acena', 'pulo', 'danca', 'estetoscopio', 'termometro', 'martelo', 'lanterna', 'balao', 'inclina', 'antena'];
  const TXT = ['Opa! Quem me cutucou?', 'Hihi, isso faz cócegas!', 'Aquecendo o estetoscópio…', 'Medindo a temperatura do servidor: 36,5 °C!', 'Já estamos quase lá!', 'Dá uma olhadinha: estou ensaiando uma dança!', 'Reflexo ótimo, doutor(a)!', 'Prometo não demorar!'];
  fr.addEventListener('load', () => { post({ rv3dPose: 'stand' }); setTimeout(() => post({ rv3dAct: 'acena' }), 500); });
  let raf = 0; addEventListener('pointermove', e => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; const r = fr.getBoundingClientRect(); post({ rv3dMouse: [e.clientX - r.left, e.clientY - r.top, Math.max(innerWidth, innerHeight) / 2] }); }); });
  bb.addEventListener('click', () => { last = Date.now(); post({ rv3dAct: ACTS[n % ACTS.length] }); say(TXT[n % TXT.length]); n++; });
  const tick = setInterval(() => { if (Date.now() - last > 4500) { last = Date.now(); post({ rv3dAct: ACTS[(Math.random() * ACTS.length) | 0] }); } }, 1000);
  const crawl = setInterval(() => { if (pct < 80) set(pct + 1.2); }, 200);   // avanço suave enquanto carrega
  say('Carregando o Talk.M3D…');
  addEventListener('load', () => { set(55); if (Date.now() - last > 4000) say('Preparando a sua tela…'); });
  const obs = new MutationObserver(() => { const a = document.getElementById('app'); if (a && a.children.length) { appOk = true; set(88); check(); } });
  const app = document.getElementById('app'); if (app) obs.observe(app, { childList: true });
  document.addEventListener('m3d:view', () => { viewOk = true; check(); });
  function check() {
    if (gone || !appOk) return;
    const login = !!document.querySelector('form[data-f="login"]');
    if (login && !viewOk) return;                 // espera a vista 3D do login ficar pronta (ou desistir)
    const wait = 900 - (Date.now() - t0); if (wait > 0) { setTimeout(check, wait); return; }
    done();
  }
  function done() {
    if (gone) return; gone = true; set(100); clearInterval(tick); clearInterval(crawl); obs.disconnect();
    b.classList.add('out'); setTimeout(() => { b.remove(); }, 600);   // remover o iframe libera o WebGL do mascote
  }
  setTimeout(done, 15000);
  setTimeout(check, 1200);
})();
