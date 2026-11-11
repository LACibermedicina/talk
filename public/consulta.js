/* Teleconsulta: janela da chamada móvel/maximizável/miniatura (PiP) e ferramentas do profissional
   (transcrição, histórico por minuto, relatório, apoio cognitivo, biblioteca). O paciente só vê o aviso de consentimento. */
(() => {
  const clang = () => (window.I18N && I18N.lang) || 'pt', isPro = () => !!(S.me && HLT(S.me.role));
  const IC = {
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    brain: '<path d="M12 5a3 3 0 00-5.6-1.5A3.5 3.5 0 004 9a3.5 3.5 0 001 6 3.5 3.5 0 005 3 2 2 0 002 1zM12 5a3 3 0 015.6-1.5A3.5 3.5 0 0120 9a3.5 3.5 0 01-1 6 3.5 3.5 0 01-5 3 2 2 0 01-2 1M12 5v14M8.5 10H12M12 14h3.5"/>',
    doc: '<path d="M6 3h9l4 4v14H6zM14 3v5h5M9 13h6M9 17h6"/>', book: '<path d="M4 5a2 2 0 012-2h13v15H6a2 2 0 00-2 2zM4 20a2 2 0 002 2h13v-4M8 7h7"/>'
  };
  const WD = {
    trans: { t: 'Transcrição', d: 'Transcrição e estruturação da consulta', c: '#d9363e', i: IC.mic, w: 380, h: 470 }, hist: { t: 'Histórico por minuto', d: 'Histórico resumido e integral, minuto a minuto', c: '#2481cc', i: IC.clock, w: 380, h: 470 },
    sup: { t: 'Apoio cognitivo', d: 'Feedback em tempo real: caso, condutas e alertas', c: '#7c6bd6', i: IC.brain, w: 400, h: 540 }, rep: { t: 'Relatório da consulta', d: 'Relatório de evolução e relato de caso', c: '#2a9d8f', i: IC.doc, w: 520, h: 560 },
    lib: { t: 'Biblioteca e preferências', d: 'Materiais, protocolos e preferências locais', c: '#c9822b', i: IC.book, w: 460, h: 520 }
  };
  const K = { mode: 'win', cx: 24, cy: 72, cw: 640, ch: 400, mini: null, aid: null, on: false, ended: false, tr: { on: false, consent: null }, since: null, segs: [], inter: [], risks: [], seen: new Set(), struct: null, structN: 0, sup: null, supOn: false, supN: -1, supBusy: false, supErr: '', supAt: 0, mins: null, rep: null, repEdit: false, repBusy: false, tab: { trans: 'live', lib: 'mat' }, lib: null, prefs: null, wins: {}, z: 80, pNeed: false, pRec: false, timers: [], busy: {} };
  const $c = () => document.querySelector('#call .cbox'), Wn = () => innerWidth, Hn = () => innerHeight;
  /* ---------- janela da chamada ---------- */
  function applyCall() {
    const b = $c(); if (!b) return; b.classList.toggle('mini', K.mode === 'mini'); b.classList.toggle('max', K.mode === 'max'); const W = Wn(), H = Hn();
    let x, y, w, h; if (K.mode === 'max') { x = 8; y = 8; w = W - 16; h = H - 90; } else if (K.mode === 'mini') { w = Math.min(260, W - 16); h = 168; x = K.mini ? K.mini.x : W - w - 16; y = K.mini ? K.mini.y : H - h - 78; } else { w = Math.min(K.cw, W - 16); h = Math.min(K.ch, H - 90); x = Math.max(0, Math.min(K.cx, W - w)); y = Math.max(0, Math.min(K.cy, H - h - 10)); }
    Object.assign(b.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
    const mx = b.querySelector('[data-a=cbmax]'); if (mx) { mx.textContent = K.mode === 'max' ? '⤡' : '⤢'; mx.title = K.mode === 'max' ? 'Restaurar' : 'Maximizar'; }
    const mn = b.querySelector('[data-a=cbmin]'); if (mn) { mn.textContent = K.mode === 'mini' ? '▢' : '▁'; mn.title = K.mode === 'mini' ? 'Restaurar' : 'Reduzir a um canto da tela'; }
  }
  function decorate() {
    const b = $c(); if (!b || b.querySelector('.cbh')) return;
    b.insertAdjacentHTML('afterbegin', `<div class="cbh" data-cbh><b>${ES('Videochamada')}</b><span class="sp"></span><button data-a="cbmin" aria-label="Reduzir a um canto da tela">▁</button><button data-a="cbmax" aria-label="Maximizar">⤢</button></div><div class="ccon" id="ccon" hidden></div>`);
    const r = b.querySelector('[data-a=rec]'); if (r) r.remove(); // a transcrição agora fica na barra de tarefas do profissional
    const m = document.getElementById('cmsg'); if (m) m.textContent = isPro() ? 'A transcrição, o relatório e o apoio cognitivo ficam na barra de tarefas abaixo (só para profissionais).' : 'Se o profissional pedir transcrição, você será consultado antes e pode recusar.';
  }
  A.cbmin = () => { K.mode = K.mode === 'mini' ? 'win' : 'mini'; applyCall(); };
  A.cbmax = () => { K.mode = K.mode === 'max' ? 'win' : 'max'; applyCall(); };
  let drag = null;
  document.addEventListener('pointerdown', e => {
    const h = e.target.closest && e.target.closest('[data-cbh]'); const b = $c();
    if (h && b && !e.target.closest('button') && K.mode !== 'max') { drag = { t: 'call', x0: e.clientX, y0: e.clientY, ox: b.offsetLeft, oy: b.offsetTop }; h.setPointerCapture(e.pointerId); e.preventDefault(); return; }
    if (K.mode === 'mini' && b && b.contains(e.target) && !e.target.closest('button')) { drag = { t: 'call', x0: e.clientX, y0: e.clientY, ox: b.offsetLeft, oy: b.offsetTop, mini: true }; b.setPointerCapture && b.setPointerCapture(e.pointerId); return; }
    const wh = e.target.closest && e.target.closest('[data-wh]'); if (wh && !e.target.closest('button')) { const el = wh.closest('.cw2'), id = el.dataset.w; K.wins[id].z = ++K.z; el.style.zIndex = K.z; drag = { t: 'win', id, el, x0: e.clientX, y0: e.clientY, ox: el.offsetLeft, oy: el.offsetTop }; wh.setPointerCapture(e.pointerId); e.preventDefault(); }
    else { const w = e.target.closest && e.target.closest('.cw2'); if (w) { K.wins[w.dataset.w].z = ++K.z; w.style.zIndex = K.z; } }
  });
  document.addEventListener('pointermove', e => {
    if (!drag) return; const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (drag.t === 'call') { const b = $c(), x = Math.max(0, Math.min(Wn() - b.offsetWidth, drag.ox + dx)), y = Math.max(0, Math.min(Hn() - 40, drag.oy + dy)); b.style.left = x + 'px'; b.style.top = y + 'px'; if (K.mode === 'mini') K.mini = { x, y }; else { K.cx = x; K.cy = y; } }
    else { const x = Math.max(0, Math.min(Wn() - 80, drag.ox + dx)), y = Math.max(0, Math.min(Hn() - 40, drag.oy + dy)); drag.el.style.left = x + 'px'; drag.el.style.top = y + 'px'; const w = K.wins[drag.id]; w.x = x; w.y = y; }
  });
  const endDrag = () => { drag = null; }; document.addEventListener('pointerup', endDrag); document.addEventListener('pointercancel', endDrag);
  document.addEventListener('dblclick', e => { if (e.target.closest && e.target.closest('[data-cbh]') && !e.target.closest('button')) A.cbmin(); });
  new ResizeObserver(() => { const b = $c(); if (b && K.mode === 'win' && b.offsetWidth > 100) { K.cw = b.offsetWidth; K.ch = b.offsetHeight; } }).observe(document.body);
  /* ---------- barra de tarefas da chamada (só profissional) ---------- */
  function barVisible() { return isPro() && (K.on || (K.ended && K.segs.length)); }
  function renderBar() {
    let d = document.getElementById('cbar'); if (!barVisible()) { if (d) d.remove(); return; }
    if (!d) { d = document.createElement('nav'); d.id = 'cbar'; d.setAttribute('aria-label', 'Ferramentas da consulta'); document.body.append(d); }
    const ids = ['trans', ...(K.tr.on || K.segs.length ? ['hist'] : []), ...(K.tr.on || K.supOn ? ['sup'] : []), ...(K.segs.length ? ['rep'] : []), 'lib'];
    d.innerHTML = ids.map(id => { const w = WD[id], st = (K.wins[id] || {}).st, on = st && st !== 'closed', rec = id === 'trans' && K.tr.on, al = id === 'sup' && K.inter.some(i => i.sev === 'grave'); return `<button class="happ cbk ${on ? 'on' : ''} ${rec ? 'rec' : ''} ${al ? 'al' : ''}" data-a="kopen" data-p="${id}" style="--pc:${w.c}" aria-pressed="${!!on}" aria-label="${w.t}: ${w.d}"><span class="dki">${ic(w.i, 24)}</span><span class="htip" role="tooltip"><b>${ES(w.t)}</b><small>${ES(w.d)}</small>${id === 'trans' ? `<small>${ES(K.tr.on ? 'Gravando · clique para abrir' : 'Desligada · abra para ativar')}</small>` : ''}</span></button>`; }).join('') + (K.ended ? `<button class="cbx" data-a="kdismiss" aria-label="Fechar barra" title="Fechar barra">✕</button>` : '');
  }
  /* ---------- janelas das ferramentas ---------- */
  function layer() { let l = document.getElementById('c2l'); if (!l) { l = document.createElement('div'); l.id = 'c2l'; document.body.append(l); } return l; }
  const statusTxt = () => K.tr.on ? (K.tr.consent === true ? 'Gravando · paciente consentiu' : K.tr.consent === false ? 'Paciente recusou: só o seu áudio é transcrito' : 'Aguardando o consentimento do paciente…') : 'Desligada';
  const alertsH = () => (K.inter.length || K.risks.length) ? `<div class="kal">${K.inter.map(i => `<div class="kai ${i.sev}"><b>${ES(i.sev === 'grave' ? 'Interação grave' : 'Interação')}: ${E(i.a)} + ${E(i.b)}</b> ${E(i.msg)} <small>(${ES(i.fonte)})</small></div>`).join('')}${K.risks.map(r => `<div class="kai risco">⚠ ${E(r)}</div>`).join('')}<small class="mu">${ES('Alerta de apoio baseado em palavras citadas; confirme em fonte oficial.')}</small></div>` : '';
  const sH = s => `<div class="kl ${s.who === 'Paciente' ? 'p' : ''}"><small>${E(new Date(s.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }))} · ${ES(s.who)}</small><p>${E(s.text)}</p></div>`;
  const structH = s => { if (!s) return `<p class="mu">${ES('A estruturação automática aparece após as primeiras falas.')}</p>`; const F = [['Queixa principal', 'queixa'], ['História da doença atual', 'hda'], ['Sintomas', 'sintomas'], ['Antecedentes', 'antecedentes'], ['Medicamentos', 'medicamentos'], ['Alergias', 'alergias'], ['Achados do exame', 'achados_exame'], ['Hipóteses', 'hipoteses'], ['Conduta discutida', 'conduta_discutida'], ['Pendências (perguntas ainda não feitas)', 'pendencias']]; return F.filter(([, k]) => s[k] && (!Array.isArray(s[k]) || s[k].length)).map(([l, k]) => `<h4>${ES(l)}</h4>${Array.isArray(s[k]) ? `<ul>${s[k].map(x => `<li>${E(String(x))}</li>`).join('')}</ul>` : `<p>${E(String(s[k]))}</p>`}`).join(''); };
  const BODY = {
    trans: () => `<div class="ktr"><label class="ksw"><input type="checkbox" data-a="ktr" ${K.tr.on ? 'checked' : ''} aria-label="${ES('Transcrever a consulta')}"><span class="sl2"></span><b>${ES('Transcrever a consulta')}</b></label><small class="mu" id="kst">${ES(statusTxt())}</small></div>
      <div class="tabs2"><button class="${K.tab.trans === 'live' ? 'on' : ''}" data-a="ktab" data-p="trans:live">${ES('Ao vivo')}</button><button class="${K.tab.trans === 'est' ? 'on' : ''}" data-a="ktab" data-p="trans:est">${ES('Estruturada')}</button></div>${alertsH()}
      ${K.tab.trans === 'live' ? `<div class="klive" id="klive">${K.segs.length ? K.segs.map(sH).join('') : `<p class="mu">${ES(K.tr.on ? 'Aguardando falas…' : 'Ative a transcrição para registrar a consulta. O paciente é consultado antes.')}</p>`}</div>` : `<div class="kest">${structH(K.struct)}</div>`}`,
    hist: () => `<div class="krow"><button data-a="kmins">${ES('Atualizar')}</button><button data-a="kcopymins">${ES('Copiar tudo')}</button></div>${!K.mins ? `<p class="mu">${ES('Carregando…')}</p>` : !K.mins.length ? `<p class="mu">${ES('Sem falas registradas.')}</p>` : K.mins.map(m => `<details class="kmin"><summary><b>${E(m.label)}</b> <span class="mu">${E(m.brief)}</span></summary>${m.lines.map(l => `<div class="kl ${l.who === 'Paciente' ? 'p' : ''}"><small>${E(l.t)} · ${ES(l.who)}</small><p>${E(l.text)}</p></div>`).join('')}</details>`).join('')}`,
    sup: () => { const s = K.sup; return `<div class="krow"><small class="mu">${ES(K.supBusy ? 'Analisando…' : s ? 'Atualizado ' + new Date(s.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Aguardando dados…')}</small><span class="sp"></span><button data-a="ksup" ${K.supBusy ? 'disabled' : ''}>${ES('Atualizar agora')}</button></div>${alertsH()}${K.supErr ? `<p class="kerr">${E(K.supErr)}</p>` : ''}
      ${s ? `${s.resumo ? `<h4>${ES('Resumo da consulta')}</h4><p>${E(s.resumo)}</p>` : ''}${s.caracterizacao ? `<h4>${ES('Caracterização do caso')}</h4><p>${E(s.caracterizacao)}</p>` : ''}${(s.hipoteses || []).length ? `<h4>${ES('Hipóteses')}</h4><ul>${s.hipoteses.map(x => `<li>${E(String(x))}</li>`).join('')}</ul>` : ''}
      ${(s.condutas || []).length ? `<h4>${ES('Condutas sugeridas')}</h4>${s.condutas.map(c => `<div class="kcd"><span class="kb ${c.tipo === 'preferencia_local' ? 'loc' : ''}">${ES(c.tipo === 'preferencia_local' ? 'Preferência local' : c.tipo === 'geral' ? 'Geral' : 'Protocolo')}</span> ${E(c.acao)}<small class="mu"> ${E(c.base || '')}</small></div>`).join('')}` : ''}
      ${(s.alertas || []).length ? `<h4>${ES('Riscos e alertas')}</h4>${s.alertas.map(a => `<div class="kai ${a.nivel === 'alto' ? 'grave' : ''}">${E(a.texto)}</div>`).join('')}` : ''}
      ${(s.interconsultas || []).length ? `<h4>${ES('Interconsultas')}</h4>${s.interconsultas.map(i => `<div class="kic"><b>${E(i.especialidade)}</b> <span class="kb">${E(i.urgencia || 'rotina')}</span><p>${E(i.motivo || '')}</p>${i.modo === 'encaminhamento' ? `<small class="mu">${ES('Sem profissional disponível: registrar apenas o encaminhamento.')}</small>` : (i.modo === 'agendar' ? i.equipe : i.online).map(u => `<div class="kpr"><span class="onl ${u.status !== 'offline' ? 'on' : ''}"></span> ${E(u.name)} <small class="mu">${E(u.cargo || '')}${u.status === 'busy' ? ' · ' + ES('ocupado') : ''}</small><button data-a="kpro" data-p="${u.id}|${i.modo}">${ES(i.modo === 'agendar' ? 'Agendar' : 'Conversar')}</button></div>`).join('') + (i.modo === 'online' ? `<small class="mu">${ES('Profissionais online disponíveis (fora da equipe do paciente).')}</small>` : '')}</div>`).join('')}` : ''}
      ${(s.perguntas || []).length ? `<h4>${ES('Perguntas sugeridas')}</h4><ul>${s.perguntas.map(x => `<li>${E(String(x))}</li>`).join('')}</ul>` : ''}<p class="mu kfn">${ES('Sugestões para o profissional avaliar; a decisão é sua. Fontes consideradas: ' + (s.fontes || 0) + ' material(is) da biblioteca.')}</p>` : ''}`; },
    rep: () => { const r = K.rep; return `<div class="krow"><button class="pbtn" data-a="krepgen" ${K.repBusy ? 'disabled' : ''}>${ES(K.repBusy ? 'Gerando…' : r && r.md ? 'Gerar de novo' : 'Gerar relatório (IA)')}</button>${r && r.md ? `<button data-a="krepedit">${ES(K.repEdit ? 'Visualizar' : 'Editar')}</button><button data-a="krepsave">${ES('Salvar')}</button><button data-a="krepcopy">${ES('Copiar')}</button><button data-a="krepprint">${ES('PDF / Imprimir')}</button>` : ''}</div>${r && r.md ? (K.repEdit ? `<textarea id="krep" class="krepta" aria-label="${ES('Relatório')}">${E(r.md)}</textarea>` : `<div class="krepv">${mdH(r.md)}</div>`) : `<p class="mu">${ES(K.segs.length ? 'Gere o relatório de evolução (boas práticas de documentação médica + relato de caso). É um rascunho para revisar e assinar.' : 'Sem transcrição para gerar o relatório.')}</p>`}${K.supErr && K.tab.err === 'rep' ? `<p class="kerr">${E(K.supErr)}</p>` : ''}`; },
    lib: () => { const t = K.tab.lib; return `<div class="tabs2"><button class="${t === 'mat' ? 'on' : ''}" data-a="ktab" data-p="lib:mat">${ES('Materiais')}</button><button class="${t === 'pref' ? 'on' : ''}" data-a="ktab" data-p="lib:pref">${ES('Preferências locais')}</button>${S.me && S.me.role === 'admin' ? `<button class="${t === 'ord' ? 'on' : ''}" data-a="ktab" data-p="lib:ord">${ES('Hierarquia protocolar')}</button>` : ''}</div>${t === 'mat' ? libMat() : t === 'ord' ? libOrd() : libPref()}`; }
  };
  const TIERS = { ministerio: 'Ministério da Saúde', sociedade: 'Sociedade de especialidade', oms: 'OMS', personal: 'Meu material', geral: 'Geral (outros usuários)' };
  const libMat = () => `<p class="mu">${ES('Prioridade usada pelo apoio cognitivo: Ministério da Saúde → sociedades → OMS → seus materiais → materiais gerais.')}</p>${!K.lib ? `<p class="mu">${ES('Carregando…')}</p>` : K.lib.map(i => `<div class="klib"><div><span class="kb t-${i.tier}">${ES(TIERS[i.tier] || i.tier)}</span> ${i.country ? `<small class="mu">${E(i.country)}</small>` : ''}<b>${E(i.title)}</b><small class="mu">${E(i.preview)}</small></div>${i.mine ? `<button data-a="kldel" data-p="${i.id}" aria-label="${ES('Remover')}" title="${ES('Remover')}">✕</button>` : ''}</div>`).join('') || `<p class="mu">${ES('Nenhum material ainda.')}</p>`}
    <details class="kadd"><summary>${ES('Adicionar material próprio')}</summary><input id="kl-t" maxlength="160" placeholder="${ES('Título (ex.: Protocolo local de HAS)')}"><textarea id="kl-b" rows="5" maxlength="30000" placeholder="${ES('Cole o texto do protocolo ou da conduta…')}"></textarea><label class="chk2"><input type="checkbox" id="kl-s"> ${ES('Compartilhar com outros usuários (material geral)')}</label><button class="pbtn" data-a="kladd">${ES('Salvar material')}</button></details>`;
  const libOrd = () => { const o = K.order; if (!o) return `<p class="mu">${ES('Carregando…')}</p>`; return `<p class="mu">${ES('Define a prioridade das fontes usada pelo apoio cognitivo, familiograma e ecomapa. Padrão: Ministério da Saúde → sociedades → OMS → material do usuário → geral.')}</p>${o.map((k, i) => `<div class="klib"><div><b>${i + 1}. ${ES(TIERS[k] || k)}</b></div><button data-a="kord" data-p="${i}|-1" aria-label="${ES('Subir')}" ${i === 0 ? 'disabled' : ''}>↑</button><button data-a="kord" data-p="${i}|1" aria-label="${ES('Descer')}" ${i === o.length - 1 ? 'disabled' : ''}>↓</button></div>`).join('')}<div class="krow"><button class="pbtn" data-a="kordsave">${ES('Salvar hierarquia')}</button><button data-a="kordreset">${ES('Restaurar padrão')}</button></div><small class="mu">${ES('Só o administrador altera. Vale para todos os usuários.')}</small>`; };
  A.kord = p => { const [i, d] = String(p).split('|').map(Number), o = K.order, j = i + d; if (!o || j < 0 || j >= o.length) return; [o[i], o[j]] = [o[j], o[i]]; renderWin('lib'); };
  A.kordreset = () => { K.order = ['ministerio', 'sociedade', 'oms', 'personal', 'geral']; renderWin('lib'); };
  A.kordsave = async () => { try { await api('/admin/protocol-order', { m: 'PUT', b: { order: K.order } }); toast('Hierarquia protocolar salva'); } catch (e) { toast(e.message); } };
  const libPref = () => `<p class="mu">${ES('Para terapêutica e farmacologia o apoio segue o Ministério da Saúde, exceto onde você registrar uma preferência da sua unidade.')}</p>${!K.prefs ? `<p class="mu">${ES('Carregando…')}</p>` : K.prefs.map((p, i) => `<div class="klib"><div><b>${E(p.topic)}</b><small>${E(p.text)}</small></div><button data-a="kprm" data-p="${i}" aria-label="${ES('Remover')}">✕</button></div>`).join('') || `<p class="mu">${ES('Nenhuma preferência registrada.')}</p>`}<div class="kadd2"><input id="kp-t" maxlength="80" placeholder="${ES('Tema (ex.: hipertensão)')}"><textarea id="kp-x" rows="3" maxlength="600" placeholder="${ES('Preferência da unidade (ex.: 1ª linha losartana 50 mg conforme RENAME local)')}"></textarea><button class="pbtn" data-a="kpadd">${ES('Registrar preferência')}</button></div>`;
  const RIBS = {
    trans: () => RIB('Transcrição', ES(WD.trans.t), [['live', 'Ao vivo', 'ktab', 'trans:live', K.tab.trans === 'live'], ['list', 'Estruturada', 'ktab', 'trans:est', K.tab.trans === 'est']]),
    hist: () => RIB('Histórico', ES(WD.hist.t), [['ref', 'Atualizar', 'kmins'], ['copy', 'Copiar tudo', 'kcopymins']]),
    sup: () => RIB('Apoio cognitivo', ES(WD.sup.t), [['ref', 'Atualizar agora', 'ksup']]),
    rep: () => RIB('Relatório', ES(WD.rep.t), [['gen', K.rep && K.rep.md ? 'Gerar de novo' : 'Gerar relatório (IA)', 'krepgen'], K.rep && K.rep.md ? ['edit', K.repEdit ? 'Visualizar' : 'Editar', 'krepedit', null, K.repEdit] : null, K.rep && K.rep.md ? ['save', 'Salvar', 'krepsave'] : null, K.rep && K.rep.md ? ['copy', 'Copiar', 'krepcopy'] : null, K.rep && K.rep.md ? ['print', 'Imprimir / PDF', 'krepprint'] : null]),
    lib: () => RIB('Biblioteca', ES(WD.lib.t), [['book', 'Materiais', 'ktab', 'lib:mat', K.tab.lib === 'mat'], ['sliders', 'Preferências locais', 'ktab', 'lib:pref', K.tab.lib === 'pref'], S.me && S.me.role === 'admin' ? ['order', 'Hierarquia protocolar', 'ktab', 'lib:ord', K.tab.lib === 'ord'] : null])
  };
  function winEl(id) { return document.querySelector(`.cw2[data-w="${id}"]`); }
  function renderWin(id, full) {
    const w = K.wins[id], d = WD[id]; let el = winEl(id); if (!w || w.st === 'closed') { if (el) el.remove(); return; }
    if (w.st === 'open' || w.st === 'max' || w.st === 'fold') w.lm = w.st;
    if (!el) { el = document.createElement('article'); el.className = 'cw2'; el.dataset.w = id; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', d.t); layer().append(el); full = true; }
    if (full) el.innerHTML = `<header class="cw2h" data-wh title="${ES('Arraste para mover · duplo clique recolhe/abre')}"><span class="cw2i" style="--pc:${d.c}">${ic(d.i, 15)}</span><b>${ES(d.t)}</b><span class="sp"></span><button data-a="kwmin" data-p="${id}" aria-label="${ES('Iconificar na barra')}" title="${ES('Iconificar na barra')}">▁</button><button data-a="kwmax" data-p="${id}" aria-label="${ES('Maximizar')}" title="${ES('Maximizar')}">⤢</button><button data-a="kwx" data-p="${id}" aria-label="${ES('Fechar')}" title="${ES('Fechar')}">✕</button></header><div class="cw2b" data-sc></div>`;
    el.className = `cw2 ${w.st === 'fold' ? 'fold' : ''} ${w.st === 'max' ? 'max' : ''}`; el.style.cssText = w.st === 'max' ? `z-index:${w.z}` : `left:${w.x}px;top:${w.y}px;width:${w.w}px;height:${w.st === 'fold' ? 'auto' : w.h + 'px'};z-index:${w.z};--pc:${d.c}`;
    const b = el.querySelector('.cw2b'), sc = b.scrollTop; b.innerHTML = BODY[id](); b.scrollTop = sc;
    if (id === 'trans' && K.tab.trans === 'live') { const l = b.querySelector('#klive'); if (l && K.stick !== false) l.scrollTop = l.scrollHeight; }
  }
  const renderAll = () => { Object.keys(K.wins).forEach(id => renderWin(id)); renderBar(); };
  const closeAll = except => { Object.keys(K.wins).forEach(x => { if (x !== except && K.wins[x].st && K.wins[x].st !== 'closed') { K.wins[x].st = 'closed'; if (x === 'sup') K.supOn = false; renderWin(x); } }); renderBar(); };
  function openWin(id) {
    closeAll(id); if (typeof CW !== 'undefined') { CW.forEach(x => { if (x.st === 'open') x.st = 'min'; }); if (typeof cwRender === 'function') cwRender(); }
    const n = Object.values(K.wins).filter(w => w.st && w.st !== 'closed').length, d = WD[id], W = Wn(), H = Hn(), w = K.wins[id] || (K.wins[id] = { st: 'closed', x: Math.max(8, W - d.w - 20 - n * 26), y: 70 + n * 30, w: Math.min(d.w, W - 16), h: Math.min(d.h, H - 100), z: 0 });
    w.st = w.lm || 'open'; w.z = ++K.z; w.x = Math.max(0, Math.min(w.x, W - 120)); w.y = Math.max(0, Math.min(w.y, H - 60)); renderWin(id, true); renderBar();
    if (id === 'hist') A.kmins(); if (id === 'lib') loadLib(); if (id === 'rep') loadRep(); if (id === 'sup') { K.supOn = true; if (!K.sup) A.ksup(); }
  }
  A.kopen = id => { const w = K.wins[id]; if (w && w.st && w.st !== 'closed') { w.st = 'closed'; renderWin(id); renderBar(); } else openWin(id); };
  A.kwmin = id => { if (id === 'fam') { K.wins[id].st = 'fold'; renderWin(id); return; } K.wins[id].st = 'closed'; renderWin(id); renderBar(); toast('Iconificada na barra de tarefas'); };
  A.kwx = id => { K.wins[id].st = 'closed'; if (id === 'sup') K.supOn = false; renderWin(id); renderBar(); };
  A.kwmax = id => { const w = K.wins[id]; w.st = w.st === 'max' ? 'open' : 'max'; w.z = ++K.z; renderWin(id); };
  document.addEventListener('dblclick', e => { const h = e.target.closest && e.target.closest('[data-wh]'); if (h && !e.target.closest('button')) { const id = h.closest('.cw2').dataset.w, w = K.wins[id]; w.st = w.st === 'fold' ? 'open' : 'fold'; renderWin(id); } });
  A.kdismiss = () => { K.ended = false; Object.keys(K.wins).forEach(id => { K.wins[id].st = 'closed'; renderWin(id); }); renderBar(); };
  A.ktab = p => { const [w, t] = String(p).split(':'); K.tab[w] = t; renderWin(w); if (w === 'lib') { loadLib(); } };
  /* ---------- transcrição ---------- */
  A.ktr = async () => {
    if (!K.aid) return; const on = !K.tr.on;
    try {
      if (on && !S.me.ai_consent) { if (!confirm('Autorizo a transcrição por IA neste atendimento (o paciente será consultado antes).')) { renderWin('trans'); return; } await api('/me/consent', { m: 'PATCH', b: { aiConsent: true } }); S.me.ai_consent = true; }
      await api(`/consults/${K.aid}/transcription`, { m: 'PUT', b: { on } }); K.tr.on = on; if (!on) K.tr.consent = K.tr.consent;
      CALL.rec = on && !CALL.demo; if (CALL.rec) recLoop(); if (on) { K.tr.consent = null; if (!K.wins.hist) { } } K.supN = -1;
    } catch (e) { toast(e.message || 'Não foi possível alterar a transcrição'); }
    renderAll(); poll();
  };
  async function poll() {
    if (!K.on || !K.aid || !isPro()) return;
    try {
      const st = await api(`/consults/${K.aid}/state`); K.tr.on = !!st.transcribing; K.tr.consent = st.patientConsent;
      if (K.tr.on) { const lv = await api(`/consults/${K.aid}/live` + (K.since ? `?since=${encodeURIComponent(K.since)}` : '')); if (lv.segments.length) { K.segs.push(...lv.segments); K.since = lv.segments[lv.segments.length - 1].at; } K.inter = lv.interactions || []; K.risks = lv.risks || [];
        for (const k of [...K.inter.filter(i => i.sev === 'grave').map(i => `i:${i.a}+${i.b}`), ...K.risks.map(r => 'r:' + r)]) if (!K.seen.has(k)) { K.seen.add(k); toast(k.startsWith('i:') ? '⚠ Interação medicamentosa grave detectada' : '⚠ Sinal de alerta na consulta'); }
        if (K.segs.length > K.structN && Date.now() - (K.structAt || 0) > 40000 && S.me.ai_consent) { K.structAt = Date.now(); K.structN = K.segs.length; api(`/consults/${K.aid}/structure`, { m: 'POST', b: { lang: clang() } }).then(r => { if (r.structured) { K.struct = r.structured; renderWin('trans'); } }).catch(() => {}); }
        if (K.supOn && !K.supBusy && K.segs.length !== K.supN && Date.now() - K.supAt > 35000) A.ksup(); }
      renderWin('trans'); if (K.wins.sup && K.wins.sup.st !== 'closed') renderWin('sup'); renderBar();
    } catch { /* tenta no próximo ciclo */ }
  }
  A.ksup = async () => {
    if (!K.aid || K.supBusy) return; K.supBusy = true; K.supErr = ''; K.supAt = Date.now(); K.supN = K.segs.length; K.supOn = true; renderWin('sup'); renderBar();
    try { K.sup = await api(`/consults/${K.aid}/support`, { m: 'POST', b: { lang: clang() } }); } catch (e) { K.supErr = e.message || 'IA indisponível no momento; o atendimento segue normalmente.'; }
    K.supBusy = false; renderWin('sup'); renderBar();
  };
  A.kmins = async () => { try { K.mins = (await api(`/consults/${K.aid}/minutes`)).minutes; } catch { K.mins = []; } renderWin('hist'); };
  A.kcopymins = async () => { const t = (K.mins || []).map(m => `${m.label}\n` + m.lines.map(l => `[${l.t}] ${l.who}: ${l.text}`).join('\n')).join('\n\n'); try { await navigator.clipboard.writeText(t); toast('Copiado'); } catch { toast('Não foi possível copiar'); } };
  /* ---------- relatório ---------- */
  async function loadRep() { try { const r = await api(`/consults/${K.aid}/report`); if (r.md && !(K.rep && K.rep.md)) K.rep = { ...r }; else if (!K.rep) K.rep = { ...r, md: null }; } catch { /* sem relatório */ } renderWin('rep'); }
  A.krepgen = async () => { K.repBusy = true; K.tab.err = 'rep'; K.supErr = ''; renderWin('rep'); try { const r = await api(`/consults/${K.aid}/report`, { m: 'POST', b: { lang: clang() } }); K.rep = { ...(K.rep || {}), md: r.md, at: r.generatedAt }; K.repEdit = false; } catch (e) { K.supErr = e.message; } K.repBusy = false; renderWin('rep'); };
  A.krepedit = () => { const t = document.getElementById('krep'); if (K.repEdit && t) K.rep.md = t.value; K.repEdit = !K.repEdit; renderWin('rep'); };
  A.krepsave = async () => { const t = document.getElementById('krep'); if (t) K.rep.md = t.value; try { await api(`/consults/${K.aid}/report`, { m: 'PUT', b: { md: K.rep.md } }); toast('Relatório salvo'); } catch (e) { toast(e.message); } };
  A.krepcopy = async () => { const t = document.getElementById('krep'); if (t) K.rep.md = t.value; try { await navigator.clipboard.writeText(K.rep.md); toast('Copiado'); } catch { toast('Não foi possível copiar'); } };
  A.krepprint = () => {
    const t = document.getElementById('krep'); if (t) K.rep.md = t.value; const r = K.rep || {}, esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const root = document.createElement('div'); root.id = 'printroot'; root.setAttribute('lang', clang());
    root.innerHTML = `<header class="pr-h"><div>Talk.M3D</div><div>${esc(ES('Relatório da consulta'))}</div></header><h1 class="pr-t">${esc(ES('Relatório de evolução da consulta'))}</h1><p class="pr-m">${esc(ES('Paciente'))}: ${esc(r.patient || '')} · ${esc(ES('Data'))}: ${esc(String(r.appointmentAt || new Date().toISOString()).slice(0, 10))}</p><section class="pr-b">${mdH(r.md || '')}</section>`;
    document.body.append(root); document.body.classList.add('printing');
    const done = () => { document.body.classList.remove('printing'); root.remove(); removeEventListener('afterprint', done); }; addEventListener('afterprint', done); setTimeout(() => window.print(), 60);
  };
  /* ---------- biblioteca e preferências ---------- */
  async function loadLib() { if (S.me && S.me.role === 'admin') { try { K.order = (await api('/admin/protocol-order')).order; } catch { K.order = null; } } try { K.lib = await api('/library'); } catch { K.lib = []; } try { K.prefs = (await api('/me/clinical-prefs')).local; } catch { K.prefs = []; } renderWin('lib'); }
  A.kladd = async () => { const t = document.getElementById('kl-t'), b = document.getElementById('kl-b'), s = document.getElementById('kl-s'); if (!t.value.trim() || b.value.trim().length < 10) return toast('Informe título e conteúdo'); try { await api('/library', { m: 'POST', b: { tier: 'personal', title: t.value.trim(), body: b.value.trim(), shared: !!s.checked, country: (S.me.country || 'BR') } }); toast('Material salvo'); await loadLib(); } catch (e) { toast(e.message); } };
  A.kldel = async id => { try { await api('/library/' + id, { m: 'DELETE' }); await loadLib(); } catch (e) { toast(e.message); } };
  const savePrefs = async () => { await api('/me/clinical-prefs', { m: 'PUT', b: { local: K.prefs } }); renderWin('lib'); toast('Preferências salvas'); };
  A.kpadd = async () => { const t = document.getElementById('kp-t'), x = document.getElementById('kp-x'); if (!t.value.trim() || !x.value.trim()) return toast('Informe tema e preferência'); K.prefs = [...(K.prefs || []), { topic: t.value.trim(), text: x.value.trim() }]; try { await savePrefs(); } catch (e) { toast(e.message); } };
  A.kprm = async i => { K.prefs = K.prefs.filter((_, k) => k !== +i); try { await savePrefs(); } catch (e) { toast(e.message); } };
  A.libopen = () => { K.tab.lib = K.tab.lib || 'mat'; openWin('lib'); };
  A.kpro = p => { const [id, modo] = String(p).split('|'); if (modo === 'agendar') { A.view('agenda'); toast('Abra a agenda e marque com este profissional'); } else if (typeof openPeer === 'function') { K.mode = 'mini'; applyCall(); openPeer(id).then(() => render()).catch(() => {}); } };
  const _view = A.view; A.view = (v, ...r) => v === 'biblioteca' ? A.libopen() : _view(v, ...r);
  /* ---------- paciente: consentimento ---------- */
  async function patientPoll() {
    if (!K.on || !K.aid || isPro()) return;
    try {
      const st = await api(`/consults/${K.aid}/state`), box = document.getElementById('ccon'); K.pNeed = !!st.needsConsent; if (K.pNeed && K.mode === 'mini') { K.mode = 'win'; applyCall(); }
      if (box) { box.hidden = !K.pNeed; if (K.pNeed) box.innerHTML = `<p><b>${ES('O profissional quer transcrever a consulta')}</b> ${ES('(áudio → texto) para o seu prontuário. Só ele terá acesso. Você aceita?')}</p><div><button class="pbtn" data-a="kcon" data-p="1">${ES('Aceitar')}</button><button data-a="kcon" data-p="0">${ES('Recusar')}</button></div>`; }
      const want = st.transcribing && st.consent === true; if (want && !K.pRec && !CALL.demo) { K.pRec = true; CALL.rec = true; recLoop(); } if (!want && K.pRec) { K.pRec = false; CALL.rec = false; }
    } catch { /* ignora */ }
  }
  A.kcon = async v => { try { await api(`/consults/${K.aid}/consent`, { m: 'PUT', b: { consent: v === '1' } }); toast(v === '1' ? 'Transcrição autorizada' : 'Transcrição recusada'); } catch (e) { toast(e.message); } patientPoll(); };
  /* ---------- ciclo da chamada ---------- */
  function onCall(on) {
    if (on) {
      decorate(); K.on = true; K.ended = false; K.aid = CALL.aid || K.aid; K.mode = 'win'; applyCall();
      Object.assign(K, { tr: { on: false, consent: null }, since: null, segs: [], inter: [], risks: [], seen: new Set(), struct: null, structN: 0, sup: null, supOn: false, supN: -1, supErr: '', mins: null, rep: null, pRec: false, structAt: 0 });
      Object.keys(K.wins).forEach(id => { K.wins[id].st = 'closed'; renderWin(id); }); renderBar(); K.timers.forEach(clearInterval); K.timers = [setInterval(poll, 4000), setInterval(patientPoll, 5000)]; poll(); patientPoll();
    } else {
      K.on = false; K.timers.forEach(clearInterval); K.timers = []; K.pRec = false; const hadSegs = K.segs.length; K.ended = isPro() && hadSegs > 0;
      if (K.tr.on && K.aid && isPro()) api(`/consults/${K.aid}/transcription`, { m: 'PUT', b: { on: false } }).catch(() => {}); K.tr.on = false;
      if (K.ended) { toast('Chamada encerrada. O histórico e o relatório continuam na barra de tarefas.'); openWin('rep'); } else { Object.keys(K.wins).forEach(id => { K.wins[id].st = 'closed'; renderWin(id); }); }
      renderBar();
    }
  }
  const boot = () => { const c = document.getElementById('call'); if (!c) return false; let was = c.classList.contains('on'); new MutationObserver(() => { const n = c.classList.contains('on'); if (n !== was) { was = n; onCall(n); } }).observe(c, { attributes: true, attributeFilter: ['class'] }); return true; };
  if (!boot()) addEventListener('DOMContentLoaded', boot);
  addEventListener('resize', () => { applyCall(); });
  // demonstração (sem SDK de vídeo): chamada simulada para visualizar a janela e as ferramentas
  const _callWith = callWith, _leave = leave;
  callWith = async id => {
    if (window.AgoraRTC) return _callWith(id);
    await run(async () => {
      let a; try { a = await api('/agenda/current?with=' + id); } catch { a = { id: 'demo' }; } CALL.aid = a.id; CALL.demo = true; const peer = (S.room && S.room.name) || 'Paciente';
      $('#rv').innerHTML = `<div class="tile" id="r1"><div class="kfake"><span>${E(String(peer).replace('# ', '').slice(0, 2).toUpperCase())}</span><small>${E(peer)}</small></div></div>`; $('#lv').innerHTML = `<div class="kfake me"><span>${E(String(S.me.name || 'V').slice(0, 2).toUpperCase())}</span><small>${ES('Você')}</small></div>`; $('#call').classList.add('on');
    });
  };
  leave = async () => { if (CALL.demo) { CALL.demo = false; CALL.rec = false; $('#call').classList.remove('on'); return; } return _leave(); };
  const _out = A.out; if (_out) A.out = (...a) => { if (K.on) { CALL.demo = false; $('#call').classList.remove('on'); } A.kdismiss(); return _out(...a); };
  const reg = (id, d, body, rib) => { WD[id] = d; BODY[id] = body; if (rib) RIBS[id] = rib; };
  const winOn = id => { const w = K.wins[id]; return !!(w && w.st && w.st !== 'closed'); };
  A.kt = tab => { K.tab.trans = tab; if (winOn('trans')) renderWin('trans'); else openWin('trans'); };
  const callRib = () => RIB('Videochamada', 'Consulta', [
    [IC.mic, K.tr.on ? 'Transcrição ligada — clique para desligar' : 'Ligar transcrição da consulta', 'ktr', null, K.tr.on, '#d9363e'],
    ['live', 'Transcrição ao vivo', 'kt', 'live', winOn('trans') && K.tab.trans === 'live', '#e5603c'],
    ['list', 'Transcrição estruturada', 'kt', 'est', winOn('trans') && K.tab.trans === 'est', '#3a8f5c'],
    K.tr.on || K.segs.length ? [IC.clock, 'Histórico por minuto', 'kopen', 'hist', winOn('hist'), '#2481cc'] : null,
    [IC.brain, 'Apoio cognitivo: resumo, caso e condutas', 'kopen', 'sup', winOn('sup'), K.inter.some(i => i.sev === 'grave') ? '#e0a526' : '#7c6bd6'],
    K.segs.length ? [IC.doc, 'Relatório da consulta', 'kopen', 'rep', winOn('rep'), '#2a9d8f'] : null,
    [IC.book, 'Biblioteca e preferências', 'kopen', 'lib', winOn('lib'), '#c9822b'],
    ['shrink', K.mode === 'mini' ? 'Restaurar chamada' : 'Iconificar chamada', 'cbmin'], ['open', K.mode === 'max' ? 'Reduzir chamada' : 'Maximizar chamada', 'cbmax']]);
  RBP.push(() => { const callOn = barVisible(), o = Object.entries(K.wins).filter(([, w]) => w.st && w.st !== 'closed').sort((a, b) => b[1].z - a[1].z)[0], wr = o && RIBS[o[0]] ? RIBS[o[0]]() : ''; if (!callOn && !wr) return null; return { pri: o ? 1000 + o[1].z : 500, key: o ? 'w:' + o[0] : 'call', col: o ? WD[o[0]].c : '#d9363e', close: o ? () => A.kwx(o[0]) : null, html: (callOn ? callRib() : '') + wr }; });
  window.CONSULTA = { K, openWin, onCall, reg, renderWin, closeAll: () => closeAll() };
})();
