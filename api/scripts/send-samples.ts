// Sends a few sample webhooks through the real endpoint so the admin has orders to show.
//   npm run samples -w api
import { config } from '../src/config';
import { buildDoorDashDemoWebhook, buildUberDemoWebhook, DemoWebhook } from '../src/services/demo.service';

const API_URL = process.env.API_URL || `http://localhost:${config.PORT}`;

async function send(label: string, webhook: DemoWebhook) {
  const response = await fetch(`${API_URL}/webhooks/orders`, {
    method: 'POST',
    headers: webhook.headers,
    body: webhook.body,
  });
  console.log(`${label} ${webhook.externalOrderId} -> ${response.status}`);
}

async function main() {
  for (let i = 0; i < 4; i++) {
    await send('doordash', buildDoorDashDemoWebhook(i));
  }
  for (let i = 0; i < 2; i++) {
    await send('uber_eats', buildUberDemoWebhook());
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
