// Testes de credenciais SEM gravar nada. Nunca devolve a chave; mensagens são genéricas.
import agora from 'agora-token';
const { RtcTokenBuilder, RtcRole } = agora;
const T = 8000, bad = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|.*\.(local|internal|localdomain)$)/i;
const http = async (url, o = {}) => { try { return (await fetch(url, { ...o, signal: AbortSignal.timeout(T) })).status; } catch { return 0; } };
const verdict = (s, okMsg) => s === 200 ? { ok: true, message: okMsg } : s === 429 ? { ok: true, warn: true, message: 'A chave é válida, mas o provedor informa limite de uso no momento.' } : s === 0 ? { ok: false, message: 'Sem conexão com o provedor (verifique a saída de rede do servidor).' } : s === 400 || s === 401 || s === 403 ? { ok: false, message: 'O provedor recusou esta chave. Confira se copiou inteira e se está ativa.' } : { ok: false, message: `Resposta inesperada do provedor (HTTP ${s}).` };
export async function testService(service, v = {}) {
  if (service === 'agora') {
    if (!/^[0-9a-f]{32}$/i.test(v.AGORA_APP_ID || '') || !/^[0-9a-f]{32}$/i.test(v.AGORA_APP_CERTIFICATE || '')) return { ok: false, message: 'App ID e Certificado do Agora têm 32 caracteres hexadecimais cada.' };
    try { RtcTokenBuilder.buildTokenWithUid(v.AGORA_APP_ID, v.AGORA_APP_CERTIFICATE, 'teste', 1, RtcRole.PUBLISHER, 60, 60); return { ok: true, warn: true, message: 'Formato válido e token de teste gerado. A conexão real só é confirmada na primeira videochamada.' }; } catch { return { ok: false, message: 'Não foi possível gerar um token com estes valores.' }; }
  }
  if (service === 'gemini') return verdict(await http('https://generativelanguage.googleapis.com/v1beta/models', { headers: { 'x-goog-api-key': v.GEMINI_API_KEY || '' } }), 'Chave do Gemini aceita.');
  if (service === 'anthropic') return verdict(await http('https://api.anthropic.com/v1/models', { headers: { 'x-api-key': v.ANTHROPIC_API_KEY || '', 'anthropic-version': '2023-06-01' } }), 'Chave da Anthropic aceita.');
  if (service === 'openai') {
    const base = v.OPENAI_BASE_URL || 'https://api.openai.com/v1'; let h; try { const u = new URL(base); if (u.protocol !== 'https:') throw 0; h = u.hostname; } catch { return { ok: false, message: 'O endereço precisa ser https.' }; }
    if (bad.test(h)) return { ok: false, message: 'Endereço local/interno não é aceito (o “modelfarm” local só existe dentro do Replit). Use https://api.openai.com/v1.' };
    return verdict(await http(base.replace(/\/$/, '') + '/models', { headers: { authorization: 'Bearer ' + (v.OPENAI_API_KEY || '') } }), 'Chave da OpenAI aceita.');
  }
  if (service === 'paypal') { const b = v.PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com'; return verdict(await http(b + '/v1/oauth2/token', { method: 'POST', headers: { authorization: 'Basic ' + Buffer.from((v.PAYPAL_CLIENT_ID || '') + ':' + (v.PAYPAL_CLIENT_SECRET || '')).toString('base64'), 'content-type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials' }), 'Credenciais do PayPal aceitas.'); }
  if (service === 'twilio') { if (!/^AC[0-9a-f]{32}$/i.test(v.TWILIO_SID || '')) return { ok: false, message: 'O Account SID do Twilio começa com AC e tem 34 caracteres.' }; return verdict(await http(`https://api.twilio.com/2010-04-01/Accounts/${v.TWILIO_SID}.json`, { headers: { authorization: 'Basic ' + Buffer.from(v.TWILIO_SID + ':' + (v.TWILIO_TOKEN || '')).toString('base64') } }), 'Credenciais do Twilio aceitas.'); }
  return { ok: false, message: 'Serviço desconhecido.' };
}
