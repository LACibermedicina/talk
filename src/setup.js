// CLI: node src/setup.js config/usuarios.json  (alternativa ao assistente da tela)
import { readFileSync } from 'node:fs';
import { pool } from './db.js';
import { createUsers } from './setupLib.js';
const die = m => { console.error('ERRO: ' + m); process.exit(1); };
const file = process.argv[2] || 'config/usuarios.json';
let cfg; try { cfg = JSON.parse(readFileSync(file, 'utf8')); } catch (e) { die(`não foi possível ler ${file}: ${e.message}`); }
const us = cfg.usuarios || [];
if (us.filter(u => u.root).length !== 1) die('defina exatamente um usuário com "root": true');
if (us.find(u => u.root).tipo !== 'admin') die('o usuário root precisa ser do tipo "admin"');
try { const r = await createUsers(us, cfg.vinculos || []); console.log('\nUsuários processados:'); r.forEach(x => console.log(` - ${x.email} | ${x.tipo}${x.root ? ' (root)' : ''} | ${x.status === 'existia' ? 'já existia (ignorado)' : x.senha ? 'SENHA TEMPORÁRIA: ' + x.senha : 'senha definida no arquivo'}`)); console.log('\nTodos trocam a senha no primeiro acesso. Anote as senhas agora (não aparecem de novo).'); }
catch (e) { die(e.message); }
await pool.end();
