// Depois da instalação, o administrador gerencia as integrações pela tela (mesma validação do assistente).
import { z } from 'zod';
import { audit } from '../audit.js';
import { saveSettings, maskedSettings } from '../settings.js';
import { testService } from '../setupTests.js';
export default async function (app) {
  const A = { preHandler: app.role('admin') };
  app.get('/api/admin/settings', A, () => maskedSettings());
  app.put('/api/admin/settings', A, async req => { const { settings } = z.object({ settings: z.record(z.string().max(400)) }).parse(req.body); await saveSettings(settings); await audit(req, 'integracoes_alteradas', 'settings', null, { chaves: Object.keys(settings) }); return { ok: true }; });
  app.post('/api/admin/settings/test', A, async req => { const b = z.object({ service: z.enum(['agora', 'gemini', 'openai', 'anthropic', 'paypal', 'twilio']), values: z.record(z.string().max(400)) }).parse(req.body); return testService(b.service, b.values); });
}
