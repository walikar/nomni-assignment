import { readFileSync } from 'node:fs';
import { Router } from 'express';

const FIXTURE = JSON.parse(
  readFileSync(new URL('../../../fixtures/uber/get-order.json', import.meta.url), 'utf8'),
) as Record<string, unknown>;

/**
 * Stand-in for Uber's Get Order endpoint when there is no live account. Returns the
 * official sample response with `id` set to the requested order id — the docs say
 * meta.resource_id equals the order id, but the two official samples use different ids.
 */
export function uberGetOrderFixture(orderId: string): Record<string, unknown> {
  return { ...structuredClone(FIXTURE), id: orderId };
}

export function uberMockRouter(): Router {
  const router = Router();
  router.get('/v2/eats/order/:orderId', (req, res) => {
    if (!req.get('authorization')?.startsWith('Bearer ')) {
      res.status(401).json({ code: 'unauthorized' });
      return;
    }
    res.json(uberGetOrderFixture(req.params.orderId));
  });
  return router;
}
