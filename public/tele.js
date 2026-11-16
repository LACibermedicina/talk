/* Teleconsulta sob demanda: quem está online e disponível, solicitar chamada, receber/atender/recusar e registro do desfecho (a agenda é gravada no servidor). */
(() => {
  const T = { av: [], out: null, first: true, seen: '', inc: null, tick: null, ring: null, ac: null, load: false, n: 0 };
  const ICON = '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/>';
  const can = () => !!S.me;
  const who = () => S.me.role === 'paciente' ? 'profissionais' : 'pessoas';
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
    modal(`<div class="tcb" role="alertdialog" aria-label="${ES('Chamada recebida')}"><div class="tci">${ic(ICON, 28)}</div><h3 ${c.urgent ? 'style="color:#d9363e"' : ''}>${c.urgent ? '⚠ ' + ES('URGÊNCIA') : ES('Teleconsulta solicitada')}</h3>${c.kind === 'interna' ? `<p class="mu">${ES('Colega da sua equipe')}${c.team ? ': ' + E(c.team) : ''}</p>` : c.kind === 'externa' ? `<p class="mu">${ES('Chamada externa')}${c.team ? ' · ' + E(c.team) : ' · ' + ES('profissional autônomo')}</p>` : ''}<p><b>${E(c.from)}</b>${c.cargo ? ' · ' + E(c.cargo) : ''}</p>${c.reason ? `<p class="mu">${ES('Motivo')}: ${E(c.reason)}</p>` : ''}<p class="mu" id="tcl"></p>
      <label class="mu" for="tcd">${ES('Se for recusar, a justificativa que a pessoa verá:')}</label><textarea id="tcd" rows="2" maxlength="300" placeholder="${ES('Deixe em branco para usar a sua mensagem padrão')}">${E(S.me.decline_msg || '')}</textarea>
      <div class="tcr"><button class="pbtn" data-a="tcacc" data-p="${c.id}">${ES('Atender')}</button><button data-a="tcdec" data-p="${c.id}" class="dng">${ES('Recusar')}</button></div></div>`);
    const upd = () => { const el = $('#tcl'); if (el) el.textContent = ES('Expira em') + ' ' + fmtLeft(c.expiresAt) + ' s'; }; upd(); T.tick = setInterval(upd, 1000); beep(); T.ring = setInterval(beep, 2200);
  }
  function hideIncoming() { stopRing(); T.inc = null; const m = $('#tcm'); if (m && m.querySelector('.tcb [data-a=tcacc]')) modal(''); }
  const result = o => {
    const t = { recusada: ['Chamada recusada', o.declineReason], sem_resposta: ['Sem resposta', o.declineReason], aceita: ['Chamada atendida', ''] }[o.status]; if (!t || o.status === 'aceita') return;
    modal(`<div class="tcb" role="alertdialog"><h3>${ES(t[0])}</h3><p><b>${E(o.target || '')}</b></p><p>${E(t[1] || '')}</p><p class="mu">${ES('A tentativa ficou registrada na sua agenda.')}</p><div class="tcr"><button class="pbtn" data-a="tcok">${ES('Entendi')}</button></div></div>`);
  };
  async function blocked(b) {
    stopRing(); T.inc = null; if (CALL.c) await leave();
    modal(`<div class="tcb" role="alertdialog"><h3>${ES('Chamada encerrada pelo administrador da equipe')}</h3>${b.by ? `<p><b>${E(b.by)}</b></p>` : ''}<p>${E(b.reason || '')}</p><p class="mu">${ES('O encerramento ficou registrado na agenda.')}</p><div class="tcr"><button class="pbtn" data-a="tcok">${ES('Entendi')}</button></div></div>`);
  }
  async function join2(aid) { if (CALL.c) return; await run(async () => { const t = await api('/video/token', { m: 'POST', b: { appointmentId: aid } }); await join(t, aid); }); }
  async function poll() {
    if (!S.me) return; let r; try { r = await api('/calls/poll'); } catch { return; }
    if (r.blocked && T.blk !== r.blocked.id) { T.blk = r.blocked.id; if (!T.first) blocked(r.blocked); } else if (r.blocked && T.first) T.blk = r.blocked.id;
    const c = (r.incoming || [])[0];
    if (c && T.inc !== c.id && !CALL.c) showIncoming(c); else if (!c && T.inc) hideIncoming();
    const o = r.outgoing, key = o ? o.id + ':' + o.status : '';
    if (o) {
      const was = T.out && (T.out.id === o.id || (T.out.urgent && o.urgent)) ? T.out.status : null; T.out = o;
      if (key !== T.seen) { T.seen = key; if (!T.first && o.status !== 'pendente' && was === 'pendente') { if (o.status === 'aceita') join2(o.appointmentId); else if (o.status !== 'cancelada' && o.status !== 'bloqueada') result(o); } }
      if (S.view === 'tele' && !busyInput()) { if (!T.load) { T.load = true; loadAv().finally(() => { T.load = false; }); } else render(); }
    } else T.out = null;
    T.first = false;
    if (++T.n % 5 === 0) { try { const k = await api('/contacts'), sig = x => x.map(y => y.id + y.status).join(); if (sig(k) !== sig(S.con || []) && !busyInput()) { S.con = k; render(); } } catch { /* segue */ } }
    if (S.view === 'tele' && T.n % 2 === 0 && !busyInput() && !T.load) { T.load = true; loadAv().finally(() => { T.load = false; }); }
  }
  async function loadAv() { try { T.av = await api('/calls/available'); } catch { T.av = []; } if (S.view === 'tele') render(); }
  /* ---------- urgência ---------- */
  const urgH = pend => `<div class="cd tcu"><h3>${ic('<path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17v.01"/>', 18)} ${ES('Urgência')}</h3><p class="mu">${ES('Chama ao mesmo tempo todos os profissionais online disponíveis para urgência. O primeiro que atender assume o caso; a chamada fica registrada na agenda.')}</p><p class="mu"><b>${T.urg == null ? '…' : T.urg.count}</b> ${ES('profissional(is) disponível(is) para urgência agora')}</p><button class="pbtn dng" data-a="turg" ${pend || !(T.urg && T.urg.count) ? 'disabled' : ''}>${ES('Chamar urgência')}</button> <button data-a="view" data-p="agenda">${ES('Prefiro agendar uma consulta')}</button></div>`;
  const DAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  const urgCfgH = () => { const u = T.ucfg || { mode: 'sempre', periods: [] }; return `<div class="cd"><h3>${ES('Meu atendimento de urgência')}</h3><p class="mu">${ES('Por padrão você está disponível para urgências sempre que estiver online. Mude aqui se não quiser ou se só puder em certos períodos.')}</p><select id="ugm" data-i="ugmode"><option value="sempre" ${u.mode === 'sempre' ? 'selected' : ''}>${ES('Disponível sempre que online (padrão)')}</option><option value="periodos" ${u.mode === 'periodos' ? 'selected' : ''}>${ES('Disponível só nos períodos abaixo')}</option><option value="nunca" ${u.mode === 'nunca' ? 'selected' : ''}>${ES('Não disponível para urgências')}</option></select>${u.mode === 'periodos' ? (u.periods.length ? u.periods : [{ d: [1, 2, 3, 4, 5], from: '08:00', to: '18:00' }]).map((p, i) => `<div class="ugp" data-i="${i}">${DAYS.map((x, d) => `<label class="ugd"><input type="checkbox" data-i="ugday" data-n="${i}:${d}" ${p.d.includes(d) ? 'checked' : ''}>${x}</label>`).join('')}<input type="time" data-i="ugfrom" data-n="${i}" value="${p.from}"> – <input type="time" data-i="ugto" data-n="${i}" value="${p.to}"></div>`).join('') + `<button data-a="ugadd">${ES('+ período')}</button>` : ''}<div style="margin-top:8px"><button class="pbtn" data-a="ugsave">${ES('Salvar')}</button> <span class="mu">${u.openNow === false ? ES('Fora do período agora') : ''}</span></div></div>`; };
  async function loadUrg() { try { T.urg = await api('/calls/urgent'); } catch { T.urg = { count: 0 }; } }
  async function urgInit() {
    if (T.ui || !S.me || !HLT(S.me.role)) return; T.ui = true;
    try { T.ucfg = await api('/me/urgency'); } catch { return; }
    if (T.ucfg.set) return;
    modal(`<div class="tcb" role="dialog" aria-label="${ES('Atendimento de urgência')}"><h3>${ES('Atendimento de urgência')}</h3><p>${ES('Pacientes e colegas podem acionar urgências. Por padrão você aparece como disponível sempre que estiver online.')}</p><div class="tcr"><button class="pbtn" data-a="ugok">${ES('Manter disponível (padrão)')}</button><button data-a="ugno" class="dng">${ES('Não estou disponível')}</button><button data-a="ugper">${ES('Só em períodos…')}</button></div></div>`);
  }
  CENTER.tele = () => {
    const pend = T.out && T.out.status === 'pendente', pro = HLT(S.me.role);
    const rowH = x => `<div class="dr tcrow"><i class="onl" style="background:#22c55e"></i><span class="tcn"><b>${E(x.name)}</b> <span class="mu">${x.cargo ? E(x.cargo) : ES(ROLE[x.role] || '')}${x.team ? ' · ' + E(x.team) : ''}</span></span><button class="pbtn" data-a="tcall" data-p="${x.id}" ${pend ? 'disabled' : ''}>${ES('Solicitar teleconsulta')}</button></div>`;
    const GR = [['paciente', 'Pacientes'], ['equipe', 'Colegas da sua equipe'], ['externo', 'Outros profissionais (externos / autônomos)'], ['staff', 'Administração e recepção']];
    const grouped = T.av.some(x => x.grp && x.grp !== 'paciente') && S.me.role !== 'paciente' ? GR.map(([g, t]) => { const l = T.av.filter(x => (x.grp || 'paciente') === g); return l.length ? `<h4 class="tch">${ES(t)}</h4>` + l.map(rowH).join('') : ''; }).join('') : '';
    const list = grouped || T.av.length ? (grouped || T.av.map(rowH).join('')) : `<p class="mu">${ES(`Nenhum(a) ${who()} disponível agora. Quem está ocupado, offline ou com consulta marcada neste horário não aparece.`)}</p>`;
    const calling = pend ? `<div class="al y tcw"><b>${ES('Chamando')} ${E(T.out.target || '')}…</b> ${ES('aguardando resposta')}<button data-a="tccan" data-p="${T.out.id}" style="float:right">${ES('Cancelar')}</button></div>` : '';
    const last = T.out && T.out.status !== 'pendente' && T.out.status !== 'aceita' ? `<div class="al"><b>${ES(T.out.status === 'recusada' ? 'Última chamada recusada' : T.out.status === 'cancelada' ? 'Última chamada cancelada' : 'Última chamada sem resposta')}</b> — ${E(T.out.target || '')}${T.out.declineReason ? `<br>${E(T.out.declineReason)}` : ''}</div>` : '';
    const msg = pro ? `<div class="cd"><h3>${ES('Mensagem padrão de recusa')}</h3><p class="mu">${ES('Aparece para quem chamou quando você recusa sem escrever outra. Você também pode personalizar no momento da recusa.')}</p><textarea id="tdm" style="width:100%" rows="2" maxlength="300" placeholder="${ES('Ex.: Estou em atendimento. Agende um horário ou tente novamente mais tarde.')}">${E(S.me.decline_msg || '')}</textarea><div style="margin-top:6px"><button data-a="tdsave">${ES('Salvar mensagem')}</button></div></div>` : '';
    return bar('Teleconsulta') + `<div class="cv">${urgH(pend)}<div class="cd"><h3>${ES(S.me.role === 'paciente' ? 'Profissionais disponíveis agora' : 'Pessoas disponíveis agora')}</h3><p class="mu">${ES('Disponível = estado Online e nenhuma consulta na agenda nos próximos 30 minutos. Cada chamada e o seu desfecho ficam registrados na agenda dos dois lados.')}</p>${calling}${last}<input id="tcr" maxlength="200" placeholder="${ES('Motivo da chamada (opcional)')}" style="width:100%;margin:6px 0">${list}</div>${msg}${pro ? urgCfgH() : ''}</div>`;
  };
  const _v = A.view; A.view = p => p === 'tele' ? run(async () => { S.view = 'tele'; S.lo = 0; T.av = []; render(); await Promise.all([loadAv(), loadUrg(), HLT(S.me.role) ? api('/me/urgency').then(u => { T.ucfg = u; }).catch(() => {}) : null]); render(); }) : _v(p);
  Object.assign(A, {
    tcall: id => run(async () => { const r = await api('/calls', { m: 'POST', b: { targetId: id, reason: ($('#tcr') && $('#tcr').value.trim()) || undefined } }); T.out = { ...r, target: (T.av.find(x => x.id === id) || {}).name }; T.seen = r.id + ':pendente'; render(); toast('Chamada enviada'); }),
    tccan: id => run(async () => { await api(`/calls/${id}/cancel`, { m: 'POST' }); T.out = { ...T.out, status: 'cancelada', declineReason: 'Chamada cancelada por quem solicitou.' }; T.seen = id + ':cancelada'; render(); loadAv(); }),
    tcacc: id => run(async () => { const r = await api(`/calls/${id}/accept`, { m: 'POST' }); hideIncoming(); modal(''); await join2(r.appointmentId); }),
    tcdec: id => run(async () => { const m = $('#tcd') ? $('#tcd').value.trim() : ''; await api(`/calls/${id}/decline`, { m: 'POST', b: { message: m || undefined } }); hideIncoming(); modal(''); toast('Chamada recusada; o motivo foi enviado e registrado na agenda'); }),
    turg: () => run(async () => { const r = await api('/calls/urgent', { m: 'POST', b: { reason: ($('#tcr') && $('#tcr').value.trim()) || undefined } }); T.out = { id: 'urgent', status: 'pendente', urgent: true, target: 'um profissional disponível (urgência)' }; T.seen = ''; render(); toast('Urgência enviada a ' + r.count + ' profissional(is)'); }),
    ugok: () => run(async () => { T.ucfg = await api('/me/urgency', { m: 'PUT', b: { mode: 'sempre', periods: [] } }); modal(''); toast('Você ficou disponível para urgências (padrão)'); }),
    ugno: () => run(async () => { T.ucfg = await api('/me/urgency', { m: 'PUT', b: { mode: 'nunca', periods: [] } }); modal(''); toast('Você não receberá chamadas de urgência'); }),
    ugper: () => run(async () => { T.ucfg = await api('/me/urgency', { m: 'PUT', b: { mode: 'periodos', periods: [{ d: [1, 2, 3, 4, 5], from: '08:00', to: '18:00' }] } }); modal(''); A.view('tele'); }),
    ugadd: () => { T.ucfg.periods = [...(T.ucfg.periods || []), { d: [1, 2, 3, 4, 5], from: '08:00', to: '18:00' }]; render(); },
    ugsave: () => run(async () => { const u = T.ucfg || { mode: 'sempre', periods: [] }; T.ucfg = await api('/me/urgency', { m: 'PUT', b: { mode: u.mode, periods: u.mode === 'periodos' ? u.periods : [] } }); toast('Preferência de urgência salva'); render(); }),
    tcok: () => modal(''),
    tdsave: () => run(async () => { const v = $('#tdm').value.trim(); await api('/me/decline-msg', { m: 'PUT', b: { message: v } }); S.me.decline_msg = v || null; toast('Mensagem salva'); }),
  });

  document.addEventListener('change', e => {
    const t = e.target, k = t.dataset && t.dataset.i; if (!k || !k.startsWith('ug') || !T.ucfg) return; const n = t.dataset.n || '';
    if (k === 'ugmode') { T.ucfg.mode = t.value; if (t.value === 'periodos' && !(T.ucfg.periods || []).length) T.ucfg.periods = [{ d: [1, 2, 3, 4, 5], from: '08:00', to: '18:00' }]; render(); return; }
    const [i, d] = n.split(':').map(Number), p = (T.ucfg.periods || [])[i]; if (!p) return;
    if (k === 'ugday') p.d = t.checked ? [...new Set([...p.d, d])] : p.d.filter(x => x !== d); else if (k === 'ugfrom') p.from = t.value; else if (k === 'ugto') p.to = t.value;
  });
  document.addEventListener('m3d:ev', e => { if (e.detail && e.detail.ev === 'call') poll(); });
  window.M3D_POLL = poll;
  setTimeout(urgInit, 4000);
  setInterval(() => { if (S.me) poll(); }, 6000);
})();
