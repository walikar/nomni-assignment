import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { fetchUberOrder } from '../src/services/uber.service';
import { UpstreamError } from '../src/utils/errors';
import { countOrdersInDb, DOORDASH_TOKEN, fakeUberGetOrder, pool, readFixture, resetDatabase, signUberBody } from './helpers';

// Replace only fetchUberOrder (the call to Uber's API); everything else in uber.service stays real.
vi.mock('../src/services/uber.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/uber.service')>();
  return { ...actual, fetchUberOrder: vi.fn() };
});
const mockedFetchUberOrder = vi.mocked(fetchUberOrder);

const app = createApp();
const uberBody = readFixture('uber/webhook.orders-notification.json');
const doordashBody = readFixture('doordash/webhook.order-create.json');

function sendUberWebhook(body = uberBody, signature = signUberBody(body)) {
  return request(app)
    .post('/webhooks/orders')
    .set('Content-Type', 'application/json')
    .set('X-Uber-Signature', signature)
    .send(body);
}

function sendDoorDashWebhook(body = doordashBody, token = DOORDASH_TOKEN) {
  return request(app)
    .post('/webhooks/orders')
    .set('Content-Type', 'application/json')
    .set('Authorization', token)
    .send(body);
}

beforeEach(async () => {
  await resetDatabase();
  mockedFetchUberOrder.mockReset();
  mockedFetchUberOrder.mockImplementation((orderId) => fakeUberGetOrder(orderId));
});

afterAll(() => pool.end());

describe('two identical webhooks arriving together create one order', () => {
  it('Uber', async () => {
    const [first, second] = await Promise.all([sendUberWebhook(), sendUberWebhook()]);

    expect([first.status, second.status]).toEqual([200, 200]);
    expect(mockedFetchUberOrder).toHaveBeenCalledTimes(2); // both really ran end to end
    expect(await countOrdersInDb()).toBe(1);
  });

  it('DoorDash', async () => {
    const [first, second] = await Promise.all([sendDoorDashWebhook(), sendDoorDashWebhook()]);

    expect([first.status, second.status]).toEqual([200, 200]);
    expect(first.body.order_status).toBe('success');
    expect(first.body.merchant_supplied_id).toBe(second.body.merchant_supplied_id);
    expect(await countOrdersInDb()).toBe(1);
  });

  it('holds under a burst of 20 concurrent deliveries', async () => {
    const responses = await Promise.all(Array.from({ length: 20 }, () => sendDoorDashWebhook()));

    expect(responses.every((response) => response.status === 200)).toBe(true);
    expect(await countOrdersInDb()).toBe(1);
  });
});

describe('Uber', () => {
  it('fetches the full order and stores it; replies 200 with an empty body', async () => {
    const response = await sendUberWebhook();

    expect(response.status).toBe(200);
    expect(response.text).toBe('');
    expect(mockedFetchUberOrder.mock.calls.map((call) => call[0])).toEqual(['153dd7f1-339d-4619-940c-418943c14636']);

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
    const response = await sendUberWebhook(uberBody, signUberBody(uberBody, 'wrong-secret'));

    expect(response.status).toBe(401);
    expect(mockedFetchUberOrder).not.toHaveBeenCalled();
    expect(await countOrdersInDb()).toBe(0);
  });

  it('rejects a missing signature', async () => {
    const response = await request(app).post('/webhooks/orders').set('Content-Type', 'application/json').send(uberBody);
    expect(response.status).toBe(401);
  });

  it('checks the signature against the raw bytes, so re-formatted JSON fails', async () => {
    const reformatted = JSON.stringify(JSON.parse(uberBody));
    const response = await sendUberWebhook(reformatted, signUberBody(uberBody));
    expect(response.status).toBe(401);
  });

  it('answers non-2xx when Get Order fails, so Uber retries', async () => {
    mockedFetchUberOrder.mockRejectedValue(new UpstreamError('Uber Get Order returned 503'));

    const response = await sendUberWebhook();

    expect(response.status).toBe(502);
    expect(await countOrdersInDb()).toBe(0);
  });

  it('a cancellation from Uber cancels the order', async () => {
    await sendUberWebhook();

    mockedFetchUberOrder.mockImplementation((orderId) => fakeUberGetOrder(orderId, { current_state: 'CANCELED' }));
    await sendUberWebhook();

    const { rows } = await pool.query('SELECT status, provider_status FROM orders');
    expect(rows).toEqual([{ status: 'cancelled', provider_status: 'CANCELED' }]);
  });
});

describe('DoorDash', () => {
  it('stores the order and confirms synchronously', async () => {
    const response = await sendDoorDashWebhook();
    expect(response.status).toBe(200);

    const { rows } = await pool.query('SELECT * FROM orders');
    expect(response.body).toEqual({ merchant_supplied_id: rows[0].id, order_status: 'success' });
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
    const response = await sendDoorDashWebhook(doordashBody, 'nope');

    expect(response.status).toBe(401);
    expect(await countOrdersInDb()).toBe(0);
  });

  it('fails the order (non-2xx with a failure_reason) when the payload is unusable', async () => {
    const body = JSON.parse(doordashBody);
    delete body.order.subtotal;

    const response = await sendDoorDashWebhook(JSON.stringify(body));

    expect(response.status).toBe(400);
    expect(response.body.order_status).toBe('fail');
    expect(response.body.failure_reason).toMatch(/subtotal/);
  });
});

describe('detection and saving', () => {
  it('detects the provider from the body, ignoring any provider hint in the URL', async () => {
    const response = await request(app)
      .post('/webhooks/orders?provider=uber_eats')
      .set('Content-Type', 'application/json')
      .set('Authorization', DOORDASH_TOKEN)
      .send(doordashBody);

    expect(response.status).toBe(200);
    const { rows } = await pool.query('SELECT provider FROM orders');
    expect(rows).toEqual([{ provider: 'doordash' }]);
  });

  it('rejects payloads from no known provider, and invalid JSON', async () => {
    const unknown = await request(app).post('/webhooks/orders').set('Content-Type', 'application/json').send('{"provider":"uber"}');
    expect(unknown.status).toBe(400);

    const broken = await request(app).post('/webhooks/orders').set('Content-Type', 'application/json').send('{"tax": 300 "x": 1}');
    expect(broken.status).toBe(400);
  });

  it('a repeated webhook updates the order but never moves its status backwards', async () => {
    await sendDoorDashWebhook();
    await pool.query("UPDATE orders SET status = 'preparing'");

    const changed = JSON.parse(doordashBody);
    changed.order.consumer.phone = '+15550001111';
    await sendDoorDashWebhook(JSON.stringify(changed));

    const { rows } = await pool.query("SELECT status, customer->>'phone' AS phone FROM orders");
    expect(rows).toEqual([{ status: 'preparing', phone: '+15550001111' }]);
  });
});
