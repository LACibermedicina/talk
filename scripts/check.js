// Verifica a sintaxe de todos os .js do projeto (rápido, sem dependências).
import { readdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const walk = d => readdirSync(d).flatMap(f => { const p = d + '/' + f; return statSync(p).isDirectory() ? (f === 'vendor' || f === 'node_modules' ? [] : walk(p)) : p.endsWith('.js') ? [p] : []; });
let bad = 0; for (const f of [...walk('src'), ...walk('scripts'), ...walk('public'), ...walk('tests')]) { const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' }); if (r.status) { bad++; console.error(f + '\n' + r.stderr); } }
console.log(bad ? `${bad} arquivo(s) com erro` : 'Sintaxe OK'); process.exit(bad ? 1 : 0);
