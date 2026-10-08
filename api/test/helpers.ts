import 'dotenv/config';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createApp } from '../src/app';
import { migrate } from '../src/db/migrate';
import { createPool } from '../src/db/pool';
import type { UberClient } from '../src/providers/uberClient';
import { uberGetOrderFixture } from '../src/providers/uberMock';

export const UBER_SECRET = 'test-uber-secret';
export const DOORDASH_TOKEN = 'test-doordash-token';

export function fixture(path: string): string {
  return readFileSync(new URL(`../../fixtures/${path}`, import.meta.url), 'utf8');
}

export function signUber(body: string, secret = UBER_SECRET): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

export const pool = createPool(
  process.env.TEST_DATABASE_URL ?? 'postgres://localhost:5432/marketplace_orders_test',
);

export async function resetDb() {
  await migrate(pool);
  await pool.query('TRUNCATE orders');
}

/** Fake Get Order: serves the official sample for any id, after a delay so concurrent requests overlap. */
export function fakeUber(overrides: Record<string, unknown> = {}): UberClient & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async getOrder(orderId) {
      calls.push(orderId);
      await new Promise((r) => setTimeout(r, 25));
      return { ...uberGetOrderFixture(orderId), ...overrides };
    },
  };
}

export function buildApp(uber: UberClient = fakeUber()) {
  return createApp({ pool, uber, uberClientSecret: UBER_SECRET, doordashWebhookToken: DOORDASH_TOKEN });
}

export async function countOrders(): Promise<number> {
  const { rows } = await pool.query<{ count: string }>('SELECT count(*) FROM orders');
  return Number(rows[0].count);
}
