import { createHmac, randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { config } from '../config';

// Builds realistic provider webhooks from the official samples in /fixtures, with a few fields changed
// so each one is a new order. Used by the "Try it" demo and by `npm run samples`.

const FIXTURES_DIR = path.join(__dirname, '../../../fixtures');

function readFixture(fileName: string): any {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, fileName), 'utf8'));
}

const UBER_WEBHOOK_SAMPLE = readFixture('uber/webhook.orders-notification.json');
const DOORDASH_WEBHOOK_SAMPLE = readFixture('doordash/webhook.order-create.json');

export interface DemoWebhook {
  externalOrderId: string;
  body: string;
  headers: Record<string, string>;
}

export function buildUberDemoWebhook(): DemoWebhook {
  const webhook = structuredClone(UBER_WEBHOOK_SAMPLE);
  const orderId = randomUUID();

  webhook.event_id = randomUUID();
  webhook.event_time = Math.floor(Date.now() / 1000);
  webhook.meta.resource_id = orderId;
  webhook.resource_href = `https://api.uber.com/v2/eats/order/${orderId}`;

  const body = JSON.stringify(webhook);
  const signature = createHmac('sha256', config.UBER_CLIENT_SECRET).update(body).digest('hex');

  return {
    externalOrderId: orderId,
    body,
    headers: { 'Content-Type': 'application/json', 'X-Uber-Signature': signature },
  };
}

const DEMO_CUSTOMERS = [
  { first: 'Priya', last: 'S.', phone: '+14155550101' },
  { first: 'Marcus', last: 'L.', phone: '+14155550102' },
  { first: 'Hana', last: 'K.', phone: '+14155550103' },
  { first: 'Diego', last: 'R.', phone: '+14155550104' },
  { first: 'Amara', last: 'O.', phone: '+14155550105' },
  { first: 'Tom', last: 'B.', phone: '+14155550106' },
];

const DEMO_DISHES = [
  { name: 'Burrito Scram-Bowl', price: 1095 },
  { name: 'Breakfast Burrito', price: 925 },
  { name: 'Huevos Rancheros', price: 1250 },
  { name: 'Chilaquiles Verdes', price: 1175 },
];

export function buildDoorDashDemoWebhook(seed = Math.floor(Math.random() * 1000)): DemoWebhook {
  const webhook = structuredClone(DOORDASH_WEBHOOK_SAMPLE);
  const order = webhook.order;
  const customer = DEMO_CUSTOMERS[seed % DEMO_CUSTOMERS.length];
  const dish = DEMO_DISHES[seed % DEMO_DISHES.length];

  order.id = `dd-${Date.now().toString(36)}${seed.toString(36)}`;
  order.consumer.first_name = customer.first;
  order.consumer.last_name = customer.last;
  order.consumer.phone = customer.phone;

  const item = order.categories[0].items[0];
  item.name = dish.name;
  item.price = dish.price;
  item.quantity = 1 + (seed % 3);

  order.subtotal = item.price * item.quantity;
  order.tax = Math.round(order.subtotal * 0.0875);

  return {
    externalOrderId: order.id,
    body: JSON.stringify(webhook),
    headers: { 'Content-Type': 'application/json', Authorization: config.DOORDASH_WEBHOOK_TOKEN },
  };
}
