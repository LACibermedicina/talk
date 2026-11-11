// Cadastro público de novos usuários (sempre como paciente). Modo definido no assistente de instalação e alterável pelo administrador.
import { z } from 'zod';
import argon2 from 'argon2';
import { q } from '../db.js';
import { audit } from '../audit.js';
import { signupMode } from '../policy.js';
import { normCode, validCode, redeemCheck, redeemEffect } from '../billingLogic.js';
import { ensureBilling, addCredits } from '../billing.js';
export default async function (app) {
  app.get('/api/signup/status', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, () => ({ mode: signupMode() }));
  app.post('/api/signup', { config: { rateLimit: { max: 5, timeWindow: '1 hour' } } }, async (req, rep) => {
    const mode = signupMode(), code = normCode((req.body || {}).token);
    if (mode === 'off' && !code) return rep.code(403).send({ error: 'O cadastro público está desativado. Peça à clínica para criar sua conta ou use um token de convite.' });
    const b = z.object({ nome: z.string().trim().min(2).max(120), email: z.string().email().max(160), senha: z.string().min(12, 'A senha precisa ter ao menos 12 caracteres').max(200), telefone: z.string().max(20).optional(), token: z.string().max(40).optional(), aceite: z.literal(true, { errorMap: () => ({ message: 'É preciso aceitar os termos de uso e privacidade' }) }) }).parse(req.body);
    const email = b.email.toLowerCase();
    // Com token válido a conta já nasce aprovada (e com teste/créditos do token); sem token segue o modo de cadastro (aprovação ou aberto).
    let tok = null, fx = null;
    if (code) {
      const [t] = validCode(code) ? await q('select * from signup_tokens where code=$1', [code]) : [], chk = redeemCheck(t, { signupMode: mode });
      if (!chk.ok) return rep.code(400).send({ error: chk.error });
      const used = await q('update signup_tokens set uses=uses+1 where code=$1 and active and (max_uses is null or uses<max_uses) returning 1', [code]);
      if (!used.length) return rep.code(400).send({ error: 'Este token já atingiu o limite de usos.' });
      tok = t; fx = redeemEffect(t);
    }
    const pending = !tok && mode === 'approval';
    try {
      const [u] = await q("insert into users(role,name,email,phone,pw_hash,active,pending,must_change) values('paciente',$1,$2,$3,$4,$5,$6,false) returning id", [b.nome, email, b.telefone || null, await argon2.hash(b.senha), !pending, pending]);
      await audit(req, 'cadastro_publico', 'user', u.id, { modo: mode, token: tok ? tok.code : null });
      await ensureBilling(u.id, { plan_id: fx && fx.plan_id, trial_ends: fx && fx.trial_ends, referred_by: tok && tok.owner_id, token: tok && tok.code });
      if (tok) { await q('insert into token_uses(code,user_id) values($1,$2) on conflict do nothing', [tok.code, u.id]); if (fx.credits) await addCredits(u.id, fx.credits, 'token', { note: tok.code }); if (fx.ownerReward) await addCredits(tok.owner_id, fx.ownerReward, 'indicacao', { note: `${tok.code} usado` }); }
      if (pending) await q(`insert into notifications(user_id,kind,title,body) select id,'cadastro_pendente',$1,$2 from users where active and role in('admin','recepcao','funcionario')`, ['Novo cadastro aguardando aprovação', `${b.nome} (${email}) pediu acesso.`]);
      return { ok: true, pendente: pending, teste: fx ? fx.trial_ends : null, creditos: fx ? fx.credits : 0 };
    } catch (e) { if (tok) await q('update signup_tokens set uses=greatest(uses-1,0) where code=$1', [tok.code]); if (e.code === '23505') return rep.code(409).send({ error: 'Este e-mail já está cadastrado.' }); throw e; }
  });
}
