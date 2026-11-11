// Atalho: cria só o administrador root a partir de ADMIN_EMAIL / ADMIN_PASSWORD (prefira src/setup.js).
import argon2 from 'argon2';
import { q } from './db.js';
const e = process.env.ADMIN_EMAIL, p = process.env.ADMIN_PASSWORD;
if (!e || !p || p.length < 12) { console.error('Defina ADMIN_EMAIL e ADMIN_PASSWORD (mínimo 12 caracteres)'); process.exit(1); }
await q(`insert into users(role,name,email,pw_hash,is_root) values('admin','Administrador Root',$1,$2,true) on conflict(email) do nothing`, [e.toLowerCase(), await argon2.hash(p)]);
console.log('Administrador root criado'); process.exit(0);
