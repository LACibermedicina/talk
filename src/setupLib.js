import { randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import { q } from './db.js';
import { audit } from './audit.js';
import { ALL } from './roles.js';
import { minPw, USERNAME } from './policy.js';
// Cria usuários iniciais (idempotente por e-mail). Sem senha informada, gera uma temporária (troca obrigatória no 1º acesso).
export async function createUsers(list, vinculos = []) {
  const out = [];
  for (const u of list) {
    if (!u.nome || !/^\S+@\S+\.\S+$/.test(u.email || '')) throw Object.assign(new Error('Nome e e-mail válidos são obrigatórios: ' + (u.email || u.nome)), { statusCode: 400 });
    if (!ALL.includes(u.tipo)) throw Object.assign(new Error(`Tipo inválido para ${u.email}: ${u.tipo}`), { statusCode: 400 });
    if (u.senha && u.senha.length < minPw()) throw Object.assign(new Error(`A senha de ${u.email} precisa ter ao menos ${minPw()} caracteres${minPw() >= 12 ? '. Senhas curtas, como as de teste, só são aceitas em servidor local.' : '.'}`), { statusCode: 400 });
    const usuario = (u.usuario || (u.root ? 'root' : '')).trim().toLowerCase() || null;
    if (usuario && !USERNAME.test(usuario)) throw Object.assign(new Error('Usuário inválido: use letras minúsculas, números, ponto, hífen ou sublinhado (3 a 30).'), { statusCode: 400 });
    const email = u.email.toLowerCase();
    if ((await q('select 1 from users where lower(email)=$1 or ($2::text is not null and lower(username)=$2)', [email, usuario])).length) { out.push({ email, tipo: u.tipo, status: 'existia' }); continue; }
    const pw = u.senha || randomBytes(12).toString('base64url');
    const [r] = await q('insert into users(role,name,email,phone,cargo,pw_hash,lang,is_root,must_change,username) values($1,$2,$3,$4,$5,$6,$7,$8,true,$9) returning id', [u.tipo, u.nome, email, u.telefone || null, u.cargo || null, await argon2.hash(pw), u.idioma || 'pt', !!u.root, usuario]);
    await audit({ ip: 'setup' }, 'setup_usuario', 'user', r.id, { tipo: u.tipo, root: !!u.root });
    out.push({ email, usuario, tipo: u.tipo, root: !!u.root, status: 'criado', senha: u.senha ? null : pw });
  }
  for (const v of vinculos) {
    const [p] = await q("select id from users where email=$1 and role='paciente'", [String(v.paciente).toLowerCase()]), [f] = await q('select id from users where email=$1', [String(v.profissional).toLowerCase()]);
    if (p && f) await q('insert into care_team values($1,$2) on conflict do nothing', [p.id, f.id]);
  }
  return out;
}
