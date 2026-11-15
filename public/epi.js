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
  const S_ = { i: 0, t: null, w: null, at: null, idle: null, hop: 0 };
  const esc = x => String(x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ORI = location.origin && location.origin !== 'null' ? location.origin : '*';
  const CW = 160, BOT_CX = 103, FEET = 176;   // tamanho da camada 3D, centro do corpo e linha dos pés (px)
  window.epiH = kind => {
    const first = !window.__epiHi; window.__epiHi = true;
    const err = S.err ? 'Ops! Confira os dados e tente de novo.' : null;
    const msg = err || (kind === 'signup' ? 'Que bom ter você por aqui! Preencha os dados para criar sua conta.' : TIPS[0]);
    setTimeout(start, 0);   // depois que a tela foi montada
    return `<div class="epib" role="status" aria-live="polite" id="epit">${esc(tr(msg))}</div><div class="epiw ${first ? 'hi' : ''}" data-epi="${kind}"><iframe class="epi3d" src="/mascote.html?pose=sit" title="" tabindex="-1" aria-hidden="true" loading="eager"></iframe><button type="button" class="epib0" data-epi-click aria-label="${esc(tr('Mascote Secreto-Bot: toque para ouvir uma dica'))}"></button></div>`;
  };
  const W = () => document.querySelector('.epiw');
  const L = () => document.querySelector('.login');
  const FR = () => { const w = W(); return w && w.querySelector('.epi3d'); };
  const post = m => { const f = FR(); try { if (f && f.contentWindow && !W().classList.contains('fb')) f.contentWindow.postMessage(m, ORI); } catch { /* sem iframe */ } };
  addEventListener('message', e => { if (e.source !== (FR() || {}).contentWindow) return; const d = e.data || {}, w = W(); if (!w) return;
    if (d.rv3d === 'sem') w.classList.add('fb'); if (d.rv3d === 'ok') { w.classList.add('ok3'); if (w.classList.contains('hi')) wave(3200); } });
  const say = (txt, ms) => { const b = document.getElementById('epit'); if (!b) return; b.textContent = tr(txt); clearTimeout(S_.t); if (ms) S_.t = setTimeout(() => nextTip(), ms); };
  const nextTip = () => { S_.i = (S_.i + 1) % TIPS.length; say(TIPS[S_.i]); };
  const wave = ms => { post({ rv3dPose: 'wave' }); clearTimeout(S_.w); S_.w = setTimeout(() => post({ rv3dPose: 'sit' }), ms || 2600); };
  const btn = () => document.querySelector('.login form>button:last-of-type');
  const fields = () => [...document.querySelectorAll('.login form input:not([type=hidden]):not([type=checkbox]),.login form select')];
  // onde o mascote pousa: em cima do botão (lado direito) ou na borda de cima do campo
  const spot = el => { const l = L(), r = el.getBoundingClientRect(), q = l.getBoundingClientRect(); return { x: r.left - q.left + r.width * (el.id === 'epit' ? .84 : .78) - BOT_CX, y: r.top - q.top - FEET + 2 }; };
  const put = (el, hop) => {
    const w = W(), l = L(); if (!w || !l || !el) return; const t = spot(el), cur = w.__pos || t; w.__pos = t; S_.at = el; w.classList.toggle('top', el.id === 'epit');
    const f = p => `translate(${p.x}px,${p.y}px)`;
    if (hop && !matchMedia('(prefers-reduced-motion:reduce)').matches) {
      post({ rv3dAct: 'pulo' }); w.style.transform = f(t);
      const a = w.animate([{ transform: f(cur) }, { transform: `translate(${(cur.x + t.x) / 2}px,${Math.min(cur.y, t.y) - 46}px)`, offset: .45 }, { transform: f(t) }], { duration: 720, easing: 'cubic-bezier(.3,.6,.4,1)' });
      a.onfinish = () => squish(el);
    } else w.style.transform = f(t);
  };
  // o campo/botão "cede" um pouquinho quando o mascote pousa
  const squish = el => { try { el.animate([{ transform: 'scale(1,1)' }, { transform: 'scale(1.015,.94)' }, { transform: 'scale(1,1)' }], { duration: 320, easing: 'ease-out' }); } catch { /* sem animação */ } };
  const ring = el => { const l = L(); if (!l) return; let g = l.querySelector('.epiring'); if (!g) { g = document.createElement('i'); g.className = 'epiring'; g.setAttribute('aria-hidden', 'true'); l.append(g); }
    const r = el.getBoundingClientRect(), q = l.getBoundingClientRect(); g.style.left = (r.left - q.left + Math.min(26, r.width * .2)) + 'px'; g.style.top = (r.top - q.top + r.height / 2) + 'px'; g.classList.remove('on'); void g.offsetWidth; g.classList.add('on'); };
  // aponta para algo fora de onde ele está sentado (links) com o ponteiro
  const aim = el => { const f = FR(), w = W(); if (!f || !w || !el) return; const r = el.getBoundingClientRect(), q = f.getBoundingClientRect(); post({ rv3dPoint: [r.left + 20 - q.left, r.top + r.height / 2 - q.top] }); post({ rv3dMouse: [r.left + 20 - q.left, r.top + r.height / 2 - q.top, 260] }); ring(el); };
  const noAim = () => post({ rv3dPoint: null });
  const SAY = { em: 'Comece por aqui: seu usuário ou e-mail.', pw: 'Agora a sua senha. Eu não espio!', sn: 'Como você se chama?', se: 'Seu e-mail de acesso.', sp: 'Crie uma senha segura.' };
  const hint = el => el.matches('input,select,textarea') ? SAY[el.id] || 'Preencha este campo.' : el.matches('button') ? 'Pronto? Clique para entrar!' : 'Ainda não tem conta? Crie a sua aqui.';
  function goto(el, talk) { if (!el) return; noAim(); if (el !== S_.at) put(el, true); if (talk !== false) say(hint(el)); if (el.id !== 'epit') ring(el); }
  // itens de médico: aponta a mão para o alvo, pede o gesto ao 3D e reage na tela (campo cede, balão responde)
  const bub = () => document.getElementById('epit'), logo = () => document.querySelector('.login>.brand');
  const act = (nome, el, texto, bate) => { if (el) aim(el); post({ rv3dAct: nome }); if (texto) say(texto);
    (bate || []).forEach(ms => setTimeout(() => { const x = el || bub(); if (x) squish(x); }, ms));
    clearTimeout(S_.noaim); S_.noaim = setTimeout(noAim, 2900); };
  const wait = (fn, ms) => setTimeout(() => { const a = document.activeElement; if (W() && !(a && a.matches && a.matches('.login input,.login select'))) fn(); }, ms);
  const PLAYS = [
    () => { const f = fields(), pw = f[f.length - 1]; goto(btn(), false); wait(() => act('estetoscopio', pw, 'Auscultando o campo da senha… batimentos normais!', [900, 1500, 2100]), 900); },
    () => { const u = fields()[0]; goto(u, false); wait(() => act('martelo', u, 'Teste de reflexo no campo de usuário. Tudo certo!', [600, 1150, 1700]), 900); },
    () => { goto(bub(), false); wait(() => act('termometro', null, 'Medindo a temperatura da conversa: 36,5 °C. Ótimo!'), 900); },
    () => { goto(bub(), false); wait(() => act('lanterna', logo(), 'Deixa eu iluminar a nossa logomarca!'), 900); },
    () => { goto(bub(), false); wait(() => { aim(fields()[0]); say('Começa por aqui, ó! Estou de olho no teu campo.'); S_.noaim = setTimeout(noAim, 2800); }, 900); },
    () => { goto(btn(), false); wait(() => act('termometro', null, 'Febre de senha esquecida? Peça ao administrador!'), 900); },
    () => { goto(bub(), false); wait(() => { squish(bub()); post({ rv3dAct: 'balao' }); say('Sabia que o balão também é meu trampolim?'); }, 900); }
  ];
  window.epiPlay = n => PLAYS[n]();   // (para testes/demonstração)
  function play() { let n; do { n = (Math.random() * PLAYS.length) | 0; } while (n === S_.last && PLAYS.length > 1); S_.last = n; PLAYS[n](); }
  // "brincadeira": quando ninguém mexe, ele escolhe uma das atividades acima a cada poucos segundos
  function idle() { clearInterval(S_.idle); S_.idle = setInterval(() => { const a = document.activeElement; if (!W() || (a && a.matches && a.matches('.login input,.login select'))) return; play(); }, 9000); }
  function start() {
    const w = W(), b = btn(); if (!w || !b || w.__init) return; w.__init = true; put(b, false); idle();
    if (S.err) { const l = L(); l.classList.add('shake'); setTimeout(() => l.classList.remove('shake'), 500); const p = $('#pw'); if (p) setTimeout(() => goto(p), 600); }
  }
  addEventListener('resize', () => { if (S_.at && document.body.contains(S_.at)) put(S_.at, false); });
  document.addEventListener('focusin', e => { const el = e.target; if (el.closest && el.closest('.login') && el.matches('input,select')) goto(el); });
  document.addEventListener('focusout', e => { const el = e.target; if (el.id === 'pw' || el.id === 'sp') { wave(1800); say('Pronto! Agora é só entrar.', 4000); setTimeout(() => { const a = document.activeElement; if (!(a && a.matches && a.matches('.login input,.login select'))) goto(btn(), false); }, 1500); } });
  document.addEventListener('input', e => { if (e.target.closest && e.target.closest('.login')) { const f = FR(); try { f.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-7px)' }, { transform: 'translateY(0)' }], { duration: 180 }); } catch { /* sem animação */ } } });
  document.addEventListener('pointerover', e => { if (e.target.closest && e.target.closest('.epib') && S_.at !== bub()) { goto(bub(), false); return; } const el = e.target.closest && e.target.closest('.login form>button:last-of-type,.login p a,.login [data-a=gologin]'); if (!el) return;
    if (el.matches('form>button')) goto(el); else { if (S_.at !== btn()) put(btn(), true); aim(el); say(hint(el)); } });
  const follow = e => { const f = FR(); if (!f || e.target.closest && e.target.closest('.login form,.login p')) return; const p = e.touches ? e.touches[0] : e, r = f.getBoundingClientRect(); post({ rv3dMouse: [p.clientX - r.left, p.clientY - r.top, Math.max(innerWidth, innerHeight) / 2] }); };
  document.addEventListener('pointermove', follow, { passive: true });
  document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-epi-click]')) { post({ rv3dAct: 'pulo' }); wave(2600); nextTip(); } });
  document.addEventListener('submit', e => { if (e.target.dataset && /^(login|signup)$/.test(e.target.dataset.f) && W()) { post({ rv3dAct: 'pulo' }); wave(2600); say('Um instante, já abro para você…'); } }, true);
  setInterval(() => { const a = document.activeElement; if (W() && !(a && a.matches && a.matches('.login input'))) nextTip(); }, 14000);
})();
