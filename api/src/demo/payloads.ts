import { createHmac, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

/**
 * Builds provider webhooks from the official fixtures with a few fields varied.
 * Used by the demo endpoint and `npm run samples`; both send them through the real
 * /webhooks/orders endpoint, signature and all.
 */

const fixture = (path: string) =>
  JSON.parse(readFileSync(new URL(`../../../fixtures/${path}`, import.meta.url), 'utf8'));

const UBER_WEBHOOK = fixture('uber/webhook.orders-notification.json');
const DOORDASH_WEBHOOK = fixture('doordash/webhook.order-create.json');

export interface BuiltWebhook {
  externalOrderId: string;
  body: string;
  headers: Record<string, string>;
}

export function buildUberWebhook(clientSecret: string): BuiltWebhook {
  const body = structuredClone(UBER_WEBHOOK);
  const id = randomUUID();
  body.event_id = randomUUID();
  body.event_time = Math.floor(Date.now() / 1000);
  body.meta.resource_id = id;
  body.resource_href = `https://api.uber.com/v2/eats/order/${id}`;
  const raw = JSON.stringify(body);
  return {
    externalOrderId: id,
    body: raw,
    headers: {
      'Content-Type': 'application/json',
      'X-Uber-Signature': createHmac('sha256', clientSecret).update(raw).digest('hex'),
    },
  };
}

const PEOPLE: [string, string, string][] = [
  ['Priya', 'S.', '+14155550101'],
  ['Marcus', 'L.', '+14155550102'],
  ['Hana', 'K.', '+14155550103'],
  ['Diego', 'R.', '+14155550104'],
  ['Amara', 'O.', '+14155550105'],
  ['Tom', 'B.', '+14155550106'],
];

const DISHES: [string, number][] = [
  ['Burrito Scram-Bowl', 1095],
  ['Breakfast Burrito', 925],
  ['Huevos Rancheros', 1250],
  ['Chilaquiles Verdes', 1175],
];

export function buildDoorDashWebhook(token: string, n = Math.floor(Math.random() * 1000)): BuiltWebhook {
  const body = structuredClone(DOORDASH_WEBHOOK);
  const [first, last, phone] = PEOPLE[n % PEOPLE.length];
  const [dish, price] = DISHES[n % DISHES.length];
  const order = body.order;
  order.id = `dd-${Date.now().toString(36)}${n.toString(36)}`;
  Object.assign(order.consumer, { first_name: first, last_name: last, phone });
  const item = order.categories[0].items[0];
  item.name = dish;
  item.price = price;
  item.quantity = 1 + (n % 3);
  order.subtotal = item.price * item.quantity;
  order.tax = Math.round(order.subtotal * 0.0875);
  return {
    externalOrderId: order.id,
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', Authorization: token },
  };
}
