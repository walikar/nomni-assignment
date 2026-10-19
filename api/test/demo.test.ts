import type { Server } from 'http';
import type { AddressInfo } from 'net';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { config } from '../src/config';
import { fetchUberOrder } from '../src/services/uber.service';
import { countOrdersInDb, fakeUberGetOrder, pool, resetDatabase } from './helpers';

vi.mock('../src/services/uber.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/uber.service')>();
  return { ...actual, fetchUberOrder: vi.fn() };
});

// The demo endpoint POSTs to its own /webhooks/orders, so it needs a real listening server.
let server: Server;
let baseUrl = '';

beforeAll(async () => {
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

beforeEach(async () => {
  await resetDatabase();
  vi.mocked(fetchUberOrder).mockImplementation((orderId) => fakeUberGetOrder(orderId));
});

describe('demo endpoint', () => {
  it('sends a signed Uber webhook through the real endpoint', async () => {
    const response = await request(baseUrl).post('/api/demo/orders').send({ provider: 'uber_eats' });

    expect(response.status).toBe(201);
    expect(response.body.deliveries).toEqual([{ status: 200, body: null }]);
    expect(response.body.orders_stored).toBe(1);
    expect(response.body.order_id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('two identical DoorDash deliveries at once still store one order', async () => {
    const response = await request(baseUrl).post('/api/demo/orders').send({ provider: 'doordash', times: 2 });

    expect(response.status).toBe(201);
    expect(response.body.deliveries.map((delivery: { status: number }) => delivery.status)).toEqual([200, 200]);
    expect(response.body.orders_stored).toBe(1);
    expect(await countOrdersInDb()).toBe(1);
  });

  it('rejects an unknown provider', async () => {
    const response = await request(baseUrl).post('/api/demo/orders').send({ provider: 'grubhub' });
    expect(response.status).toBe(400);
  });

  it('is off unless DEMO_MODE is set', async () => {
    config.DEMO_MODE = false;
    try {
      expect((await request(baseUrl).get('/api/demo')).body).toEqual({ enabled: false });
      expect((await request(baseUrl).post('/api/demo/orders').send({ provider: 'doordash' })).status).toBe(404);
    } finally {
      config.DEMO_MODE = true;
    }
  });
});
