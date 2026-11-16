/* Tradução automática (IA) das mensagens recebidas: opcional, por usuário, exige consentimento de IA. A tradução aparece sob a mensagem original. */
(() => {
  const pend = new Set(); let busy = false, off = 0;
  const myLang = () => (window.I18N ? I18N.lang : (S.me && S.me.lang)) || 'pt';
  const todo = () => (S.msgs || []).filter(m => m.sender_id !== S.me.id && m.lang && m.lang !== myLang() && !S.trn[m.id] && !pend.has(m.id)).slice(0, 20);
  async function tick() {
    if (busy || !S.me || !S.me.auto_translate || S.view !== 'chat' || !S.room || Date.now() < off) return;
    const l = todo(); if (!l.length) return; busy = true; l.forEach(m => pend.add(m.id));
    try { const r = await api('/messages/translate', { m: 'POST', b: { ids: l.map(m => m.id), to: myLang() } }); let n = 0; for (const [id, t] of Object.entries(r.out || {})) { S.trn[id] = t; n++; } if (n) render(); }
    catch (e) { off = Date.now() + 60000; if (/limite/.test(e.message || '')) toast('Limite diário de traduções por IA atingido'); }
    finally { busy = false; }
  }
  setInterval(tick, 1500);
  const _d = typeof dskCard === 'function' ? dskCard : null;
  if (_d) dskCard = function () {
    const on = !!(S.me && S.me.auto_translate);
    return `<div class="cd dtt" style="margin-top:12px"><h3>${ES('Tradução automática com IA')}</h3><p class="mu">${ES('Traduz sozinha, para o seu idioma, as mensagens que você recebe em outro idioma. O original continua visível e o texto das mensagens é enviado ao provedor de IA configurado, por isso exige o seu consentimento para uso de IA.')}</p><label class="chk" style="display:flex;gap:8px;align-items:center"><input type="checkbox" data-i="autotr" ${on ? 'checked' : ''}> ${ES('Traduzir mensagens recebidas automaticamente')}</label></div>` + _d();
  };
  document.addEventListener('change', e => {
    const t = e.target; if (!t.dataset || t.dataset.i !== 'autotr') return;
    run(async () => {
      if (t.checked && !S.me.ai_consent) { if (!confirm('Autorizo o uso de IA para traduzir as mensagens que recebo (o texto será enviado ao provedor de IA configurado).')) { t.checked = false; return; } await api('/me/consent', { m: 'PATCH', b: { aiConsent: true } }); S.me.ai_consent = true; }
      await api('/me/auto-translate', { m: 'PATCH', b: { on: t.checked } }); S.me.auto_translate = t.checked; off = 0; toast(t.checked ? 'Tradução automática ligada' : 'Tradução automática desligada'); render();
    });
  });
})();
