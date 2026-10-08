import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { countOrders, DOORDASH_TOKEN, fakeUber, pool, resetDb, UBER_SECRET } from './helpers';

let server: Server;
let base = '';

function app(demoMode: boolean) {
  return createApp({
    pool,
    uber: fakeUber(),
    uberClientSecret: UBER_SECRET,
    doordashWebhookToken: DOORDASH_TOKEN,
    demoMode,
    selfUrl: () => base,
  });
}

beforeAll(async () => {
  // The demo endpoint POSTs to its own /webhooks/orders, so it needs a real listening server.
  server = app(true).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  await new Promise((r) => server.close(r));
  await pool.end();
});
beforeEach(resetDb);

describe('demo endpoint', () => {
  it('sends a signed Uber webhook through the real endpoint', async () => {
    const res = await request(base).post('/api/demo/orders').send({ provider: 'uber_eats' });
    expect(res.status).toBe(201);
    expect(res.body.deliveries).toEqual([{ status: 200, body: null }]);
    expect(res.body.orders_stored).toBe(1);
    expect(res.body.order_id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('two identical DoorDash deliveries at once still store one order', async () => {
    const res = await request(base).post('/api/demo/orders').send({ provider: 'doordash', times: 2 });
    expect(res.status).toBe(201);
    expect(res.body.deliveries.map((d: { status: number }) => d.status)).toEqual([200, 200]);
    expect(res.body.orders_stored).toBe(1);
    expect(await countOrders()).toBe(1);
  });

  it('rejects an unknown provider', async () => {
    const res = await request(base).post('/api/demo/orders').send({ provider: 'grubhub' });
    expect(res.status).toBe(400);
  });

  it('is off unless DEMO_MODE is set', async () => {
    const off = app(false);
    expect((await request(off).get('/api/demo')).body).toEqual({ enabled: false });
    expect((await request(off).post('/api/demo/orders').send({ provider: 'doordash' })).status).toBe(404);
  });
});
