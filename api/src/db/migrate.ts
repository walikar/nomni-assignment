import fs from 'fs';
import path from 'path';
import pool from '../db';

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

// Runs every .sql file in ./migrations that hasn't run yet, in name order (001_, 002_, ...).
// Each file runs in its own transaction, and is recorded in schema_migrations so it never runs twice.
export async function runMigrations(): Promise<string[]> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const alreadyApplied = await pool.query<{ name: string }>('SELECT name FROM schema_migrations');
  const appliedNames = new Set(alreadyApplied.rows.map((row) => row.name));

  const files = fs.readdirSync(MIGRATIONS_DIR).filter((file) => file.endsWith('.sql')).sort();
  const newlyApplied: string[] = [];

  for (const file of files) {
    if (appliedNames.has(file)) continue;

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      newlyApplied.push(file);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  return newlyApplied;
}

// `npm run migrate` runs this file directly.
if (require.main === module) {
  runMigrations()
    .then((applied) => {
      console.log(applied.length > 0 ? `Applied: ${applied.join(', ')}` : 'Database is up to date');
      return pool.end();
    })
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
