// Recuperação de acesso de QUALQUER usuário (administrador, médico etc.): nova senha temporária + desbloqueio + reativação.
// Uso:  node src/reset-user.js <e-mail ou usuário>      (sem argumento: lista os administradores)
import { randomBytes } from 'node:crypto';
import { loadConfig, missing } from './boot/config.js';
loadConfig();
const m = missing(process.env);
if (m.length) { console.error('Sistema ainda não configurado (falta: ' + m.join(', ') + ').'); process.exit(1); }
const { q, pool } = await import('./db.js'), argon2 = (await import('argon2')).default;
const id = String(process.argv[2] || '').trim().toLowerCase();
if (!id) {
  const rows = await q("select name,email,username,is_root,active,locked_until from users where role='admin' order by is_root desc,name");
  console.log('\nAdministradores cadastrados:'); rows.forEach(r => console.log(`  ${r.is_root ? '[root] ' : '       '}${r.name} · ${r.email}${r.username ? ' · usuário: ' + r.username : ''}${r.active ? '' : ' · INATIVO'}${r.locked_until && new Date(r.locked_until) > new Date() ? ' · BLOQUEADO' : ''}`));
  console.log('\nPara redefinir:  node src/reset-user.js <e-mail ou usuário>\n');
} else {
  const [u] = await q('select id,name,email,username from users where lower(email)=$1 or lower(username)=$1 limit 1', [id]);
  if (!u) { console.error('Usuário não encontrado: ' + id); process.exit(1); }
  const pw = randomBytes(12).toString('base64url');
  await q('update users set pw_hash=$2,must_change=true,failed_logins=0,locked_until=null,active=true,pending=false,sessions_valid_after=now() - interval \'2 seconds\',pw_changed_at=now() where id=$1', [u.id, await argon2.hash(pw)]);
  await q("insert into credential_events(user_id,kind) values($1,'senha_redefinida')", [u.id]);
  console.log(`\nSenha redefinida.\n  Usuário: ${u.username || u.email}\n  E-mail:  ${u.email}\n  Senha temporária: ${pw}\n(o sistema pedirá a troca no primeiro login)\n`);
}
await pool.end(); process.exit(0);
