'use strict';
/* ===== Interface v2 =====
   Menu em tópicos com ícones (estilo caixa de e-mail), presença online, mapa de relações com legenda e detalhe,
   bloco de anotações, calendário de tarefas em post-its com foco no paciente, resumo visual de desenvolvimento global e ajuda.
   Carregado depois de app.js; amplia as funções existentes sem alterar a API do servidor. */
const T2 = s => window.I18N ? I18N.t(s) : s;
const LOC = { pt: 'pt-BR', es: 'es', gn: 'es-PY', en: 'en', zh: 'zh-CN' }, lng = () => window.I18N ? I18N.lang : 'pt';
const dloc = (d, o) => E(d.toLocaleDateString(LOC[lng()] || 'pt-BR', o));
const pad2 = n => String(n).padStart(2, '0'), ymd = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const ICO = {
  agenda: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  cal: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 14h2M12 14h2M8 17h2"/>',
  fin: '<circle cx="12" cy="12" r="9"/><path d="M14.5 9.5c-.5-1-1.5-1.5-2.5-1.5-1.5 0-2.5.8-2.5 2s1 1.7 2.5 2 2.5.8 2.5 2-1 2-2.5 2c-1 0-2-.5-2.5-1.5M12 6v2M12 16v2"/>',
  audit: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  users: G.ppl, chan: '<path d="M5 9h14M5 15h14M10 4L8 20M16 4l-2 16"/>', hist: CI.hist, net: CI.net, note: G.note,
  integ: '<path d="M9 3v5M15 3v5M7 8h10v4a5 5 0 01-10 0zM12 17v4"/>',
  bell: '<path d="M6 16v-5a6 6 0 0112 0v5l2 2H4zM10 20a2 2 0 004 0"/>',
  cfg: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>',
  out: '<path d="M10 4H5v16h5M15 8l4 4-4 4M19 12H9"/>', help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 114 2c-1 .6-1.5 1-1.5 2M12 17v.5"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>'
};
/* ---------- bloco de anotações (somente neste navegador) ---------- */
const NB = {
  get() { try { return JSON.parse(localStorage.getItem('m3d_nb_' + S.me.id)) || []; } catch { return []; } },
  set(a) { try { localStorage.setItem('m3d_nb_' + S.me.id, JSON.stringify(a.slice(0, 200))); } catch { toast('Não foi possível salvar neste navegador'); } }
};
/* ---------- presença online ---------- */
const isOn = id => { const c = S.con.find(x => x.id === id); return !!(c && c.online); };
const stOf = id => { const c = S.con.find(x => x.id === id); return c ? (c.status || (c.online ? 'online' : 'offline')) : 'offline'; }, STL = { online: 'Online', busy: 'Ocupado', offline: 'Offline' };
const onDot = id => { const t = stOf(id); return `<i class="onl ${t === 'offline' ? '' : t === 'busy' ? 'on busy' : 'on'}" title="${STL[t]}" role="img" aria-label="${STL[t]}"></i>`; };
let presT = 0;
function startPresence() {
  clearInterval(presT);
  presT = setInterval(async () => {
    if (!S.me || document.hidden) return;
    try { const c = await api('/contacts'), sig = x => x.map(a => a.id + (a.status || (a.online ? 1 : 0))).join(); if (sig(c) !== sig(S.con)) { S.con = c; const l = $('aside.list'); if (l) l.innerHTML = listH(); if (S.view === 'tarefas' || S.cal) { const p = $('aside.panel'); if (p) p.innerHTML = panelH(); } } } catch { /* offline */ }
  }, 30000);
}
/* ---------- menu em tópicos, com ícones ---------- */
const sortB = (k, b) => { const o = lay().ord[k] || [], ix = id => o.indexOf(id) < 0 ? 99 : o.indexOf(id); return b.sort((x, y) => ix(x.id) - ix(y.id)); };
const _rb = railBlocks;
railBlocks = function (k) {
  const r = S.me.role, adm = ['admin', 'recepcao', 'funcionario'].includes(r);
  if (k === 'users') return _rb(k).map(b => ({ ...b, icon: b.custom ? ICO.star : ICO.users }));
  if (k === 'canais') return _rb(k).map(b => ({ ...b, icon: ICO.chan, items: b.items.map(x => ({ ...x, i: 'chan' })) }));
  const L = (id, title, color, icon, items) => ({ id, title, kind: 'links', color, icon, items });
  let b = [];
  if (k === 'gestao') {
    b.push(L('g:agenda', 'Agenda e atendimento', '#2a9d8f', ICO.agenda, [{ t: 'Agenda Visual', a: 'view', p: 'agenda', i: 'agenda' }, { t: 'Tarefas e calendário', a: 'view', p: 'tarefas', i: 'cal' }]));
    if (adm) b.push(L('g:fin', 'Financeiro', '#3d9b5e', ICO.fin, [{ t: 'Financeiro', a: 'view', p: 'fin', i: 'fin' }]));
    if (adm) { const it = [{ t: 'Cadastro de usuários', a: 'view', p: 'users', i: 'users' }]; if (r === 'admin') it.push({ t: 'Integrações', a: 'view', p: 'integ', i: 'integ' }, { t: 'Auditoria', a: 'view', p: 'audit', i: 'audit' }); b.push(L('g:adm', 'Administração', '#5b6abf', ICO.audit, it)); }
  } else if (k === 'relat') {
    b.push(L('g:acomp', 'Acompanhamento', '#d19a1a', ICO.hist, [{ t: 'Histórico de atividades', a: 'view', p: 'hist', i: 'hist' }, { t: 'Notificações', a: 'view', p: 'notif', i: 'bell', n: S.nc || 0 }]));
    b.push(L('g:analise', 'Análise', '#c26a3c', ICO.net, [{ t: 'Relações (3D)', a: 'view', p: 'grafo', i: 'net' }, { t: 'Bloco de anotações', a: 'view', p: 'notas', i: 'note', n: NB.get().length }]));
  } else {
    b.push(L('g:pref', 'Preferências', '#708090', ICO.cfg, [{ t: 'Configurações', a: 'view', p: 'cfg', i: 'cfg' }, { t: 'Ajuda e guia', a: 'help', p: '', i: 'help' }]));
    b.push(L('g:sessao', 'Sessão', '#8a6d9e', ICO.out, [{ t: 'Sair', a: 'out', p: '', i: 'out' }]));
  }
  return sortB(k, b);
};
rowH = function (b, x) {
  if (b.kind === 'users') {
    const on = S.view === 'chat' && S.room && S.room.peer === x.id, o = !!x.online;
    return `<div class="bkr ${on ? 'on' : ''}" role="listitem" draggable="true" data-cd="${x.id}"><button class="bkn" data-a="peer" data-p="${x.id}"><span class="av sm pr">${ini(x.name)}<i class="onl ${stOf(x.id) === 'offline' ? '' : stOf(x.id) === 'busy' ? 'on busy' : 'on'}"></i></span><span class="tx"><b>${E(x.name)}</b><small>${x.cargo ? E(x.cargo) : ES(ROLE[x.role])} · <span class="${stOf(x.id) === 'busy' ? 'bzt' : o ? 'okt' : ''}">${stOf(x.id) === 'busy' ? 'ocupado' : o ? 'online' : 'offline'}</span></small></span></button><button class="bkm" data-a="cmv" data-p="${x.id}" aria-label="Mover ${E(x.name)} para outro grupo" title="Mover para outro grupo">⋮</button></div>`;
  }
  const on = x.a === 'view' ? S.view === x.p : x.a === 'chan' ? S.room && S.room.key === 'ch:' + x.p : false, lab = x.a === 'chan' ? E(x.t) : x.a === 'out' ? `${ES('Sair')} (${E(S.me.name)})` : ES(x.t);
  return `<div class="bkr bkl ${on ? 'on' : ''}" role="listitem"><button class="bkn" data-a="${x.a}" data-p="${x.p}"><span class="lic" aria-hidden="true">${ic(ICO[x.i] || ICO.note, 17)}</span><span class="tx"><b>${lab}</b></span>${x.n ? `<span class="bdg2" aria-label="${x.n} itens">${x.n}</span>` : ''}</button></div>`;
};
blockH = function (b, k, i, n) {
  const L = lay(), col = !!L.col[b.id], q = S.q[b.id] || '', user = b.kind === 'users', pac = b.id === 'u:pac', only = pac && S.onlyOn;
  const nOn = pac ? b.items.filter(c => c.online).length : 0; let base = only ? b.items.filter(c => c.online) : b.items;
  const scroll = user && base.length > L.max, items = user && q ? base.filter(c => norm(c.name).includes(norm(q))) : base, tit = b.custom ? E(b.title) : ES(b.title);
  const rows = items.map(x => rowH(b, x)).join('') || `<div class="mu bkempty">${user ? (q ? 'Nenhum resultado.' : only ? 'Nenhum paciente online agora.' : 'Arraste contatos para cá.') : ''}</div>`;
  const badge = b.kind === 'links' ? b.items.reduce((a, x) => a + (x.n || 0), 0) : 0;
  const onbar = pac ? `<div class="onbar"><span class="${nOn ? 'okt' : 'mu'}"><i class="onl ${nOn ? 'on' : ''}"></i> ${nOn ? (nOn === 1 ? '1 paciente online agora' : nOn + ' pacientes online agora') : 'Nenhum paciente online'}</span><button class="lk" data-a="onlyon" aria-pressed="${!!only}">${only ? 'Mostrar todos' : 'Só online'}</button></div>` : '';
  return `<section class="bk" style="--bkc:${b.color}" data-bk="${E(b.id)}"><header class="bkh" ${user ? `data-cdrop="${E(b.id)}"` : ''}><button class="bkt" data-a="bkt" data-p="${E(b.id)}" aria-expanded="${!col}"><span class="chv" aria-hidden="true">${col ? '▸' : '▾'}</span><span class="bki" aria-hidden="true">${ic(b.icon || ICO.star, 15)}</span><b>${tit}</b>${pac && nOn ? `<span class="cnt on"><i class="onl on"></i>${nOn}</span>` : ''}<span class="cnt ${badge && col ? 'hot' : ''}">${b.kind === 'links' ? (badge || b.items.length) : b.items.length}</span></button><span class="bkctl">${n > 1 ? `<button data-a="bkup" data-p="${E(b.id)}" aria-label="Subir bloco" ${i ? '' : 'disabled'}>▲</button><button data-a="bkdn" data-p="${E(b.id)}" aria-label="Descer bloco" ${i < n - 1 ? '' : 'disabled'}>▼</button>` : ''}${b.custom ? `<button data-a="grren" data-p="${b.custom}" aria-label="Renomear grupo">✎</button><button data-a="grdel" data-p="${b.custom}" aria-label="Excluir grupo">×</button>` : ''}</span></header>${col ? '' : `${onbar}${scroll ? `<div class="bks"><input id="q-${cid(b.id)}" data-i="bq" data-p="${E(b.id)}" type="search" placeholder="Buscar neste bloco" aria-label="Buscar em ${tit}" value="${E(q)}" autocomplete="off"></div>` : ''}<div class="bkb" ${scroll ? `style="max-height:${L.max * 46}px;overflow-y:auto"` : ''} role="list" ${scroll ? 'tabindex="0" aria-label="Lista rolável"' : ''}>${rows}</div>`}</section>`;
};
listH = function () {
  const k = railKeys().includes(S.rail) ? S.rail : 'users', bl = railBlocks(k), bell = S.me.role !== 'paciente' ? `<button class="bell" data-a="view" data-p="notif" aria-label="Notificações${S.nc ? ': ' + S.nc + ' novas' : ''}">${ic(ICO.bell, 22)}${S.nc ? `<span class="bdg">${S.nc}</span>` : ''}</button>` : '';
  return `<div class="brand"><img src="/logo.png" alt=""><span translate="no">Talk<b>.M3D</b></span><button class="helpbtn" data-a="help" aria-label="Ajuda e guia passo a passo" title="Ajuda e guia (Alt+G)">?</button>${bell}</div>${window.I18N ? `<div class="langrow" translate="no"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></svg>${I18N.selectHTML()}</div>` : ''}<div class="rail2">${railKeys().map(x => `<button class="${k === x ? 'on' : ''}" data-a="rail" data-p="${x}" aria-label="${RAILS[x][0]}" title="${RAILS[x][0]}">${ic(RAILS[x][1], 20)}</button>`).join('')}</div><div class="bksec"><b>${RAILS[k][0]}</b><span class="bktools"><button class="lk" data-a="lcollapse" title="Recolher todos os blocos" aria-label="Recolher todos os blocos">⊟</button><button class="lk" data-a="lexpand" title="Expandir todos os blocos" aria-label="Expandir todos os blocos">⊞</button>${k === 'users' ? `<button class="lk" data-a="lreset" title="Voltar ao formato original">↺ Restaurar</button>` : ''}</span></div>${bl.map((b, i) => blockH(b, k, i, bl.length)).join('')}${k === 'users' ? `<form class="ngf" data-f="ngroup"><input id="ngn" placeholder="Novo grupo (ex.: Favoritos)" maxlength="40" aria-label="Nome do novo grupo" autocomplete="off"><button class="pbtn">Criar grupo</button></form>` : ''}`;
};
A.onlyon = () => { S.onlyOn = !S.onlyOn; render(); };
A.help = () => { S.lo = false; if (window.HELP) HELP.runApp(); };

/* ---------- mapa de relações: cores por função, legenda, detalhe e anotações ---------- */
const RC = { medico: '#1f88c0', fisio: '#00a39a', enfermeiro: '#e0568a', nutricionista: '#7cb342', farmaceutico: '#5c6bc0', profissional: '#607d8b', cuidador: '#a1887f', recepcao: '#8d9aa5', funcionario: '#8d9aa5', admin: '#455a64' };
const EK = { equipe: ['Vínculo de cuidado', '#1f88c0', []], consulta: ['Consulta marcada', '#c9a400', [7, 4]], atende: ['Profissional atende', '#d98a00', [2, 3]], terapia: ['Terapia prescrita', '#9b59b6', []], 'solicitação': ['Solicitação ou documento', '#e67e22', [9, 3, 2, 3]], atividade: ['Atividade registrada', '#2a9d8f', [1, 4]] };
const gcol = p => p.type === 'staff' ? (RC[p.role] || GC.staff) : (GC[p.type] || '#888'), nkey = p => p.type === 'staff' ? 'staff:' + (p.role || '') : p.type;
const nrole = p => p.type === 'staff' ? (ROLE[p.role] || 'Profissional') : (GN[p.type] || ''), gname = p => (nrole(p) ? T2(nrole(p)) + ' · ' : '') + p.label;
const ek = k => EK[k] || [k, '#808c96', []], gh = () => S.gh || (S.gh = { n: {}, e: {} });
const relOf = i => { const m = {}; S.g.e.forEach(([a, b, k]) => { if (a !== i && b !== i) return; (m[k] = m[k] || []).push(a === i ? b : a); }); return m; };
function ginfo(p) {
  const L = [], c = S.con.find(x => x.id === p.id);
  if ((p.type === 'patient' || p.type === 'staff') && c) L.push(['Situação', c.online ? 'Online' : 'Offline']);
  if (p.type === 'patient') { const o = (S.ov || []).find(x => x.id === p.id); if (o) { if (o.last_eva != null) L.push(['Dor atual (EVA)', o.last_eva + '/10']); if (o.goal != null) L.push(['Meta de dor', '≤ ' + o.goal]); if (o.esp > 0) L.push(['Frequência no plano', Math.round(Math.min(1, o.feito / o.esp) * 100) + '%']); L.push(['Pendências', String(o.pend_ag + o.pend_cl)]); } }
  return L;
}
const gTasks = p => (S.tk || []).filter(t => t.status !== 'done' && (t.patient_id === p.id || t.assignee_id === p.id)).slice(0, 5).map(t => t.title);
function gdetH() {
  const g = S.g, i = g ? g.sel : -1;
  if (!g || i == null || i < 0) return '';
  const p = g.n[i], rel = relOf(i), saved = NB.get().some(c => c.nid === p.id), tk = gTasks(p), c = S.con.find(x => x.id === p.id);
  return `<div class="gdh"><i class="swt" style="background:${gcol(p)}"></i><div><b>${ES(nrole(p))}${nrole(p) ? ' · ' : ''}${E(p.label)}</b><div class="mu">${ES(p.type === 'staff' ? 'Equipe' : GN[p.type])}</div></div><button data-a="gclose" aria-label="Fechar detalhe">×</button></div>
  ${ginfo(p).map(([l, v]) => `<div class="dr"><span class="mu">${ES(l)}</span><b style="margin-left:auto">${ES(v)}</b></div>`).join('')}
  ${tk.length ? `<div class="mu" style="margin-top:6px">Tarefas abertas</div>${tk.map(t => `<div class="gtk">• ${E(t)}</div>`).join('')}` : ''}
  <div class="mu" style="margin-top:8px">Ligações (${Object.values(rel).reduce((a, b) => a + b.length, 0)})</div>
  ${Object.entries(rel).map(([k, js]) => `<div class="grp"><span class="lgk"><svg width="26" height="8" aria-hidden="true"><line x1="1" x2="25" y1="4" y2="4" stroke="${ek(k)[1]}" stroke-width="2.5" stroke-dasharray="${ek(k)[2].join(' ')}" stroke-linecap="round"/></svg>${ES(ek(k)[0])}</span><div>${js.slice(0, 12).map(j => `<button class="chip" data-a="gnb" data-p="${j}"><i class="swt" style="background:${gcol(g.n[j])}"></i>${ES(nrole(g.n[j]))}${nrole(g.n[j]) ? ' · ' : ''}${E(g.n[j].label)}</button>`).join('')}${js.length > 12 ? `<span class="mu"> +${js.length - 12}</span>` : ''}</div></div>`).join('') || '<div class="mu">Sem ligações neste nível. Aumente a complexidade para ver mais.</div>'}
  <div class="gact">${p.type === 'patient' ? `<button data-a="openp" data-p="${p.id}">Abrir paciente</button>` : ''}${p.type === 'staff' && c ? `<button data-a="peer" data-p="${p.id}">Conversar</button>` : ''}${saved ? `<button data-a="view" data-p="notas">Já nas anotações · abrir</button>` : `<button class="pbtn" data-a="gsave">Salvar nas anotações</button>`}</div>`;
}
function glegend() {
  const g = S.g; if (!g) return ''; const H = gh(), nk = [...new Map(g.n.map(p => [nkey(p), p])).entries()], kinds = [...new Set(g.e.map(e => e[2]))];
  return `<div class="glg"><div class="gl1"><span class="mu">Função (cor dos pontos)</span>${nk.map(([k, p]) => `<button class="lgi ${H.n[k] ? 'off' : ''}" data-a="gtn" data-p="${k}" aria-pressed="${!H.n[k]}"><i class="swt" style="background:${gcol(p)}"></i>${ES(nrole(p))}</button>`).join('')}</div><div class="gl1"><span class="mu">Vínculo (tipo de linha)</span>${kinds.map(k => `<button class="lgi ${H.e[k] ? 'off' : ''}" data-a="gte" data-p="${k}" aria-pressed="${!H.e[k]}"><svg width="30" height="10" aria-hidden="true"><line x1="1" x2="29" y1="5" y2="5" stroke="${ek(k)[1]}" stroke-width="2.5" stroke-dasharray="${ek(k)[2].join(' ')}" stroke-linecap="round"/></svg>${ES(ek(k)[0])}</button>`).join('')}</div><div class="mu">Toque em um item da legenda para mostrar ou ocultar. Linhas mais grossas indicam mais atividades.</div></div>`;
}
CENTER.grafo = () => bar('Mapa de relações') + `<div class="cv"><div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center"><span class="mu">Complexidade:</span>${['Equipe e pacientes', '+ Consultas', '+ Terapias, solicitações e atividades'].map((l, i) => `<button class="${S.lv === i + 1 ? 'pbtn' : ''}" data-a="glv" data-p="${i + 1}">${l}</button>`).join('')}</div><div class="gwrap"><div><canvas id="g3" width="900" height="560" role="img" aria-label="Grafo 3D de relações entre equipe, pacientes, consultas, terapias e solicitações" style="width:100%;height:auto;aspect-ratio:900/560;background:var(--sf);border:1px solid var(--ln);border-radius:12px;margin-top:8px;touch-action:none;color:var(--ink)"></canvas>${glegend()}<div class="mu">Arraste para girar, role para aproximar e clique em um item para ver o detalhe.</div></div><aside id="gdet" class="gdet" aria-live="polite">${gdetH()}</aside></div></div>`;
gDraw = function () {
  requestAnimationFrame(gDraw); const c = $('#g3'), g = S.g; if (!c || !g || !c.getContext) return;
  const x = c.getContext('2d'), W = c.width, H = c.height, cy = Math.cos(g.yaw), sy = Math.sin(g.yaw), cp = Math.cos(g.pitch), sp = Math.sin(g.pitch), F = gh(); if (!g.drag) g.yaw += .003;
  const hid = g.n.map(p => !!F.n[nkey(p)]);
  g.P = g.n.map((p, i) => { const X = p.x * cy + p.z * sy, Z0 = -p.x * sy + p.z * cy, Y = p.y * cp - Z0 * sp, Z = p.y * sp + Z0 * cp, s = 420 / (420 + Z) * g.zoom * 2.4; return hid[i] ? { x: -9999, y: -9999, s, z: Z } : { x: W / 2 + X * s, y: H / 2 + Y * s, s, z: Z }; });
  x.clearRect(0, 0, W, H); const ink = getComputedStyle(c).color || '#888';
  g.e.forEach(([i, j, k, w]) => {
    if (hid[i] || hid[j] || F.e[k]) return; const a = g.P[i], b = g.P[j], hot = g.sel >= 0 && (i === g.sel || j === g.sel), st = ek(k);
    x.save(); x.strokeStyle = st[1]; x.globalAlpha = g.sel >= 0 && !hot ? .12 : hot ? 1 : .6; x.lineWidth = hot ? 2.6 : Math.min(3.4, 1.3 + ((w || 1) - 1) * .35); x.setLineDash(st[2]); x.lineCap = 'round'; x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.stroke(); x.restore();
  });
  g.n.map((p, i) => i).filter(i => !hid[i]).sort((a, b) => g.P[b].z - g.P[a].z).forEach(i => {
    const p = g.n[i], q = g.P[i], r = (4 + Math.min(8, p.deg)) * q.s * .7, near = g.sel >= 0 && (i === g.sel || g.e.some(e => !F.e[e[2]] && ((e[0] === g.sel && e[1] === i) || (e[1] === g.sel && e[0] === i))));
    x.globalAlpha = g.sel >= 0 && !near ? .25 : 1; x.fillStyle = gcol(p); x.beginPath(); x.arc(q.x, q.y, r, 0, 7); x.fill();
    if (i === g.sel) { x.strokeStyle = ink; x.lineWidth = 2.5; x.beginPath(); x.arc(q.x, q.y, r + 4, 0, 7); x.stroke(); }
    x.globalAlpha = 1; if (i === g.hover || i === g.sel || p.type === 'staff' || (p.type === 'patient' && g.n.length < 40)) { x.fillStyle = ink; x.font = '12px Inter,sans-serif'; x.fillText(gname(p), q.x + r + 3, q.y + 4); }
  });
};
document.addEventListener('pointerup', e => { if (e.target.id === 'g3' && S.g) S.g.wasDrag = !!(S.g.drag && S.g.drag.m > 6); }, true);
const gDetail = () => { const el = $('#gdet'); if (el) el.innerHTML = gdetH(); };
document.addEventListener('pointerup', e => { if (e.target.id === 'g3' && S.g && !S.g.wasDrag) gDetail(); });
A.gclose = () => { if (S.g) S.g.sel = -1; gDetail(); };
A.gnb = j => { if (S.g) { S.g.sel = +j; gDetail(); } };
A.gtn = k => { const H = gh(); H.n[k] = !H.n[k]; if (S.g && S.g.sel >= 0 && H.n[nkey(S.g.n[S.g.sel])]) S.g.sel = -1; render(); };
A.gte = k => { const H = gh(); H.e[k] = !H.e[k]; render(); };
A.gsave = () => {
  const g = S.g, p = g && g.n[g.sel]; if (!p) return; const nb = NB.get(); if (nb.some(c => c.nid === p.id)) return toast('Este item já está nas anotações');
  const rels = []; Object.entries(relOf(g.sel)).forEach(([k, js]) => js.forEach(j => rels.push({ k, n: g.n[j].label, t: g.n[j].type, r: g.n[j].role || null })));
  nb.unshift({ id: 'n' + Date.now().toString(36), at: Date.now(), nid: p.id, type: p.type, role: p.role || null, name: p.label, lines: ginfo(p), tasks: gTasks(p), rels, text: '' }); NB.set(nb);
  toast('Salvo no bloco de anotações'); gDetail(); const l = $('aside.list'); if (l) l.innerHTML = listH();
};
const nbCard = c => `<article class="nbc" style="--nbc:${c.type === 'staff' ? (RC[c.role] || GC.staff) : GC[c.type] || '#888'}"><header><i class="swt" style="background:var(--nbc)"></i><div><b>${ES(nrole(c))}${nrole(c) ? ' · ' : ''}${E(c.name)}</b><div class="mu">${dloc(new Date(c.at), { day: 'numeric', month: 'short', year: 'numeric' })}</div></div></header>
  ${(c.lines || []).map(([l, v]) => `<div class="dr"><span class="mu">${ES(l)}</span><b style="margin-left:auto">${ES(v)}</b></div>`).join('')}
  ${(c.tasks || []).length ? `<div class="mu">Tarefas abertas</div>${c.tasks.map(t => `<div class="gtk">• ${E(t)}</div>`).join('')}` : ''}
  ${(c.rels || []).length ? `<div class="mu" style="margin-top:6px">Ligações</div>${Object.entries(c.rels.reduce((m, r) => ((m[r.k] = m[r.k] || []).push(r), m), {})).map(([k, rs]) => `<div class="grp"><span class="lgk"><svg width="26" height="8" aria-hidden="true"><line x1="1" x2="25" y1="4" y2="4" stroke="${ek(k)[1]}" stroke-width="2.5" stroke-dasharray="${ek(k)[2].join(' ')}" stroke-linecap="round"/></svg>${ES(ek(k)[0])}</span><div>${rs.slice(0, 10).map(r => `<span class="chip st"><i class="swt" style="background:${r.t === 'staff' ? (RC[r.r] || GC.staff) : GC[r.t] || '#888'}"></i>${E(r.n)}</span>`).join('')}</div></div>`).join('')}` : ''}
  <label class="mu" for="nt-${c.id}">Minha anotação</label><textarea id="nt-${c.id}" rows="3" maxlength="800" data-i="nbt" data-p="${c.id}" placeholder="Escreva uma observação sobre este item">${E(c.text || '')}</textarea>
  <div class="gact"><button data-a="nbmap" data-p="${c.id}">Ver no mapa</button><button data-a="nbdel" data-p="${c.id}">Excluir</button></div></article>`;
CENTER.notas = () => bar('Bloco de anotações') + `<div class="cv"><p class="mu">Cartões salvos a partir do mapa de relações. Ficam só neste navegador, para o seu uso. Apague os que não precisar mais, principalmente em computador compartilhado.</p><div class="nbg">${NB.get().map(nbCard).join('') || '<div class="cd mu">Nenhuma anotação ainda. Abra “Relações (3D)”, clique em um item e escolha “Salvar nas anotações”.</div>'}</div></div>`;
A.nbdel = id => { if (!confirm('Excluir este cartão de anotações?')) return; NB.set(NB.get().filter(c => c.id !== id)); render(); };
A.nbmap = id => run(async () => {
  const c = NB.get().find(x => x.id === id); if (!c) return;
  for (const lv of [S.lv, 2, 3]) { S.lv = lv; await ensureTasks(); await loadGraph(); const i = S.g.n.findIndex(n => n.id === c.nid); if (i >= 0) { S.view = 'grafo'; S.lo = 0; S.g.sel = i; render(); return; } }
  S.view = 'grafo'; render(); toast('Este item não aparece no mapa atual');
});
document.addEventListener('input', e => { const t = e.target; if (t.dataset && t.dataset.i === 'nbt') { const nb = NB.get(), c = nb.find(x => x.id === t.dataset.p); if (c) { c.text = t.value; deb('nb' + c.id, () => NB.set(nb), 400); } } });

/* ---------- calendário de tarefas (post-its), pendências de hoje e foco no paciente ---------- */
const calS = () => { if (!S.cal) { const n = new Date(); let sz = 'std'; try { sz = localStorage.getItem('m3d_cal_sz') || 'std'; } catch { /* sem armazenamento */ } S.cal = { y: n.getFullYear(), m: n.getMonth(), day: ymd(n), sz, ap: [] }; } return S.cal; };
const gridStart = c => { const f = new Date(c.y, c.m, 1); f.setDate(1 - ((f.getDay() + 6) % 7)); return f; };
async function loadCal() {
  if (!S.me) return; const c = calS(), a = gridStart(c), b = new Date(a); b.setDate(b.getDate() + 42);
  try { c.ap = (await api(`/agenda/week?from=${encodeURIComponent(a.toISOString())}&to=${encodeURIComponent(b.toISOString())}`)).appointments || []; } catch { c.ap = []; }
}
async function ensureTasks() { if (S.me && S.me.role !== 'paciente' && !S.tk) { try { S.tk = await api('/tasks'); } catch { S.tk = []; } } }
const todayKey = () => ymd(new Date()), open1 = it => it.k === 't' ? it.status !== 'done' : !['finalizado', 'cancelado', 'faltou'].includes(it.status);
function calItems() {
  const c = calS(), M = {}, today = todayKey(), push = (k, it) => (M[k] = M[k] || []).push(it);
  (S.tk || []).forEach(t => { const d = t.due ? String(t.due).slice(0, 10) : (t.status !== 'done' ? today : null); if (d) push(d, { k: 't', ...t, nodate: !t.due }); });
  c.ap.forEach(a => push(ymd(new Date(a.starts_at)), { k: 'a', ...a }));
  Object.values(M).forEach(l => l.sort((a, b) => (a.k === 'a' ? +new Date(a.starts_at) : 9e15) - (b.k === 'a' ? +new Date(b.starts_at) : 9e15))); return M;
}
const fcs = () => { const f = focus(); return f && (f.t === 'patient' || f.t === 'pro') ? f : null; };
const relf = (it, f) => !!f && (f.t === 'patient' ? it.patient_id === f.id : (it.assignee_id === f.id || it.professional_id === f.id));
function chips(it) {
  const f = (id, name, kind) => { if (!id || !name || id === S.me.id) return ''; const con = S.con.find(x => x.id === id), act = kind === 'p' ? 'openp' : con ? 'peer' : ''; return act ? `<button class="chip" data-a="${act}" data-p="${id}" title="Abrir">${onDot(id)}${E(name)}</button>` : `<span class="chip st">${E(name)}</span>`; };
  return `<div class="chips">${f(it.patient_id, it.patient, 'p')}${it.k === 'a' ? f(it.professional_id, it.professional, 's') : f(it.assignee_id, it.assignee, 's')}</div>`;
}
function itemRow(it, f) {
  const rel = relf(it, f), cls = `pst ${it.k} ${rel ? 'neon' : ''} ${f && !rel ? 'dim' : ''}`;
  if (it.k === 't') { const dn = it.status === 'done'; return `<div class="${cls} ${dn ? 'dn' : ''}"><input type="checkbox" class="tkc" data-a="tkdone" data-p="${it.id}" ${dn ? 'checked' : ''} aria-label="Concluir tarefa"><div class="pb2"><b>${E(it.title)}</b>${it.nodate ? ' <span class="mu">sem data</span>' : ''}${chips(it)}</div></div>`; }
  return `<div class="${cls}"><input type="checkbox" class="tkc" disabled ${it.status === 'finalizado' ? 'checked' : ''} aria-label="Consulta"><div class="pb2"><b>${tm(it.starts_at)}</b> · ${ES('Consulta')} <span class="mu">${ES(SL[it.status] || it.status)}</span>${chips(it)}</div></div>`;
}
function calCell(d, c, M, f) {
  const key = ymd(d), l = M[key] || [], out = d.getMonth() !== c.m, rel = f ? l.filter(i => relf(i, f)) : [], sel = key === c.day, big = c.sz === 'big';
  const pits = (rel.length ? rel : l).slice(0, 3).map(it => `<i class="pit ${it.k} ${relf(it, f) ? 'nn' : ''} ${it.status === 'done' ? 'dn' : ''}"></i>`).join(''), more = l.length > 3 ? `<span class="pm">+${l.length - 3}</span>` : '';
  const txt = big ? (rel.length ? rel : l).slice(0, 2).map(it => `<span class="ptx ${it.k}">${it.k === 'a' ? tm(it.starts_at) + ' ' : ''}${E(it.title || it.patient || '')}</span>`).join('') : '';
  const n = l.filter(open1).length;
  return `<button class="cday ${out ? 'out' : ''} ${key === todayKey() ? 'today' : ''} ${sel ? 'sel' : ''} ${rel.length ? 'hasrel' : ''}" data-a="calday" data-p="${key}" aria-pressed="${sel}" aria-label="${dloc(d, { weekday: 'long', day: 'numeric', month: 'long' })}: ${n} pendentes, ${l.length} itens"><span class="dnum">${d.getDate()}</span><span class="pits">${pits}${more}</span>${txt}</button>`;
}
function dayList(c, M, f) {
  const l = M[c.day] || [], d = new Date(c.day + 'T12:00:00'), mine = f ? l.filter(i => relf(i, f)) : [], rest = f ? l.filter(i => !relf(i, f)) : l;
  return `<div class="dayl"><div class="ah"><b>${dloc(d, { weekday: 'long', day: 'numeric', month: 'long' })}</b><span class="mu">${l.filter(open1).length} ${l.filter(open1).length === 1 ? 'pendente' : 'pendentes'}</span></div>${f && mine.length ? `<div class="mu neont">${f.t === 'patient' ? 'Deste paciente' : 'Desta pessoa'}: ${E(f.name)}</div>${mine.map(i => itemRow(i, f)).join('')}${rest.length ? '<div class="mu" style="margin-top:6px">Outras tarefas do dia</div>' : ''}` : ''}${rest.map(i => itemRow(i, f)).join('')}${l.length ? '' : '<span class="mu">Nada marcado neste dia.</span>'}</div>`;
}
function calBlock(full) {
  const c = calS(), M = calItems(), f = fcs(), sz = full ? (c.sz === 'min' ? 'std' : c.sz) : c.sz, t = M[todayKey()] || [], ma = t.filter(i => i.k === 'a').length, mp = t.filter(i => i.k === 't' && open1(i)).length;
  const tools = `<span class="sp"></span><button data-a="calsz" data-p="min" title="Minimizar" aria-label="Minimizar calendário" ${sz === 'min' ? 'disabled' : ''}>▁</button><button data-a="calsz" data-p="std" title="Tamanho padrão" aria-label="Tamanho padrão" ${sz === 'std' ? 'disabled' : ''}>▭</button><button data-a="calsz" data-p="big" title="Ampliar" aria-label="Ampliar calendário" ${sz === 'big' ? 'disabled' : ''}>⤢</button>`;
  if (sz === 'min' && !full) return `<div class="cd cal min"><div class="calh"><b>${ES('Tarefas')}</b><span class="mu">${ES('Hoje')}: ${mp} ${mp === 1 ? 'tarefa' : 'tarefas'} · ${ma} ${ma === 1 ? 'consulta' : 'consultas'}</span>${tools}</div></div>`;
  const a = gridStart(c), cells = Array.from({ length: 42 }, (_, i) => { const d = new Date(a); d.setDate(a.getDate() + i); return d; }), wd = cells.slice(0, 7).map(d => `<span>${dloc(d, { weekday: 'narrow' })}</span>`).join('');
  return `<div class="cd cal ${sz} ${full ? 'full' : ''}"><div class="calh"><button data-a="calnav" data-p="-1" aria-label="Mês anterior">‹</button><b>${dloc(new Date(c.y, c.m, 1), { month: 'long', year: 'numeric' })}</b><button data-a="calnav" data-p="1" aria-label="Próximo mês">›</button><button class="lk" data-a="caltoday">Hoje</button>${full ? '' : tools}</div>${f ? `<div class="note2 neonn">Em foco: <b>${E(f.name)}</b>. As tarefas dele aparecem em destaque.</div>` : ''}<div class="calw" aria-hidden="true">${wd}</div><div class="calg">${cells.map(d => calCell(d, c, M, f)).join('')}</div>${dayList(c, M, f)}</div>`;
}
function todayCards() {
  if (!S.me || S.me.role === 'paciente') return ''; const M = calItems(), items = M[todayKey()] || [], f = fcs(), pend = items.filter(open1); let h = '';
  if (f) { const mine = items.filter(i => relf(i, f)); h += `<div class="cd neonc"><h3>Hoje · ${E(f.name)}</h3>${mine.map(i => itemRow(i, f)).join('') || '<span class="mu">Sem tarefas nem consultas hoje.</span>'}</div>`; }
  const rest = f ? pend.filter(i => !relf(i, f)) : pend;
  return h + `<div class="cd"><div class="ah"><h3>Pendências de hoje (todas)</h3><span class="mu">${pend.length}</span></div>${rest.slice(0, 8).map(i => itemRow(i, null)).join('') || '<span class="mu">Nada pendente hoje.</span>'}${rest.length > 8 ? `<button class="lk" data-a="calday" data-p="${todayKey()}">Ver mais ${rest.length - 8}</button>` : ''}</div>`;
}
const _p3 = panelH;
panelH = function () { const h = _p3(); if (S.view === 'tarefas') return h; return h.replace('<div class="pb">', '<div class="pb">' + calBlock(false) + todayCards()); };
CENTER.tarefas = () => bar('Tarefas e calendário') + `<div class="cv"><div class="calfull">${calBlock(true)}</div>${todayCards()}</div>`;
A.calday = k => { const c = calS(), d = new Date(k + 'T12:00:00'); c.day = k; if (c.sz === 'min') c.sz = 'std'; if (d.getMonth() !== c.m || d.getFullYear() !== c.y) { c.y = d.getFullYear(); c.m = d.getMonth(); return run(async () => { await loadCal(); render(); }); } render(); };
A.calnav = p => run(async () => { const c = calS(), d = new Date(c.y, c.m + +p, 1); c.y = d.getFullYear(); c.m = d.getMonth(); await loadCal(); render(); });
A.caltoday = () => run(async () => { const c = calS(), n = new Date(); c.y = n.getFullYear(); c.m = n.getMonth(); c.day = ymd(n); await loadCal(); render(); });
A.calsz = p => { calS().sz = p; try { localStorage.setItem('m3d_cal_sz', p); } catch { /* sem armazenamento */ } render(); };
tform = function (ch) {
  const st = S.con.filter(c => c.role !== 'paciente'), pt = S.con.filter(c => c.role === 'paciente').concat((S.ov || []).filter(o => !S.con.some(c => c.id === o.id)));
  return `<div class="tf"><input id="tkt" placeholder="Nova tarefa" maxlength="160" aria-label="Nova tarefa"><input id="tkd" type="date" aria-label="Prazo da tarefa" value="${calS().day || ''}"><select id="tka" aria-label="Responsável"><option value="">Sem responsável</option><option value="${S.me.id}">Eu</option>${st.map(c => `<option value="${c.id}">${E(c.name)}</option>`).join('')}</select><select id="tkp" aria-label="Paciente"><option value="">Sem paciente</option>${pt.map(c => `<option value="${c.id}">${E(c.name)}</option>`).join('')}</select><button class="pbtn" data-a="tkadd" data-p="${ch}">Adicionar</button></div>`;
};
A.tkadd = ch => run(async () => { const t = $('#tkt').value.trim(); if (t.length < 2) return toast('Descreva a tarefa'); await api('/tasks', { m: 'POST', b: { title: t, channel: ch || undefined, assigneeId: $('#tka').value || undefined, patientId: $('#tkp').value || undefined, due: ($('#tkd') && $('#tkd').value) || undefined } }); await reTasks(); });
const _lc2 = loadCtx;
loadCtx = async function () { await _lc2(); if (S.me.role === 'paciente') return; if (!['colleague', 'avisos', 'shift'].includes(ctx().t)) { try { S.tk = await api('/tasks'); } catch { S.tk = S.tk || []; } } };
const _lw2 = loadWeek;
loadWeek = async function () { await _lw2(); await loadCal(); };
const _al6 = afterLogin;
afterLogin = async function () { S.cal = null; S.tk = null; await _al6(); await ensureTasks(); await loadCal(); startPresence(); };

/* ---------- desenvolvimento global: mini painel visual ---------- */
const ring = (pct, c) => `<svg viewBox="0 0 44 44" width="54" height="54" role="img" aria-label="${pct}%"><circle cx="22" cy="22" r="18" fill="none" stroke="var(--ln)" stroke-width="5"/><circle cx="22" cy="22" r="18" fill="none" stroke="${c}" stroke-width="5" stroke-linecap="round" stroke-dasharray="${(2 * Math.PI * 18 * Math.max(0, Math.min(100, pct)) / 100).toFixed(1)} 999" transform="rotate(-90 22 22)"/><text x="22" y="26" text-anchor="middle" font-size="11" font-weight="600" fill="currentColor">${pct}%</text></svg>`;
const rc = p => p >= 70 ? 'var(--ok)' : p >= 40 ? '#e1a21b' : 'var(--er)', minBy = (a, f) => a.reduce((b, x) => !b || f(x) < f(b) ? x : b, null), maxBy = (a, f) => a.reduce((b, x) => !b || f(x) > f(b) ? x : b, null);
function onlineLine() { const pts = S.con.filter(c => c.role === 'paciente'); if (!pts.length) return ''; const n = pts.filter(c => c.online).length; return `<div class="onbar" style="margin-bottom:8px"><span class="${n ? 'okt' : 'mu'}"><i class="onl ${n ? 'on' : ''}"></i> ${n ? (n === 1 ? '1 paciente online agora' : n + ' pacientes online agora') : 'Nenhum paciente online'}</span><span class="mu">${pts.length} no total</span></div>`; }
gchart = function (ov) {
  const L = 8, avg = []; for (let i = 0; i < L; i++) { const v = ov.map(p => p.serie[p.serie.length - L + i]).filter(x => x != null); avg.push(v.length ? { v: v.reduce((a, b) => a + b, 0) / v.length, n: v.length } : null); } S.gavg = avg;
  const fr = ov.filter(p => p.esp > 0), adh = fr.length ? Math.round(fr.reduce((a, p) => a + Math.min(1, p.feito / p.esp), 0) / fr.length * 100) : null, pend = ov.reduce((a, p) => a + p.pend_ag + p.pend_cl, 0), gl = ov.filter(p => p.goal != null && p.last_eva != null), hit = gl.filter(p => p.last_eva <= p.goal).length;
  const pts = avg.filter(Boolean), tiles = [], lk = (k, p, txt) => p ? `<button class="lk" data-a="gdev" data-p="${k}">${txt}: ${E(p.name)} ›</button>` : '';
  if (adh != null) tiles.push(`<div class="gt"><div class="gtv">${ring(adh, rc(adh))}</div><div class="gtx"><b>Frequência no plano</b><span class="mu">Quanto do plano prescrito foi cumprido</span>${lk('freq', minBy(fr, p => p.feito / p.esp), 'Atenção')}</div></div>`);
  if (pend > 0) tiles.push(`<div class="gt"><div class="gtv big">${ic(CI.clk, 18)}<b>${pend}</b></div><div class="gtx"><b>Pendências</b><span class="mu">Consultas e tarefas clínicas em aberto</span>${lk('pend', maxBy(ov.filter(p => p.pend_ag + p.pend_cl > 0), p => p.pend_ag + p.pend_cl), 'Mais pendências')}</div></div>`);
  if (gl.length) { const pc = Math.round(hit / gl.length * 100); tiles.push(`<div class="gt"><div class="gtv">${ring(pc, rc(pc))}</div><div class="gtx"><b>Metas de dor</b><span class="mu">${hit} de ${gl.length} pacientes na meta</span>${lk('meta', maxBy(gl.filter(p => p.last_eva > p.goal), p => p.last_eva - p.goal), 'Mais longe da meta')}</div></div>`); }
  if (pts.length > 1) { const a = pts[0].v, b = pts[pts.length - 1].v, d = b - a, pp = pts.map((p, i) => [4 + i * (112 / (pts.length - 1)), 26 - p.v / 10 * 22]); tiles.push(`<div class="gt wide"><div class="gtv"><svg viewBox="0 0 120 30" width="120" height="30" role="img" aria-label="Tendência da dor média"><polyline fill="none" stroke="${d <= 0 ? 'var(--ok)' : 'var(--er)'}" stroke-width="2" stroke-linecap="round" points="${pp.map(p => p.join(',')).join(' ')}"/><circle cx="${pp[pp.length - 1][0]}" cy="${pp[pp.length - 1][1]}" r="3" fill="${d <= 0 ? 'var(--ok)' : 'var(--er)'}"/></svg></div><div class="gtx"><b>Dor média</b><span class="mu">${d <= 0 ? 'Caiu' : 'Subiu'} ${Math.abs(d).toFixed(1).replace('.', ',')} ponto${Math.abs(d) >= 1.5 ? 's' : ''} nos últimos registros (menor é melhor)</span>${lk('evo', maxBy(ov.filter(p => p.last_eva != null), p => p.last_eva), 'Maior dor atual')}</div></div>`); }
  return onlineLine() + (tiles.length ? `<div class="cd gdash"><h3>Desenvolvimento global</h3><div class="mu">Resumo dos pacientes vinculados. Toque no link de um item para abrir o painel correspondente.</div><div class="gts">${tiles.join('')}</div></div>` : '');
};
A.gdev = k => run(async () => {
  const ov = S.ov || []; let p, tab = 'res';
  if (k === 'freq') { p = minBy(ov.filter(x => x.esp > 0), x => x.feito / x.esp); tab = 'pl'; }
  if (k === 'pend') p = maxBy(ov.filter(x => x.pend_ag + x.pend_cl > 0), x => x.pend_ag + x.pend_cl);
  if (k === 'meta') { p = maxBy(ov.filter(x => x.goal != null && x.last_eva != null && x.last_eva > x.goal), x => x.last_eva - x.goal); tab = 'evo'; }
  if (k === 'evo') { p = maxBy(ov.filter(x => x.last_eva != null), x => x.last_eva); tab = 'evo'; }
  if (!p) return;
  if (k === 'pend') { S.pp = p.id; S.view = 'agenda'; S.focusP = p.id; S.nofocus = false; await loadWeek(); await loadPanel(); S.np = false; render(); return; }
  if (S.con.some(c => c.id === p.id)) await openPeer(p.id); else { S.pp = p.id; S.focusP = p.id; S.nofocus = false; await loadPanel(); }
  S.tab = tab; S.np = false; render();
});
const _pc = pcard;
pcard = p => _pc(p).replace(/<span class="av sm">([^<]*)<\/span>/, `<span class="av sm pr">$1${onDot(p.id).replace('role="img" ', '')}</span>`);

/* ---------- telas novas e idioma ---------- */
const _v9 = A.view;
A.view = p => {
  if (p === 'tarefas') return run(async () => { S.view = 'tarefas'; S.lo = 0; await ensureTasks(); await loadCal(); render(); });
  if (p === 'notas') return run(async () => { S.view = 'notas'; S.lo = 0; render(); });
  if (p === 'grafo') ensureTasks().then(() => { if (S.view === 'grafo') gDetail(); });
  return _v9(p);
};
if (window.I18N) { const _oc = I18N.onchange; I18N.onchange = l => { if (_oc) _oc(l); if (S.me) render(); }; }
