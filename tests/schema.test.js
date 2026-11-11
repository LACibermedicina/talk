import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
const rd = d => readdirSync(d, { recursive: true }).filter(f => f.endsWith('.js') || f.endsWith('.sql')).map(f => [f, readFileSync(d + '/' + f, 'utf8')]);
const sql = readdirSync('db').filter(f => f.endsWith('.sql')).sort();
test('migrações numeradas em sequência, sem buracos', () => { sql.forEach((f, i) => assert.ok(f.startsWith(String(i + 1).padStart(3, '0') + '_'), f)); });
test('toda tabela usada no código existe em alguma migração', () => {
  const ddl = sql.map(f => readFileSync('db/' + f, 'utf8')).join('\n'), have = new Set([...ddl.matchAll(/create table (?:if not exists )?([a-z_]+)/gi)].map(m => m[1].toLowerCase()));
  const used = new Set(); for (const [, t] of rd('src')) for (const m of t.matchAll(/\b(?:from|join|into|update)\s+([a-z_]+)\b/gi)) used.add(m[1].toLowerCase());
  const ignore = new Set(['users_role_check', 'information_schema', 'pg_catalog', 'set', 'select', 'the', 'a', 'of', 'to', 'jsonb_array_elements', 'unnest', 'generate_series', 'lateral', 'only', 'where', 'values', 'each', 'that', 'this', 'your', 'one', 'it', 'u', 'x', 'r', 'n', 'new']);
  const missing = [...used].filter(t => !have.has(t) && !ignore.has(t) && t.length > 3 && /_|s$/.test(t) && !/^(from|join|into|update)$/.test(t));
  const known = missing.filter(t => !['configuracao', 'mensagem', 'mensagens', 'usuario', 'uma', 'busca', 'dados', 'ele', 'testes', 'cadastro'].includes(t));
  const fp = new Set(['_migrations', 'pg_stat_ssl', 'starts_at']); // criada pelo migrador / visão do sistema / coluna em extract()
  assert.deepEqual(known.filter(t => !fp.has(t)), [], 'tabelas sem migração');
});
test('credenciais: colunas e eventos existem na migração 013', () => {
  const m = readFileSync('db/013_credenciais.sql', 'utf8'); for (const c of ['last_login_at', 'pw_changed_at', 'sessions_valid_after', 'credential_events']) assert.match(m, new RegExp(c));
  const u = sql.map(f => readFileSync('db/' + f, 'utf8')).join('\n'); for (const c of ['failed_logins', 'locked_until', 'must_change', 'is_root', 'pw_hash']) assert.match(u, new RegExp(c));
});
test('migração de créditos cobre planos, custos, carteira, razão, tokens e pedidos', () => { const m = readFileSync('db/012_creditos.sql', 'utf8'); for (const t of ['plans', 'credit_costs', 'user_billing', 'credit_ledger', 'signup_tokens', 'token_uses', 'billing_orders']) assert.match(m, new RegExp('create table if not exists ' + t)); });
