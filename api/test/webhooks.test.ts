import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp, countOrders, DOORDASH_TOKEN, fakeUber, fixture, pool, resetDb, signUber } from './helpers';

const uberBody = fixture('uber/webhook.orders-notification.json');
const doordashBody = fixture('doordash/webhook.order-create.json');

function postUber(app: ReturnType<typeof buildApp>, body = uberBody, signature = signUber(body)) {
  return request(app)
    .post('/webhooks/orders')
    .set('Content-Type', 'application/json')
    .set('X-Uber-Signature', signature)
    .send(body);
}

function postDoorDash(app: ReturnType<typeof buildApp>, body = doordashBody, token = DOORDASH_TOKEN) {
  return request(app)
    .post('/webhooks/orders')
    .set('Content-Type', 'application/json')
    .set('Authorization', token)
    .send(body);
}

beforeEach(resetDb);
afterAll(() => pool.end());

describe('two identical webhooks arriving together create one order', () => {
  it('Uber', async () => {
    const uber = fakeUber();
    const app = buildApp(uber);

    const [a, b] = await Promise.all([postUber(app), postUber(app)]);

    expect([a.status, b.status]).toEqual([200, 200]);
    expect(uber.calls).toHaveLength(2); // both really ran end to end
    expect(await countOrders()).toBe(1);
  });

  it('DoorDash', async () => {
    const app = buildApp();

    const [a, b] = await Promise.all([postDoorDash(app), postDoorDash(app)]);

    expect([a.status, b.status]).toEqual([200, 200]);
    expect(a.body.order_status).toBe('success');
    expect(a.body.merchant_supplied_id).toBe(b.body.merchant_supplied_id);
    expect(await countOrders()).toBe(1);
  });

  it('holds under a burst of 20 concurrent deliveries', async () => {
    const app = buildApp();
    const responses = await Promise.all(Array.from({ length: 20 }, () => postDoorDash(app)));
    expect(responses.every((r) => r.status === 200)).toBe(true);
    expect(await countOrders()).toBe(1);
  });
});

describe('Uber', () => {
  it('fetches the full order and stores the mapped ticket; replies 200 with an empty body', async () => {
    const uber = fakeUber();
    const res = await postUber(buildApp(uber));

    expect(res.status).toBe(200);
    expect(res.text).toBe('');
    expect(uber.calls).toEqual(['153dd7f1-339d-4619-940c-418943c14636']);

    const { rows } = await pool.query('SELECT * FROM orders');
    expect(rows[0]).toMatchObject({
      provider: 'uber_eats',
      external_order_id: '153dd7f1-339d-4619-940c-418943c14636',
      status: 'new',
      provider_status: 'CREATED',
      customer: { name: 'Larry', phone: '+1 555-555-5555', email: null },
      subtotal_cents: 650,
      tax_cents: 52,
      total_cents: 1399,
      currency: 'USD',
    });
    expect(rows[0].line_items).toHaveLength(3);
    expect(rows[0].raw_payload.notification.event_id).toBe('c4d2261e-2779-4eb6-beb0-cb41235c751e');
  });

  it('rejects a bad signature without calling Uber', async () => {
    const uber = fakeUber();
    const res = await postUber(buildApp(uber), uberBody, signUber(uberBody, 'wrong-secret'));
    expect(res.status).toBe(401);
    expect(uber.calls).toHaveLength(0);
    expect(await countOrders()).toBe(0);
  });

  it('rejects a missing signature', async () => {
    const res = await request(buildApp()).post('/webhooks/orders').set('Content-Type', 'application/json').send(uberBody);
    expect(res.status).toBe(401);
  });

  it('verifies against the raw bytes, so re-serialised JSON fails', async () => {
    const reformatted = JSON.stringify(JSON.parse(uberBody));
    const res = await postUber(buildApp(), reformatted, signUber(uberBody));
    expect(res.status).toBe(401);
  });

  it('answers non-2xx when Get Order fails, so Uber retries', async () => {
    const app = buildApp({
      async getOrder() {
        const { UpstreamError } = await import('../src/providers/uberClient');
        throw new UpstreamError('Uber Get Order returned 503', 503);
      },
    });
    const res = await postUber(app);
    expect(res.status).toBe(502);
    expect(await countOrders()).toBe(0);
  });

  it('a cancellation from Uber cancels the ticket', async () => {
    await postUber(buildApp());
    await postUber(buildApp(fakeUber({ current_state: 'CANCELED' })));
    const { rows } = await pool.query('SELECT status, provider_status FROM orders');
    expect(rows).toEqual([{ status: 'cancelled', provider_status: 'CANCELED' }]);
  });
});

describe('DoorDash', () => {
  it('stores the order and confirms synchronously', async () => {
    const res = await postDoorDash(buildApp());
    expect(res.status).toBe(200);

    const { rows } = await pool.query('SELECT * FROM orders');
    expect(res.body).toEqual({ merchant_supplied_id: rows[0].id, order_status: 'success' });
    expect(rows[0]).toMatchObject({
      provider: 'doordash',
      external_order_id: 'abc12345',
      status: 'new',
      provider_status: 'NEW',
      customer: { name: 'Kelley W.', phone: '+18559731040', email: 'support@doordash.com' },
      subtotal_cents: 2000,
      tax_cents: 300,
      total_cents: 2300,
      currency: 'USD',
    });
  });

  it('rejects a wrong Authorization token', async () => {
    const res = await postDoorDash(buildApp(), doordashBody, 'nope');
    expect(res.status).toBe(401);
    expect(await countOrders()).toBe(0);
  });

  it('fails the order (non-2xx with a failure_reason) when the payload is unusable', async () => {
    const body = JSON.parse(doordashBody);
    delete body.order.subtotal;
    const res = await postDoorDash(buildApp(), JSON.stringify(body));
    expect(res.status).toBe(400);
    expect(res.body.order_status).toBe('fail');
    expect(res.body.failure_reason).toMatch(/subtotal/);
  });
});

describe('detection and upsert behaviour', () => {
  it('detects the provider from the body, ignoring any provider hint in the URL', async () => {
    const res = await request(buildApp())
      .post('/webhooks/orders?provider=uber_eats')
      .set('Content-Type', 'application/json')
      .set('Authorization', DOORDASH_TOKEN)
      .send(doordashBody);
    expect(res.status).toBe(200);
    const { rows } = await pool.query('SELECT provider FROM orders');
    expect(rows).toEqual([{ provider: 'doordash' }]);
  });

  it('rejects payloads from no known provider, and invalid JSON', async () => {
    const app = buildApp();
    const unknown = await request(app).post('/webhooks/orders').set('Content-Type', 'application/json').send('{"provider":"uber"}');
    expect(unknown.status).toBe(400);
    const broken = await request(app).post('/webhooks/orders').set('Content-Type', 'application/json').send('{"tax": 300 "x": 1}');
    expect(broken.status).toBe(400);
  });

  it('a redelivered webhook updates the order but never moves its status backwards', async () => {
    const app = buildApp();
    await postDoorDash(app);
    await pool.query("UPDATE orders SET status = 'preparing'");

    const changed = JSON.parse(doordashBody);
    changed.order.consumer.phone = '+15550001111';
    await postDoorDash(app, JSON.stringify(changed));

    const { rows } = await pool.query("SELECT status, customer->>'phone' AS phone FROM orders");
    expect(rows).toEqual([{ status: 'preparing', phone: '+15550001111' }]);
  });
});
