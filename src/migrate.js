import { migrate } from './migrateLib.js';
import { pool } from './db.js';
await migrate(); console.log('Banco atualizado.'); await pool.end();
