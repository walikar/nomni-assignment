import express, { Router } from 'express';
import type { Pool } from '../db/pool';
import { upsertOrder } from '../orders/repo';
import { PayloadError } from '../orders/types';
import { UpstreamError, type UberClient } from '../providers/uberClient';
import { detectProvider } from './detect';
import { mapDoorDashOrder, verifyDoorDashToken } from './doordash';
import { mapUberOrder, verifyUberSignature } from './uber';
import type { Json } from './util';

export interface WebhookDeps {
  pool: Pool;
  uber: UberClient;
  uberClientSecret: string;
  doordashWebhookToken: string;
}

/** One endpoint for every provider; the body's shape decides who sent it. */
export function webhookRouter(deps: WebhookDeps): Router {
  const router = Router();

  // Raw bytes, not parsed JSON: Uber's HMAC is over the exact body received.
  router.post('/webhooks/orders', express.raw({ type: () => true, limit: '1mb' }), async (req, res, next) => {
    try {
      const raw: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
      let body: unknown;
      try {
        body = JSON.parse(raw.toString('utf8'));
      } catch {
        res.status(400).json({ error: 'invalid_json' });
        return;
      }

      const provider = detectProvider(body);
      const payload = body as Json;

      if (provider === 'uber_eats') {
        if (!verifyUberSignature(raw, req.get('x-uber-signature'), deps.uberClientSecret)) {
          res.status(401).json({ error: 'invalid_signature' });
          return;
        }
        const orderId = (payload.meta as Json).resource_id as string;
        // The notification has no cart: fetch the full order. If this fails we answer non-2xx
        // and Uber redelivers (exponential backoff, up to 7 attempts) — the upsert makes that safe.
        const order = await deps.uber.getOrder(orderId);
        const normalized = mapUberOrder(order, payload);
        if (normalized.external_order_id !== orderId) {
          throw new UpstreamError(`Get Order returned id ${normalized.external_order_id} for resource_id ${orderId}`);
        }
        await upsertOrder(deps.pool, normalized);
        // Documented acknowledgement: 200 with an empty body.
        res.status(200).end();
        return;
      }

      if (provider === 'doordash') {
        if (!verifyDoorDashToken(req.get('authorization'), deps.doordashWebhookToken)) {
          res.status(401).json({ error: 'unauthorized' });
          return;
        }
        const event = payload.event as Json;
        if (event.type !== 'OrderCreate') {
          res.status(200).json({ ignored: event.type });
          return;
        }
        let normalized;
        try {
          normalized = mapDoorDashOrder(payload);
        } catch (err) {
          if (!(err instanceof PayloadError)) throw err;
          // Synchronous confirmation: non-2xx fails the order; body mirrors the PATCH confirmation.
          res.status(400).json({ order_status: 'fail', failure_reason: `Invalid order payload: ${err.message}` });
          return;
        }
        const saved = await upsertOrder(deps.pool, normalized);
        // Synchronous confirmation: 200 = accepted. merchant_supplied_id is our internal id.
        res.status(200).json({ merchant_supplied_id: saved.id, order_status: 'success' });
        return;
      }

      res.status(400).json({ error: 'unrecognized_payload' });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
