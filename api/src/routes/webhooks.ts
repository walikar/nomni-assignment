import express, { Request, Response, Router } from 'express';
import { convertDoorDashOrder, isValidDoorDashToken } from '../services/doordash.service';
import { saveOrder } from '../services/orders.service';
import { convertUberOrder, fetchUberOrder, isValidUberSignature } from '../services/uber.service';
import { detectProvider } from '../utils/detect-provider';
import { InvalidPayloadError, UpstreamError } from '../utils/errors';

const router = Router();

// POST /webhooks/orders
// One endpoint for both Uber Eats and DoorDash.
//
// express.raw keeps the body as bytes instead of parsed JSON,
// because Uber's signature is calculated over the exact bytes it sent.
router.post('/orders', express.raw({ type: () => true, limit: '1mb' }), async (req: Request, res: Response) => {
  const rawBody: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);

  let body: any;
  try {
    body = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'invalid_json' });
  }

  // Who sent it? Decided from the body's shape only.
  const provider = detectProvider(body);

  try {
    if (provider === 'uber_eats') {
      return await handleUberWebhook(req, res, body, rawBody);
    }
    if (provider === 'doordash') {
      return await handleDoorDashWebhook(req, res, body);
    }
    return res.status(400).json({ error: 'unrecognized_payload' });
  } catch (err: any) {
    if (err instanceof InvalidPayloadError) {
      return res.status(422).json({ error: 'invalid_payload', message: err.message });
    }
    if (err instanceof UpstreamError) {
      // Any non-2xx makes Uber retry later, so a temporary failure isn't lost.
      console.warn(err.message);
      return res.status(502).json({ error: 'upstream_error', message: err.message });
    }
    console.error('Webhook processing failed:', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// --- Uber Eats ---
// The webhook is only a notification ("order X changed"), so we fetch the full order from Uber.
async function handleUberWebhook(req: Request, res: Response, notification: any, rawBody: Buffer) {
  // 1. Is it really from Uber?
  if (!isValidUberSignature(rawBody, req.get('x-uber-signature'))) {
    return res.status(401).json({ error: 'invalid_signature' });
  }

  // 2. Fetch the full order (cart, customer, totals) from Uber's Get Order API.
  const orderId: string = notification.meta.resource_id;
  const uberOrder = await fetchUberOrder(orderId);

  // 3. Convert it to our format, and check Uber returned the order we asked for.
  const order = convertUberOrder(uberOrder, notification);
  if (order.external_order_id !== orderId) {
    throw new UpstreamError(`Get Order returned id ${order.external_order_id} for resource_id ${orderId}`);
  }

  // 4. Save it. If we've seen this order before, it's updated instead of duplicated.
  await saveOrder(order);

  // 5. Uber's docs ask for 200 with an empty body.
  return res.status(200).end();
}

// --- DoorDash ---
// The webhook contains the full order, so we save it straight away and confirm it in the response.
async function handleDoorDashWebhook(req: Request, res: Response, body: any) {
  // 1. Is it really from DoorDash?
  if (!isValidDoorDashToken(req.get('authorization'))) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  // 2. We only handle new orders. Acknowledge anything else.
  if (body.event.type !== 'OrderCreate') {
    return res.status(200).json({ ignored: body.event.type });
  }

  // 3. Convert it to our format. If it's unusable, tell DoorDash the order failed (any non-2xx does that).
  let order;
  try {
    order = convertDoorDashOrder(body);
  } catch (err: any) {
    if (!(err instanceof InvalidPayloadError)) throw err;
    return res.status(400).json({ order_status: 'fail', failure_reason: `Invalid order payload: ${err.message}` });
  }

  // 4. Save it (insert or update).
  const saved = await saveOrder(order);

  // 5. Confirm synchronously: 200 means "accepted". merchant_supplied_id is our own order id.
  return res.status(200).json({ merchant_supplied_id: saved.id, order_status: 'success' });
}

export default router;
