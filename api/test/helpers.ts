import { createHmac } from 'crypto';
import fs from 'fs';
import path from 'path';
import pool from '../src/db';
import { runMigrations } from '../src/db/migrate';
import { getSampleUberOrder } from '../src/routes/uber-mock';

// Same values as vitest.config.ts sets for the app.
export const UBER_SECRET = 'test-uber-secret';
export const DOORDASH_TOKEN = 'test-doordash-token';

export { pool };

export function readFixture(fileName: string): string {
  return fs.readFileSync(path.join(__dirname, '../../fixtures', fileName), 'utf8');
}

// Signs a body the way Uber does.
export function signUberBody(body: string, secret = UBER_SECRET): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

// Fresh, empty orders table before each test.
export async function resetDatabase() {
  await runMigrations();
  await pool.query('TRUNCATE orders');
}

export async function countOrdersInDb(): Promise<number> {
  const result = await pool.query<{ count: string }>('SELECT count(*) FROM orders');
  return Number(result.rows[0].count);
}

// Stands in for Uber's Get Order API in tests: returns Uber's sample order after a short delay,
// so two concurrent webhooks really overlap.
export async function fakeUberGetOrder(orderId: string, overrides: Record<string, unknown> = {}) {
  await new Promise((resolve) => setTimeout(resolve, 25));
  return { ...getSampleUberOrder(orderId), ...overrides };
}
