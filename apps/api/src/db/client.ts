import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: new URL('../../../../.env', import.meta.url).pathname });

const { Pool } = pg;

export const pool = new Pool({
  connectionString:
    process.env['DATABASE_URL'] ??
    'postgresql://postgres:postgres@localhost:5432/local_change_monitor',
});
