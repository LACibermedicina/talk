/* Dicas ao passar o mouse: logo em seguida o nome do ícone; se o mouse demorar, aparece também o resumo do que há dentro da funcionalidade. */
(() => {
  const SHORT = 400, LONG = 1700, SEL = '.happ,.rb,.dk,.pstk,.tbi,.mhome,[data-tip],button[aria-label],[data-a][title],a[title],[role=button][aria-label]';
  const TIPD = { gohome: 'Volta ao desktop com todas as funcionalidades.', menu: 'Abre o menu lateral com contatos, conversas e atalhos.', ntp: 'Lista os avisos e alertas recentes; marque como lidos.', rdesk: 'Restaura quadros, post-its, dock e menu lateral para o padrão.', tcall: 'Envia um pedido de videochamada; quem recebe pode atender ou recusar.', eqblk: 'Encerra a chamada em curso e anula o repasse.' };

  // Descrições dos botões dos submenus (barra de ações sob o título): por ação; algumas dependem do parâmetro (aba/painel).
  const RA = {
    dref: 'Recarrega os dados e redesenha todos os painéis desta funcionalidade.', dreset: 'Devolve os painéis à posição e ao tamanho originais.', dopenall: 'Abre todos os painéis desta funcionalidade de uma vez.', dminall: 'Reduz todos os painéis a ícones ao lado da barra, sem perder o que estava neles.', dclall: 'Fecha todos os quadros abertos desta funcionalidade e volta ao desktop.',
    cwpdf: 'Gera um PDF do resultado do caso, pronto para imprimir ou guardar.', cwcopy: 'Copia o texto do resultado para colar em outro lugar.', cwpin: 'Fixa este resultado como quadro no desktop para consultar depois.',
    ktr: 'Liga ou desliga a transcrição da consulta. O paciente precisa estar de acordo; o áudio vira texto durante a chamada.', cbmin: 'Reduz a videochamada a uma janela pequena para você trabalhar nas outras telas.', cbmax: 'Amplia a videochamada para ocupar a tela.',
    kmins: 'Atualiza o resumo da conversa, agrupada por minuto.', kcopymins: 'Copia o histórico minuto a minuto da consulta.', ksup: 'Pede novo apoio cognitivo agora: resumo do caso, alertas e condutas sugeridas a partir do que foi dito.',
    krepgen: 'A IA redige o relatório de evolução da consulta a partir da transcrição e do caso. É um rascunho para você revisar.', krepedit: 'Alterna entre ler e editar o texto do relatório.', krepsave: 'Salva o relatório editado no prontuário.', krepcopy: 'Copia o relatório para a área de transferência.', krepprint: 'Abre a impressão para imprimir ou salvar o relatório em PDF.',
    famk: 'Alterna entre o familiograma (a família) e o ecomapa (a rede de apoio ao redor do paciente).', famgen: 'A IA monta ou atualiza o mapa a partir do prontuário. Revise antes de usar.', famedit: 'Abre o mapa para edição manual.', famsave: 'Salva as alterações do mapa.', famprint: 'Imprime ou salva o mapa em PDF.'
  };
  const RP = {
    'ktab:trans:live': 'Transcrição em tempo real da consulta, falante a falante.', 'ktab:trans:est': 'Transcrição organizada em queixa, história, achados e conduta.', 'ktab:lib:mat': 'Protocolos e materiais de referência, ordenados pela hierarquia definida.', 'ktab:lib:pref': 'Suas preferências clínicas locais, que a IA considera nas sugestões.', 'ktab:lib:ord': 'Define a ordem de prioridade dos protocolos: ministério, sociedades, OMS e materiais pessoais.',
    'kt:live': 'Abre a transcrição ao vivo da consulta.', 'kt:est': 'Abre a transcrição estruturada da consulta.', 'kopen:hist': 'Abre o histórico da conversa agrupado por minuto.', 'kopen:sup': 'Abre o apoio cognitivo: resumo do caso, interações medicamentosas, riscos e condutas sugeridas.', 'kopen:rep': 'Abre o relatório da consulta gerado pela IA.', 'kopen:lib': 'Abre a biblioteca de protocolos e as suas preferências clínicas.',
    'agenda:fn': 'Atalhos da agenda: nova consulta, nova nota e navegação entre semanas.', 'tarefas:cal': 'Calendário com as tarefas e os prazos do mês.', 'tarefas:today': 'O que precisa ser feito hoje.', 'tarefas:new': 'Cria uma tarefa e define responsável e prazo.', 'tarefas:rep': 'Quantas tarefas cada responsável tem e o que está em atraso.', 'tarefas:st': 'Panorama das tarefas por situação.',
    'fin:sum': 'Entradas, saídas e saldo do mês.', 'fin:rep': 'Relatório detalhado de entradas e saídas.', 'fin:inad': 'Quem está em atraso e há quanto tempo.', 'fin:fn': 'Registrar pagamentos, emitir cobranças e exportar.',
    'users:sum': 'Quantos usuários há por tipo e situação.', 'users:pend': 'Cadastros que aguardam a sua aprovação.', 'users:fn': 'Criar usuários, redefinir senhas e inativar contas.', 'users:reg': 'Lista de usuários, tipo, registro profissional e vínculos.',
    'integ:cfg': 'Chaves de vídeo, pagamentos, SMS, IA e plataforma de estudos de caso.', 'integ:sec': 'Como as chaves são guardadas e testadas, sem nunca serem exibidas.', 'integ:fn': 'Ações relacionadas às integrações.',
    'audit:log': 'Alertas de segurança e o registro de ações, na ordem em que aconteceram.', 'audit:sum': 'Resumo de eventos de segurança recentes.', 'audit:rep': 'Relatório das ações registradas por usuário e tipo.', 'audit:fn': 'Exportar e verificar a integridade do registro.',
    'grafo:map': 'Mapa visual de quem se relaciona com quem: pacientes, profissionais e equipe.', 'hist:log': 'Linha do tempo das atividades recentes.', 'notas:nb': 'Seu bloco de anotações importantes.', 'notif:nt': 'Avisos e alertas do sistema.', 'cfg:cf': 'Idioma, país, IA, aparência e conta.', 'cfg:ag': 'Sua agenda de consultas e notas.'
  };
  let tip, timer1, timer2, cur = null;
  const el = () => { if (!tip) { tip = document.createElement('div'); tip.id = 'tipx'; tip.setAttribute('role', 'tooltip'); tip.innerHTML = '<b></b><small></small>'; document.body.append(tip); } return tip; };
  const T = s => { try { return typeof ES === 'function' ? ES(s) : s; } catch { return s; } };
  function info(t) {
    let label = t.dataset.tip || '', d = t.dataset.tipd || '';
    const h = t.querySelector('.htip b'); if (h) label = label || h.textContent;
    if (!label) { const ti = t.getAttribute('title'); if (ti) { t.dataset.tt = ti; t.removeAttribute('title'); } label = t.dataset.tt || ''; }
    if (!label) { label = t.getAttribute('aria-label') || ''; if (t.classList.contains('happ')) label = label.split(':')[0]; }
    if (!d) {
      const a = t.dataset.a, p = t.dataset.p;
      if (t.classList.contains('happ') && typeof HDESC !== 'undefined') d = HDESC[p] || '';
      if (!d) d = (t.classList.contains('rb') && (RP[a + ':' + p] || (a === 'dkc' ? RP[(typeof S !== 'undefined' ? S.view : '') + ':' + p] : '') || RA[a])) || TIPD[a] || '';
      if (!d && t.classList.contains('rb')) { const r = t.closest('.rib'); d = r ? 'Pertence a: ' + r.getAttribute('aria-label') : ''; }
      if (!d && t.classList.contains('dk')) { const v = typeof S !== 'undefined' && S.view; d = 'Painel desta funcionalidade; clique para abrir ou minimizar.' + (v && typeof HDESC !== 'undefined' && HDESC[v] ? ' Aqui: ' + HDESC[v] + '.' : ''); }
      if (!d && a === 'view' && typeof HDESC !== 'undefined') d = HDESC[p] || '';
    }
    return { label: label.trim(), d: d.trim() };
  }
  function place(t) {
    const x = el(), r = t.getBoundingClientRect(), w = x.offsetWidth, h = x.offsetHeight;
    let top = r.top - h - 10; if (top < 6) top = r.bottom + 10; if (top + h > innerHeight - 6) top = Math.max(6, innerHeight - h - 6);
    let left = r.left + r.width / 2 - w / 2; left = Math.max(6, Math.min(left, innerWidth - w - 6));
    x.style.top = top + 'px'; x.style.left = left + 'px';
  }
  function hide() { clearTimeout(timer1); clearTimeout(timer2); cur = null; if (tip) tip.className = ''; }
  function start(t) {
    if (t === cur) return; hide(); if (t.closest('.hpop,.flagrow') || t.classList.contains('hgb')) return; const i = info(t); if (!i.label) return; cur = t;
    const rb = t.classList.contains('rb'); timer1 = setTimeout(() => { if (cur !== t || !t.isConnected) return; const x = el(); x.querySelector('b').textContent = i.label; x.querySelector('small').textContent = ''; x.className = 'on'; place(t); }, rb ? 250 : SHORT);
    if (i.d) timer2 = setTimeout(() => { if (cur !== t || !t.isConnected) return; const x = el(); x.querySelector('small').textContent = T(i.d); x.className = 'on lg'; place(t); }, rb ? 800 : LONG);
  }
  document.addEventListener('pointerover', e => { if (e.pointerType && e.pointerType !== 'mouse') return; const t = e.target.closest && e.target.closest(SEL); if (t) start(t); else if (cur) hide(); });
  document.addEventListener('focusin', e => { const t = e.target.closest && e.target.closest(SEL); if (t && t.matches(':focus-visible')) start(t); });
  for (const ev of ['pointerdown', 'keydown', 'scroll', 'focusout']) document.addEventListener(ev, hide, true);
  document.addEventListener('pointerleave', hide, true);
})();
