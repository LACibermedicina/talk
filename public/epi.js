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
    return `<div class="epiw ${first ? 'hi' : ''} ${err ? 'no' : ''}" data-epi="${kind}"><button type="button" class="epib0" data-epi-click aria-label="${esc(tr('Mascote Secreto-Bot: toque para ouvir uma dica'))}"><i class="epiped" aria-hidden="true"></i><iframe class="epi3d" src="/mascote.html?pose=sit" title="" tabindex="-1" aria-hidden="true" loading="eager"></iframe></button><div class="epib" role="status" aria-live="polite" id="epit">${esc(tr(msg))}</div></div>`;
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
  const rectIn = (el, f) => { const r = el.getBoundingClientRect(), q = f.getBoundingClientRect(); return { x: r.left + Math.min(26, r.width * .2) - q.left, y: r.top + r.height / 2 - q.top, cx: r.left + Math.min(26, r.width * .2), cy: r.top + r.height / 2, r }; };
  // aponta a mão para o elemento e faz o círculo luminoso "pulsar" nele; a cabeça também olha para lá
  let cur = null;
  function aim(el, say_) {
    const w = W(), f = FR(), L = document.querySelector('.login'); if (!w || !f || !L || !el) return; cur = el;
    const t = rectIn(el, f); post({ rv3dPoint: [t.x, t.y] }); post({ rv3dMouse: [t.x, t.y, 260] });
    let ring = L.querySelector('.epiring'); if (!ring) { ring = document.createElement('i'); ring.className = 'epiring'; ring.setAttribute('aria-hidden', 'true'); L.append(ring); }
    const lr = L.getBoundingClientRect(); ring.style.left = (t.cx - lr.left) + 'px'; ring.style.top = (t.cy - lr.top) + 'px'; ring.classList.remove('on'); void ring.offsetWidth; ring.classList.add('on');
    if (say_) say(say_);
  }
  const follow = e => { const f = FR(); if (!f || e.target.closest && e.target.closest('.login form,.login p')) return; const p = e.touches ? e.touches[0] : e, r = f.getBoundingClientRect(); post({ rv3dMouse: [p.clientX - r.left, p.clientY - r.top, Math.max(innerWidth, innerHeight) / 2] }); };
  document.addEventListener('pointermove', follow, { passive: true });
  const first = () => document.querySelector('.login input:not([type=hidden]):not([type=checkbox])');
  const SAY = { em: 'Comece por aqui: seu usuário ou e-mail.', pw: 'Agora a sua senha. Eu não espio!', sn: 'Como você se chama?', se: 'Seu e-mail de acesso.', sp: 'Crie uma senha segura.' };
  const hint = el => el.matches('input,select,textarea') ? SAY[el.id] || 'Preencha este campo.' : el.matches('button') ? 'Pronto? Clique para entrar!' : 'Ainda não tem conta? Crie a sua aqui.';
  const home = () => { if (S.err && $('#pw')) return $('#pw'); const a = document.activeElement; return a && a.closest && a.closest('.login') && a.matches('input,select,textarea') ? a : first(); };
  document.addEventListener('pointerover', e => { const el = e.target.closest && e.target.closest('.login input,.login select,.login textarea,.login form button,.login p a,.login [data-a=gologin]'); if (el && el !== cur) aim(el, hint(el)); });
  document.addEventListener('focusin', e => { const el = e.target; if (el.closest && el.closest('.login') && el.matches('input,select,textarea')) aim(el, hint(el)); });
  document.addEventListener('focusout', e => { const el = e.target; if (el.id === 'pw' || el.id === 'sp') { wave(1800); say('Pronto! Agora é só entrar.', 4000); } });
  addEventListener('resize', () => { if (cur && document.body.contains(cur)) aim(cur); });
  // primeira abertura: depois do aceno, aponta para o primeiro campo
  addEventListener('message', e => { const f = FR(); if (f && e.source === f.contentWindow && (e.data || {}).rv3d === 'ok') setTimeout(() => { const a = home(); if (a) aim(a); }, 3600); });
  document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-epi-click]')) { mood('jump', 700); wave(2600); nextTip(); } });
  document.addEventListener('submit', e => { if (e.target.dataset && /^(login|signup)$/.test(e.target.dataset.f) && W()) { mood('jump', 700); wave(2600); say('Um instante, já abro para você…'); } }, true);
  setInterval(() => { const w = W(); if (w && !w.classList.contains('shy')) { w.classList.add('blink'); setTimeout(() => w.classList.remove('blink'), 160); } }, 3600);
  setInterval(() => { const w = W(); if (w && !w.classList.contains('no') && !document.activeElement.matches?.('input')) nextTip(); }, 12000);
})();
