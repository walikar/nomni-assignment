/**
 * Sends a handful of webhooks through the real endpoint, built from the official
 * fixtures with a few fields varied, so the admin has something to filter and sort.
 *   npm run samples -w api
 */
import 'dotenv/config';
import { buildDoorDashWebhook, buildUberWebhook, type BuiltWebhook } from '../src/demo/payloads';

const API = process.env.API_URL ?? `http://localhost:${process.env.PORT ?? 4000}`;

async function send(label: string, hook: BuiltWebhook) {
  const res = await fetch(`${API}/webhooks/orders`, { method: 'POST', headers: hook.headers, body: hook.body });
  console.log(`${label} ${hook.externalOrderId} -> ${res.status}`);
}

for (let i = 0; i < 4; i++) {
  await send('doordash', buildDoorDashWebhook(process.env.DOORDASH_WEBHOOK_TOKEN ?? '', i));
}
for (let i = 0; i < 2; i++) {
  await send('uber_eats', buildUberWebhook(process.env.UBER_CLIENT_SECRET ?? ''));
}
