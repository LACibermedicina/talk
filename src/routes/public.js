// Páginas abertas pelo QR code (sem login). Token aleatório de 144 bits; limite de requisições por IP.
import { z } from 'zod';
import { docView, useDocument, routineView, advance } from '../followup.js';
export default async function (app) {
  const tk = z.string().regex(/^[A-Za-z0-9_-]{20,64}$/), rl = { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, rw = { config: { rateLimit: { max: 15, timeWindow: '1 minute' } } };
  const who = z.object({ nome: z.string().trim().min(2, 'Informe o nome do responsável').max(80), lugar: z.string().trim().max(80).optional(), nota: z.string().trim().max(200).optional() });
  app.get('/api/public/r/:token', rl, async (req, rep) => (await docView(tk.parse(req.params.token))) || rep.code(404).send({ error: 'Receita não encontrada' }));
  app.post('/api/public/r/:token/baixa', rw, async (req, rep) => {
    const b = who.extend({ acao: z.enum(['utilizada', 'nao_utilizada']) }).parse(req.body), r = await useDocument(tk.parse(req.params.token), { ...b, ip: req.ip });
    return r.code === 200 ? r.view : rep.code(r.code).send({ error: r.error, status: r.status });
  });
  app.get('/api/public/p/:token', rl, async (req, rep) => (await routineView({ token: tk.parse(req.params.token) })) || rep.code(404).send({ error: 'Rotina não encontrada' }));
  app.post('/api/public/p/:token/passo', rw, async (req, rep) => {
    const b = who.extend({ acao: z.enum(['concluida', 'nao_realizada']) }).parse(req.body), r = await advance({ token: tk.parse(req.params.token) }, b);
    return r.code === 200 ? r.view : rep.code(r.code).send({ error: r.error, status: r.status });
  });
}
