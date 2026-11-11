// Modo de teste (TEST_MODE=true): cria contas de teste e libera o "acesso rápido" na tela de login.
// Só liga em servidor local ou com ALLOW_WEAK_PASSWORDS=true. NUNCA use em servidor público com dados reais.
import argon2 from 'argon2';
import { q } from './db.js';
import { weakAllowed } from './policy.js';
export const TEST_USERS = [
  { nome: 'Superusuário (root)', usuario: 'root', email: 'root@teste.local', senha: 'arcano1234', tipo: 'admin', root: true },
  { nome: 'Administrador', email: 'admin@demo.com', senha: 'demo', tipo: 'admin' },
  { nome: 'Dra. Ana C.', email: 'medico@demo.com', senha: 'demo', tipo: 'medico' },
  { nome: 'Recepção', email: 'recepcao@demo.com', senha: 'demo', tipo: 'recepcao' },
  { nome: 'Sofia Almeida', email: 'paciente@demo.com', senha: 'demo', tipo: 'paciente' }
];
export const testOn = () => process.env.TEST_MODE === 'true' && weakAllowed();
export async function seedTest(log) {
  if (process.env.TEST_MODE === 'true' && !weakAllowed()) { log.error('TEST_MODE ignorado: exige APP_ORIGIN local ou ALLOW_WEAK_PASSWORDS=true'); return; }
  if (!testOn()) return;
  for (const u of TEST_USERS) {
    const hash = await argon2.hash(u.senha), un = u.usuario || null;
    const [ex] = await q('select id from users where lower(email)=$1 or ($2::text is not null and lower(username)=$2) or ($3 and is_root)', [u.email, un, !!u.root]);
    if (ex) await q('update users set pw_hash=$2,must_change=false,active=true,pending=false,username=coalesce($3,username) where id=$1', [ex.id, hash, un]);
    else await q('insert into users(role,name,email,pw_hash,is_root,must_change,username,active) values($1,$2,$3,$4,$5,false,$6,true)', [u.tipo, u.nome, u.email, hash, !!u.root, un]);
  }
  await q("insert into care_team select p.id,f.id from users p, users f where p.email='paciente@demo.com' and f.email='medico@demo.com' on conflict do nothing");
  log.warn('MODO DE TESTE ATIVO: contas de teste criadas (root/arcano1234 e *@demo.com/demo). Não use em produção.');
}
