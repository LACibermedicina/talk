/* Mascote da tela de entrada: Secreto-Bot em 3D (iframe /mascote.html). Segue o cursor, vira o rosto na senha, acena e dá dicas.
   Sem WebGL, cai no Epi 2D (SVG). */
(() => {
  const tr = s => (window.I18N && I18N.t ? I18N.t(s) : s);
  const TIPS = [
    'Olá! Eu sou o Secreto-Bot, o mascote do Talk.M3D. Bem-vindo!',
    'O ponto verde ao lado do nome mostra quem está online agora.',
    'Quando um médico está online e livre, você pode pedir uma teleconsulta na hora.',
    'A IA propõe rascunhos, mas quem decide é sempre o profissional.',
    'Suas notas de atendimento são cifradas. Privacidade em primeiro lugar!',
    'Clique em mim para ouvir outra dica.'];
  const S_ = { i: 0, t: null, w: null };
  const esc = x => String(x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const svg = `<svg class="epi" viewBox="0 0 200 240" aria-hidden="true" focusable="false">
  <defs><pattern id="epk" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="#8f6236" opacity=".45"/><circle cx="6.5" cy="5.5" r="1.2" fill="#e3bf8c" opacity=".55"/><circle cx="4" cy="8" r=".8" fill="#7a5028" opacity=".4"/></pattern>
  <radialGradient id="epd" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#d7e3e0"/></radialGradient></defs>
  <ellipse cx="102" cy="228" rx="62" ry="8" fill="#000" opacity=".14"/>
  <g class="body">
    <rect x="62" y="196" width="26" height="22" rx="7" fill="#9a6b3c"/><rect x="112" y="196" width="26" height="22" rx="7" fill="#9a6b3c"/>
    <polygon points="50,98 70,82 170,82 150,98" fill="#d9ae76"/><polygon points="150,98 170,82 170,186 150,202" fill="#a97a47"/>
    <rect x="50" y="98" width="100" height="104" rx="6" fill="#c99a63"/><rect x="50" y="98" width="100" height="104" rx="6" fill="url(#epk)"/>
    <polygon points="50,98 70,82 170,82 150,98" fill="url(#epk)"/><polygon points="150,98 170,82 170,186 150,202" fill="url(#epk)"/>
    <path d="M100 100v100" stroke="#5a3a1d" stroke-width="2" stroke-dasharray="5 4" fill="none"/><g stroke="#5a3a1d" stroke-width="2" stroke-linecap="round"><path d="M95 112l10 4M95 130l10 4M95 148l10 4M95 166l10 4M95 184l10 4"/></g>
    <rect x="108" y="150" width="34" height="38" rx="6" fill="url(#epd)"/><path d="M111 170h7l4-10 5 18 4-8h8" stroke="#1f9d8a" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="130" cy="120" r="5" fill="#6d4524"/><circle cx="130" cy="120" r="2.2" fill="#d9ae76"/>
    <g class="eye"><circle cx="78" cy="125" r="23" fill="#1b6f66"/><circle cx="78" cy="125" r="19" fill="#2aa593"/><circle cx="78" cy="125" r="15" fill="#fff"/>
      <g class="pup"><circle cx="78" cy="125" r="8.5" fill="#12493f"/><circle cx="78" cy="125" r="5" fill="#0a2a25"/><circle cx="75" cy="122" r="2.2" fill="#fff"/></g>
      <ellipse class="lid" cx="78" cy="125" rx="16" ry="16" fill="#c99a63"/></g>
    <g class="armL"><rect x="38" y="128" width="12" height="52" rx="6" fill="#f3f7f6"/><circle cx="44" cy="184" r="12" fill="#fff" stroke="#cfdcd9" stroke-width="1.5"/></g>
  </g>
  <g class="head"><circle cx="86" cy="64" r="44" fill="url(#epd)" stroke="#c4d3d0" stroke-width="2"/><ellipse cx="68" cy="44" rx="14" ry="8" fill="#fff" opacity=".7" transform="rotate(-30 68 44)"/>
    <g transform="translate(88 44) scale(.2)"><polygon points="10,8 70,8 40,90" fill="#7CC6B4"/><polygon points="40,90 70,8 110,90" fill="#167D6E"/><polygon points="70,8 110,90 70,170" fill="#167D6E"/><polygon points="110,8 210,8 110,90" fill="#3BA794"/><polygon points="110,8 210,8 180,170 110,170" fill="#47B29F"/><polygon points="40,170 110,90 110,170" fill="#0F5C50"/></g>
    <path d="M104 22L112 4" stroke="#7a8b88" stroke-width="3" stroke-linecap="round"/><circle class="ant" cx="113" cy="4" r="5.5" fill="#2aa593"/></g>
  <g class="armR"><rect x="154" y="122" width="12" height="62" rx="6" fill="#f3f7f6"/><circle cx="160" cy="190" r="13" fill="#fff" stroke="#cfdcd9" stroke-width="1.5"/></g>
</svg>`;
  const ORI = location.origin && location.origin !== 'null' ? location.origin : '*';
  window.epiH = kind => {
    const first = !window.__epiHi; window.__epiHi = true;
    const err = S.err ? 'Ops! Confira os dados e tente de novo.' : null;
    const msg = err || (kind === 'signup' ? 'Que bom ter você por aqui! Preencha os dados para criar sua conta.' : TIPS[0]);
    return `<div class="epiw ${first ? 'hi' : ''} ${err ? 'no' : ''}" data-epi="${kind}"><button type="button" class="epib0" data-epi-click aria-label="${esc(tr('Mascote Secreto-Bot: toque para ouvir uma dica'))}"><iframe class="epi3d" src="/mascote.html?pose=sit" title="" tabindex="-1" aria-hidden="true" loading="eager"></iframe><span class="epifb">${svg}</span></button><div class="epib" role="status" aria-live="polite" id="epit">${esc(tr(msg))}</div></div>`;
  };
  const W = () => document.querySelector('.epiw');
  const FR = () => { const w = W(); return w && w.querySelector('.epi3d'); };
  const post = m => { const f = FR(); try { if (f && f.contentWindow && !W().classList.contains('fb')) f.contentWindow.postMessage(m, ORI); } catch { /* sem iframe */ } };
  // o 3D avisa quando desenhou ('ok') ou quando o navegador não tem WebGL ('sem'): aí mostramos o desenho 2D
  addEventListener('message', e => { if (e.source !== (FR() || {}).contentWindow) return; const d = e.data || {}, w = W(); if (!w) return;
    if (d.rv3d === 'sem') w.classList.add('fb'); if (d.rv3d === 'ok') { w.classList.add('ok3'); w.classList.remove('fb'); if (w.classList.contains('hi')) wave(3200); } });
  setTimeout(() => { const w = W(); if (w && !w.classList.contains('ok3')) w.classList.add('fb'); }, 9000);
  const say = (txt, ms) => { const b = document.getElementById('epit'); if (!b) return; b.textContent = tr(txt); clearTimeout(S_.t); if (ms) S_.t = setTimeout(() => nextTip(), ms); };
  const nextTip = () => { S_.i = (S_.i + 1) % TIPS.length; say(TIPS[S_.i]); };
  const mood = (c, ms) => { const w = W(); if (!w) return; w.classList.add(c); setTimeout(() => { const x = W(); if (x) x.classList.remove(c); }, ms); };
  const wave = ms => { post({ rv3dPose: 'wave' }); clearTimeout(S_.w); S_.w = setTimeout(() => post({ rv3dPose: 'sit' }), ms || 2600); };
  const look = (x, y) => { const w = W(); if (!w) return; const s = w.querySelector('.epi'); s.style.setProperty('--px', x.toFixed(1) + 'px'); s.style.setProperty('--py', y.toFixed(1) + 'px'); };
  const follow = e => {
    const w = W(); if (!w || w.classList.contains('shy')) return; const p = e.touches ? e.touches[0] : e, f = FR(); if (!f) return;
    const r = f.getBoundingClientRect(); post({ rv3dMouse: [p.clientX - r.left, p.clientY - r.top, Math.max(innerWidth, innerHeight) / 2] });
    const q = w.querySelector('.epi').getBoundingClientRect(), dx = p.clientX - (q.left + q.width * .39), dy = p.clientY - (q.top + q.height * .52), d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 160); look(dx / d * 6.5 * k, dy / d * 6.5 * k);
  };
  document.addEventListener('pointermove', follow, { passive: true }); document.addEventListener('touchmove', follow, { passive: true });
  const away = () => post({ rv3dMouse: [-500, -400, 300] });   // vira o rosto para o lado: não olha a senha
  document.addEventListener('focusin', e => {
    const w = W(); if (!w) return;
    if (e.target.id === 'pw' || e.target.id === 'sp') { w.classList.add('shy'); away(); say('Pode digitar, eu não olho!'); }
    else { w.classList.remove('shy'); if (e.target.id === 'em' || e.target.id === 'sn' || e.target.id === 'se') say('Isso! Digite seu usuário ou e-mail.'); }
  });
  document.addEventListener('focusout', e => { const w = W(); if (w && (e.target.id === 'pw' || e.target.id === 'sp')) { w.classList.remove('shy'); wave(1800); say('Pronto! Agora é só entrar.', 4000); } });
  document.addEventListener('input', e => { const w = W(); if (!w || w.classList.contains('shy') || !/^(em|sn|se)$/.test(e.target.id)) return; const n = e.target.value.length, c = Math.min(1, n / 24), f = FR(), r = f ? f.getBoundingClientRect() : { width: 150, height: 190 }; post({ rv3dMouse: [r.width * (.1 + c * .8), r.height * 2.2, 150] }); look(-5 + c * 10, 4.5); });
  document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-epi-click]')) { mood('jump', 700); wave(2600); nextTip(); } });
  document.addEventListener('submit', e => { if (e.target.dataset && /^(login|signup)$/.test(e.target.dataset.f) && W()) { mood('jump', 700); wave(2600); say('Um instante, já abro para você…'); } }, true);
  setInterval(() => { const w = W(); if (w && !w.classList.contains('shy')) { w.classList.add('blink'); setTimeout(() => w.classList.remove('blink'), 160); } }, 3600);
  setInterval(() => { const w = W(); if (w && !w.classList.contains('no') && !document.activeElement.matches?.('input')) nextTip(); }, 12000);
})();
