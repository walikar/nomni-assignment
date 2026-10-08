import express, { Router, type Request } from 'express';
import type { Pool } from '../db/pool';
import { advanceOrder, getOrder, listOrders, SORTS, type ListParams, type SortKey } from './repo';
import { ORDER_STATUSES, PROVIDERS, type OrderStatus, type Provider } from './types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function ordersRouter(pool: Pool): Router {
  const router = Router();
  router.use(express.json());

  router.get('/orders', async (req, res, next) => {
    try {
      const parsed = parseListParams(req);
      if ('error' in parsed) {
        res.status(400).json(parsed);
        return;
      }
      const { items, total } = await listOrders(pool, parsed);
      res.json({ items, total, page: parsed.page, page_size: parsed.pageSize });
    } catch (err) {
      next(err);
    }
  });

  router.get('/orders/:id', async (req, res, next) => {
    try {
      const order = UUID.test(req.params.id) ? await getOrder(pool, req.params.id) : null;
      if (!order) {
        res.status(404).json({ error: 'not_found' });
        return;
      }
      res.json(order);
    } catch (err) {
      next(err);
    }
  });

  router.post('/orders/:id/advance', async (req, res, next) => {
    try {
      const from = req.body?.from;
      if (!UUID.test(req.params.id)) {
        res.status(404).json({ error: 'not_found' });
        return;
      }
      if (!ORDER_STATUSES.includes(from)) {
        res.status(400).json({ error: 'invalid_from', allowed: ORDER_STATUSES });
        return;
      }
      const result = await advanceOrder(pool, req.params.id, from);
      if (result.ok) {
        res.json(result.order);
        return;
      }
      res.status(result.reason === 'not_found' ? 404 : 409).json({ error: result.reason, current: result.current });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

function parseListParams(req: Request): ListParams | { error: string } {
  const q = req.query;
  const one = (k: string) => (typeof q[k] === 'string' && q[k] !== '' ? (q[k] as string) : undefined);

  const provider = one('provider');
  if (provider && !PROVIDERS.includes(provider as Provider)) return { error: 'invalid_provider' };
  const status = one('status');
  if (status && !ORDER_STATUSES.includes(status as OrderStatus)) return { error: 'invalid_status' };

  // sort=created_at (asc) or sort=-created_at (desc)
  const rawSort = one('sort') ?? '-created_at';
  const dir = rawSort.startsWith('-') ? 'desc' : 'asc';
  const sort = rawSort.replace(/^-/, '');
  if (!(sort in SORTS)) return { error: 'invalid_sort' };

  const page = Math.max(1, Number.parseInt(one('page') ?? '1', 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(one('page_size') ?? '25', 10) || 25));

  return {
    provider: provider as Provider | undefined,
    status: status as OrderStatus | undefined,
    q: one('q')?.trim().slice(0, 100) || undefined,
    sort: sort as SortKey,
    dir,
    page,
    pageSize,
  };
}
