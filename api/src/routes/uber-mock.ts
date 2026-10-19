import fs from 'fs';
import path from 'path';
import { Request, Response, Router } from 'express';

// A stand-in for Uber's Get Order API, because there is no live Uber account.
// Only mounted when MOCK_UBER=1.

const router = Router();

const SAMPLE_ORDER_FILE = path.join(__dirname, '../../../fixtures/uber/get-order.json');
const SAMPLE_ORDER = JSON.parse(fs.readFileSync(SAMPLE_ORDER_FILE, 'utf8'));

// Uber's official sample, with its id replaced by the one requested.
// (The docs say meta.resource_id equals the order id, but Uber's two samples use different ids.)
export function getSampleUberOrder(orderId: string) {
  return { ...structuredClone(SAMPLE_ORDER), id: orderId };
}

// GET /mock/uber/v2/eats/order/:orderId
router.get('/v2/eats/order/:orderId', (req: Request, res: Response) => {
  if (!req.get('authorization')?.startsWith('Bearer ')) {
    return res.status(401).json({ code: 'unauthorized' });
  }
  res.json(getSampleUberOrder(req.params.orderId));
});

export default router;
