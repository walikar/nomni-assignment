import pool from '../db';
import { NewOrder, Order, OrderStatus, Provider } from '../types/order';
import { getNextStatus, STATUS_FLOW } from '../utils/order-status';

// Columns returned by every query (raw_payload only on the detail view, it can be large).
const ORDER_COLUMNS = `
  id, provider, external_order_id, status, provider_status, customer, line_items,
  subtotal_cents, tax_cents, total_cents, currency, placed_at, created_at, updated_at
`;

// Produces: ARRAY['new','accepted','preparing','ready','completed']
const STATUS_FLOW_SQL = `ARRAY[${STATUS_FLOW.map((status) => `'${status}'`).join(',')}]`;

// --- Save (insert or update) ---

// Saves an order. If the same provider order was saved before, it's updated instead of duplicated.
//
// Why this is safe when two identical webhooks arrive at the same time:
// INSERT ... ON CONFLICT is one atomic statement. The unique key (provider, external_order_id)
// makes the second insert wait for the first to finish, then take the DO UPDATE branch.
// There is no "check, then insert" gap for a duplicate to slip through.
//
// Status rule on update: it only ever moves forward, so a late or retried webhook can't undo
// kitchen progress. 'completed' and 'cancelled' are final.
export async function saveOrder(order: NewOrder): Promise<Order> {
  const sql = `
    INSERT INTO orders (
      provider, external_order_id, status, provider_status, customer, line_items,
      subtotal_cents, tax_cents, total_cents, currency, placed_at, raw_payload
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)

    ON CONFLICT (provider, external_order_id) DO UPDATE SET
      status = CASE
        -- already finished: keep it
        WHEN orders.status IN ('completed', 'cancelled') THEN orders.status
        -- the provider cancelled it: cancel
        WHEN EXCLUDED.status = 'cancelled' THEN 'cancelled'
        -- the new status is further along the flow: take it
        WHEN array_position(${STATUS_FLOW_SQL}, EXCLUDED.status) > array_position(${STATUS_FLOW_SQL}, orders.status)
          THEN EXCLUDED.status
        -- otherwise keep what we have
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

    RETURNING ${ORDER_COLUMNS}
  `;
  // In ON CONFLICT, "orders" is the row already saved and "EXCLUDED" is the row we tried to insert.

  const values = [
    order.provider, //                       $1
    order.external_order_id, //              $2
    order.status, //                         $3
    order.provider_status, //                $4
    JSON.stringify(order.customer), //       $5
    JSON.stringify(order.line_items), //     $6
    order.subtotal_cents, //                 $7
    order.tax_cents, //                      $8
    order.total_cents, //                    $9
    order.currency, //                       $10
    order.placed_at, //                      $11
    JSON.stringify(order.raw_payload), //    $12
  ];

  const result = await pool.query<Order>(sql, values);
  return result.rows[0];
}

// --- List (admin) ---

// What the admin can sort by, mapped to SQL. Sort keys come from this list only, never straight from the request.
export const SORT_COLUMNS: Record<string, string> = {
  created_at: 'created_at',
  total: 'total_cents',
  customer: "customer->>'name'",
  status: `array_position(${STATUS_FLOW_SQL}::text[] || ARRAY['cancelled'], status)`,
  provider: 'provider',
};

export interface OrderFilters {
  provider?: Provider;
  status?: OrderStatus;
  search?: string;
  sortBy: string; // a key of SORT_COLUMNS
  sortDirection: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

export async function findOrders(filters: OrderFilters): Promise<{ orders: Order[]; total: number }> {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (filters.provider) {
    values.push(filters.provider);
    conditions.push(`provider = $${values.length}`);
  }

  if (filters.status) {
    values.push(filters.status);
    conditions.push(`status = $${values.length}`);
  }

  if (filters.search) {
    // Escape % and _ so they are searched for literally, not used as wildcards.
    const escaped = filters.search.replace(/[\\%_]/g, '\\$&');
    values.push(`%${escaped}%`);
    const n = values.length;
    conditions.push(`(external_order_id ILIKE $${n} OR customer->>'name' ILIKE $${n} OR customer->>'phone' ILIKE $${n})`);
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const direction = filters.sortDirection === 'asc' ? 'ASC' : 'DESC';
  const orderBySql = `ORDER BY ${SORT_COLUMNS[filters.sortBy]} ${direction} NULLS LAST, id`;
  const offset = (filters.page - 1) * filters.pageSize;

  const listSql = `
    SELECT ${ORDER_COLUMNS} FROM orders
    ${whereSql}
    ${orderBySql}
    LIMIT $${values.length + 1} OFFSET $${values.length + 2}
  `;
  const countSql = `SELECT count(*) FROM orders ${whereSql}`;

  const [listResult, countResult] = await Promise.all([
    pool.query<Order>(listSql, [...values, filters.pageSize, offset]),
    pool.query<{ count: string }>(countSql, values),
  ]);

  return {
    orders: listResult.rows,
    total: Number(countResult.rows[0].count),
  };
}

// --- Get one ---

export async function findOrderById(id: string): Promise<Order | null> {
  const result = await pool.query<Order>(`SELECT ${ORDER_COLUMNS}, raw_payload FROM orders WHERE id = $1`, [id]);
  return result.rows[0] ?? null;
}

// --- Move to the next status (admin button) ---

export type MoveResult =
  | { success: true; order: Order }
  | { success: false; error: 'not_found' | 'final_status' | 'status_changed'; currentStatus?: OrderStatus };

// Moves an order one step forward.
// `shownStatus` is the status the admin was looking at. The UPDATE only matches if the order still has
// that status, so if someone else moved it first we report a conflict instead of skipping a step.
export async function moveOrderToNextStatus(id: string, shownStatus: OrderStatus): Promise<MoveResult> {
  const nextStatus = getNextStatus(shownStatus);

  if (nextStatus) {
    const updateResult = await pool.query<Order>(
      `UPDATE orders SET status = $3, updated_at = now()
       WHERE id = $1 AND status = $2
       RETURNING ${ORDER_COLUMNS}, raw_payload`,
      [id, shownStatus, nextStatus],
    );
    if (updateResult.rows[0]) {
      return { success: true, order: updateResult.rows[0] };
    }
  }

  // Nothing was updated. Find out why.
  const current = await pool.query<{ status: OrderStatus }>('SELECT status FROM orders WHERE id = $1', [id]);
  const currentStatus = current.rows[0]?.status;

  if (!currentStatus) {
    return { success: false, error: 'not_found' };
  }
  if (currentStatus !== shownStatus) {
    return { success: false, error: 'status_changed', currentStatus };
  }
  return { success: false, error: 'final_status', currentStatus };
}

// --- Used by the demo ---

export async function countOrders(): Promise<number> {
  const result = await pool.query<{ count: string }>('SELECT count(*) FROM orders');
  return Number(result.rows[0].count);
}

// All our order ids for one provider order. After any number of duplicate webhooks this should be exactly one.
export async function findOrderIdsByExternalId(provider: Provider, externalOrderId: string): Promise<string[]> {
  const result = await pool.query<{ id: string }>(
    'SELECT id FROM orders WHERE provider = $1 AND external_order_id = $2',
    [provider, externalOrderId],
  );
  return result.rows.map((row) => row.id);
}
