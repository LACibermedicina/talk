// Regras puras da tradução de interface por IA (testáveis sem banco). Dados de usuários nunca chegam aqui:
// o cliente só envia textos fixos e o servidor ainda recusa o que parece dado pessoal.
import { createHash } from 'node:crypto';
export const LANGS = { es: 'espanhol', gn: 'guarani (Paraguai)', en: 'inglês', zh: 'chinês simplificado' };
export const hash = s => createHash('sha256').update(s).digest('hex').slice(0, 32);
export const placeholders = s => (String(s).match(/\{\d+\}/g) || []).sort().join(',');
export const sensitive = s => /@|https?:\/\/|\d{8,}/i.test(s);
export const eligible = s => typeof s === 'string' && s.length >= 3 && s.length <= 300 && /[a-zà-ÿ]/i.test(s) && !sensitive(s);
export const limit = () => +process.env.I18N_DAILY_LIMIT || 3000;
// Aceita só a tradução que preserva exatamente os marcadores {n} do original.
export const validOut = (src, out) => typeof out === 'string' && out.trim().length > 0 && out.length <= 900 && placeholders(src) === placeholders(out);
export function parseAI(text) {
  try { const j = JSON.parse(String(text).replace(/```json|```/g, '').trim()); return j && typeof j === 'object' && !Array.isArray(j) ? j : {}; } catch { return {}; }
}
