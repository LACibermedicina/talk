/* Mascote da tela de entrada: Secreto-Bot em 3D (iframe /mascote.html). Segue o cursor, vira o rosto na senha, acena e dá dicas. */
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
  const ORI = location.origin && location.origin !== 'null' ? location.origin : '*';
  window.epiH = kind => {
    const first = !window.__epiHi; window.__epiHi = true;
    const err = S.err ? 'Ops! Confira os dados e tente de novo.' : null;
    const msg = err || (kind === 'signup' ? 'Que bom ter você por aqui! Preencha os dados para criar sua conta.' : TIPS[0]);
    return `<div class="epiw ${first ? 'hi' : ''} ${err ? 'no' : ''}" data-epi="${kind}"><button type="button" class="epib0" data-epi-click aria-label="${esc(tr('Mascote Secreto-Bot: toque para ouvir uma dica'))}"><iframe class="epi3d" src="/mascote.html?pose=sit" title="" tabindex="-1" aria-hidden="true" loading="eager"></iframe></button><div class="epib" role="status" aria-live="polite" id="epit">${esc(tr(msg))}</div></div>`;
  };
  const W = () => document.querySelector('.epiw');
  const FR = () => { const w = W(); return w && w.querySelector('.epi3d'); };
  const post = m => { const f = FR(); try { if (f && f.contentWindow && !W().classList.contains('fb')) f.contentWindow.postMessage(m, ORI); } catch { /* sem iframe */ } };
  // o 3D avisa quando desenhou ('ok') ou quando o navegador não tem WebGL ('sem'): nesse caso some só o desenho, o balão de dicas fica
  addEventListener('message', e => { if (e.source !== (FR() || {}).contentWindow) return; const d = e.data || {}, w = W(); if (!w) return;
    if (d.rv3d === 'sem') w.classList.add('fb'); if (d.rv3d === 'ok') { w.classList.add('ok3'); w.classList.remove('fb'); if (w.classList.contains('hi')) wave(3200); } });
  const say = (txt, ms) => { const b = document.getElementById('epit'); if (!b) return; b.textContent = tr(txt); clearTimeout(S_.t); if (ms) S_.t = setTimeout(() => nextTip(), ms); };
  const nextTip = () => { S_.i = (S_.i + 1) % TIPS.length; say(TIPS[S_.i]); };
  const mood = (c, ms) => { const w = W(); if (!w) return; w.classList.add(c); setTimeout(() => { const x = W(); if (x) x.classList.remove(c); }, ms); };
  const wave = ms => { post({ rv3dPose: 'wave' }); clearTimeout(S_.w); S_.w = setTimeout(() => post({ rv3dPose: 'sit' }), ms || 2600); };
  const follow = e => {
    const w = W(); if (!w || w.classList.contains('shy')) return; const p = e.touches ? e.touches[0] : e, f = FR(); if (!f) return;
    const r = f.getBoundingClientRect(); post({ rv3dMouse: [p.clientX - r.left, p.clientY - r.top, Math.max(innerWidth, innerHeight) / 2] });
  };
  document.addEventListener('pointermove', follow, { passive: true }); document.addEventListener('touchmove', follow, { passive: true });
  const away = () => post({ rv3dMouse: [-500, -400, 300] });   // vira o rosto para o lado: não olha a senha
  document.addEventListener('focusin', e => {
    const w = W(); if (!w) return;
    if (e.target.id === 'pw' || e.target.id === 'sp') { w.classList.add('shy'); away(); say('Pode digitar, eu não olho!'); }
    else { w.classList.remove('shy'); if (e.target.id === 'em' || e.target.id === 'sn' || e.target.id === 'se') say('Isso! Digite seu usuário ou e-mail.'); }
  });
  document.addEventListener('focusout', e => { const w = W(); if (w && (e.target.id === 'pw' || e.target.id === 'sp')) { w.classList.remove('shy'); wave(1800); say('Pronto! Agora é só entrar.', 4000); } });
  document.addEventListener('input', e => { const w = W(); if (!w || w.classList.contains('shy') || !/^(em|sn|se)$/.test(e.target.id)) return; const n = e.target.value.length, c = Math.min(1, n / 24), f = FR(), r = f ? f.getBoundingClientRect() : { width: 150, height: 190 }; post({ rv3dMouse: [r.width * (.1 + c * .8), r.height * 2.2, 150] }); });
  document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-epi-click]')) { mood('jump', 700); wave(2600); nextTip(); } });
  document.addEventListener('submit', e => { if (e.target.dataset && /^(login|signup)$/.test(e.target.dataset.f) && W()) { mood('jump', 700); wave(2600); say('Um instante, já abro para você…'); } }, true);
  setInterval(() => { const w = W(); if (w && !w.classList.contains('shy')) { w.classList.add('blink'); setTimeout(() => w.classList.remove('blink'), 160); } }, 3600);
  setInterval(() => { const w = W(); if (w && !w.classList.contains('no') && !document.activeElement.matches?.('input')) nextTip(); }, 12000);
})();
