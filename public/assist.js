/* Assistente de ajuda (botão "Ajuda"): chat com a IA do sistema, restrito ao nível de acesso do usuário.
   Conversa só em memória (não é gravada). A IA não recebe dados de pacientes; ações [[ir:x]] só para telas permitidas ao perfil. */
(() => {
  const AS = { open: false, min: false, msgs: [], busy: false, info: null }, VIEWS = ['agenda', 'tarefas', 'fin', 'users', 'integ', 'audit', 'grafo', 'hist', 'notas', 'notif', 'cred', 'credadm', 'cfg'];
  const lang = () => (window.I18N && I18N.lang) || 'pt', md = t => (typeof mdH === 'function' ? mdH(t) : `<p>${E(t)}</p>`);
  function el() {
    let d = document.getElementById('asst'); if (d) return d;
    d = document.createElement('section'); d.id = 'asst'; d.hidden = true; d.setAttribute('role', 'dialog'); d.setAttribute('aria-label', 'Assistente de ajuda'); document.body.append(d);
    d.innerHTML = `<header class="ash"><b>${ES('Assistente Talk.M3D')}</b><span class="sp"></span><button data-a="asguide" title="Guia passo a passo" aria-label="Guia passo a passo">?</button><button data-a="asmin" title="Minimizar" aria-label="Minimizar">▁</button><button data-a="asx" title="Fechar" aria-label="Fechar">✕</button></header><div class="asb"><div id="asmsg" aria-live="polite"></div><div id="assug"></div><form id="asf"><input id="asi" maxlength="600" autocomplete="off" placeholder="${ES('Pergunte ou peça ajuda…')}" aria-label="${ES('Mensagem para o assistente')}"><button type="submit" class="pbtn" aria-label="${ES('Enviar')}">➤</button></form><p class="mu asn">${ES('A IA ajuda só com o uso do sistema, dentro do seu nível de acesso. Não envie dados de pacientes.')}</p></div>`;
    d.querySelector('#asf').addEventListener('submit', e => { e.preventDefault(); const i = d.querySelector('#asi'), t = i.value.trim(); if (t) { i.value = ''; send(t); } });
    return d;
  }
  function draw() {
    const d = el(); d.hidden = !AS.open; d.classList.toggle('min', AS.min); if (!AS.open) return;
    const m = d.querySelector('#asmsg');
    m.innerHTML = (AS.msgs.length ? '' : `<div class="asm bot"><p>${ES('Olá! Posso explicar como usar o sistema e levar você até a tela certa. O que você precisa?')}</p></div>`)
      + AS.msgs.map(x => x.role === 'user' ? `<div class="asm me"><p>${E(x.content)}</p></div>` : `<div class="asm bot">${md(x.content)}${(x.actions || []).length ? `<div class="asa">${x.actions.map(a => `<button data-a="asgo" data-p="${a.id}">${ES('Abrir')} ${ES(a.title)} →</button>`).join('')}</div>` : ''}${x.ai === false ? `<small class="mu">${ES('Resposta automática (IA indisponível).')}</small>` : ''}</div>`).join('')
      + (AS.busy ? `<div class="asm bot"><p class="mu">${ES('Pensando…')}</p></div>` : '');
    m.scrollTop = m.scrollHeight;
    d.querySelector('#assug').innerHTML = AS.msgs.length || !AS.info ? '' : (AS.info.suggestions || []).map((s, i) => `<button data-a="assg" data-p="${i}">${ES(s)}</button>`).join('');
  }
  async function send(text) {
    AS.msgs.push({ role: 'user', content: text }); AS.busy = true; draw();
    try {
      const r = await api('/assistant', { m: 'POST', b: { messages: AS.msgs.slice(-8).map(x => ({ role: x.role, content: String(x.content).slice(0, 1200) })), lang: lang(), view: S.view || '' } });
      AS.msgs.push({ role: 'assistant', content: r.reply || '…', actions: r.actions || [], ai: r.ai });
    } catch (e) { AS.msgs.push({ role: 'assistant', content: 'Não consegui responder agora: ' + (e.message || 'erro'), actions: [], ai: false }); }
    AS.busy = false; draw();
  }
  async function open() {
    if (!S.me) return; AS.open = true; AS.min = false; draw();
    if (!AS.info) { try { AS.info = await api('/assistant/info'); } catch { AS.info = { suggestions: [], features: [] }; } draw(); }
    setTimeout(() => { const i = document.getElementById('asi'); if (i) i.focus(); }, 50);
  }
  A.asx = () => { AS.open = false; draw(); };
  A.asmin = () => { AS.min = !AS.min; draw(); };
  A.asguide = () => { AS.open = false; draw(); if (window.HELP) HELP.open(); };
  A.assg = i => { const t = AS.info && AS.info.suggestions[+i]; if (t) send(t); };
  A.asgo = id => {
    if (VIEWS.includes(id)) { A.view(id); return; }
    if (id === 'chat') { A.gohome(); return; }
    toast({ call: 'Abra a conversa com a pessoa e use o botão “Video Chamada”.', caso: 'Abra a conversa com o paciente e use a aba “Caso clínico”.', consulta: 'Durante a chamada, use os ícones da barra de tarefas da chamada.', biblioteca: 'Durante a chamada ou na barra de tarefas, abra a Biblioteca.' }[id] || 'Ok');
    if (id === 'biblioteca' && window.A && A.libopen) A.libopen();
  };
  // o botão "Ajuda" abre o chat; o guia passo a passo continua em Alt+G e no botão "?" do chat
  const hook = () => { const f = document.getElementById('helpfab'); if (!f || f.dataset.as) return !!f; f.dataset.as = '1'; f.addEventListener('click', e => { e.stopImmediatePropagation(); AS.open && !AS.min ? A.asx() : open(); }, true); return true; };
  if (!hook()) { const t = setInterval(() => { if (hook()) clearInterval(t); }, 300); }
  const _help = A.help; A.help = () => { S.lo = false; open(); };
  const _out = A.out; if (_out) A.out = (...a) => { AS.msgs = []; AS.open = false; AS.info = null; draw(); return _out(...a); };
  window.ASSIST = { open, state: AS };
})();
