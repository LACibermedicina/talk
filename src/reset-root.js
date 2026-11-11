// Recuperação de acesso: gera uma senha temporária nova para o root (ou cria o root se não existir).
// Uso:  docker compose exec app node src/reset-root.js        (ou: node src/reset-root.js)
import { randomBytes } from 'node:crypto';
import { loadConfig, missing } from './boot/config.js';
loadConfig();
const m = missing(process.env);
if (m.length) { console.error('Sistema ainda não configurado (falta: ' + m.join(', ') + '). Abra o endereço no navegador e conclua o instalador primeiro.'); process.exit(1); }
const { q, pool } = await import('./db.js'), argon2 = (await import('argon2')).default;
const pw = randomBytes(12).toString('base64url'), hash = await argon2.hash(pw);
const [r] = await q('select id,username,email from users where is_root limit 1');
if (r) {
  await q('update users set pw_hash=$2,must_change=true,failed_logins=0,locked_until=null,active=true,sessions_valid_after=now() where id=$1', [r.id, hash]);
  console.log(`\nRoot existente redefinido.\n  Usuário: ${r.username || r.email}\n  E-mail:  ${r.email}\n  Senha temporária: ${pw}\n(o sistema pedirá a troca no primeiro login)\n`);
} else {
  await q("insert into users(role,name,email,username,pw_hash,is_root,must_change,active) values('admin','Root','root@local.invalid','root',$1,true,true,true)", [hash]);
  console.log(`\nRoot criado.\n  Usuário: root\n  Senha temporária: ${pw}\n(o sistema pedirá a troca no primeiro login)\n`);
}
await (pool && pool.end ? pool.end() : null); process.exit(0);
