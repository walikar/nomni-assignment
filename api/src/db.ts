import { Pool } from 'pg';
import { config } from './config';

const pool = new Pool({ connectionString: config.DATABASE_URL });

// Hosted Postgres (Neon) closes idle connections. Log it instead of crashing the server.
pool.on('error', (err) => {
  console.warn('Postgres idle client error:', err.message);
});

export default pool;
