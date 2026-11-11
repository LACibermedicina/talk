import { readdirSync, readFileSync } from 'node:fs';
import { pool } from './db.js';
const dir = new URL('../db/', import.meta.url);
export const migrationFiles = () => readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
export async function pending() {
  await pool.query('create table if not exists _migrations(name text primary key, at timestamptz not null default now())');
  const done = new Set((await pool.query('select name from _migrations')).rows.map(r => r.name));
  return migrationFiles().filter(f => !done.has(f));
}
export async function migrate(log = console.log) {
  await pool.query('create table if not exists _migrations(name text primary key, at timestamptz not null default now())');
  const done = new Set((await pool.query('select name from _migrations')).rows.map(r => r.name));
  if ((await pool.query("select to_regclass('public.users') r")).rows[0].r && !done.size) { await pool.query("insert into _migrations(name) values('001_schema.sql')"); done.add('001_schema.sql'); }
  const applied = [];
  for (const f of migrationFiles()) {
    if (done.has(f)) continue; const c = await pool.connect();
    try { await c.query('begin'); await c.query(readFileSync(new URL(f, dir), 'utf8')); await c.query('insert into _migrations(name) values($1)', [f]); await c.query('commit'); applied.push(f); log('Migração aplicada: ' + f); }
    catch (e) { await c.query('rollback'); throw e; } finally { c.release(); }
  }
  return applied;
}
