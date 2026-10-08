import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { upsertOrder } from '../src/orders/repo';
import type { NormalizedOrder } from '../src/orders/types';
import { buildApp, pool, resetDb } from './helpers';

function order(overrides: Partial<NormalizedOrder>): NormalizedOrder {
  return {
    provider: 'doordash',
    external_order_id: 'x',
    status: 'new',
    provider_status: 'NEW',
    customer: { name: 'Ana Diaz', phone: '+15550000000', email: null },
    line_items: [],
    subtotal_cents: 1000,
    tax_cents: 100,
    total_cents: 1100,
    currency: 'USD',
    placed_at: null,
    raw_payload: {},
    ...overrides,
  };
}

const app = buildApp();

beforeEach(async () => {
  await resetDb();
  await upsertOrder(pool, order({ external_order_id: 'dd-1', total_cents: 500 }));
  await upsertOrder(pool, order({ external_order_id: 'dd-2', total_cents: 3000, customer: { name: 'Bo Chen', phone: null, email: null } }));
  await upsertOrder(pool, order({ provider: 'uber_eats', external_order_id: 'ue-1', total_cents: 1500, status: 'accepted' }));
});
afterAll(() => pool.end());

describe('GET /api/orders', () => {
  it('lists newest first by default, without raw_payload', async () => {
    const res = await request(app).get('/api/orders');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    expect(res.body.items[0].raw_payload).toBeUndefined();
  });

  it('filters by provider and status', async () => {
    const res = await request(app).get('/api/orders?provider=doordash&status=new');
    expect(res.body.items.map((o: { external_order_id: string }) => o.external_order_id).sort()).toEqual(['dd-1', 'dd-2']);
  });

  it('searches order id and customer name', async () => {
    expect((await request(app).get('/api/orders?q=chen')).body.items).toHaveLength(1);
    expect((await request(app).get('/api/orders?q=ue-')).body.items).toHaveLength(1);
    expect((await request(app).get('/api/orders?q=%25')).body.items).toHaveLength(0); // literal %, not a wildcard
  });

  it('sorts by total in both directions', async () => {
    const asc = await request(app).get('/api/orders?sort=total');
    expect(asc.body.items.map((o: { total_cents: number }) => o.total_cents)).toEqual([500, 1500, 3000]);
    const desc = await request(app).get('/api/orders?sort=-total');
    expect(desc.body.items.map((o: { total_cents: number }) => o.total_cents)).toEqual([3000, 1500, 500]);
  });

  it('rejects unknown filter values and sort keys', async () => {
    expect((await request(app).get('/api/orders?status=bogus')).status).toBe(400);
    expect((await request(app).get('/api/orders?sort=raw_payload')).status).toBe(400);
  });
});

describe('POST /api/orders/:id/advance', () => {
  it('moves forward one step at a time and stops at completed', async () => {
    const { rows } = await pool.query("SELECT id FROM orders WHERE external_order_id = 'dd-1'");
    const id = rows[0].id;
    const steps = ['new', 'accepted', 'preparing', 'ready'];
    for (const from of steps) {
      const res = await request(app).post(`/api/orders/${id}/advance`).send({ from });
      expect(res.status).toBe(200);
    }
    const final = await request(app).post(`/api/orders/${id}/advance`).send({ from: 'completed' });
    expect(final.status).toBe(409);
    expect(final.body.error).toBe('final_status');
  });

  it('returns 409 if the status changed since the admin loaded it', async () => {
    const { rows } = await pool.query("SELECT id FROM orders WHERE external_order_id = 'ue-1'");
    const res = await request(app).post(`/api/orders/${rows[0].id}/advance`).send({ from: 'new' });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'status_changed', current: 'accepted' });
  });

  it('404s for an unknown order', async () => {
    const res = await request(app).post('/api/orders/00000000-0000-0000-0000-000000000000/advance').send({ from: 'new' });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/orders/:id', () => {
  it('includes raw_payload on the detail view', async () => {
    const { rows } = await pool.query("SELECT id FROM orders WHERE external_order_id = 'dd-1'");
    const res = await request(app).get(`/api/orders/${rows[0].id}`);
    expect(res.status).toBe(200);
    expect(res.body.raw_payload).toEqual({});
  });

  it('404s for a malformed id', async () => {
    expect((await request(app).get('/api/orders/not-a-uuid')).status).toBe(404);
  });
});
