/* Equipes: administradores de equipe, propostas de integração (valores por consulta e % da equipe), chamadas entre profissionais com bloqueio e repasses. */
(() => {
  const Q = { tab: 'eq', mine: null, props: [], tprops: [], calls: [], sett: null, teams: [], cand: {}, f: { fee: '', pct: '', model: 'por_chamada', currency: 'BRL', conditions: '', summary: '', prompt: '', pro: '' }, files: [], ai: null, busy: false };
  const ICON = '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.4"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M15 14.5c3 0 6 1.6 6 5.5"/>';
  const can = () => S.me && (HLT(S.me.role) || S.me.role === 'admin');
  const HOME = HOME_APPS.findIndex(a => a[0] === 'cfg');
  HOME_APPS.splice(HOME < 0 ? HOME_APPS.length : HOME, 0, ['equipes', 'Equipes', ICON, '#7a5bd6', can]);
  HDESC.equipes = 'Equipes, propostas de integração, chamadas e repasses';
  const isG = () => S.me && S.me.role === 'admin', isTA = () => !!(Q.mine && Q.mine.team && Q.mine.isAdmin), tid = () => Q.mine && Q.mine.team && Q.mine.team.id;
  const money = (v, c) => (c || 'BRL') + ' ' + Number(v || 0).toFixed(2), dt = t => t ? new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
  const MODEL = { por_chamada: 'por chamada', por_paciente: 'uma vez por paciente' }, ST = { enviada: 'aguardando resposta', aceita: 'aceita', recusada: 'recusada', cancelada: 'cancelada', expirada: 'expirada' };
  const KIND = { interna: 'interna', externa: 'externa', livre: 'autônomos' }, CST = { pendente: 'tocando', aceita: 'atendida', recusada: 'recusada', cancelada: 'cancelada', sem_resposta: 'sem resposta', bloqueada: 'bloqueada' };
  async function form(path, data, files) {
    const fm = new FormData(); fm.append('data', JSON.stringify(data)); files.forEach(f => fm.append('file', f, f.name));
    const r = await fetch('/api' + path, { method: 'POST', body: fm }), j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Erro ' + r.status); return j;
  }
  async function load() {
    Q.mine = await api('/teams/mine').catch(() => ({ team: null }));
    Q.props = HLT(S.me.role) ? await api('/proposals/mine').catch(() => []) : [];
    if (isTA() || (isG() && tid())) { const id = tid(); [Q.calls, Q.tprops, Q.sett] = await Promise.all([api(`/teams/${id}/calls`).catch(() => []), api(`/teams/${id}/proposals`).catch(() => []), api(`/teams/${id}/settlements`).catch(() => null)]); }
    else if (HLT(S.me.role) && Q.mine.team) Q.sett = { items: await api('/settlements/mine').catch(() => []), mine: true };
    else Q.sett = null;
    if (isG()) Q.teams = await api('/teams').catch(() => []);
    if (!Q.tabs().includes(Q.tab)) Q.tab = 'eq'; render();
  }
  Q.tabs = () => ['eq', 'pr', ...(isTA() ? ['ch', 'np'] : []), ...(Q.sett ? ['re'] : []), ...(isG() ? ['gl'] : [])];
  const TL = { eq: 'Minha equipe', pr: 'Propostas recebidas', ch: 'Chamadas da equipe', np: 'Propor integração', re: 'Repasses', gl: 'Todas as equipes' };
  const termsH = t => t ? `<p>${money(t.fee, t.currency)} ${ES('por consulta')} · <b>${Number(t.team_pct)}%</b> ${ES('para a equipe')} (${ES(MODEL[t.model] || '')})</p>${t.summary ? `<p class="mu">${E(t.summary)}</p>` : ''}${t.conditions ? `<details><summary>${ES('Condições')}</summary><p style="white-space:pre-wrap">${E(t.conditions)}</p></details>` : ''}` : `<p class="mu">${ES('Sem condições financeiras registradas.')}</p>`;
  const filesH = (p, pid) => (p.files || []).map(f => `<a href="/api/proposals/${pid}/files/${f.id}" download>${E(f.name)}</a>`).join(' · ');
  function tEq() {
    const m = Q.mine;
    if (!m.team) return `<div class="cd"><h3>${ES('Você é profissional autônomo(a) (freelancer)')}</h3><p class="mu">${ES('Você pode chamar e receber chamadas de qualquer profissional. Para integrar uma equipe, o administrador dela envia uma proposta e você aceita as condições na aba Propostas recebidas.')}</p></div>`;
    const mem = m.members.map(x => `<div class="dr"><i class="onl" style="background:${x.online ? '#22c55e' : '#9aa5b1'}"></i><span class="tcn"><b>${E(x.name)}</b> <span class="mu">${x.cargo ? E(x.cargo) : ES(ROLE[x.role] || '')}${x.teamRole === 'admin' ? ' · ' + ES('administrador') : ''}</span></span>${m.isAdmin && x.id !== S.me.id ? `<button data-a="eqrole" data-p="${x.id}:${x.teamRole === 'admin' ? 'membro' : 'admin'}">${ES(x.teamRole === 'admin' ? 'Tornar membro' : 'Tornar administrador')}</button><button class="dng" data-a="eqrm" data-p="${x.id}">${ES('Remover')}</button>` : ''}</div>`).join('');
    return `<div class="cd"><h3>${E(m.team.name)}</h3><p class="mu">${ES(m.isAdmin ? 'Você administra esta equipe: é avisado das chamadas dos profissionais dela e pode bloquear qualquer chamada a qualquer momento.' : 'Seu administrador é avisado das suas chamadas e pode bloqueá-las.')}</p></div>
      <div class="cd"><h3>${ES('Suas condições')}</h3>${termsH(m.terms)}</div><div class="cd"><h3>${ES('Membros')}</h3>${mem}${m.isAdmin ? '' : `<p><button class="dng" data-a="eqrm" data-p="${S.me.id}">${ES('Sair da equipe')}</button></p>`}</div>`;
  }
  const tPr = () => !Q.props.length ? `<div class="cd"><p class="mu">${ES('Nenhuma proposta recebida.')}</p></div>` : Q.props.map(p => `<div class="cd"><h3>${E(p.team)} <span class="mu">· ${ES(ST[p.status] || p.status)}</span></h3>${termsH({ fee: p.fee, currency: p.currency, team_pct: p.teamPct, model: p.model, summary: p.summary, conditions: p.conditions })}${p.files.length ? `<p>${filesH(p, p.id)}</p>` : ''}<p class="mu">${dt(p.at)}${p.status === 'enviada' ? ' · ' + ES('vale até') + ' ' + dt(p.expiresAt) : ''}${p.declineReason ? ' · ' + E(p.declineReason) : ''}</p>${p.status === 'enviada' ? `<p>${Q.mine && Q.mine.team && Q.mine.team.id !== p.teamId ? `<span class="mu">${ES('Você já está em outra equipe: saia dela para aceitar.')}</span>` : `<button class="pbtn" data-a="eqacc" data-p="${p.id}">${ES('Aceitar condições e integrar a equipe')}</button>`} <button class="dng" data-a="eqdec" data-p="${p.id}">${ES('Recusar')}</button></p>` : ''}</div>`).join('');
  const tCh = () => `<div class="cd"><h3>${ES('Chamadas entre profissionais')}</h3><p class="mu">${ES('As chamadas não dependem da sua aprovação. Você pode bloquear a qualquer momento: a chamada em curso é encerrada e o repasse, anulado.')}</p>${Q.calls.length ? Q.calls.map(c => `<div class="dr"><span class="tcn"><b>${E(c.requester)}</b>${c.requesterTeam ? ` <span class="mu">(${E(c.requesterTeam)})</span>` : ''} → <b>${E(c.target)}</b>${c.targetTeam ? ` <span class="mu">(${E(c.targetTeam)})</span>` : ''}<br><span class="mu">${ES(KIND[c.kind] || c.kind)} · ${ES(CST[c.status] || c.status)}${c.byAdmin ? ' · ' + ES('chamada de administrador') : ''} · ${dt(c.at)}${c.blockReason ? ' · ' + E(c.blockReason) : ''}</span></span>${c.ongoing ? `<button class="dng" data-a="eqblk" data-p="${c.id}">${ES('Bloquear')}</button>` : ''}</div>`).join('') : `<p class="mu">${ES('Nenhuma chamada nos últimos 30 dias.')}</p>`}</div>`;
  function tNp() {
    const id = tid(), f = Q.f, cand = (Q.cand[id] || []).filter(x => !x.member);
    const sent = Q.tprops.map(p => `<div class="dr"><span class="tcn"><b>${E(p.professional)}</b> <span class="mu">· ${ES(ST[p.status] || p.status)} · ${money(p.fee, p.currency)} · ${p.teamPct}% · ${dt(p.at)}</span>${p.declineReason ? `<br><span class="mu">${E(p.declineReason)}</span>` : ''}</span>${p.status === 'enviada' ? `<button data-a="eqpcan" data-p="${p.id}">${ES('Cancelar')}</button>` : ''}</div>`).join('');
    return `<div class="cd"><h3>${ES('Nova proposta de integração')}</h3><p class="mu">${ES('Descreva o plano de negócios da equipe em um prompt e/ou anexe PDF ou texto. A IA sugere os valores; você revisa e envia. O profissional só entra na equipe se aceitar as condições.')}</p>
      <label class="mu">${ES('Profissional')}</label><select id="qpro" data-f="pro"><option value="">${ES('Escolha…')}</option>${cand.map(x => `<option value="${x.id}" ${f.pro === x.id ? 'selected' : ''}>${E(x.name)} · ${E(x.cargo || ROLE[x.role] || '')}</option>`).join('')}</select>
      <label class="mu">${ES('Prompt do plano de negócios')}</label><textarea data-f="prompt" rows="4" maxlength="6000" placeholder="${ES('Ex.: Cobramos R$ 150 por consulta; a equipe fica com 20% de cada chamada; atendimentos de retorno do mesmo paciente não pagam taxa.')}">${E(f.prompt)}</textarea>
      <label class="mu">${ES('Arquivos do plano (PDF, TXT, MD — até 3, 4 MB cada)')}</label><input type="file" id="qfile" accept=".pdf,.txt,.md,.csv,application/pdf,text/plain,text/markdown" multiple>${Q.files.length ? `<p class="mu">${Q.files.map(x => E(x.name)).join(' · ')}</p>` : ''}
      <p><button data-a="eqai" ${Q.busy ? 'disabled' : ''}>${ES(Q.busy ? 'Analisando…' : 'Analisar com IA')}</button>${Q.ai ? ` <span class="mu">${Q.ai.ai ? ES('Sugestão da IA abaixo — revise antes de enviar.') : E(Q.ai.error || '')}</span>` : ''}</p>
      <div class="g2"><div><label class="mu">${ES('Valor por consulta')}</label><input data-f="fee" inputmode="decimal" value="${E(f.fee)}"></div><div><label class="mu">${ES('Moeda')}</label><select data-f="currency">${['BRL', 'USD', 'EUR', 'PYG'].map(c => `<option ${f.currency === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div></div>
      <div class="g2"><div><label class="mu">${ES('% da equipe')}</label><input data-f="pct" inputmode="decimal" value="${E(f.pct)}"></div><div><label class="mu">${ES('Cobrança da %')}</label><select data-f="model"><option value="por_chamada" ${f.model === 'por_chamada' ? 'selected' : ''}>${ES('Em toda chamada')}</option><option value="por_paciente" ${f.model === 'por_paciente' ? 'selected' : ''}>${ES('Só na 1ª chamada com cada paciente')}</option></select></div></div>
      <label class="mu">${ES('Resumo')}</label><textarea data-f="summary" rows="2" maxlength="1500">${E(f.summary)}</textarea><label class="mu">${ES('Condições')}</label><textarea data-f="conditions" rows="4" maxlength="4000">${E(f.conditions)}</textarea>
      <p><button class="pbtn" data-a="eqsend" ${Q.busy ? 'disabled' : ''}>${ES('Enviar proposta')}</button></p></div>${sent ? `<div class="cd"><h3>${ES('Propostas enviadas')}</h3>${sent}</div>` : ''}`;
  }
  const tRe = () => { const s = Q.sett, tot = s.totals ? Object.entries(s.totals).map(([c, v]) => `${money(v.team, c)} ${ES('equipe')} · ${money(v.pro, c)} ${ES('profissionais')}`).join(' | ') : ''; return `<div class="cd"><h3>${ES('Repasses')}</h3>${tot ? `<p><b>${tot}</b></p>` : ''}${(s.items || []).length ? s.items.map(r => `<div class="dr"><span class="tcn"><b>${E(s.mine ? r.team : r.professional)}</b> ${r.patient ? '· ' + E(r.patient) : ''}<br><span class="mu">${dt(r.at)} · ${money(r.fee, r.currency)} → ${ES('equipe')} ${money(r.teamAmount, r.currency)} (${r.teamPct}%) · ${ES('profissional')} ${money(r.proAmount, r.currency)} · ${ES(r.status)}</span></span>${!s.mine && r.status !== 'anulado' ? `<button data-a="eqpay" data-p="${r.id}:${r.status === 'pago' ? 'pendente' : 'pago'}">${ES(r.status === 'pago' ? 'Reabrir' : 'Marcar pago')}</button>` : ''}</div>`).join('') : `<p class="mu">${ES('Nenhum repasse ainda.')}</p>`}</div>`; };
  const tGl = () => `<div class="cd"><h3>${ES('Criar equipe')}</h3><input id="qtn" maxlength="80" placeholder="${ES('Nome da equipe')}"><input id="qtd" maxlength="500" placeholder="${ES('Descrição (opcional)')}"><p><button class="pbtn" data-a="eqnew">${ES('Criar equipe')}</button></p></div>${Q.teams.map(t => `<div class="cd"><h3>${E(t.name)} <span class="mu">· ${t.members} ${ES('membros')}${t.active ? '' : ' · ' + ES('inativa')}</span></h3><p class="mu">${ES('Administradores')}: ${E(t.admins || '—')}</p>${Q.cand[t.id] ? `<select id="qa${t.id}">${Q.cand[t.id].filter(x => !x.member).map(x => `<option value="${x.id}">${E(x.name)}</option>`).join('')}</select> <button data-a="eqadm" data-p="${t.id}">${ES('Definir como administrador')}</button>` : `<button data-a="eqcand" data-p="${t.id}">${ES('Adicionar administrador')}</button>`} <button data-a="eqact" data-p="${t.id}:${t.active ? 0 : 1}">${ES(t.active ? 'Desativar' : 'Ativar')}</button></div>`).join('')}`;
  CENTER.equipes = () => {
    if (!Q.mine) return bar('Equipes') + `<div class="cv"><p class="mu">${ES('Carregando…')}</p></div>`;
    const tabs = Q.tabs().map(t => `<button class="${Q.tab === t ? 'pbtn' : ''}" data-a="eqtab" data-p="${t}">${ES(TL[t])}${t === 'pr' && Q.props.some(p => p.status === 'enviada') ? ' •' : ''}</button>`).join(' ');
    const body = { eq: tEq, pr: tPr, ch: tCh, np: tNp, re: () => Q.sett ? tRe() : '', gl: tGl }[Q.tab]();
    return bar('Equipes') + `<div class="cv"><p>${tabs}</p>${body}</div>`;
  };
  const _v = A.view; A.view = p => p === 'equipes' ? run(async () => { S.view = 'equipes'; S.lo = 0; Q.mine = null; render(); await load(); }) : _v(p);
  // Os campos do formulário ficam guardados para não se perderem quando a tela é redesenhada.
  document.addEventListener('input', e => { const k = e.target && e.target.dataset && e.target.dataset.f; if (k && S.view === 'equipes') Q.f[k] = e.target.value; });
  document.addEventListener('change', e => { if (e.target && e.target.id === 'qfile') { Q.files = [...e.target.files].slice(0, 3); render(); } });
  const reload = () => load();
  const body = () => ({ professionalId: Q.f.pro, prompt: Q.f.prompt, provider: Q.ai && Q.ai.provider, terms: { fee: Q.f.fee, team_pct: Q.f.pct, model: Q.f.model, currency: Q.f.currency, conditions: Q.f.conditions, summary: Q.f.summary } });
  Object.assign(A, {
    eqtab: t => { Q.tab = t; if (t === 'np' && !Q.cand[tid()]) api(`/teams/${tid()}/candidates`).then(r => { Q.cand[tid()] = r; render(); }).catch(() => {}); render(); },
    eqrole: p => run(async () => { const [u, r] = p.split(':'); await api(`/teams/${tid()}/members/${u}`, { m: 'PUT', b: { role: r } }); await reload(); }),
    eqrm: u => run(async () => { if (!confirm(ES('Confirmar?'))) return; await api(`/teams/${tid()}/members/${u}`, { m: 'DELETE' }); await reload(); }),
    eqacc: id => run(async () => { if (!confirm(ES('Aceitar as condições e integrar a equipe?'))) return; const r = await api(`/proposals/${id}/accept`, { m: 'POST' }); toast('Você integrou a equipe ' + r.team); Q.tab = 'eq'; await reload(); }),
    eqdec: id => run(async () => { const reason = prompt(ES('Motivo (opcional)')) || ''; await api(`/proposals/${id}/decline`, { m: 'POST', b: { reason } }); await reload(); }),
    eqpcan: id => run(async () => { await api(`/proposals/${id}/cancel`, { m: 'POST' }); await reload(); }),
    eqblk: id => run(async () => { const reason = prompt(ES('Motivo do bloqueio (opcional)')); if (reason === null) return; await api(`/calls/${id}/block`, { m: 'POST', b: { reason } }); toast('Chamada bloqueada'); await reload(); }),
    eqpay: p => run(async () => { const [id, st] = p.split(':'); await api(`/settlements/${id}/status`, { m: 'POST', b: { status: st } }); await reload(); }),
    eqai: () => run(async () => {
      Q.busy = true; render();
      try { const r = await form(`/teams/${tid()}/proposals/analyze`, { prompt: Q.f.prompt }, Q.files); Q.ai = r; if (r.ai) { const t = r.terms; Object.assign(Q.f, { fee: t.fee ?? Q.f.fee, pct: t.team_pct ?? Q.f.pct, model: t.model, currency: t.currency, conditions: t.conditions || Q.f.conditions, summary: t.summary || Q.f.summary }); } } finally { Q.busy = false; render(); }
    }),
    eqsend: () => run(async () => {
      Q.busy = true; render();
      try { await form(`/teams/${tid()}/proposals`, body(), Q.files); toast('Proposta enviada ao profissional'); Q.f = { fee: '', pct: '', model: 'por_chamada', currency: 'BRL', conditions: '', summary: '', prompt: '', pro: '' }; Q.files = []; Q.ai = null; } finally { Q.busy = false; }
      await reload();
    }),
    eqnew: () => run(async () => { await api('/teams', { m: 'POST', b: { name: $('#qtn').value.trim(), description: $('#qtd').value.trim() || undefined } }); toast('Equipe criada'); await reload(); }),
    eqcand: id => run(async () => { Q.cand[id] = await api(`/teams/${id}/candidates`); render(); }),
    eqadm: id => run(async () => { const u = $('#qa' + id).value; if (!u) return; await api(`/teams/${id}/members/${u}`, { m: 'PUT', b: { role: 'admin' } }); delete Q.cand[id]; await reload(); }),
    eqact: p => run(async () => { const [id, a] = p.split(':'); await api(`/teams/${id}`, { m: 'PATCH', b: { active: a === '1' } }); await reload(); }),
  });
})();
