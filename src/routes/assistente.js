import { z } from 'zod';
import { chat } from '../services/ai.js';
import { buildAssistantPrompt, parseActions, localAnswer, featuresFor, suggestionsFor } from '../assistantLogic.js';
// Chat de ajuda: a IA só conhece as funções do perfil do usuário e não recebe dados de pacientes.
export default async function (app) {
  app.get('/api/assistant/info', { preHandler: app.auth }, async req => ({ features: featuresFor(req.user.role).map(f => ({ id: f.id, title: f.title })), suggestions: suggestionsFor(req.user.role) }));
  app.post('/api/assistant', { preHandler: app.auth, config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async req => {
    const b = z.object({ messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(1200) })).min(1).max(12), lang: z.enum(['pt', 'es', 'gn', 'en', 'zh']).default('pt'), view: z.string().max(20).default('') }).parse(req.body);
    const last = [...b.messages].reverse().find(m => m.role === 'user'); if (!last) return { reply: '', actions: [], ai: false };
    const conv = b.messages.slice(-8).map(m => (m.role === 'user' ? 'Usuário: ' : 'Assistente: ') + m.content.replace(/\[\[|\]\]/g, '')).join('\n');
    try { const out = await chat(buildAssistantPrompt({ role: req.user.role, lang: b.lang, view: b.view }), conv + '\nAssistente:', { max: 500, ms: 25000 }); return { ...parseActions(out, req.user.role), ai: true }; }
    catch { return { ...localAnswer(last.content, req.user.role), ai: false }; }
  });
}
