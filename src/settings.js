// Credenciais de integração gravadas CIFRADAS no banco (app_settings). O valor gravado vale imediatamente (process.env) e a cada reinício.
import { q } from './db.js';
import { enc, dec } from './crypto.js';
export const KEYS = {
  AGORA_APP_ID: /^[0-9a-f]{32}$/i, AGORA_APP_CERTIFICATE: /^[0-9a-f]{32}$/i,
  GEMINI_API_KEY: /^[\w.-]{20,200}$/, OPENAI_API_KEY: /^[\w-]{20,300}$/, OPENAI_BASE_URL: /^https:\/\/[\w.-]+(:\d+)?(\/[\w./-]*)?$/, ANTHROPIC_API_KEY: /^[\w-]{20,300}$/,
  PROTOCOL_ORDER: /^(ministerio|sociedade|oms|personal|geral)(,(ministerio|sociedade|oms|personal|geral)){4}$/,
  SIGNUP_MODE: /^(off|approval|open)$/, AI_PROVIDERS: /^(gemini|openai|anthropic)(,(gemini|openai|anthropic)){0,2}$/, STT_PROVIDERS: /^(openai|gemini)(,(openai|gemini))?$/,
  BILLING_ENFORCE: /^(true|false)$/, AMB_MAX_GROUPS: /^\d{1,3}$/, AMB_MAX_TOKENS: /^\d{1,4}$/, AMB_MAX_USES: /^\d{1,4}$/, AMB_MAX_CREDITS: /^\d{1,6}$/, AMB_MAX_TRIAL_DAYS: /^\d{1,3}$/, AMB_REWARD: /^\d{1,6}$/, AMB_PLAN: /^[a-z][a-z0-9_-]{2,29}$/,
  PAYPAL_ENV: /^(sandbox|live)$/, PAYPAL_CLIENT_ID: /^[\w-]{10,200}$/, PAYPAL_CLIENT_SECRET: /^[\w-]{10,200}$/,
  TWILIO_SID: /^AC[0-9a-f]{32}$/i, TWILIO_TOKEN: /^[0-9a-f]{32}$/i, TWILIO_FROM: /^\+?[0-9]{8,15}$/
};
export async function loadSettings() { try { for (const r of await q('select key,value_enc from app_settings')) { try { process.env[r.key] = dec(r.value_enc); } catch { /* chave de criptografia diferente */ } } } catch { /* tabela ainda não existe */ } }
export async function saveSettings(obj) {
  for (const [k, v] of Object.entries(obj)) { if (!KEYS[k]) throw Object.assign(new Error('Configuração desconhecida: ' + k), { statusCode: 400 }); if (!KEYS[k].test(String(v))) throw Object.assign(new Error('Valor com formato inválido para ' + k), { statusCode: 400 }); }
  for (const [k, v] of Object.entries(obj)) { await q('insert into app_settings(key,value_enc) values($1,$2) on conflict(key) do update set value_enc=$2,updated_at=now()', [k, enc(String(v))]); process.env[k] = String(v); }
}
export async function maskedSettings() {
  const rows = await q('select key,updated_at from app_settings where key<>$1', ['setup_done']), set = Object.fromEntries(rows.map(r => [r.key, r.updated_at]));
  return Object.keys(KEYS).map(k => ({ key: k, configurado: !!(process.env[k]), origem: set[k] ? 'painel' : process.env[k] ? 'ambiente' : null, fim: process.env[k] && !/^(PROTOCOL_ORDER|AI_PROVIDERS|STT_PROVIDERS|PAYPAL_ENV|OPENAI_BASE_URL|SIGNUP_MODE|BILLING_ENFORCE|AMB_[A-Z_]+)$/.test(k) ? '…' + process.env[k].slice(-4) : process.env[k] || null }));
}
