// Ponto de entrada. Sem .env completo, abre o instalador no navegador (modo bootstrap); com tudo definido, inicia o servidor normal.
import { loadConfig, missing } from './boot/config.js';
loadConfig();
const miss = missing();
if (miss.length) { const { runBoot } = await import('./boot/server.js'); await runBoot(miss); }
await import('./server.js');
