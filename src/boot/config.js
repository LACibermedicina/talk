// Configuração de bootstrap: lê/grava data/config.env (volume persistente) quando o servidor ainda não tem .env.
// Não importa banco nem criptografia: precisa funcionar ANTES de existirem DATABASE_URL, DATA_KEY e JWT_SECRET.
import { readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync, renameSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
export const dataDir = () => process.env.DATA_DIR || new URL('../../data', import.meta.url).pathname;
export const cfgFile = () => join(dataDir(), 'config.env');
const KEY_RE = /^[A-Z][A-Z0-9_]{1,63}$/;
export function parseEnv(text) { const o = {}; for (const line of String(text || '').split(/\r?\n/)) { const m = /^\s*([A-Z][A-Z0-9_]*)\s*=(.*)$/.exec(line); if (m && !line.trim().startsWith('#')) o[m[1]] = m[2].trim().replace(/^(["'])(.*)\1$/, '$2'); } return o; }
export function serializeEnv(o) { return '# Gerado pelo instalador do Talk.M3D. Contém segredos: não versione nem compartilhe.\n' + Object.entries(o).filter(([k, v]) => KEY_RE.test(k) && v !== undefined && v !== '' && !/[\r\n]/.test(String(v))).map(([k, v]) => `${k}=${v}`).join('\n') + '\n'; }
/** Carrega data/config.env para process.env SEM sobrescrever o que já veio do ambiente (docker/.env têm prioridade). */
export function loadConfig() { try { const f = cfgFile(); if (!existsSync(f)) return {}; const o = parseEnv(readFileSync(f, 'utf8')); for (const [k, v] of Object.entries(o)) if (!process.env[k]) process.env[k] = v; return o; } catch { return {}; } }
export function saveConfig(o) { const dir = dataDir(); mkdirSync(dir, { recursive: true }); const f = cfgFile(), tmp = f + '.tmp', cur = existsSync(f) ? parseEnv(readFileSync(f, 'utf8')) : {}; writeFileSync(tmp, serializeEnv({ ...cur, ...o }), { mode: 0o600 }); renameSync(tmp, f); try { chmodSync(f, 0o600); } catch { /* ok */ } }
export const genKeys = () => ({ JWT_SECRET: randomBytes(48).toString('base64url'), DATA_KEY: randomBytes(32).toString('base64') });
export const validKey = v => Buffer.from(v || '', 'base64').length === 32;
/** Variáveis obrigatórias que ainda faltam ou são inválidas, com o motivo didático. */
export function missing(env = process.env) {
  const m = [];
  if (!env.DATABASE_URL || !/^postgres(ql)?:\/\//.test(env.DATABASE_URL)) m.push('DATABASE_URL');
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) m.push('JWT_SECRET');
  if (!validKey(env.DATA_KEY)) m.push('DATA_KEY');
  if (!env.APP_ORIGIN || !/^https?:\/\/[^/\s]+$/.test(env.APP_ORIGIN)) m.push('APP_ORIGIN');
  return m;
}
export const validDbUrl = u => { try { const x = new URL(u); return /^postgres(ql)?:$/.test(x.protocol) && !!x.hostname && !!x.pathname.slice(1); } catch { return false; } };
export const originOf = (headers = {}) => { const host = String(headers['x-forwarded-host'] || headers.host || '').split(',')[0].trim(), proto = String(headers['x-forwarded-proto'] || 'http').split(',')[0].trim(); return /^[a-z0-9.\-:\[\]]+$/i.test(host) ? `${proto === 'https' ? 'https' : 'http'}://${host}` : ''; };
const CODE_A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const newCode = () => { const b = randomBytes(12); return [0, 4, 8].map(i => [...b.subarray(i, i + 4)].map(x => CODE_A[x % CODE_A.length]).join('')).join('-'); };
