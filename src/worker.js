// Processo de segundo plano (lembretes por SMS, detecção de anomalias, renovação de planos), separado da API.
// Rode UMA instância. Espera o sistema estar configurado (instalador concluído ou variáveis presentes) antes de começar.
import { loadConfig, missing } from './boot/config.js';
const log = { info: (...a) => console.log('[worker]', ...a), warn: (...a) => console.warn('[worker]', ...a), error: (...a) => console.error('[worker]', ...a) };
for (;;) { loadConfig(); const m = missing(process.env); if (!m.length) break; log.warn('aguardando configuração (' + m.join(', ') + ')…'); await new Promise(r => setTimeout(r, 5000)); }
const { q } = await import('./db.js'), { loadSettings } = await import('./settings.js'), { startJobs } = await import('./jobs.js');
for (;;) { try { await q('select 1 from app_settings limit 1'); break; } catch { log.warn('aguardando o banco/migrações…'); await new Promise(r => setTimeout(r, 5000)); } }
await loadSettings(); startJobs(log); log.info('jobs ativos');
setInterval(() => loadSettings().catch(() => {}), 5 * 60e3); // pega chaves alteradas na tela de Integrações
process.on('SIGTERM', () => process.exit(0)); process.on('SIGINT', () => process.exit(0));
