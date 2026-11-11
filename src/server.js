// Ponto de entrada (também usado por PM2/systemd: node src/server.js). Sem configuração completa abre o instalador no navegador; com tudo definido inicia a aplicação (src/app.js).
import { loadConfig, missing } from './boot/config.js';
loadConfig();
const miss = missing();
if (miss.length) { const { runBoot } = await import('./boot/server.js'); await runBoot(miss); }
await import('./app.js');
