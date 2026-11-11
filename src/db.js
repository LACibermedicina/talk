import pg from 'pg';
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 10, ssl: process.env.PGSSL === 'false' ? false : { rejectUnauthorized: true }, connectionTimeoutMillis: 10000 });
export const q = (t, p) => pool.query(t, p).then(r => r.rows);
