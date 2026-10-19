import { Request, Response, Router } from 'express';
import { findOrderById, findOrders, moveOrderToNextStatus, OrderFilters, SORT_COLUMNS } from '../services/orders.service';
import { OrderStatus, PROVIDERS, Provider } from '../types/order';
import { ALL_STATUSES } from '../utils/order-status';

const router = Router();

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

// GET /api/orders?provider=doordash&status=new&q=priya&sort=-total&page=1&page_size=25
// sort=total is ascending, sort=-total is descending.
router.get('/', async (req: Request, res: Response) => {
  const provider = readQueryParam(req, 'provider');
  if (provider && !PROVIDERS.includes(provider as Provider)) {
    return res.status(400).json({ error: 'invalid_provider' });
  }

  const status = readQueryParam(req, 'status');
  if (status && !ALL_STATUSES.includes(status as OrderStatus)) {
    return res.status(400).json({ error: 'invalid_status' });
  }

  const sort = readQueryParam(req, 'sort') || '-created_at';
  const sortBy = sort.replace(/^-/, '');
  if (!(sortBy in SORT_COLUMNS)) {
    return res.status(400).json({ error: 'invalid_sort' });
  }

  const page = Math.max(1, parseInt(readQueryParam(req, 'page') || '1', 10) || 1);
  const requestedSize = parseInt(readQueryParam(req, 'page_size') || String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, requestedSize));

  const filters: OrderFilters = {
    provider: provider as Provider | undefined,
    status: status as OrderStatus | undefined,
    search: readQueryParam(req, 'q')?.trim().slice(0, 100) || undefined,
    sortBy,
    sortDirection: sort.startsWith('-') ? 'desc' : 'asc',
    page,
    pageSize,
  };

  try {
    const { orders, total } = await findOrders(filters);
    res.json({ items: orders, total, page, page_size: pageSize });
  } catch (err: any) {
    console.error('Order list fetch failed:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /api/orders/:id
router.get('/:id', async (req: Request, res: Response) => {
  if (!UUID_PATTERN.test(req.params.id)) {
    return res.status(404).json({ error: 'not_found' });
  }

  try {
    const order = await findOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'not_found' });
    }
    res.json(order);
  } catch (err: any) {
    console.error('Order fetch failed:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /api/orders/:id/advance   body: { "from": "new" }
// Moves the order one step forward. "from" is the status the admin was looking at.
router.post('/:id/advance', async (req: Request, res: Response) => {
  const shownStatus = req.body?.from;

  if (!UUID_PATTERN.test(req.params.id)) {
    return res.status(404).json({ error: 'not_found' });
  }
  if (!ALL_STATUSES.includes(shownStatus)) {
    return res.status(400).json({ error: 'invalid_from', allowed: ALL_STATUSES });
  }

  try {
    const result = await moveOrderToNextStatus(req.params.id, shownStatus);

    if (result.success) {
      return res.json(result.order);
    }
    if (result.error === 'not_found') {
      return res.status(404).json({ error: 'not_found' });
    }
    // status_changed: someone else moved it first. final_status: it's already completed or cancelled.
    return res.status(409).json({ error: result.error, current: result.currentStatus });
  } catch (err: any) {
    console.error('Order status update failed:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Returns a query string value, or undefined if it's missing or empty.
function readQueryParam(req: Request, name: string): string | undefined {
  const value = req.query[name];
  return typeof value === 'string' && value !== '' ? value : undefined;
}

export default router;
