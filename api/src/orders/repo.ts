import type { Pool } from '../db/pool';
import { nextStatus, STATUS_FLOW, type NormalizedOrder, type Order, type OrderStatus, type Provider } from './types';

const LIST_COLUMNS = `id, provider, external_order_id, status, provider_status, customer, line_items,
  subtotal_cents, tax_cents, total_cents, currency, placed_at, created_at, updated_at`;

const FLOW_ARRAY = `ARRAY[${STATUS_FLOW.map((s) => `'${s}'`).join(',')}]`;

/**
 * Insert-or-update keyed on (provider, external_order_id). ON CONFLICT is atomic, so
 * concurrent duplicate deliveries serialize on the unique index instead of racing a
 * read-then-insert. Status only ever moves forward: a late or retried webhook can't undo
 * progress made in the kitchen, and cancelled/completed are final.
 */
export async function upsertOrder(pool: Pool, o: NormalizedOrder): Promise<Order> {
  const { rows } = await pool.query<Order>(
    `INSERT INTO orders (provider, external_order_id, status, provider_status, customer, line_items,
                         subtotal_cents, tax_cents, total_cents, currency, placed_at, raw_payload)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (provider, external_order_id) DO UPDATE SET
       status = CASE
         WHEN orders.status IN ('completed', 'cancelled') THEN orders.status
         WHEN EXCLUDED.status = 'cancelled' THEN 'cancelled'
         WHEN array_position(${FLOW_ARRAY}, EXCLUDED.status) > array_position(${FLOW_ARRAY}, orders.status)
           THEN EXCLUDED.status
         ELSE orders.status
       END,
       provider_status = EXCLUDED.provider_status,
       customer        = EXCLUDED.customer,
       line_items      = EXCLUDED.line_items,
       subtotal_cents  = EXCLUDED.subtotal_cents,
       tax_cents       = EXCLUDED.tax_cents,
       total_cents     = EXCLUDED.total_cents,
       currency        = EXCLUDED.currency,
       placed_at       = COALESCE(EXCLUDED.placed_at, orders.placed_at),
       raw_payload     = EXCLUDED.raw_payload,
       updated_at      = now()
     RETURNING ${LIST_COLUMNS}`,
    [
      o.provider,
      o.external_order_id,
      o.status,
      o.provider_status,
      JSON.stringify(o.customer),
      JSON.stringify(o.line_items),
      o.subtotal_cents,
      o.tax_cents,
      o.total_cents,
      o.currency,
      o.placed_at,
      JSON.stringify(o.raw_payload),
    ],
  );
  return rows[0];
}

export const SORTS = {
  created_at: 'created_at',
  total: 'total_cents',
  customer: "customer->>'name'",
  status: `array_position(${FLOW_ARRAY}::text[] || ARRAY['cancelled'], status)`,
  provider: 'provider',
} as const;
export type SortKey = keyof typeof SORTS;

export interface ListParams {
  provider?: Provider;
  status?: OrderStatus;
  q?: string;
  sort: SortKey;
  dir: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

export async function listOrders(pool: Pool, p: ListParams): Promise<{ items: Order[]; total: number }> {
  const where: string[] = [];
  const args: unknown[] = [];
  if (p.provider) {
    args.push(p.provider);
    where.push(`provider = $${args.length}`);
  }
  if (p.status) {
    args.push(p.status);
    where.push(`status = $${args.length}`);
  }
  if (p.q) {
    args.push(`%${p.q.replace(/[\\%_]/g, '\\$&')}%`);
    const n = args.length;
    where.push(`(external_order_id ILIKE $${n} OR customer->>'name' ILIKE $${n} OR customer->>'phone' ILIKE $${n})`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  // Sort expressions come from a fixed map, never from the request.
  const orderSql = `ORDER BY ${SORTS[p.sort]} ${p.dir === 'asc' ? 'ASC' : 'DESC'} NULLS LAST, id`;

  const [items, count] = await Promise.all([
    pool.query<Order>(
      `SELECT ${LIST_COLUMNS} FROM orders ${whereSql} ${orderSql} LIMIT $${args.length + 1} OFFSET $${args.length + 2}`,
      [...args, p.pageSize, (p.page - 1) * p.pageSize],
    ),
    pool.query<{ count: string }>(`SELECT count(*) FROM orders ${whereSql}`, args),
  ]);
  return { items: items.rows, total: Number(count.rows[0].count) };
}

export async function getOrder(pool: Pool, id: string): Promise<Order | null> {
  const { rows } = await pool.query<Order>(`SELECT ${LIST_COLUMNS}, raw_payload FROM orders WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export type AdvanceResult =
  | { ok: true; order: Order }
  | { ok: false; reason: 'not_found' | 'final_status' | 'status_changed'; current?: OrderStatus };

/**
 * Moves an order one step forward. `from` is the status the admin saw; if someone else moved
 * it in the meantime the conditional UPDATE matches nothing and we report a conflict.
 */
export async function advanceOrder(pool: Pool, id: string, from: OrderStatus): Promise<AdvanceResult> {
  const to = nextStatus(from);
  if (to) {
    const { rows } = await pool.query<Order>(
      `UPDATE orders SET status = $3, updated_at = now() WHERE id = $1 AND status = $2 RETURNING ${LIST_COLUMNS}, raw_payload`,
      [id, from, to],
    );
    if (rows[0]) return { ok: true, order: rows[0] };
  }
  const { rows } = await pool.query<{ status: OrderStatus }>('SELECT status FROM orders WHERE id = $1', [id]);
  if (!rows[0]) return { ok: false, reason: 'not_found' };
  if (rows[0].status !== from) return { ok: false, reason: 'status_changed', current: rows[0].status };
  return { ok: false, reason: 'final_status', current: rows[0].status };
}
