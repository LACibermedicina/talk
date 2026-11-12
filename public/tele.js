/* Teleconsulta sob demanda: quem está online e disponível, solicitar chamada, receber/atender/recusar e registro do desfecho (a agenda é gravada no servidor). */
(() => {
  const T = { av: [], out: null, first: true, seen: '', inc: null, tick: null, ring: null, ac: null, load: false, n: 0 };
  const ICON = '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/>';
  const can = () => S.me && (S.me.role === 'paciente' || HLT(S.me.role));
  const who = () => S.me.role === 'paciente' ? 'médicos' : 'pacientes';
  const HOME = HOME_APPS.findIndex(a => a[0] === 'cfg');
  HOME_APPS.splice(HOME < 0 ? HOME_APPS.length : HOME, 0, ['tele', 'Teleconsulta', ICON, '#1a9bb0', can]);
  HDESC.tele = 'Chamar quem está online e disponível agora';
  const busyInput = () => { const a = document.activeElement; return a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName); };
  const fmtLeft = t => Math.max(0, Math.ceil((new Date(t) - Date.now()) / 1000));
  function beep() { try { const a = T.ac || (T.ac = new (window.AudioContext || window.webkitAudioContext)()), o = a.createOscillator(), g = a.createGain(); o.connect(g); g.connect(a.destination); o.frequency.value = 880; g.gain.value = .07; o.start(); o.stop(a.currentTime + .22); } catch { /* sem áudio */ } }
  const modal = h => { let m = $('#tcm'); if (!m) { m = document.createElement('div'); m.id = 'tcm'; document.body.append(m); } m.innerHTML = h; m.className = h ? 'on' : ''; };
  const stopRing = () => { clearInterval(T.tick); clearInterval(T.ring); T.tick = T.ring = null; };
  function showIncoming(c) {
    stopRing(); T.inc = c.id;
    modal(`<div class="tcb" role="alertdialog" aria-label="${ES('Chamada recebida')}"><div class="tci">${ic(ICON, 28)}</div><h3>${ES('Teleconsulta solicitada')}</h3><p><b>${E(c.from)}</b>${c.cargo ? ' · ' + E(c.cargo) : ''}</p>${c.reason ? `<p class="mu">${ES('Motivo')}: ${E(c.reason)}</p>` : ''}<p class="mu" id="tcl"></p>
      <label class="mu" for="tcd">${ES('Se for recusar, a justificativa que a pessoa verá:')}</label><textarea id="tcd" rows="2" maxlength="300" placeholder="${ES('Deixe em branco para usar a sua mensagem padrão')}">${E(S.me.decline_msg || '')}</textarea>
      <div class="tcr"><button class="pbtn" data-a="tcacc" data-p="${c.id}">${ES('Atender')}</button><button data-a="tcdec" data-p="${c.id}" class="dng">${ES('Recusar')}</button></div></div>`);
    const upd = () => { const el = $('#tcl'); if (el) el.textContent = ES('Expira em') + ' ' + fmtLeft(c.expiresAt) + ' s'; }; upd(); T.tick = setInterval(upd, 1000); beep(); T.ring = setInterval(beep, 2200);
  }
  function hideIncoming() { stopRing(); T.inc = null; const m = $('#tcm'); if (m && m.querySelector('.tcb [data-a=tcacc]')) modal(''); }
  const result = o => {
    const t = { recusada: ['Chamada recusada', o.declineReason], sem_resposta: ['Sem resposta', o.declineReason], aceita: ['Chamada atendida', ''] }[o.status]; if (!t || o.status === 'aceita') return;
    modal(`<div class="tcb" role="alertdialog"><h3>${ES(t[0])}</h3><p><b>${E(o.target || '')}</b></p><p>${E(t[1] || '')}</p><p class="mu">${ES('A tentativa ficou registrada na sua agenda.')}</p><div class="tcr"><button class="pbtn" data-a="tcok">${ES('Entendi')}</button></div></div>`);
  };
  async function join2(aid) { if (CALL.c) return; await run(async () => { const t = await api('/video/token', { m: 'POST', b: { appointmentId: aid } }); await join(t, aid); }); }
  async function poll() {
    if (!S.me) return; let r; try { r = await api('/calls/poll'); } catch { return; }
    const c = (r.incoming || [])[0];
    if (c && T.inc !== c.id && !CALL.c) showIncoming(c); else if (!c && T.inc) hideIncoming();
    const o = r.outgoing, key = o ? o.id + ':' + o.status : '';
    if (o) {
      const was = T.out && T.out.id === o.id ? T.out.status : null; T.out = o;
      if (key !== T.seen) { T.seen = key; if (!T.first && o.status !== 'pendente' && was === 'pendente') { if (o.status === 'aceita') join2(o.appointmentId); else if (o.status !== 'cancelada') result(o); } }
      if (S.view === 'tele' && !busyInput()) { if (!T.load) { T.load = true; loadAv().finally(() => { T.load = false; }); } else render(); }
    } else T.out = null;
    T.first = false;
    if (++T.n % 5 === 0) { try { const k = await api('/contacts'), sig = x => x.map(y => y.id + y.status).join(); if (sig(k) !== sig(S.con || []) && !busyInput()) { S.con = k; render(); } } catch { /* segue */ } }
    if (S.view === 'tele' && T.n % 2 === 0 && !busyInput() && !T.load) { T.load = true; loadAv().finally(() => { T.load = false; }); }
  }
  async function loadAv() { try { T.av = await api('/calls/available'); } catch { T.av = []; } if (S.view === 'tele') render(); }
  CENTER.tele = () => {
    const pend = T.out && T.out.status === 'pendente', pro = HLT(S.me.role);
    const list = T.av.length ? T.av.map(x => `<div class="dr tcrow"><i class="onl" style="background:#22c55e"></i><span class="tcn"><b>${E(x.name)}</b> <span class="mu">${x.cargo ? E(x.cargo) : ES(ROLE[x.role] || '')}</span></span><button class="pbtn" data-a="tcall" data-p="${x.id}" ${pend ? 'disabled' : ''}>${ES('Solicitar teleconsulta')}</button></div>`).join('') : `<p class="mu">${ES(`Nenhum(a) ${who()} disponível agora. Quem está ocupado, offline ou com consulta marcada neste horário não aparece.`)}</p>`;
    const calling = pend ? `<div class="al y tcw"><b>${ES('Chamando')} ${E(T.out.target || '')}…</b> ${ES('aguardando resposta')}<button data-a="tccan" data-p="${T.out.id}" style="float:right">${ES('Cancelar')}</button></div>` : '';
    const last = T.out && T.out.status !== 'pendente' && T.out.status !== 'aceita' ? `<div class="al"><b>${ES(T.out.status === 'recusada' ? 'Última chamada recusada' : T.out.status === 'cancelada' ? 'Última chamada cancelada' : 'Última chamada sem resposta')}</b> — ${E(T.out.target || '')}${T.out.declineReason ? `<br>${E(T.out.declineReason)}` : ''}</div>` : '';
    const msg = pro ? `<div class="cd"><h3>${ES('Mensagem padrão de recusa')}</h3><p class="mu">${ES('Aparece para quem chamou quando você recusa sem escrever outra. Você também pode personalizar no momento da recusa.')}</p><textarea id="tdm" style="width:100%" rows="2" maxlength="300" placeholder="${ES('Ex.: Estou em atendimento. Agende um horário ou tente novamente mais tarde.')}">${E(S.me.decline_msg || '')}</textarea><div style="margin-top:6px"><button data-a="tdsave">${ES('Salvar mensagem')}</button></div></div>` : '';
    return bar('Teleconsulta') + `<div class="cv"><div class="cd"><h3>${ES(S.me.role === 'paciente' ? 'Médicos disponíveis agora' : 'Pacientes disponíveis agora')}</h3><p class="mu">${ES('Disponível = estado Online e nenhuma consulta na agenda nos próximos 30 minutos. Cada chamada e o seu desfecho ficam registrados na agenda dos dois lados.')}</p>${calling}${last}<input id="tcr" maxlength="200" placeholder="${ES('Motivo da chamada (opcional)')}" style="width:100%;margin:6px 0">${list}</div>${msg}</div>`;
  };
  const _v = A.view; A.view = p => p === 'tele' ? run(async () => { S.view = 'tele'; S.lo = 0; T.av = []; render(); await loadAv(); }) : _v(p);
  Object.assign(A, {
    tcall: id => run(async () => { const r = await api('/calls', { m: 'POST', b: { targetId: id, reason: ($('#tcr') && $('#tcr').value.trim()) || undefined } }); T.out = { ...r, target: (T.av.find(x => x.id === id) || {}).name }; T.seen = r.id + ':pendente'; render(); toast('Chamada enviada'); }),
    tccan: id => run(async () => { await api(`/calls/${id}/cancel`, { m: 'POST' }); T.out = { ...T.out, status: 'cancelada', declineReason: 'Chamada cancelada por quem solicitou.' }; T.seen = id + ':cancelada'; render(); loadAv(); }),
    tcacc: id => run(async () => { const r = await api(`/calls/${id}/accept`, { m: 'POST' }); hideIncoming(); modal(''); await join2(r.appointmentId); }),
    tcdec: id => run(async () => { const m = $('#tcd') ? $('#tcd').value.trim() : ''; await api(`/calls/${id}/decline`, { m: 'POST', b: { message: m || undefined } }); hideIncoming(); modal(''); toast('Chamada recusada; o motivo foi enviado e registrado na agenda'); }),
    tcok: () => modal(''),
    tdsave: () => run(async () => { const v = $('#tdm').value.trim(); await api('/me/decline-msg', { m: 'PUT', b: { message: v } }); S.me.decline_msg = v || null; toast('Mensagem salva'); }),
  });
  setInterval(() => { if (S.me) poll(); }, 6000);
})();
