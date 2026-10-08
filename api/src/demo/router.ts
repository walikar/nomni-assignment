import express, { Router } from 'express';
import type { Pool } from '../db/pool';
import { PROVIDERS, type Provider } from '../orders/types';
import { buildDoorDashWebhook, buildUberWebhook } from './payloads';

export interface DemoDeps {
  enabled: boolean;
  pool: Pool;
  /** Base URL where this API can reach its own /webhooks/orders. */
  selfUrl: () => string;
  uberClientSecret: string;
  doordashWebhookToken: string;
}

const MAX_PER_MINUTE = 20;
const MAX_ORDERS = 1000;

/**
 * "Send test order" for the hosted demo. Builds a provider webhook and POSTs it to our own
 * /webhooks/orders over HTTP, so it goes through detection, auth, the provider flow and the
 * upsert exactly like a real delivery. `times: 2` sends two identical copies at once.
 */
export function demoRouter(deps: DemoDeps): Router {
  const router = Router();
  router.get('/demo', (_req, res) => {
    res.json({ enabled: deps.enabled });
  });
  if (!deps.enabled) return router;

  let windowStart = Date.now();
  let used = 0;

  router.post('/demo/orders', express.json(), async (req, res, next) => {
    try {
      const provider = req.body?.provider as Provider;
      const times = req.body?.times === 2 ? 2 : 1;
      if (!PROVIDERS.includes(provider)) {
        res.status(400).json({ error: 'invalid_provider', allowed: PROVIDERS });
        return;
      }

      if (Date.now() - windowStart > 60_000) {
        windowStart = Date.now();
        used = 0;
      }
      if (used >= MAX_PER_MINUTE) {
        res.status(429).json({ error: 'rate_limited', message: 'Too many demo orders; try again in a minute.' });
        return;
      }
      const { rows } = await deps.pool.query<{ count: string }>('SELECT count(*) FROM orders');
      if (Number(rows[0].count) >= MAX_ORDERS) {
        res.status(409).json({ error: 'demo_full', message: 'The demo database is full.' });
        return;
      }
      used++;

      const hook =
        provider === 'uber_eats'
          ? buildUberWebhook(deps.uberClientSecret)
          : buildDoorDashWebhook(deps.doordashWebhookToken);

      const deliveries = await Promise.all(
        Array.from({ length: times }, async () => {
          const r = await fetch(`${deps.selfUrl()}/webhooks/orders`, { method: 'POST', headers: hook.headers, body: hook.body });
          const text = await r.text();
          return { status: r.status, body: text ? safeJson(text) : null };
        }),
      );

      const stored = await deps.pool.query<{ id: string }>(
        'SELECT id FROM orders WHERE provider = $1 AND external_order_id = $2',
        [provider, hook.externalOrderId],
      );
      res.status(deliveries.every((d) => d.status === 200) ? 201 : 502).json({
        provider,
        external_order_id: hook.externalOrderId,
        deliveries,
        orders_stored: stored.rowCount,
        order_id: stored.rows[0]?.id ?? null,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
