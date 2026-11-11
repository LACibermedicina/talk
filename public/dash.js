'use strict';
/* ===== Dashboards de gestão + atalhos do chat conforme o interlocutor =====
   Itens de gestão (Agenda, Tarefas, Financeiro, Cadastro, Integrações, Auditoria) abrem um dashboard em vez do chat/painel do paciente.
   Os painéis podem ser movidos, redimensionados, maximizados, minimizados (viram ícones translúcidos no dock, no estilo do macOS) ou fechados.
   O arranjo fica salvo no navegador, por usuário e por tela. Carregado depois de ui2.js. */
const CHART = '<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>', BOLT = '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>', LIST = '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>';
const ORIG = { agenda: CENTER.agenda, fin: CENTER.fin, users: CENTER.users, integ: CENTER.integ, audit: CENTER.audit, grafo: CENTER.grafo, hist: CENTER.hist, notas: CENTER.notas, notif: CENTER.notif, cfg: CENTER.cfg };
const inner = v => (ORIG[v] ? ORIG[v]() : CENTER[v]()).replace(/^<div class="tb">.*?<\/div>/s, '');
const money = c => 'R$ ' + (c / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
const bars = (rows, color = 'var(--ac)') => { const mx = Math.max(1, ...rows.map(r => r[1])); return rows.length ? rows.map(([l, n, raw]) => `<div class="dr"><span style="min-width:96px">${raw ? l : ES(l)}</span><div style="flex:1;height:10px;background:var(--ln);border-radius:5px"><div style="width:${n / mx * 100}%;height:100%;background:${color};border-radius:5px"></div></div><b>${n}</b></div>`).join('') : '<span class="mu">Sem dados no período.</span>'; };
const kpi = (l, v, c = '') => `<div class="kpi ${c}"><span class="mu">${ES(l)}</span><b>${v}</b></div>`;
const goBtn = (a, p, t, cls = '') => `<button class="${cls}" data-a="${a}" data-p="${p}">${ES(t)}</button>`;
const dayOf = a => ymd(new Date(a.starts_at));

const DASH = {
  agenda: { title: 'Agenda', icon: ICO.agenda, panels: [
    { id: 'ag', t: 'Agenda Visual', c: '#2a9d8f', i: ICO.agenda, f: [0, 0, .66, .76], h: () => inner('agenda') },
    { id: 'day', t: 'Resumo do dia', c: '#3b82c4', i: ICO.cal, f: [.66, 0, .34, .38], h: () => {
      const t = todayKey(), l = (S.ag.appointments || []).filter(a => dayOf(a) === t), by = k => l.filter(a => a.status === k).length, nx = l.filter(a => new Date(a.starts_at) > new Date() && !['cancelado', 'faltou', 'finalizado'].includes(a.status))[0];
      return `<div class="kpis">${kpi('Consultas hoje', l.length)}${kpi('Em atendimento', by('em_atendimento'))}${kpi('Na recepção', by('na_recepcao'))}${kpi('Finalizadas', by('finalizado'))}</div>${nx ? `<div class="dr"><span class="mu">Próxima</span><b style="margin-left:auto">${tm(nx.starts_at)} · ${E(nx.patient)}</b></div>` : '<span class="mu">Sem próximas consultas hoje.</span>'}`; } },
    { id: 'risk', t: 'Previsão de faltas', c: '#d9473b', i: G.warn, f: [.66, .38, .34, .38], h: () => {
      const l = (S.ag.appointments || []).filter(a => risk(a) >= .4 && !['cancelado', 'finalizado', 'faltou'].includes(a.status)).sort((a, b) => risk(b) - risk(a));
      return `<p class="mu">Consultas da semana com risco alto de falta. O lembrete por SMS é antecipado automaticamente.</p>${l.map(a => `<div class="dr"><div><b>${E(a.patient)}</b><div class="mu">${dt(a.starts_at)}</div></div><span class="seal" style="margin-left:auto;border-color:var(--er);color:var(--er)">${Math.round(risk(a) * 100)}%</span><button data-a="focusag" data-p="${a.patient_id}">Ver</button></div>`).join('') || '<span class="mu">Nenhuma consulta com risco alto.</span>'}`; } },
    { id: 'occ', t: 'Relatório: ocupação da semana', c: '#7c6bd6', i: CHART, f: [0, .76, .66, .24], h: () => { const ap = (S.ag.appointments || []).filter(a => a.status !== 'cancelado'); return bars(DN.map((n, d) => [n, ap.filter(a => (new Date(a.starts_at).getDay() + 6) % 7 === d).length]), '#7c6bd6') + `<div class="mu">Capacidade de referência: ${HR.length} horários por dia.</div>`; } },
    { id: 'fn', t: 'Funções da agenda', c: '#e0a21a', i: BOLT, f: [.66, .76, .34, .24], h: () => `<div class="fnb">${goBtn('new', '', 'Nova consulta', 'pbtn')}${goBtn('newnote', '', 'Nova nota')}${goBtn('wk0', '', 'Semana atual')}${goBtn('nofocus', '', 'Limpar foco')}${goBtn('view', 'tarefas', 'Tarefas e calendário')}</div>` }
  ] },
  tarefas: { title: 'Tarefas e calendário', icon: ICO.cal, panels: [
    { id: 'cal', t: 'Calendário de tarefas', c: '#e0a21a', i: ICO.cal, f: [0, 0, .54, .72], h: () => calBlock(true) },
    { id: 'today', t: 'Pendências de hoje', c: '#00b865', i: LIST, f: [.54, 0, .46, .5], h: () => todayCards() },
    { id: 'new', t: 'Nova tarefa', c: '#3b82c4', i: G.plus, f: [.54, .5, .46, .24], h: () => `<div class="dtt">${tform('')}</div>` },
    { id: 'rep', t: 'Relatório: tarefas por responsável', c: '#7c6bd6', i: CHART, f: [0, .72, .54, .28], h: () => { const m = {}; (S.tk || []).filter(t => t.status !== 'done').forEach(t => { const k = t.assignee || 'Sem responsável'; m[k] = (m[k] || 0) + 1; }); return bars(Object.entries(m).map(([k, n]) => [k === 'Sem responsável' ? k : E(k), n, k !== 'Sem responsável']), '#7c6bd6'); } },
    { id: 'st', t: 'Situação das tarefas', c: '#2a9d8f', i: ICO.audit, f: [.54, .74, .46, .26], h: () => { const T = S.tk || [], c = k => T.filter(t => t.status === k).length; return `<div class="kpis">${kpi('A fazer', c('todo'))}${kpi('Em andamento', c('doing'))}${kpi('Concluídas', c('done'))}</div><div class="fnb">${goBtn('caltoday', '', 'Ir para hoje')}</div>`; } }
  ] },
  fin: { title: 'Financeiro', icon: ICO.fin, panels: [
    { id: 'sum', t: 'Resumo do mês', c: '#3d9b5e', i: ICO.fin, f: [0, 0, .5, .3], h: () => { const f = S.fin; return f ? `<div class="kpis">${kpi('Entradas', money(f.entradas), 'ok')}${kpi('Saídas', money(f.saidas), 'bad')}${kpi('Saldo', money(f.saldo))}</div>` : '<span class="mu">Carregando…</span>'; } },
    { id: 'rep', t: 'Relatório: entradas e saídas', c: '#7c6bd6', i: CHART, f: [0, .3, .5, .4], h: () => { const f = S.fin; if (!f) return '<span class="mu">Carregando…</span>'; const mx = Math.max(1, f.entradas, f.saidas, Math.abs(f.saldo)); return [['Entradas', f.entradas, 'var(--ok)'], ['Saídas', f.saidas, 'var(--er)'], ['Saldo', Math.abs(f.saldo), 'var(--ac)']].map(([l, v, c]) => `<div class="dr"><span style="min-width:70px">${ES(l)}</span><div style="flex:1;height:14px;background:var(--ln);border-radius:7px"><div style="width:${v / mx * 100}%;height:100%;background:${c};border-radius:7px"></div></div><b>${money(v)}</b></div>`).join(''); } },
    { id: 'inad', t: 'Inadimplência', c: '#d9473b', i: G.warn, f: [.5, 0, .5, .7], h: () => { const f = S.fin; return f ? (f.inadimplencia.map(x => `<div class="dr"><span>${E(x.patient)} · ${E(x.package)}</span><span class="mu" style="margin-left:auto">${money(x.devido_cents)}</span></div>`).join('') || '<span class="mu">Nenhuma pendência.</span>') : '<span class="mu">Carregando…</span>'; } },
    { id: 'fn', t: 'Funções financeiras', c: '#e0a21a', i: BOLT, f: [0, .7, 1, .3], h: () => `<div class="fnb">${goBtn('view', 'fin', 'Atualizar valores', 'pbtn')}${goBtn('fincsv', '', 'Exportar inadimplência (CSV)')}${goBtn('view', 'users', 'Cadastro de usuários')}</div><p class="mu">Valores em reais, calculados no servidor a partir dos pacotes e pagamentos do mês.</p>` }
  ] },
  users: { title: 'Cadastro de usuários', icon: ICO.users, panels: [
    { id: 'sum', t: 'Resumo de usuários', c: '#2481cc', i: ICO.users, f: [0, 0, .36, .4], h: () => { const u = S.us || [], m = {}; u.filter(x => !x.pending).forEach(x => { m[x.role] = (m[x.role] || 0) + 1; }); return `<div class="kpis">${kpi('Ativos', u.filter(x => x.active && !x.pending).length)}${kpi('Pendentes', u.filter(x => x.pending).length, u.some(x => x.pending) ? 'bad' : '')}</div>${bars(Object.entries(m).map(([k, n]) => [ROLE[k] || k, n]))}`; } },
    { id: 'pend', t: 'Aprovações pendentes', c: '#e0a21a', i: ICO.bell, f: [.36, 0, .32, .4], h: () => { const l = (S.us || []).filter(x => x.pending); return l.map(x => `<div class="dr"><div><b>${E(x.name)}</b><div class="mu">${E(x.email)}</div></div><span style="margin-left:auto;display:flex;gap:4px"><button class="pbtn" data-a="uapprove" data-p="${x.id}">Aprovar</button><button data-a="ureject" data-p="${x.id}">Recusar</button></span></div>`).join('') || '<span class="mu">Nenhum cadastro aguardando aprovação.</span>'; } },
    { id: 'fn', t: 'Funções de cadastro', c: '#7c6bd6', i: BOLT, f: [.68, 0, .32, .4], h: () => `<p class="mu">Cadastro público: <b>${ES({ off: 'desligado', approval: 'com aprovação', open: 'aberto' }[S.signup] || 'desligado')}</b>.</p><div class="fnb">${S.me.role === 'admin' ? goBtn('view', 'integ', 'Alterar o modo de cadastro') : ''}${goBtn('view', 'audit', 'Ver auditoria')}</div>` },
    { id: 'reg', t: 'Cadastro e vínculos', c: '#2a9d8f', i: LIST, f: [0, .4, 1, .6], h: () => inner('users') }
  ] },
  integ: { title: 'Integrações', icon: ICO.integ, panels: [
    { id: 'cfg', t: 'Integrações e chaves', c: '#5b6abf', i: ICO.integ, f: [0, 0, .64, 1], h: () => inner('integ') },
    { id: 'sec', t: 'Segurança das chaves', c: '#2a9d8f', i: ICO.audit, f: [.64, 0, .36, .5], h: () => '<p>As chaves ficam <b>cifradas no banco</b> e nunca são exibidas de novo. Cada chave é testada antes de salvar.</p><p class="mu">Troque as chaves expostas fora do sistema e confira o resultado na auditoria.</p>' },
    { id: 'fn', t: 'Funções relacionadas', c: '#e0a21a', i: BOLT, f: [.64, .5, .36, .5], h: () => `<div class="fnb">${goBtn('view', 'audit', 'Auditoria', 'pbtn')}${goBtn('view', 'users', 'Cadastro de usuários')}</div>` }
  ] },
  audit: { title: 'Auditoria e alertas', icon: ICO.audit, panels: [
    { id: 'log', t: 'Alertas e registro', c: '#5b6abf', i: ICO.audit, f: [0, 0, .64, 1], h: () => inner('audit') },
    { id: 'sum', t: 'Resumo de segurança', c: '#d9473b', i: G.warn, f: [.64, 0, .36, .34], h: () => `<div class="kpis">${kpi('Alertas abertos', (S.alr || []).length, (S.alr || []).length ? 'bad' : 'ok')}${kpi('Registros lidos', (S.aud || []).length)}</div>${S.vf ? `<div class="${S.vf.ok ? 'okt' : 'err'}">${S.vf.ok ? 'Cadeia íntegra: ' + S.vf.entries + ' registros' : 'Cadeia QUEBRADA no registro ' + S.vf.brokenAt}</div>` : ''}` },
    { id: 'rep', t: 'Relatório: ações registradas', c: '#7c6bd6', i: CHART, f: [.64, .34, .36, .36], h: () => { const m = {}; (S.aud || []).forEach(r => { m[r.action] = (m[r.action] || 0) + 1; }); return bars(Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => [E(k), n, 1]), '#7c6bd6'); } },
    { id: 'fn', t: 'Funções de auditoria', c: '#e0a21a', i: BOLT, f: [.64, .7, .36, .3], h: () => `<div class="fnb">${goBtn('verify', '', 'Verificar cadeia', 'pbtn')}${goBtn('view', 'audit', 'Atualizar')}${goBtn('view', 'hist', 'Histórico de atividades')}</div>` }
  ] }
};
// demais funcionalidades também viram painéis (mover, redimensionar, minimizar, maximizar, ocultar), cada uma com o seu quadro principal
Object.assign(DASH, {
  grafo: { title: 'Relações', icon: ICO.net, panels: [{ id: 'map', t: 'Mapa de relações', c: '#3a8f5c', i: ICO.net, f: [0, 0, .78, .88], h: () => inner('grafo') }] },
  hist: { title: 'Histórico', icon: ICO.hist, panels: [{ id: 'log', t: 'Histórico de atividades', c: '#708090', i: ICO.hist, f: [0, 0, .78, .88], h: () => inner('hist') }] },
  notas: { title: 'Anotações', icon: ICO.note, panels: [{ id: 'nb', t: 'Bloco de anotações', c: '#d4a017', i: ICO.note, f: [0, 0, .78, .88], h: () => inner('notas') }] },
  notif: { title: 'Notificações', icon: ICO.bell, panels: [{ id: 'nt', t: 'Notificações', c: '#e5603c', i: ICO.bell, f: [0, 0, .78, .88], h: () => inner('notif') }] },
  cfg: { title: 'Configurações', icon: ICO.cfg, panels: [{ id: 'cf', t: 'Configurações', c: '#5b6b7c', i: ICO.cfg, f: [0, 0, .78, .88], h: () => inner('cfg') }] }
});
// paciente: as funções dele (agenda e configurações) também são painéis, sem os quadros de gestão
const DP = { agenda: { title: 'Agenda', icon: ICO.agenda, panels: [{ id: 'ag', t: 'Minha agenda', c: '#2a9d8f', i: ICO.agenda, f: [0, 0, .78, .88], h: () => inner('agenda') }] }, cfg: DASH.cfg };
const DD = v => (S.me && S.me.role === 'paciente' ? DP[v] : DASH[v]);
const isDash = () => !!(S.me && DD(S.view));
const dwKey = v => 'm3d_dw_' + S.me.id + '_' + v;
const dwGet = v => { S.dws = S.dws || {}; if (!S.dws[v]) { try { S.dws[v] = JSON.parse(localStorage.getItem(dwKey(v))) || {}; } catch { S.dws[v] = {}; } } return S.dws[v]; };
const dwSave = v => { try { localStorage.setItem(dwKey(v), JSON.stringify(S.dws[v])); } catch { /* sem armazenamento */ } };
const MINW = 260, MINH = 170;
const geo = (v, p) => { const s = dwGet(v)[p.id] || {}, [fx, fy, fw, fh] = p.f; let g = { x: s.x ?? fx, y: s.y ?? fy, w: s.w ?? fw, h: s.h ?? fh, st: s.st || 'open' }; if (g.st === 'min') { const b = document.querySelector('#dw'), W = b ? b.clientWidth : 1000, H = b ? b.clientHeight : 600; g.w = Math.min(1, MINW / W); g.h = Math.min(1, MINH / H); g.x = Math.min(g.x, 1 - g.w); g.y = Math.min(g.y, 1 - g.h); } return g; };
// guarda a geometria normal ao minimizar e restaura ao sair do estado de quadro pequeno
const unmin = (v, id) => { const s = dwGet(v)[id]; if (s && s.pre) setSt(v, id, { ...s.pre, pre: null }); };
const slot = (v, id) => { const b = $('#dw'); if (!b) return { x: 0.01, y: 0.7 }; const W = b.clientWidth, H = b.clientHeight, n = DD(v).panels.filter(p => p.id !== id && geo(v, p).st === 'min').length, per = Math.max(1, Math.floor((W - 8) / (MINW + 8))); return { x: (8 + (n % per) * (MINW + 8)) / W, y: (H - MINH - 8 - Math.floor(n / per) * (MINH + 8)) / H }; };
const goMin = (v, id) => { const s = dwGet(v)[id] || {}, g = geo(v, pid2id(v, id)); if (s.st !== 'min') { const raw = { x: s.x ?? g.x, y: s.y ?? g.y, w: s.w ?? g.w, h: s.h ?? g.h }; setSt(v, id, { pre: raw }); } const t = slot(v, id); setSt(v, id, { st: 'min', x: t.x, y: t.y }); };
const pid2id = (v, id) => DD(v).panels.find(p => p.id === id);
const setOpen = (v, id, st) => { unmin(v, id); setSt(v, id, { st }); front(v, id); };
const setSt = (v, id, o) => { if (o.st === 'open' || o.st === 'max') o = { ...o, lm: o.st }; const d = dwGet(v); d[id] = { ...(d[id] || {}), ...o }; dwSave(v); };
S.dz = 10;
/* ---------- submenu de ícones da funcionalidade aberta: faixa fina com o rótulo do grupo e ícones de linha (outro perfil de ícones) ---------- */
const RI = { closeall: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 9l6 6M15 9l-6 6"/>', ref: '<path d="M20 12a8 8 0 10-2.5 5.8M20 5v5h-5"/>', copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 012-2h9"/>', save: '<path d="M5 4h11l3 3v13H5zM8 4v5h7M8 20v-6h8v6"/>', edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>', print: '<path d="M7 9V4h10v5M7 17H5v-6h14v6h-2M7 14h10v6H7z"/>', pdf: '<path d="M6 3h9l4 4v14H6zM14 3v5h5M9 14h6M9 17h4"/>', pin: '<path d="M9 4h6l-1 6 3 3H7l3-3zM12 13v7"/>', gen: '<path d="M12 3l1.8 4.7L18.5 9l-4.7 1.8L12 15.5l-1.8-4.7L5.5 9l4.7-1.3zM18 15l.8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8z"/>', list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>', live: '<circle cx="12" cy="12" r="3"/><path d="M6.3 6.3a8 8 0 000 11.4M17.7 6.3a8 8 0 010 11.4"/>', tree: '<circle cx="12" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="19" r="2"/><path d="M12 7v5M12 12H6v5M12 12h6v5"/>', eco: '<circle cx="12" cy="12" r="3"/><circle cx="5" cy="5" r="1.7"/><circle cx="19" cy="5" r="1.7"/><circle cx="5" cy="19" r="1.7"/><circle cx="19" cy="19" r="1.7"/><path d="M7 7l3 3M17 7l-3 3M7 17l3-3M17 17l-3-3"/>', book: '<path d="M4 5a2 2 0 012-2h13v15H6a2 2 0 00-2 2zM4 20a2 2 0 002 2h13v-4"/>', sliders: '<path d="M5 6h9M18 6h1M5 12h3M12 12h7M5 18h11M20 18h-1"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>', order: '<path d="M8 4v16M8 4L5 7M8 4l3 3M16 20V4M16 20l-3-3M16 20l3-3"/>', grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>', open: '<path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4"/>', shrink: '<path d="M4 18h16"/>', trans: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>' };
/** group: nome do grupo de funções; scope: nome da funcionalidade aberta; items: [ícone, rótulo, ação, parâmetro, ativo?] */
const RPAL = ['#2481cc', '#e0a526', '#2a9d8f', '#7c6bd6', '#e5603c', '#3a8f5c', '#c9822b', '#d9363e'];
function RIB(group, scope, items) { const bs = items.filter(Boolean).map(([i, t, a, p, on, col, dim], n) => `<button class="rb ${on ? 'on' : ''} ${dim ? 'dim' : ''}" style="--pc:${col || RPAL[n % RPAL.length]};--d:${n * 0.35}s" data-a="${a}" ${p != null ? `data-p="${p}"` : ''} aria-label="${ES(t)}"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${RI[i] || i}</svg><span class="rt" role="tooltip">${ES(t)}</span></button>`).join(''); return `<div class="rib" role="toolbar" aria-label="${ES(group)} · ${ES(scope)}"><span class="rg" title="${ES('Ações da funcionalidade aberta')}: ${ES(scope)} · ${ES('arraste para mover · 3 cliques fecham')}">${ES(group)}</span><span class="rsep"></span>${bs}</div>`; }
/* barra de submenu no topo: mostra os ícones (e o grupo) da funcionalidade em foco; provedores: {pri, html} */
const RBP = [() => { if (!S.me || !isDash()) return null; const v = S.view, D = DD(v), all = D.panels.map(p => ({ p, g: geo(v, p) })), vis = all.filter(x => x.g.st !== 'closed' && x.g.st !== 'min'); const top = vis.length ? vis.sort((a, b) => ((S.dzs && S.dzs[v + b.p.id]) || 1) - ((S.dzs && S.dzs[v + a.p.id]) || 1))[0].p : null; return { pri: 1, key: 'v:' + v, col: top ? top.c : null, close: () => A.gohome(), html: RIB(D.title, D.title, [...(true ? all.map(x => [x.p.i, x.p.t, 'dkc', x.p.id, x.g.st === 'open' || x.g.st === 'max', x.p.c, x.g.st === 'closed' || x.g.st === 'min']) : []), ['ref', 'Atualizar', 'dref'], ['grid', 'Reorganizar painéis', 'dreset'], ['open', 'Abrir todos os painéis', 'dopenall'], ['shrink', 'Minimizar todos', 'dminall'], ['closeall', 'Fechar todos os quadros', 'dclall', null, false, '#d9363e']]) }; }];
let ribL = '', ribT = 0, ribClose = null, ribKey = '';
function ribTop() { let best = null; for (const f of RBP) { let r = null; try { r = f(); } catch { r = null; } if (r && (!best || r.pri > best.pri)) best = r; } let el = document.getElementById('rbar'); if (!best) { if (el) { el.remove(); } ribL = ''; return; } if (!el) { el = document.createElement('div'); el.id = 'rbar'; el.title = ''; document.body.append(el); ribL = ''; ribKey = ''; } ribClose = best.close || null; if ((best.key || '') !== ribKey) { ribKey = best.key || ''; el.classList.remove('moved'); } if (best.col) el.style.setProperty('--pc', best.col); else el.style.removeProperty('--pc'); if (best.html !== ribL) { el.innerHTML = best.html; ribL = best.html; } ribAnchor(el); }
/* barra de submenus: ancorada no topo, antes do ícone de desktop; pode ser arrastada, mas volta à posição ao abrir outra funcionalidade */
function ribClamp(el) { const r = el.getBoundingClientRect(), x = Math.max(4, Math.min(innerWidth - r.width - 4, r.left)), y = Math.max(4, Math.min(innerHeight - r.height - 4, r.top)); el.style.left = x + 'px'; el.style.top = y + 'px'; return { x, y }; }
function ribAnchor(el) {
  if (el.classList.contains('moved')) return; const t = document.querySelector('.tbc[data-top]'); el.style.maxWidth = ''; el.style.overflowX = '';
  if (!t) { el.style.left = Math.max(4, innerWidth - el.offsetWidth - 70) + 'px'; el.style.top = '8px'; return; }
  const r = t.getBoundingClientRect(), tb = t.closest('.tb') || t.parentElement, lefts = [...tb.children].filter(c => c !== t && !c.classList.contains('sp') && c.getBoundingClientRect().width > 0 && c.getBoundingClientRect().right <= r.left + 1), minL = lefts.length ? Math.max(...lefts.map(c => c.getBoundingClientRect().right)) + 8 : 4, avail = r.left - 10 - minL;
  if (el.offsetWidth > avail) { el.style.maxWidth = Math.max(120, avail) + 'px'; el.style.overflowX = 'auto'; }
  const w = Math.min(el.offsetWidth, Math.max(120, avail)); el.style.left = Math.max(4, r.left - 10 - w) + 'px'; el.style.top = Math.max(2, r.top + r.height / 2 - el.offsetHeight / 2) + 'px';
}
let rbd = null;
document.addEventListener('pointerdown', e => { const el = e.target.closest && e.target.closest('#rbar'); if (!el || e.target.closest('button') || e.button > 0) return; const r = el.getBoundingClientRect(); try { getSelection().removeAllRanges(); } catch { /* ok */ } e.preventDefault(); rbd = { el, dx: e.clientX - r.left, dy: e.clientY - r.top, x0: e.clientX, y0: e.clientY, on: false, id: e.pointerId }; });
document.addEventListener('pointermove', e => { if (!rbd) return; if (!rbd.on) { if (Math.hypot(e.clientX - rbd.x0, e.clientY - rbd.y0) < 5) return; rbd.on = true; rbd.el.classList.add('moved', 'drag'); rbd.el.style.bottom = 'auto'; try { rbd.el.setPointerCapture(rbd.id); } catch { /* ok */ } } rbd.el.style.left = (e.clientX - rbd.dx) + 'px'; rbd.el.style.top = (e.clientY - rbd.dy) + 'px'; ribClamp(rbd.el); });
const rbEnd = () => { if (!rbd) return; const { el } = rbd; rbd = null; el.classList.remove('drag'); };
document.addEventListener('pointerup', rbEnd); document.addEventListener('pointercancel', rbEnd);
document.addEventListener('click', e => { const r = e.target.closest && e.target.closest('#rbar'); if (r && !e.target.closest('button') && e.detail === 3 && ribClose) { const f = ribClose; ribClose = null; f(); } });
addEventListener('resize', () => { const el = document.getElementById('rbar'); if (el) { if (el.classList.contains('moved')) ribClamp(el); else ribAnchor(el); } });
/* itens móveis (posição lembrada neste navegador): ajuda, assistente, dock de funcionalidades e barra da consulta */
const MOV = [['#helpfab', 'helpfab', null], ['#asst', 'asst', '.ash'], ['.hdock', 'dock', null], ['#cbar', 'cbar', null]];
const mvGet = k => { try { return JSON.parse(localStorage.getItem('m3d_mv_' + k) || 'null'); } catch { return null; } };
function mvApply(el, p) { el.classList.add('mvd'); el.style.setProperty('position', 'fixed', 'important'); el.style.left = p.x + 'px'; el.style.top = p.y + 'px'; el.style.right = 'auto'; el.style.bottom = 'auto'; el.style.transform = 'none'; el.style.margin = '0'; }
function applyMovables() { for (const [sel, k] of MOV) { const p = mvGet(k); if (!p) continue; document.querySelectorAll(sel).forEach(el => { if (el.dataset.mvk === JSON.stringify(p)) return; el.dataset.mvk = JSON.stringify(p); mvApply(el, p); const r = el.getBoundingClientRect(); if (r.right > innerWidth || r.bottom > innerHeight || r.left < 0 || r.top < 0) { el.style.left = Math.max(4, Math.min(innerWidth - r.width - 4, r.left)) + 'px'; el.style.top = Math.max(4, Math.min(innerHeight - r.height - 4, r.top)) + 'px'; } }); } }
let mvd = null, mvLast = 0;
document.addEventListener('pointerdown', e => { if (e.button > 0 || !e.target.closest) return; for (const [sel, k, hd] of MOV) { const el = e.target.closest(sel); if (!el) continue; if (hd && !e.target.closest(hd)) continue; if (e.target.closest('input,textarea,select') ) return; const r = el.getBoundingClientRect(); mvd = { el, k, dx: e.clientX - r.left, dy: e.clientY - r.top, x0: e.clientX, y0: e.clientY, on: false }; try { getSelection().removeAllRanges(); } catch { /* ok */ } e.preventDefault(); return; } }, true);
document.addEventListener('pointermove', e => { if (!mvd) return; if (!mvd.on) { if (Math.hypot(e.clientX - mvd.x0, e.clientY - mvd.y0) < 6) return; mvd.on = true; mvApply(mvd.el, { x: e.clientX - mvd.dx, y: e.clientY - mvd.dy }); mvd.el.classList.add('mvdrag'); } const r = mvd.el.getBoundingClientRect(); mvd.el.style.left = Math.max(2, Math.min(innerWidth - r.width - 2, e.clientX - mvd.dx)) + 'px'; mvd.el.style.top = Math.max(2, Math.min(innerHeight - r.height - 2, e.clientY - mvd.dy)) + 'px'; });
const mvEnd = () => { if (!mvd) return; const { el, k, on } = mvd; mvd = null; el.classList.remove('mvdrag'); if (on) { mvLast = performance.now(); const r = el.getBoundingClientRect(), p = { x: Math.round(r.left), y: Math.round(r.top) }; el.dataset.mvk = JSON.stringify(p); try { localStorage.setItem('m3d_mv_' + k, JSON.stringify(p)); } catch { /* ok */ } } };
document.addEventListener('pointerup', mvEnd, true); document.addEventListener('pointercancel', mvEnd, true);
document.addEventListener('click', e => { if (performance.now() - mvLast < 300) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);
const mvReset = () => { MOV.forEach(([, k]) => { try { localStorage.removeItem('m3d_mv_' + k); } catch { /* ok */ } }); document.querySelectorAll('.mvd').forEach(el => { el.classList.remove('mvd'); ['position', 'left', 'top', 'right', 'bottom', 'transform', 'margin'].forEach(p => el.style.removeProperty(p)); delete el.dataset.mvk; }); };
const ribSched = () => { if (ribT) return; ribT = requestAnimationFrame(() => { ribT = 0; ribTop(); applyMovables(); }); };
new MutationObserver(ms => { if (ms.every(m => m.target.closest && m.target.closest('#rbar'))) return; ribSched(); }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
/* dock de funcionalidades (estilo macOS): fica visível na área de trabalho e dentro de qualquer funcionalidade aberta */
function appDockH() { const act = v => (v === 'biblioteca' ? !!(window.CONSULTA && CONSULTA.K.wins.lib && CONSULTA.K.wins.lib.st !== 'closed') : S.view === v); return `<nav class="hdock" aria-label="Funcionalidades">${HOME_APPS.filter(a => a[4]()).map(([v, t, i, c]) => `<button class="happ ${act(v) ? 'on' : ''}" data-a="adk" data-p="${v}" style="--pc:${c}" aria-pressed="${act(v)}" aria-label="${t}: ${HDESC[v] || ''}"><span class="dki">${ic(i, 26)}</span><span class="htip" role="tooltip"><b>${ES(t)}</b><small>${ES(HDESC[v] || '')}</small></span></button>`).join('')}</nav>`; }
A.adk = v => { if (v === 'biblioteca') { const w = window.CONSULTA && CONSULTA.K.wins.lib; if (w && w.st && w.st !== 'closed') { CONSULTA.closeAll(); render(); } else A.view('biblioteca'); return; } if (S.view === v) A.gohome(); else A.view(v); };
const dockIcon = (p, on) => `<button class="dk ${on ? 'on' : ''}" data-a="dkc" data-p="${p.id}" style="--pc:${p.c}" aria-pressed="${on}" aria-label="${on ? 'Minimizar' : 'Abrir'} painel ${p.t}" title="${p.t}"><span class="dki">${ic(p.i, 24)}</span><span class="dkt">${ES(p.t)}</span></button>`;
function dashH(v) {
  const D = DD(v), stack = innerWidth < 900, G0 = D.panels.map(p => ({ p, g: geo(v, p) })), vis = G0.filter(x => x.g.st !== 'closed'), mins = vis.filter(x => x.g.st === 'min'), mx = vis.find(x => x.g.st === 'max');
  const panel = ({ p, g }) => {
    const max = g.st === 'max', min = g.st === 'min';
    return `<article class="dp ${max ? 'max' : ''} ${min ? 'min' : ''}" data-dp="${p.id}" style="--pc:${p.c};left:calc(${g.x * 100}% + 4px);top:calc(${g.y * 100}% + 4px);width:calc(${g.w * 100}% - 8px);height:calc(${g.h * 100}% - 8px);z-index:${S.dzs && S.dzs[v + p.id] || 1}" role="region" aria-label="${p.t}"><header class="dph" data-dpd><span class="dpi">${ic(p.i, 15)}</span><b>${ES(p.t)}</b><span class="sp"></span><button data-a="dmin" data-p="${p.id}" aria-label="Minimizar ${p.t}" title="Minimizar">▁</button><button data-a="dmax" data-p="${p.id}" aria-label="${max ? 'Restaurar' : 'Maximizar'} ${p.t}" title="${max ? 'Restaurar tamanho' : 'Maximizar'}">${max ? '❐' : '▢'}</button><button data-a="dcl" data-p="${p.id}" aria-label="Fechar ${p.t}" title="Fechar">×</button></header><div class="dpb" data-dpb="${p.id}">${p.h()}</div><i class="dpr" data-dpr aria-hidden="true"></i></article>`;
  };
  const menu = S.dwm ? `<div class="dmenu" role="menu"><b class="mu">Painéis</b>${G0.map(({ p, g }) => `<button role="menuitemcheckbox" aria-checked="${g.st !== 'closed'}" data-a="dpt" data-p="${p.id}"><span>${g.st === 'closed' ? '☐' : '☑'}</span> ${ES(p.t)}</button>`).join('')}<hr><button data-a="dopenall">Abrir todos</button><button data-a="dminall">Minimizar todos</button><button data-a="dreset">Reorganizar (padrão)</button></div>` : '';
  return `<div class="tb dtb"><button class="menu" data-a="menu" aria-label="Menu">☰</button><h2 style="margin:0;font-size:17px">${ES('Dashboard')} · ${ES(D.title)}</h2><span class="sp"></span><button data-a="dm" aria-haspopup="menu" aria-expanded="${!!S.dwm}">${ic(LIST, 15)} Painéis</button>${menu}<button class="xcl" data-a="closev" aria-label="Fechar janela" title="Fechar janela">✕</button></div>
  <div class="dw ${stack ? 'stack' : ''}" id="dw" data-dv="${v}" style="--wc:${(vis.slice().sort((a, b) => ((S.dzs && S.dzs[v + b.p.id]) || 1) - ((S.dzs && S.dzs[v + a.p.id]) || 1))[0] || { p: { c: 'transparent' } }).p.c}">${vis.map(panel).join('')}${vis.length ? '' : `<div class="dwe"><p class="mu">${ES('Funcionalidade aberta sem quadros. Use os ícones da barra superior para abrir os quadros que precisar.')}</p><button class="pbtn" data-a="dopenall">Abrir todos</button></div>`}</div>
  <div class="dockbar">${appDockH()}</div>`;
}
Object.keys(DASH).forEach(v => { CENTER[v] = () => isDash() ? dashH(v) : (ORIG[v] ? ORIG[v]() : CENTER.tarefas0()); });
CENTER.tarefas0 = () => bar('Tarefas e calendário') + `<div class="cv"><div class="calfull">${calBlock(true)}</div>${todayCards()}</div>`;
const isHome = () => !!(S.me && S.view === 'chat' && !S.room);
const _pn = panelH; panelH = function () { return isDash() || isHome() ? '' : _pn(); };
const _rd = render;
render = function () {
  const sc = {}; document.querySelectorAll('[data-dpb]').forEach(e => { sc[e.dataset.dpb] = e.scrollTop; });
  _rd(); fixGrid();
  document.querySelectorAll('[data-dpb]').forEach(e => { if (sc[e.dataset.dpb]) e.scrollTop = sc[e.dataset.dpb]; });
};
const dv = () => S.view, pid2 = id => DD(dv()).panels.find(p => p.id === id);
const front = (v, id) => { S.dzs = S.dzs || {}; S.dzs[v + id] = ++S.dz; };
A.dmin = id => { const g = geo(dv(), pid2(id)); if (g.st === 'min') setOpen(dv(), id, 'open'); else goMin(dv(), id); render(); };
A.dres = id => { setOpen(dv(), id, 'open'); render(); };
A.dmax = id => { const g = geo(dv(), pid2(id)); setOpen(dv(), id, g.st === 'max' ? 'open' : 'max'); render(); };
A.dcl = id => { unmin(dv(), id); setSt(dv(), id, { st: 'closed' }); render(); };
const lastMode = (v, id) => ((dwGet(v)[id] || {}).lm === 'max' ? 'max' : 'open');
A.dkc = id => { const g = geo(dv(), pid2(id)); if (g.st === 'closed' || g.st === 'min') setOpen(dv(), id, lastMode(dv(), id)); else goMin(dv(), id); render(); };
A.dpt = id => { const g = geo(dv(), pid2(id)); if (g.st === 'closed') setOpen(dv(), id, lastMode(dv(), id)); else { unmin(dv(), id); setSt(dv(), id, { st: 'closed' }); } render(); };
A.dopenall = () => { DD(dv()).panels.forEach(p => setOpen(dv(), p.id, 'open')); S.dwm = false; render(); };
A.dminall = () => { DD(dv()).panels.forEach(p => { if (geo(dv(), p).st !== 'min') goMin(dv(), p.id); }); S.dwm = false; render(); };
A.dref = () => { render(); };
const closeAllPanels = v => { const D = DD(v); if (!D) return; D.panels.forEach(p => { unmin(v, p.id); setSt(v, p.id, { st: 'closed' }); }); };
A.dclall = () => { closeAllPanels(dv()); S.dwm = false; render(); toast('Todos os quadros fechados'); };
A.dm = () => { S.dwm = !S.dwm; render(); };
A.dreset = () => { S.dws[dv()] = {}; dwSave(dv()); S.dwm = false; mvReset(); render(); toast('Painéis reorganizados'); };
A.wk0 = () => run(async () => { S.wk = 0; S.sel = null; await loadWeek(); render(); });
A.fincsv = () => { const f = S.fin; if (!f) return; const q = s => '"' + String(s).replace(/"/g, '""') + '"', csv = 'paciente;pacote;valor_devido\n' + f.inadimplencia.map(x => [q(x.patient), q(x.package), (x.devido_cents / 100).toFixed(2).replace('.', ',')].join(';')).join('\n'), a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })); a.download = 'inadimplencia.csv'; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
// mover (arrastando o título) e redimensionar (canto inferior direito); posições guardadas em frações da área do dashboard
let drag = null;
document.addEventListener('pointerdown', e => {
  const art = e.target.closest && e.target.closest('[data-dp]'); if (!art || !isDash()) return; const v = S.view, id = art.dataset.dp, p = pid2(id); front(v, id); art.style.zIndex = S.dzs[v + id]; { const dwx = $('#dw'); if (dwx && p) dwx.style.setProperty('--wc', p.c); const rb = document.getElementById('rbar'); if (rb && p) rb.style.setProperty('--pc', p.c); }
  const hd = e.target.closest('[data-dpd]'), rs = e.target.closest('[data-dpr]'); if ((!hd && !rs) || e.target.closest('button') || art.classList.contains('max') || $('#dw').classList.contains('stack')) return;
  const box = $('#dw').getBoundingClientRect(), g = geo(v, p); drag = { v, id, art, rs: !!rs, x0: e.clientX, y0: e.clientY, g, W: box.width, H: box.height, cur: { ...g } }; (hd || rs).setPointerCapture(e.pointerId); e.preventDefault();
});
document.addEventListener('pointermove', e => {
  if (!drag) return; const dx = (e.clientX - drag.x0) / drag.W, dy = (e.clientY - drag.y0) / drag.H, g = drag.g, c = drag.cur, minW = 190 / drag.W, minH = 110 / drag.H;
  if (drag.rs) { c.w = Math.max(minW, Math.min(1 - g.x, g.w + dx)); c.h = Math.max(minH, Math.min(1 - g.y, g.h + dy)); } else { c.x = Math.max(0, Math.min(1 - g.w, g.x + dx)); c.y = Math.max(0, Math.min(1 - g.h, g.y + dy)); }
  const a = drag.art.style; a.left = `calc(${c.x * 100}% + 4px)`; a.top = `calc(${c.y * 100}% + 4px)`; a.width = `calc(${c.w * 100}% - 8px)`; a.height = `calc(${c.h * 100}% - 8px)`;
});
const endDrag = () => { if (!drag) return; const { v, id, cur } = drag; drag = null; setSt(v, id, { x: +cur.x.toFixed(4), y: +cur.y.toFixed(4), w: +cur.w.toFixed(4), h: +cur.h.toFixed(4) }); };
document.addEventListener('pointerup', endDrag); document.addEventListener('pointercancel', endDrag);
document.addEventListener('dblclick', e => { const h = e.target.closest && e.target.closest('[data-dpd]'); if (h && !e.target.closest('button') && isDash()) A.dmin(h.closest('[data-dp]').dataset.dp); });
addEventListener('resize', () => { if (isDash() && S.me) { clearTimeout(S.rzT); S.rzT = setTimeout(render, 200); } });
// ao abrir um item de gestão, carrega os dados do dashboard
const _v10 = A.view;
A.view = p => { S.dwm = false; if (!window.M3D_KEEP && S.me && DD(p) && S.view !== p) closeAllPanels(p); return _v10(p); };

/* ---------- atalhos do chat conforme o interlocutor ---------- */
function pillsH() {
  const r = S.room, me = S.me.role, peer = r && !r.channel ? S.con.find(x => x.id === r.peer) || { role: r.role } : null, pr = peer && peer.role, call = r && !r.channel ? `<button data-a="call">Video Chamada</button>` : '';
  let mid;
  if (r && r.channel) mid = `<button data-a="meet" data-p="reuniao">Agendar Reunião</button>`;
  else if (me === 'paciente') mid = ADM.includes(pr) ? `<button data-a="chkag">Checar Agenda</button>` : `<button data-a="view" data-p="agenda">Agendar Consulta</button><button data-a="prontuario">Ver Prontuário</button>`;
  else if (pr === 'paciente') mid = `<button data-a="view" data-p="agenda">Agendar Consulta</button><button data-a="prontuario">Ver Prontuário</button>`;
  else if (ADM.includes(pr)) mid = `<button data-a="chkag">Checar Agenda</button>`;
  else if (pr === 'medico' && me === 'medico') mid = `<button data-a="meet" data-p="inter">Interconsulta</button>`;
  else mid = `<button data-a="meet" data-p="reuniao">Agendar Reunião</button>`;
  return `<div class="pills">${call}${mid}</div>`;
}
const _ch = CENTER.chat; CENTER.chat = () => S.room ? _ch().replace(/<div class="pills">.*?<\/div>/s, pillsH()) : homeH();
A.chkag = () => { S.nofocus = true; S.focusP = null; A.view('agenda'); };
A.meet = k => run(async () => {
  const r = S.room; if (!r) return; S.wk = 0; await loadWeek(); let d = 0, h = 8; outer: for (d = 0; d < 5; d++) for (h of HR) if (!S.ag.notes.some(n => { const s = new Date(n.starts_at); return (s.getDay() + 6) % 7 === d && s.getHours() === h; }) && !S.ag.appointments.some(a => { const s = new Date(a.starts_at); return (s.getDay() + 6) % 7 === d && s.getHours() === h; })) break outer; if (d > 4) { d = 0; h = 8; }
  const who = r.channel ? 'canal ' + r.name.replace('# ', '#') : r.name, n = await api('/agenda/notes', { m: 'POST', b: { title: (k === 'inter' ? 'Interconsulta com ' : 'Reunião com ') + who, body: '', startsAt: slotISO(d, h) } });
  S.view = 'agenda'; S.nofocus = true; S.focusP = null; await loadWeek(); S.sel = 'n:' + n.id; render(); toast((k === 'inter' ? 'Interconsulta' : 'Reunião') + ' criada na agenda: arraste o card ou ajuste o texto para definir o horário');
});
document.addEventListener('click', e => { if (S.dwm && !e.target.closest('.dmenu') && !e.target.closest('[data-a=dm]')) { S.dwm = false; if (isDash()) render(); } });

// ===== Acesso rápido (só quando o servidor roda com TEST_MODE=true) =====
(function () {
  const st = document.createElement('style'); st.textContent = '.ql{margin-top:16px;border-top:1px dashed var(--ln);padding-top:12px;display:grid;gap:6px}.qlb{display:flex;justify-content:space-between;align-items:center;gap:8px;text-align:left;border:1px solid var(--ln);background:var(--sf);border-radius:10px;padding:8px 12px;min-height:44px}.qlb code{font-size:12px;color:var(--mu)}.qlb:hover{border-color:var(--ac);background:var(--ac2)}'; document.head.append(st);
  const _l = loginH;
  loginH = function () {
    const h = _l(); if (!S.tu || !S.tu.length) return h;
    return h.replace('</form>', '</form><div class="ql" translate="no"><b>Credenciais de teste</b><span class="mu">Toque para entrar. Só em modo de teste.</span>' + S.tu.map(x => `<button type="button" class="qlb" data-a="tlogin" data-p="${x.u}|${x.p}"><b>${x.n}</b><code>${x.u} · ${x.p}</code></button>`).join('') + '</div>');
  };
  A.tlogin = pp => run(async () => { const [u, p] = pp.split('|'); await api('/login', { m: 'POST', b: { login: u, password: p } }); S.err = ''; S.me = await api('/me'); await afterLogin(); render(); });
  fetch('/api/test-users').then(r => r.ok ? r.json() : []).catch(() => []).then(l => { if (l.length && !S.me) { S.tu = l; render(); } });
})();

// ===== Menu lateral: oculta ao clicar fora (exceto com o chat aberto) e botão fechar janela =====
function fixGrid() {
  const a = $('#app'); if (!a || !S.me) return; const d = isDash(), w = innerWidth, hide = !!S.lh && w > 820;
  a.classList.toggle('dashv', d); a.classList.toggle('lh', hide); if (!hide) a.classList.remove('peek'); if (d || isHome()) a.classList.add('np');
  let tab = $('#ltab'); if (hide) { if (!tab) { tab = document.createElement('button'); tab.id = 'ltab'; tab.type = 'button'; tab.setAttribute('data-a', 'menu'); tab.setAttribute('aria-label', 'Fixar menu de contatos'); tab.innerHTML = '<img src="/logo.png" alt=""><span translate="no">Talk.M3D</span><span class="ltip" role="tooltip">' + ES('Fixar menu de contatos') + '</span>'; a.append(tab); } } else if (tab) tab.remove();
  decorateTop(); homeLayout();
  a.style.gridTemplateColumns = w > 820 ? `64px ${hide ? '0px' : (w > 1180 ? '290px' : '270px')} minmax(0,1fr)${w > 1180 && !a.classList.contains('np') ? ' 400px' : ''}` : '';
}
A.menu = () => { if (innerWidth > 820) S.lh = !S.lh; else S.lo = !S.lo; render(); };
A.closev = () => { if (S.view === 'chat') { S.room = null; S.msgs = []; } else S.view = 'chat'; S.lh = false; S.dwm = false; if (innerWidth <= 820) S.lo = 1; render(); };
// dois cliques fora do menu (na mesma tela) ocultam o menu; com o chat aberto ele só some quando o usuário minimiza
let oc = 0, ocView = null;
document.addEventListener('click', e => {
  if (S.me && innerWidth > 820 && !S.lh && S.view === 'chat' && S.room) { // conversa aberta: clicar na área da conversa oculta o menu (sem recarregar a tela, para não perder o texto digitado)
    const t = e.target; if (t.closest && t.closest('.chat') && !t.closest('button, a, input, textarea, select, label, summary, [data-a], [contenteditable]')) { S.lh = true; fixGrid(); }
    oc = 0; return;
  }
  if (!S.me || innerWidth <= 820 || S.lh || (S.view === 'chat' && S.room)) { oc = 0; return; }
  const t = e.target; if (t.closest && (t.closest('.list') || t.closest('.rail'))) { oc = 0; return; } if (!t.closest || t.closest('[data-a=menu]') || t.closest('[data-lg]') || t.closest('.lgw') || t.closest('#hbox') || t.closest('#helpfab') || t.closest('.hp') || t.closest('#ltab')) return;
  const v0 = S.view + '|' + (S.room ? S.room.key : '');
  setTimeout(() => { const v1 = S.view + '|' + (S.room ? S.room.key : ''); if (v1 !== v0) { ocView = v1; oc = 0; return; } if (ocView !== v0) { ocView = v0; oc = 0; } if (++oc >= 2 && !S.lh && !(S.view === 'chat' && S.room)) { oc = 0; S.lh = true; render(); } }, 0);
});
addEventListener('resize', () => { if (S.me) fixGrid(); });
// com o menu oculto, aproximar o mouse da aba da logo revela o menu por cima da tela; só um clique na aba fixa o menu
let peekT = 0;
const peekSet = on => { const a = $('#app'); if (!a) return; clearTimeout(peekT); if (on) a.classList.add('peek'); else a.classList.remove('peek'); };
document.addEventListener('pointermove', e => {
  const a = $('#app'); if (!a || !S.me || !a.classList.contains('lh') || e.pointerType === 'touch') return;
  const inZone = e.clientX <= 100 && e.clientY >= 70 && e.clientY <= 340, inList = !!(e.target.closest && e.target.closest('.list, #ltab'));
  if (inZone || (a.classList.contains('peek') && inList)) { clearTimeout(peekT); a.classList.add('peek'); } else if (a.classList.contains('peek')) { clearTimeout(peekT); peekT = setTimeout(() => peekSet(false), 280); }
});
document.addEventListener('click', e => { if (e.target.closest && e.target.closest('.app.peek .list .it, .app.peek .list .bkn, .app.peek .list .bkl')) setTimeout(() => peekSet(false), 0); });

// ===== Tela inicial: desktop com post-its, agenda/notificações e ícones das funcionalidades =====
const nonPac = () => S.me.role !== 'paciente', mgmt = () => ['recepcao', 'funcionario', 'admin'].includes(S.me.role);
const HOME_APPS = [
  ['agenda', 'Agenda', ICO.agenda, '#2481cc', () => true], ['tarefas', 'Tarefas', ICO.cal, '#e0a526', nonPac], ['fin', 'Financeiro', ICO.fin, '#2a9d8f', mgmt],
  ['users', 'Usuários', ICO.users, '#7c6bd6', mgmt], ['integ', 'Integrações', ICO.integ, '#c9822b', () => S.me.role === 'admin'], ['audit', 'Auditoria', ICO.audit, '#d9363e', () => S.me.role === 'admin'],
  ['grafo', 'Relações', ICO.net, '#3a8f5c', nonPac], ['hist', 'Histórico', ICO.hist, '#708090', nonPac], ['notas', 'Anotações', ICO.note, '#d4a017', nonPac],
  ['notif', 'Notificações', ICO.bell, '#e5603c', nonPac], ['cred', 'Créditos', '<circle cx="12" cy="12" r="9"/><path d="M14.5 9.2c-.6-.8-1.5-1.2-2.6-1.2-1.5 0-2.6.8-2.6 2 0 3 5.4 1.5 5.4 4.3 0 1.2-1.1 2-2.7 2-1.2 0-2.2-.5-2.8-1.4M12 6.5V8m0 8v1.5"/>', '#2fa36b', () => true], ['credadm', 'Gestão de créditos', '<path d="M4 19V9m5 10V5m5 14v-7m5 7V8"/><path d="M3 19h18"/>', '#8a5cd6', () => S.me.role === 'admin'], ['biblioteca', 'Biblioteca', '<path d="M4 5a2 2 0 012-2h13v15H6a2 2 0 00-2 2zM4 20a2 2 0 002 2h13v-4M8 7h7"/>', '#c9822b', () => HLT(S.me.role) || S.me.role === 'admin'], ['cfg', 'Configurações', ICO.cfg, '#5b6b7c', () => true]
];
const HDESC = { cred: 'Saldo, planos, tokens e extrato', credadm: 'Planos, custos, tokens e distribuição de créditos', agenda: 'Consultas e horários', tarefas: 'Tarefas, prazos e calendário', fin: 'Pacotes, pagamentos e inadimplência', users: 'Cadastro e aprovação de usuários', integ: 'Vídeo, pagamentos, SMS e IA', audit: 'Registro de acessos e ações', grafo: 'Mapa de relações entre pacientes e equipe', hist: 'Histórico de atividades', notas: 'Anotações importantes', notif: 'Avisos e alertas do sistema', cfg: 'Idioma, país, IA e conta', biblioteca: 'Materiais, protocolos e preferências clínicas' };
const PITINFO = { ag: ['<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>', 'Consultas do dia e dos próximos dias'], tk: ['<path d="M9 6h11M9 12h11M9 18h11M3.5 6l1.5 1.5L7 5M3.5 12l1.5 1.5L7 11M3.5 18l1.5 1.5L7 17"/>', 'Tarefas pendentes, prazos e responsáveis'], nt: ['<path d="M6 16V11a6 6 0 1112 0v5l1.5 2h-15zM10 20a2 2 0 004 0"/>', 'Notificações e avisos novos'], nb: ['<path d="M6 3h9l4 4v14H6zM14 3v5h5M9 13h6M9 17h6"/>', 'Anotações importantes salvas'], cs: ['<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V3h6v1M12 9v6M9 12h6"/>', 'Casos clínicos fixados no desktop'] };
const hhm = x => new Date(x).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
function homeLoad() {
  if (S.hnl || !S.me) return; S.hnl = true;
  api('/notifications').then(l => { S.hn = (l || []).slice(0, 30); }).catch(() => { S.hn = []; }).then(() => { if (isHome()) render(); });
}
// post-its do desktop: mover (arrastar o título), minimizar, expandir em detalhe; posição e estado ficam salvos neste navegador
const pitKey = () => 'm3d_pit_' + (S.me ? S.me.id : '');
const PIT = { get() { try { return JSON.parse(localStorage.getItem(pitKey())) || {}; } catch { return {}; } }, set(o) { try { localStorage.setItem(pitKey(), JSON.stringify(o)); } catch { /* sem armazenamento */ } } };
const capS = x => String(x || '').charAt(0).toUpperCase() + String(x || '').slice(1).replace(/_/g, ' ');
let PMIN = [];
function pitCard(id, cls, rot, ttl, brief, detail, foot) {
  const st = (PIT.get()[id] || {}).st || 'open', big = st === 'big', fold = st === 'fold';
  if (st === 'min') { PMIN.push({ id, cls, ttl }); return ''; }
  return `<article class="sn ${cls} ${fold ? 'fold' : ''} ${big ? 'big' : ''}" data-pit="${id}" style="--rot:${big || fold ? 0 : rot}deg"><i class="snpin" aria-hidden="true"></i><header class="sn-h" data-pitd title="${ES('Arraste para mover · duplo clique recolhe/abre')}"><h3>${ES(ttl)}</h3><span class="sp"></span><button data-a="pitmin" data-p="${id}" aria-label="Minimizar para a pilha lateral" title="Minimizar para a pilha lateral">▁</button><button data-a="pitbig" data-p="${id}" aria-label="${big ? 'Recolher' : 'Expandir em detalhe'}" title="${big ? 'Recolher' : 'Expandir em detalhe'}">${big ? '⤡' : '⤢'}</button></header><div class="sn-b">${big ? detail : brief}</div>${big || fold ? '' : foot || ''}</article>`;
}
function homeH() {
  PMIN = []; homeLoad(); const nm = String(S.me.name || ''), now = new Date(), items = (calItems()[todayKey()] || []).filter(open1), tdy = todayKey();
  const allTk = (S.tk || []).filter(t => t.status !== 'done').sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999')), tk = allTk.slice(0, 5), ag = items.filter(i => i.k === 'a').slice(0, 5);
  const allNt = S.hn || [], nt = allNt.filter(n => !n.read_at).slice(0, 4), nbAll = nonPac() ? NB.get() : [], nb = nbAll.slice(0, 3), more = (t, v) => `<button class="sn-m" data-a="view" data-p="${v}">${ES(t)} →</button>`;
  const row = (go, a, t, sub) => `<button class="sn-r" data-a="${go}" ${a ? `data-p="${a}"` : ''}><b>${t}</b>${sub ? `<small>${sub}</small>` : ''}</button>`, empty = t => `<p class="sn-e">${ES(t)}</p>`;
  const dueTxt = d => d ? dloc(new Date(String(d).slice(0, 10) + 'T12:00'), { day: 'numeric', month: 'short' }) : ES('Sem prazo');
  // ---- detalhe (post-it expandido) ----
  const apAll = (calS().ap || []).filter(a => open1({ k: 'a', ...a })).sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at)), lim = new Date(); lim.setDate(lim.getDate() + 8);
  const byDay = {}; apAll.filter(a => new Date(a.starts_at) < lim).forEach(a => (byDay[ymd(new Date(a.starts_at))] = byDay[ymd(new Date(a.starts_at))] || []).push(a));
  const dAg = Object.keys(byDay).length ? Object.entries(byDay).map(([d, l]) => `<h4>${d === tdy ? ES('Hoje') + ' · ' : ''}${dloc(new Date(d + 'T12:00'), { weekday: 'long', day: 'numeric', month: 'long' })}</h4>${l.map(i => row('view', 'agenda', `${hhm(i.starts_at)}${i.ends_at ? '–' + hhm(i.ends_at) : ''} · ${E(i.patient || i.title || '')}`, `${E(i.professional || '')}${i.professional ? ' · ' : ''}${ES(capS(i.status))}`)).join('')}`).join('') : empty('Sem consultas nos próximos dias.');
  const grp = { late: [], today: [], next: [], none: [] }; allTk.forEach(t => grp[!t.due ? 'none' : String(t.due).slice(0, 10) < tdy ? 'late' : String(t.due).slice(0, 10) === tdy ? 'today' : 'next'].push(t));
  const tkRow = t => row('view', 'tarefas', E(t.title), `${dueTxt(t.due)}${t.assignee ? ' · ' + E(t.assignee) : ''}${t.patient ? ' · ' + E(t.patient) : ''} · ${ES(capS(t.status === 'doing' ? 'Em andamento' : 'A fazer'))}`);
  const dTk = allTk.length ? [['late', 'Atrasadas'], ['today', 'Hoje'], ['next', 'Próximas'], ['none', 'Sem prazo']].filter(([k]) => grp[k].length).map(([k, l]) => `<h4>${ES(l)} (${grp[k].length})</h4>${grp[k].map(tkRow).join('')}`).join('') : empty('Nada pendente. Bom trabalho!');
  const dNt = allNt.length ? allNt.map(n => `<button class="sn-r ${n.read_at ? '' : 'new'}" data-a="ntopen" data-p="${n.id}"><b>${n.read_at ? '' : '● '}${E(n.title)}</b><small>${E(n.body || '')}</small><small>${E(n.patient || '')}${n.patient ? ' · ' : ''}${E(dt(n.created_at))}</small></button>`).join('') : empty('Nenhuma notificação nova.');
  const dNb = nbAll.length ? nbAll.map(c => `<div class="sn-card"><b>${E(c.name)}</b><small>${E(dt(c.at))}</small>${(c.lines || []).map(([l, v]) => `<div class="sn-kv"><span>${ES(l)}</span><b>${ES(v)}</b></div>`).join('')}${c.text ? `<p>${E(c.text)}</p>` : ''}</div>`).join('') : empty('Salve cartões a partir do mapa de relações.');
  const posts = [
    pitCard('ag', 'pt-y', -1.2, 'Agenda de hoje', ag.length ? ag.map(i => row('view', 'agenda', `${hhm(i.starts_at)} · ${E(i.patient || i.title || '')}`, E(i.professional || ''))).join('') : empty('Sem consultas pendentes hoje.'), dAg, more('Abrir agenda', 'agenda')),
    nonPac() ? pitCard('tk', 'pt-g', 1.1, 'Tarefas pendentes', tk.length ? tk.map(t => row('view', 'tarefas', E(t.title), dueTxt(t.due))).join('') : empty('Nada pendente. Bom trabalho!'), dTk, more('Todas as tarefas', 'tarefas')) : '',
    pitCard('nt', 'pt-p', -.8, 'Notificações', nt.length ? nt.map(n => row('view', 'notif', E(n.title), E(n.patient || ''))).join('') : empty(S.hn ? 'Nenhuma notificação nova.' : 'Carregando…'), dNt, nonPac() ? more('Ver todas', 'notif') : ''),
    nonPac() ? pitCard('nb', 'pt-b', 1.4, 'Anotações importantes', nb.length ? nb.map(c => row('view', 'notas', E(c.name), c.text ? E(c.text).slice(0, 60) : '')).join('') : empty('Salve cartões a partir do mapa de relações.'), dNb, more('Abrir anotações', 'notas')) : ''
  ].join('');
  const apps = HOME_APPS.filter(a => a[4]()).map(([v, t, i, c]) => `<button class="happ" data-a="view" data-p="${v}" style="--pc:${c}" aria-label="${t}: ${HDESC[v] || ''}"><span class="dki">${ic(i, 26)}</span><span class="htip" role="tooltip"><b>${ES(t)}</b><small>${ES(HDESC[v] || '')}</small></span></button>`).join('');
  return `<div class="tb"><button class="menu" data-a="menu" aria-label="Menu">☰</button><h2 style="margin:0;font-size:17px">${ES('Início')}</h2><span class="sp"></span></div>
  <div class="home"><img class="home-logo" src="/logo.png" alt=""><div class="home-in"><div class="home-hi"><h1>${ES('Olá')}, ${E(nm)}</h1><span class="mu">${dloc(now, { weekday: 'long', day: 'numeric', month: 'long' })}</span><span class="sp"></span><button class="lk" data-a="pitreset">${ES('Reorganizar post-its')}</button></div><div class="sns" id="sns">${posts}</div></div><div class="pstack" id="pstack" aria-label="Post-its minimizados"></div>
  ${appDockH()}</div>`;
}
function homeLayout() {
  const stk = document.getElementById('pstack'); if (stk) stk.innerHTML = PMIN.map(p => `<button class="pstk ${p.cls}" data-a="pitmin" data-p="${p.id}" title="${ES('Restaurar')}: ${ES(p.ttl)}" aria-label="${ES('Restaurar')}: ${ES(p.ttl)}"><i></i><span class="pki">${ic((PITINFO[p.id] || PITINFO.nb)[0], 19)}</span><span class="ptip" role="tooltip"><b>${ES(p.ttl)}</b><small>${ES((PITINFO[p.id] || PITINFO.nb)[1])}</small><small class="mu">${ES('Clique para restaurar')}</small></span></button>`).join('');
  if (stk) { let nts = []; try { nts = NB.get(); } catch { nts = []; } stk.insertAdjacentHTML('beforeend', nts.slice(0, 12).map(c => `<button class="pstk pnote" data-a="view" data-p="notas" aria-label="${ES('Anotação')}: ${E(c.name)}"><i></i><span class="pki">${ic(ICO.note, 18)}</span><span class="ptip" role="tooltip"><b>${E(c.name)}</b><small>${c.text ? E(String(c.text).slice(0, 80)) : ES('Anotação salva')}</small><small class="mu">${ES('Clique para abrir as anotações')}</small></span></button>`).join('')); }
  const sns = document.getElementById('sns'); if (!sns) return; const PS = PIT.get(), W = sns.clientWidth || 800, gap = 20, colW = 250, cols = Math.max(1, Math.floor((W + gap) / (colW + gap))), colH = new Array(cols).fill(0); let maxB = 0;
  [...sns.querySelectorAll('.sn[data-pit]')].forEach(el => {
    const id = el.dataset.pit, s = PS[id] || {}, big = s.st === 'big', min = s.st === 'min', w = big ? Math.min(780, W - 8) : min ? 200 : colW; el.style.width = w + 'px'; el.style.zIndex = (S.pz && S.pz[id]) || (big ? 20 : 1);
    let x, y; if (s.x != null && s.y != null) { x = s.x; y = s.y; } else { const c = colH.indexOf(Math.min(...colH)); x = c * (colW + gap); y = colH[c]; colH[c] += el.offsetHeight + gap; }
    x = Math.max(0, Math.min(x, Math.max(0, W - w))); y = Math.max(0, y); el.style.left = x + 'px'; el.style.top = y + 'px'; maxB = Math.max(maxB, y + el.offsetHeight);
  });
  sns.style.minHeight = Math.max(maxB + 24, 260) + 'px';
}
const pitSet = (id, o) => { const P = PIT.get(); P[id] = { ...(P[id] || {}), ...o }; PIT.set(P); };
A.pitmin = id => { const st = (PIT.get()[id] || {}).st; pitSet(id, { st: st === 'min' ? 'open' : 'min' }); render(); };
A.pitbig = id => { const st = (PIT.get()[id] || {}).st; S.pz = S.pz || {}; S.pz[id] = ++S.pzc || (S.pzc = 30); pitSet(id, { st: st === 'big' ? 'open' : 'big' }); render(); const el = document.querySelector(`[data-pit="${id}"]`); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); };
A.pitfold = id => { const st = (PIT.get()[id] || {}).st; pitSet(id, { st: st === 'fold' ? 'open' : 'fold' }); render(); };
A.pitreset = () => { PIT.set({}); render(); toast('Post-its reorganizados'); };
let pdrag = null;
document.addEventListener('pointerdown', e => {
  const art = e.target.closest && e.target.closest('.sn[data-pit]'); if (!art) return; const id = art.dataset.pit; S.pz = S.pz || {}; S.pzc = (S.pzc || 30) + 1; S.pz[id] = S.pzc; art.style.zIndex = S.pzc;
  const hd = e.target.closest('[data-pitd]'); if (!hd || e.target.closest('button')) return; pdrag = { id, art, x0: e.clientX, y0: e.clientY, ox: art.offsetLeft, oy: art.offsetTop, moved: false }; hd.setPointerCapture(e.pointerId); e.preventDefault();
});
document.addEventListener('pointermove', e => { if (!pdrag) return; const sns = document.getElementById('sns'); if (!sns) return; const W = sns.clientWidth; const x = Math.max(0, Math.min(W - pdrag.art.offsetWidth, pdrag.ox + e.clientX - pdrag.x0)), y = Math.max(0, pdrag.oy + e.clientY - pdrag.y0); if (Math.abs(e.clientX - pdrag.x0) + Math.abs(e.clientY - pdrag.y0) > 3) pdrag.moved = true; pdrag.art.style.left = x + 'px'; pdrag.art.style.top = y + 'px'; pdrag.art.classList.add('drag'); });
const endPit = () => { if (!pdrag) return; const { id, art, moved } = pdrag; pdrag = null; art.classList.remove('drag'); if (moved) { pitSet(id, { x: art.offsetLeft, y: art.offsetTop }); const sns = document.getElementById('sns'); if (sns) sns.style.minHeight = Math.max(art.offsetTop + art.offsetHeight + 24, 260) + 'px'; } };
document.addEventListener('pointerup', endPit); document.addEventListener('pointercancel', endPit);
document.addEventListener('dblclick', e => { const h = e.target.closest && e.target.closest('[data-pitd]'); if (h && !e.target.closest('button') && S.me) A.pitfold(h.closest('.sn').dataset.pit); });

// ===== Barra superior: desktop, avisos (sino) e estado de presença =====
const STX = { online: ['Online', '#22c55e'], busy: ['Ocupado', '#e5484d'], offline: ['Offline', '#a3afb9'] };
const myst = () => (S.me && S.me.presence) || 'online';
const DESK = '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>';
function ntpH() {
  const L = (S.nt || []).slice(0, 6);
  return `<div class="tbm ntm" role="dialog" aria-label="Notificações"><div class="tbm-h"><b>${ES('Notificações')}</b><button class="lk" data-a="readall2">${ES('Marcar como lidas')}</button></div>${L.length ? L.map(n => `<button class="tbn ${n.read_at ? '' : 'new'}" data-a="ntopen" data-p="${n.id}"><b>${E(n.title)}</b><small>${E(n.patient || '')}${n.patient ? ' · ' : ''}${E(dt(n.created_at))}</small></button>`).join('') : `<p class="mu" style="margin:8px">${ES('Sem notificações.')}</p>`}<button class="lk tbm-f" data-a="view" data-p="notif">${ES('Ver todas')}</button></div>`;
}
function stmH() {
  return `<div class="tbm" role="menu" aria-label="Meu estado">${['online', 'busy', 'offline'].map(k => `<button role="menuitemradio" aria-checked="${myst() === k}" data-a="setst" data-p="${k}"><i class="onl" style="background:${STX[k][1]}"></i><span><b>${ES(STX[k][0])}</b><small>${ES(k === 'online' ? 'Disponível para todos' : k === 'busy' ? 'Aparece como ocupado' : 'Aparece offline (invisível)')}</small></span>${myst() === k ? '<em>✓</em>' : ''}</button>`).join('')}</div>`;
}
function topH() {
  const home = isHome(), n = S.nc || 0, st = myst();
  const bell = nonPac() ? `<span class="tbw"><button class="tbi" data-a="ntp" aria-haspopup="dialog" aria-expanded="${!!S.ntp}" aria-label="Notificações${n ? ': ' + n : ''}" title="Notificações">${ic(ICO.bell, 18)}${n ? `<i class="tbadge">${n > 9 ? '9+' : n}</i>` : ''}</button>${S.ntp ? ntpH() : ''}</span>` : '';
  return `<span class="tbc" data-top><button class="tbi ${home ? 'on' : ''}" data-a="gohome" aria-label="Ir para o desktop" title="Desktop" ${home ? 'aria-current="page"' : ''}>${ic(DESK, 18)}</button>${bell}<span class="tbw"><button class="tbs" data-a="stm" aria-haspopup="menu" aria-expanded="${!!S.stm}" title="Meu estado"><i class="onl" style="background:${STX[st][1]}"></i><span class="tbs-l">${ES(STX[st][0])}</span><span aria-hidden="true">▾</span></button>${S.stm ? stmH() : ''}</span></span>`;
}
function decorateTop() {
  const tb = document.querySelector('section.chat > .tb'); if (!tb || !S.me || tb.querySelector('[data-top]')) return;
  const sp = tb.querySelector('.sp'); (sp ? sp.insertAdjacentHTML('afterend', topH()) : tb.insertAdjacentHTML('beforeend', topH()));
}
A.gohome = () => { S.room = null; S.msgs = []; S.view = 'chat'; S.ntp = false; S.stm = false; S.dwm = false; render(); };
A.ntp = () => run(async () => { S.ntp = !S.ntp; S.stm = false; if (S.ntp) { try { S.nt = await api('/notifications'); } catch { S.nt = S.nt || []; } } render(); });
A.stm = () => { S.stm = !S.stm; S.ntp = false; render(); };
A.setst = st => run(async () => { await api('/me/status', { m: 'PUT', b: { status: st } }); S.me.presence = st; S.stm = false; render(); toast(STX[st][0]); });
A.readall2 = () => run(async () => { await api('/notifications/read-all', { m: 'POST' }); S.nc = 0; S.nt = await api('/notifications'); render(); });
A.ntopen = id => run(async () => { try { await api('/notifications/' + id + '/read', { m: 'PATCH' }); S.nc = Math.max(0, (S.nc || 1) - 1); } catch { /* segue */ } S.ntp = false; await A.view('notif'); });
document.addEventListener('click', e => { if ((S.ntp || S.stm) && !(e.target.closest && e.target.closest('.tbw'))) { S.ntp = S.stm = false; render(); } });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && (S.ntp || S.stm)) { S.ntp = S.stm = false; render(); } });

// clicar na logo/nome do menu leva ao desktop
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('.list .brand'); if (b && S.me && !e.target.closest('button, select, a, .lgw, .langrow')) A.gohome(); });
