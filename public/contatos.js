/* Regras de contato (grafo interativo do administrador), ícone flutuante do desktop, consentimento na chamada e atualização em tempo real. */
(() => {
  const isAdm = () => S.me && S.me.role === 'admin';
  const ICON = '<circle cx="6" cy="7" r="3"/><circle cx="18" cy="7" r="3"/><circle cx="12" cy="18" r="3"/><path d="M8.5 8.5L11 15.5M15.5 8.5L13 15.5M9 7h6"/>';
  const HOME = HOME_APPS.findIndex(a => a[0] === 'cfg');
  HOME_APPS.splice(HOME < 0 ? HOME_APPS.length : HOME, 0, ['cgrafo', 'Regras de contato', ICON, '#7c6bd6', isAdm]);
  HDESC.cgrafo = 'Quem pode contatar quem, por nível de usuário: arraste de um nível ao outro para conectar';
  try { APP_GROUPS[1][1].push('cgrafo'); } catch { /* sem grupos */ }
  const NI = { paciente: ['#ff8fb1', '<path d="M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10z"/>'], cuidador: ['#ffb86b', '<path d="M7 11V6a1.5 1.5 0 013 0v4M10 10V4.5a1.5 1.5 0 013 0V10M13 10V5.5a1.5 1.5 0 013 0V13c0 4-2 7-6 7-3 0-5-2-5-5v-3a1.5 1.5 0 013 0"/>'], medico: ['#5ec8f2', '<path d="M12 5v14M5 12h14"/>'], fisio: ['#7be0a4', '<circle cx="12" cy="5" r="2"/><path d="M12 8v6l-3 6M12 14l3 6M7 11l5-3 5 3"/>'], enfermeiro: ['#9ad0ff', '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8v8M8 12h8"/>'], nutricionista: ['#a6e05e', '<path d="M5 19c0-8 5-13 14-14 0 9-5 14-14 14zM5 19l8-8"/>'], farmaceutico: ['#c79bff', '<rect x="3" y="9" width="18" height="6" rx="3" transform="rotate(-35 12 12)"/><path d="M9.5 8.5l5 5"/>'], profissional: ['#6fd6d0', '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5h6v2M3 13h18"/>'], recepcao: ['#ffd36b', '<path d="M4 15a8 8 0 0116 0M3 15h3v4H3zM18 15h3v4h-3zM18 19c0 1.5-2 2-5 2"/>'], funcionario: ['#d6b38a', '<rect x="5" y="3" width="14" height="18" rx="3"/><circle cx="12" cy="10" r="2.5"/><path d="M8 17c1-2 7-2 8 0"/>'], admin: ['#f2c14e', '<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z"/>'] };
  const KC = { video: '#1a9bb0', chat: '#7c6bd6' }, KT = { video: 'Videochamada', chat: 'Mensagens' };
  const G = { nodes: [], rules: null, kind: 'video', work: new Set(), dirty: false, drag: null, from: '', to: '' };
  const W = 760, H = 560, CX = 380, CY = 270, RX = 290, RY = 200, R = 34;
  const pos = i => { const a = -Math.PI / 2 + i * 2 * Math.PI / G.nodes.length; return { x: CX + RX * Math.cos(a), y: CY + RY * Math.sin(a) }; };
  const nm = r => ES(ROLE[r] || r);
  async function loadG() { const d = await api('/admin/contact-rules'); G.nodes = d.nodes; G.rules = d.rules; setWork(); }
  function setWork() { G.work = new Set(((G.rules[G.kind] || {}).edges || []).map(e => e.join('>'))); G.dirty = false; }
  function edgePath(f, t) {
    const a = pos(G.nodes.indexOf(f)), b = pos(G.nodes.indexOf(t));
    if (f === t) return { d: `M${a.x - 14} ${a.y - R + 4} C${a.x - 40} ${a.y - R - 46},${a.x + 40} ${a.y - R - 46},${a.x + 14} ${a.y - R + 4}`, hit: true };
    const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, off = G.work.has(t + '>' + f) ? 16 : 0, nx = -uy * off, ny = ux * off;
    const sx = a.x + ux * (R + 2) + nx, sy = a.y + uy * (R + 2) + ny, ex = b.x - ux * (R + 8) + nx, ey = b.y - uy * (R + 8) + ny, mx = (sx + ex) / 2 + (CX - (sx + ex) / 2) * .18, my = (sy + ey) / 2 + (CY - (sy + ey) / 2) * .18;
    return { d: `M${sx} ${sy} Q${mx + nx} ${my + ny} ${ex} ${ey}` };
  }
  const nodeH = (r, i) => { const p = pos(i), [c, ic0] = NI[r] || ['#bbb', '']; return `<g class="gnode" data-node="${r}" transform="translate(${p.x} ${p.y})" tabindex="0" role="button" aria-label="${E(nm(r))}"><circle r="${R + 5}" fill="${c}" opacity=".25" class="gaura"/><circle r="${R}" fill="url(#gg-${r})" stroke="#fff" stroke-width="3.5" filter="url(#gsh)"/><ellipse cx="-9" cy="-14" rx="14" ry="8" fill="#fff" opacity=".55" transform="rotate(-25)"/><g transform="translate(-13 -13) scale(1.08)" fill="none" stroke="#fff" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">${ic0}</g><text y="${R + 17}" text-anchor="middle" class="glb">${E(nm(r))}</text></g>`; };
  const defsH = () => `<defs><filter id="gsh" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="4" stdDeviation="3.5" flood-color="#10304a" flood-opacity=".35"/></filter>${G.nodes.map(r => { const c = (NI[r] || ['#bbb'])[0]; return `<radialGradient id="gg-${r}" cx="35%" cy="28%" r="80%"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".35" stop-color="${c}"/><stop offset="1" stop-color="${c}" stop-opacity=".78"/></radialGradient>`; }).join('')}<marker id="garr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${KC[G.kind]}"/></marker></defs>`;
  function svgH() {
    const edges = [...G.work].map(k => { const [f, t] = k.split('>'); if (!G.nodes.includes(f) || !G.nodes.includes(t)) return ''; const p = edgePath(f, t); return `<g class="gedge" data-e="${k}"><path d="${p.d}" class="gline" stroke="${KC[G.kind]}" marker-end="url(#garr)"/><path d="${p.d}" class="ghit"><title>${E(nm(f))} → ${E(nm(t))} · ${ES('clique para remover')}</title></path></g>`; }).join('');
    return `<svg id="gsvg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${ES('Grafo de contatos entre níveis de usuário')}">${defsH()}${edges}${G.nodes.map(nodeH).join('')}</svg>`;
  }
  const chipH = k => { const [f, t] = k.split('>'); return `<span class="gchip" style="--gc:${KC[G.kind]}">${E(nm(f))} → ${E(nm(t))}<button data-a="gdel" data-p="${k}" aria-label="${ES('Remover conexão')}">×</button></span>`; };
  CENTER.cgrafo = () => {
    const opts = sel => G.nodes.map(r => `<option value="${r}" ${sel === r ? 'selected' : ''}>${E(nm(r))}</option>`).join(''), cfg = G.rules && G.rules[G.kind] && G.rules[G.kind].configured;
    return bar('Regras de contato') + `<div class="cv"><div class="cd gcard"><h3>${ES('Quem pode contatar quem')}</h3><p class="mu">${ES('Cada bolha é um nível de usuário. Arraste de uma bolha até outra para permitir que o primeiro nível contate o segundo; clique numa seta para removê-la. O administrador contata todos (fixo).')}</p>
      <div class="gtabs" role="tablist">${Object.keys(KT).map(k => `<button role="tab" aria-selected="${G.kind === k}" class="${G.kind === k ? 'on' : ''}" style="--gc:${KC[k]}" data-a="gkind" data-p="${k}">${ES(KT[k])}</button>`).join('')}</div>
      <p class="mu">${cfg ? ES('Configuração personalizada em uso.') : ES('Padrão do sistema em uso (nada foi personalizado ainda).')}</p>
      <div class="gwrap">${svgH()}</div>
      <div class="grow"><select id="gf" data-i="gf" aria-label="${ES('De')}">${opts(G.from || G.nodes[0])}</select><span>→</span><select id="gt" data-i="gt" aria-label="${ES('Para')}">${opts(G.to || G.nodes[0])}</select><button data-a="gadd">${ES('Conectar')}</button></div>
      <div class="gchips">${[...G.work].map(chipH).join('') || `<span class="mu">${ES('Nenhuma conexão: só o administrador pode contatar.')}</span>`}</div>
      <div class="gbar"><button class="pbtn" data-a="gsave" ${G.dirty ? '' : 'disabled'}>${ES('Salvar regras')}</button><button data-a="greset">${ES('Restaurar padrão')}</button>${G.dirty ? `<span class="mu">${ES('Alterações ainda não salvas')}</span>` : ''}</div></div></div>`;
  };
  const _vg = A.view; A.view = p => p === 'cgrafo' ? run(async () => { await loadG(); S.view = 'cgrafo'; S.lo = 0; render(); }) : _vg(p);
  const add = k => { if (!G.work.has(k)) { G.work.add(k); G.dirty = true; } };
  Object.assign(A, {
    gkind: k => { G.kind = k; setWork(); render(); },
    gadd: () => { const f = $('#gf').value, t = $('#gt').value; G.from = f; G.to = t; if (f === 'admin') return toast('O administrador já contata todos'); add(f + '>' + t); render(); },
    gdel: k => { G.work.delete(k); G.dirty = true; render(); },
    gsave: () => run(async () => { const r = await api('/admin/contact-rules', { m: 'PUT', b: { kind: G.kind, edges: [...G.work].map(k => k.split('>')) } }); G.rules[G.kind] = { configured: true, edges: r.edges }; setWork(); toast('Regras salvas'); render(); }),
    greset: () => { if (!confirm('Voltar ao padrão do sistema para ' + KT[G.kind] + '?')) return; run(async () => { await api('/admin/contact-rules/' + G.kind, { m: 'DELETE' }); await loadG(); toast('Padrão restaurado'); render(); }); },
  });
  document.addEventListener('change', e => { const k = e.target.dataset && e.target.dataset.i; if (k === 'gf') G.from = e.target.value; else if (k === 'gt') G.to = e.target.value; });
  /* arrastar de uma bolha até outra cria a conexão; clicar numa seta remove */
  const svgPt = (svg, e) => { const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; return p.matrixTransform(svg.getScreenCTM().inverse()); };
  document.addEventListener('pointerdown', e => {
    const n = e.target.closest && e.target.closest('#gsvg [data-node]'); if (!n || S.view !== 'cgrafo') return;
    const svg = $('#gsvg'), from = n.dataset.node; if (from === 'admin') { toast('O administrador já contata todos'); return; }
    const a = pos(G.nodes.indexOf(from)), ln = document.createElementNS('http://www.w3.org/2000/svg', 'path'); ln.setAttribute('class', 'gtmp'); ln.setAttribute('stroke', KC[G.kind]); svg.append(ln); n.classList.add('grab');
    G.drag = { from, a, ln, svg, n }; e.preventDefault(); try { svg.setPointerCapture(e.pointerId); } catch { /* ok */ }
  });
  document.addEventListener('pointermove', e => { const d = G.drag; if (!d) return; const p = svgPt(d.svg, e); d.ln.setAttribute('d', `M${d.a.x} ${d.a.y} L${p.x} ${p.y}`); const t = document.elementFromPoint(e.clientX, e.clientY), tn = t && t.closest && t.closest('#gsvg [data-node]'); d.svg.querySelectorAll('.gnode.tgt').forEach(x => x.classList.remove('tgt')); if (tn && tn !== d.n) tn.classList.add('tgt'); });
  document.addEventListener('pointerup', e => {
    const d = G.drag; if (!d) return; G.drag = null; d.ln.remove(); d.n.classList.remove('grab');
    const t = document.elementFromPoint(e.clientX, e.clientY), tn = t && t.closest && t.closest('#gsvg [data-node]'), moved = Math.hypot(svgPt(d.svg, e).x - d.a.x, svgPt(d.svg, e).y - d.a.y) > R;
    if (tn && (tn !== d.n || moved)) { add(d.from + '>' + tn.dataset.node); render(); toast(nm(d.from) + ' → ' + nm(tn.dataset.node)); } else if (tn === d.n && !moved) { G.from = d.from; render(); }
  });
  document.addEventListener('click', e => { const ed = e.target.closest && e.target.closest('#gsvg .gedge'); if (ed && S.view === 'cgrafo') { G.work.delete(ed.dataset.e); G.dirty = true; render(); } });

  /* ---------- ícone do desktop: sempre visível, movível ---------- */
  const fab = document.createElement('button'); fab.id = 'homefab'; fab.type = 'button'; fab.setAttribute('aria-label', 'Ir para o desktop'); fab.title = 'Ir para o desktop — arraste para mover';
  fab.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/></svg>'; document.body.append(fab);
  const KEY = 'm3d_homefab', clamp = (x, y) => ({ x: Math.max(4, Math.min(innerWidth - 56, x)), y: Math.max(4, Math.min(innerHeight - 56, y)) });
  const place = (x, y) => { const p = clamp(x, y); fab.style.left = p.x + 'px'; fab.style.top = p.y + 'px'; return p; };
  const load = () => { try { const v = JSON.parse(localStorage.getItem(KEY)); if (v && isFinite(v.x)) return v; } catch { /* sem preferência */ } return { x: innerWidth - 66, y: innerHeight - 150 }; };
  place(load().x, load().y); addEventListener('resize', () => { const v = load(); place(v.x, v.y); });
  let fd = null; fab.addEventListener('pointerdown', e => { fd = { x0: e.clientX, y0: e.clientY, ox: fab.offsetLeft, oy: fab.offsetTop, moved: false }; fab.setPointerCapture(e.pointerId); });
  fab.addEventListener('pointermove', e => { if (!fd) return; const dx = e.clientX - fd.x0, dy = e.clientY - fd.y0; if (Math.hypot(dx, dy) > 6) fd.moved = true; if (fd.moved) place(fd.ox + dx, fd.oy + dy); });
  fab.addEventListener('pointerup', e => { if (!fd) return; const m = fd.moved; fd = null; if (m) { try { localStorage.setItem(KEY, JSON.stringify({ x: fab.offsetLeft, y: fab.offsetTop })); } catch { /* ok */ } } else A.gohome(); });
  fab.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); A.gohome(); } });
  setInterval(() => { fab.classList.toggle('on', !!S.me); }, 600);

  /* ---------- consentimento durante a videochamada ---------- */
  const CS = { v: null };
  const paintC = () => { const b = $('#ccons'); if (!b) return; const pac = S.me && S.me.role === 'paciente'; b.className = 'ccons ' + (CS.v === true ? 'ok' : CS.v === false ? 'no' : 'unk'); const t = CS.v === true ? 'Paciente consentiu' : CS.v === false ? 'Paciente não consentiu' : 'Consentimento ainda não registrado'; b.title = t + (pac ? '' : ' — clique para ' + (CS.v === true ? 'desativar' : 'ativar')); b.setAttribute('aria-label', b.title); b.querySelector('span').textContent = CS.v === true ? 'Consente' : CS.v === false ? 'Não consente' : 'Consent.'; };
  async function tickC() { const b = $('#ccons'); if (!b) return; const on = S.me && $('#call').classList.contains('on') && CALL.aid && !CALL.demo; b.hidden = !on; if (!on) { CS.v = null; return; } try { const st = await api('/consults/' + CALL.aid + '/state'); CS.v = S.me.role === 'paciente' ? st.consent : st.patientConsent; } catch { /* segue */ } paintC(); }
  setInterval(tickC, 4000);
  A.ccons = () => {
    if (S.me.role === 'paciente') return toast(CS.v === true ? 'Você consentiu com a transcrição' : CS.v === false ? 'Você não consentiu com a transcrição' : 'Se o profissional pedir transcrição, você será consultado');
    const next = CS.v !== true; if (!next && !confirm('Registrar que o paciente NÃO consente? A transcrição e o uso de IA sobre o áudio do paciente serão interrompidos nesta chamada.')) return;
    run(async () => { await api('/consults/' + CALL.aid + '/consent-pro', { m: 'PUT', b: { consent: next } }); CS.v = next; paintC(); toast(next ? 'Consentimento registrado' : 'Não consentimento registrado: transcrição do paciente interrompida'); });
  };
  { const _j = join; join = async (...a) => { document.querySelectorAll('#call .cc .off').forEach(b => b.classList.remove('off')); const r = await _j(...a); setTimeout(tickC, 300); return r; }; }

  /* ---------- atualização automática quando outra pessoa altera algo que me envolve ---------- */
  let rt = null;
  async function refreshNow() {
    if (!S.me) return; const a = document.activeElement; if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) { rt = setTimeout(refreshNow, 3000); return; }
    try { if (S.view === 'agenda' && typeof loadWeek === 'function') await loadWeek(); if (typeof A.dref === 'function' && typeof isDash === 'function' && isDash()) await A.dref(); S.con = await api('/contacts'); } catch { /* segue */ }
    render(); toast('Dados atualizados');
  }
  document.addEventListener('m3d:ev', e => { if (e.detail && e.detail.ev === 'refresh') { clearTimeout(rt); rt = setTimeout(refreshNow, 700); } });
})();
