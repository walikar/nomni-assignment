import { Request, Response, Router } from 'express';
import { config } from '../config';
import { buildDoorDashDemoWebhook, buildUberDemoWebhook } from '../services/demo.service';
import { countOrders, findOrderIdsByExternalId } from '../services/orders.service';
import { PROVIDERS, Provider } from '../types/order';

const router = Router();

const MAX_DEMO_ORDERS_PER_MINUTE = 20;
const MAX_ORDERS_IN_DATABASE = 1000;

// Simple in-memory rate limit for the public demo.
let windowStartedAt = Date.now();
let ordersThisWindow = 0;

// GET /api/demo  ->  { enabled: true | false }
// The admin shows the "Try it" panel only when this is enabled.
router.get('/', (_req: Request, res: Response) => {
  res.json({ enabled: config.DEMO_MODE });
});

// POST /api/demo/orders   body: { "provider": "uber_eats" | "doordash", "times": 1 | 2 }
// Builds a real provider webhook and sends it to our own /webhooks/orders endpoint over HTTP,
// so it goes through exactly the same checks as a real delivery. times: 2 sends two identical copies at once.
router.post('/orders', async (req: Request, res: Response) => {
  if (!config.DEMO_MODE) {
    return res.status(404).json({ error: 'not_found' });
  }

  const provider = req.body?.provider as Provider;
  const times = req.body?.times === 2 ? 2 : 1;

  if (!PROVIDERS.includes(provider)) {
    return res.status(400).json({ error: 'invalid_provider', allowed: PROVIDERS });
  }

  if (Date.now() - windowStartedAt > 60_000) {
    windowStartedAt = Date.now();
    ordersThisWindow = 0;
  }
  if (ordersThisWindow >= MAX_DEMO_ORDERS_PER_MINUTE) {
    return res.status(429).json({ error: 'rate_limited', message: 'Too many demo orders; try again in a minute.' });
  }

  try {
    if ((await countOrders()) >= MAX_ORDERS_IN_DATABASE) {
      return res.status(409).json({ error: 'demo_full', message: 'The demo database is full.' });
    }
    ordersThisWindow++;

    const webhook = provider === 'uber_eats' ? buildUberDemoWebhook() : buildDoorDashDemoWebhook();

    // Call ourselves on the port this request came in on.
    const ownUrl = `http://127.0.0.1:${req.socket.localPort}`;
    const sendOnce = async () => {
      const response = await fetch(`${ownUrl}/webhooks/orders`, {
        method: 'POST',
        headers: webhook.headers,
        body: webhook.body,
      });
      const text = await response.text();
      return { status: response.status, body: text ? parseJsonOrText(text) : null };
    };

    const deliveries = await Promise.all(Array.from({ length: times }, sendOnce));

    // How many orders exist for this provider order id? Should always be 1.
    const storedIds = await findOrderIdsByExternalId(provider, webhook.externalOrderId);

    const allSucceeded = deliveries.every((delivery) => delivery.status === 200);
    res.status(allSucceeded ? 201 : 502).json({
      provider,
      external_order_id: webhook.externalOrderId,
      deliveries,
      orders_stored: storedIds.length,
      order_id: storedIds[0] ?? null,
    });
  } catch (err: any) {
    console.error('Demo order failed:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

function parseJsonOrText(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export default router;
