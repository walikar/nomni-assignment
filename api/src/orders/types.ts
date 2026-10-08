export const PROVIDERS = ['uber_eats', 'doordash'] as const;
export type Provider = (typeof PROVIDERS)[number];

/** Forward-only kitchen flow. `cancelled` sits outside it and is terminal. */
export const STATUS_FLOW = ['new', 'accepted', 'preparing', 'ready', 'completed'] as const;
export const ORDER_STATUSES = [...STATUS_FLOW, 'cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface Customer {
  name: string | null;
  phone: string | null;
  email: string | null;
}

export interface LineItem {
  name: string;
  quantity: number;
  unit_price_cents: number;
  total_cents: number;
  modifiers: string[];
  notes: string | null;
}

/** What a provider mapper produces; the repository turns it into a row. */
export interface NormalizedOrder {
  provider: Provider;
  external_order_id: string;
  status: OrderStatus;
  provider_status: string | null;
  customer: Customer;
  line_items: LineItem[];
  subtotal_cents: number | null;
  tax_cents: number | null;
  total_cents: number;
  currency: string;
  placed_at: string | null;
  raw_payload: unknown;
}

export interface Order extends Omit<NormalizedOrder, 'raw_payload'> {
  id: string;
  created_at: string;
  updated_at: string;
  raw_payload?: unknown;
}

/** Thrown when a payload is missing something we need. Maps to a 4xx. */
export class PayloadError extends Error {}

export function nextStatus(current: OrderStatus): OrderStatus | null {
  const i = STATUS_FLOW.indexOf(current as (typeof STATUS_FLOW)[number]);
  return i >= 0 && i < STATUS_FLOW.length - 1 ? STATUS_FLOW[i + 1] : null;
}
