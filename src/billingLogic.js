// Regras puras de créditos, planos, tokens e acesso (sem banco: testável). Valores em BRL; créditos são inteiros.
export const FEATURES = [
  ['ia_assistente', 'Assistente do sistema', 'IA'], ['ia_traducao', 'Tradução de mensagens e telas', 'IA'], ['ia_transcricao', 'Transcrição de áudio', 'IA'],
  ['clinico_ia', 'Rascunho de prontuário por IA', 'IA'], ['consulta_estrutura', 'Estruturação da consulta (SOAP)', 'Consulta'], ['consulta_relatorio', 'Relatório da consulta', 'Consulta'],
  ['consulta_apoio', 'Apoio à decisão e protocolos', 'Consulta'], ['caso_ia', 'Análise de caso clínico', 'Caso'], ['familia_ia', 'Familiograma e ecomapa por IA', 'Caso']
];
export const FEATURE_KEYS = FEATURES.map(f => f[0]);
/** Rotas medidas: [método, regex do caminho, funcionalidade]. Custo 0 (padrão) = livre. */
export const FEATURE_ROUTES = [
  ['POST', /^\/api\/assistant$/, 'ia_assistente'], ['POST', /^\/api\/i18n\/translate$/, 'ia_traducao'], ['POST', /^\/api\/messages\/[^/]+\/translate$/, 'ia_traducao'],
  ['POST', /^\/api\/consults\/[^/]+\/transcribe$/, 'ia_transcricao'], ['POST', /^\/api\/patients\/[^/]+\/clinical\/ai$/, 'clinico_ia'],
  ['POST', /^\/api\/consults\/[^/]+\/structure$/, 'consulta_estrutura'], ['POST', /^\/api\/consults\/[^/]+\/report$/, 'consulta_relatorio'], ['POST', /^\/api\/consults\/[^/]+\/support$/, 'consulta_apoio'],
  ['POST', /^\/api\/patients\/[^/]+\/case\/ai$/, 'caso_ia'], ['POST', /^\/api\/patients\/[^/]+\/family-map\/generate$/, 'familia_ia']
];
export const featureFor = (method, path) => { const r = FEATURE_ROUTES.find(([m, re]) => m === method && re.test(path)); return r ? r[2] : null; };
/** Rotas que continuam abertas mesmo para quem está sem acesso (para poder ver o saldo, comprar créditos e sair). */
export const OPEN_WHEN_LOCKED = [/^\/api\/me(\/password)?$/, /^\/api\/logout$/, /^\/api\/billing(\/|$)/, /^\/api\/login/, /^\/api\/signup/, /^\/api\/setup/, /^\/api\/health/, /^\/api\/i18n\/(dict|langs)/];
export const isOpenWhenLocked = path => OPEN_WHEN_LOCKED.some(re => re.test(path));

/** Perfis de plano: mix coerente com o mercado de SaaS de saúde (preço semanal ≈ 30% do mensal; créditos proporcionais). */
export const PLAN_SEED = [
  { id: 'basico', name: 'Básico', tier: 1, description: 'Para conhecer: mensagens, agenda e receitas, sem IA clínica.', price_month: 0, price_week: 0, credits_month: 50, credits_week: 15, features: { pacientes: 15, equipe: 1, ia: false, video_min: 120, armazenamento_gb: 1, protocolos: false, suporte: 'comunidade' } },
  { id: 'essencial', name: 'Essencial', tier: 2, description: 'Autônomo: IA de apoio (transcrição, tradução), videochamada e prontuário.', price_month: 59, price_week: 19, credits_month: 400, credits_week: 110, features: { pacientes: 80, equipe: 1, ia: true, video_min: 900, armazenamento_gb: 10, protocolos: false, suporte: 'e-mail' } },
  { id: 'profissional', name: 'Profissional', tier: 3, description: 'Consulta completa: protocolos, caso clínico, familiograma/ecomapa e relatórios.', price_month: 149, price_week: 45, credits_month: 1500, credits_week: 420, features: { pacientes: 400, equipe: 3, ia: true, video_min: 3000, armazenamento_gb: 50, protocolos: true, suporte: 'prioritário' } },
  { id: 'clinica', name: 'Clínica', tier: 4, description: 'Equipe multiprofissional: vários usuários, recepção, financeiro e auditoria.', price_month: 399, price_week: 119, credits_month: 6000, credits_week: 1700, features: { pacientes: 3000, equipe: 15, ia: true, video_min: 15000, armazenamento_gb: 300, protocolos: true, suporte: 'dedicado' } }
];
export const CYCLES = { week: 7, month: 30 };
export const DEFAULT_TOKEN = { code: 'TALK', kind: 'default', trial_days: 7, plan_id: 'basico', credits: 0, reward_owner: 0, max_uses: null };

export const normCode = c => String(c || '').trim().toUpperCase().replace(/\s+/g, '');
export const validCode = c => /^[A-Z0-9][A-Z0-9-]{2,23}$/.test(c);
const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
/** Gera códigos legíveis (sem 0/O/1/I) a partir de bytes aleatórios. */
export const genCode = (bytes, prefix = '') => prefix + [...bytes.subarray(0, 6)].map(b => A[b % A.length]).join('');

/** Situação de acesso. b = linha de user_billing (ou null = usuário não medido). enforce = BILLING_ENFORCE. */
export function accessState(b, { role, enforce, now = new Date() } = {}) {
  if (!enforce || role === 'admin' || !b) return { ok: true, reason: null };
  if (b.blocked) return { ok: false, reason: 'bloqueado', message: b.blocked_reason || 'Acesso bloqueado pelo administrador.' };
  const t = now.getTime(), pe = b.plan_ends && new Date(b.plan_ends).getTime(), te = b.trial_ends && new Date(b.trial_ends).getTime();
  if (pe && pe > t) return { ok: true, reason: null, until: b.plan_ends, via: 'plano' };
  if (te && te > t) return { ok: true, reason: null, until: b.trial_ends, via: 'teste' };
  return { ok: false, reason: pe || te ? 'expirado' : 'sem_plano', message: pe || te ? 'Seu período de uso terminou.' : 'Escolha um plano para começar a usar.' };
}
/** Avalia o resgate de um token no cadastro. */
export function redeemCheck(tok, { signupMode, now = new Date() } = {}) {
  if (!tok || !tok.active) return { ok: false, error: 'Token inválido ou desativado.' };
  if (tok.expires_at && new Date(tok.expires_at) < now) return { ok: false, error: 'Este token expirou.' };
  if (tok.max_uses != null && tok.uses >= tok.max_uses) return { ok: false, error: 'Este token já atingiu o limite de usos.' };
  if (tok.kind === 'default' && signupMode === 'off') return { ok: false, error: 'O cadastro público está desativado. Use um token de convite.' };
  return { ok: true };
}
/** Efeito do token sobre a conta nova e sobre quem indicou. */
export function redeemEffect(tok, now = new Date()) {
  const trial_ends = tok.trial_days > 0 ? new Date(now.getTime() + tok.trial_days * 864e5).toISOString() : null;
  return { credits: Math.max(0, tok.credits | 0), trial_ends, plan_id: tok.plan_id || null, ownerReward: tok.owner_id ? Math.max(0, tok.reward_owner | 0) : 0 };
}
/** Limites que o administrador define para embaixadores (lidos das configurações). */
export const ambLimits = env => { const n = (k, d) => { const v = parseInt(env[k], 10); return Number.isFinite(v) && v >= 0 ? v : d; }; return { maxGroups: n('AMB_MAX_GROUPS', 5), maxTokens: n('AMB_MAX_TOKENS', 20), maxUses: n('AMB_MAX_USES', 5), maxCredits: n('AMB_MAX_CREDITS', 30), maxTrialDays: n('AMB_MAX_TRIAL_DAYS', 14), reward: n('AMB_REWARD', 10) }; };
/** Valida o grupo de tokens que um embaixador quer criar contra os limites. Retorna erro (texto) ou null. */
export function checkGroup(g, lim, { groupsSoFar = 0 } = {}) {
  if (groupsSoFar >= lim.maxGroups) return `Você já criou o máximo de ${lim.maxGroups} grupos.`;
  if (!(g.count >= 1 && g.count <= lim.maxTokens)) return `Um grupo pode ter de 1 a ${lim.maxTokens} tokens.`;
  if (!(g.max_uses >= 1 && g.max_uses <= lim.maxUses)) return `Cada token pode ter de 1 a ${lim.maxUses} usos.`;
  if (g.credits > lim.maxCredits) return `O bônus de créditos para o novo usuário é de até ${lim.maxCredits}.`;
  if (g.trial_days > lim.maxTrialDays) return `O período de teste é de até ${lim.maxTrialDays} dias.`;
  return null;
}
/** Próximo vencimento ao ativar/renovar um plano; se ainda vigente, soma ao saldo de tempo. */
export function planEnds(cycle, current, now = new Date()) { const base = current && new Date(current) > now ? new Date(current) : now; return new Date(base.getTime() + CYCLES[cycle] * 864e5).toISOString(); }
export const planPrice = (p, cycle) => Number(cycle === 'week' ? p.price_week : p.price_month);
export const planCredits = (p, cycle) => cycle === 'week' ? p.credits_week : p.credits_month;
