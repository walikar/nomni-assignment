export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export const PROVIDERS = ['uber_eats', 'doordash'] as const;
export type Provider = (typeof PROVIDERS)[number];

export const STATUS_FLOW = ['new', 'accepted', 'preparing', 'ready', 'completed'] as const;
export const STATUSES = [...STATUS_FLOW, 'cancelled'] as const;
export type OrderStatus = (typeof STATUSES)[number];

export interface LineItem {
  name: string;
  quantity: number;
  unit_price_cents: number;
  total_cents: number;
  modifiers: string[];
  notes: string | null;
}

export interface Order {
  id: string;
  provider: Provider;
  external_order_id: string;
  status: OrderStatus;
  provider_status: string | null;
  customer: { name: string | null; phone: string | null; email: string | null };
  line_items: LineItem[];
  subtotal_cents: number | null;
  tax_cents: number | null;
  total_cents: number;
  currency: string;
  placed_at: string | null;
  created_at: string;
  updated_at: string;
  raw_payload?: unknown;
}

export interface OrderPage {
  items: Order[];
  total: number;
  page: number;
  page_size: number;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError(`Can't reach the API at ${API_URL}. Is it running?`, 0);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.error ?? `Request failed (${res.status})`, res.status, body);
  return body as T;
}

export function fetchOrders(query: string, signal?: AbortSignal) {
  return call<OrderPage>(`/api/orders${query ? `?${query}` : ''}`, { signal });
}

export function fetchOrder(id: string, signal?: AbortSignal) {
  return call<Order>(`/api/orders/${encodeURIComponent(id)}`, { signal });
}

export function advanceOrder(id: string, from: OrderStatus) {
  return call<Order>(`/api/orders/${encodeURIComponent(id)}/advance`, {
    method: 'POST',
    body: JSON.stringify({ from }),
  });
}

export interface DemoResult {
  provider: Provider;
  external_order_id: string;
  deliveries: { status: number; body: unknown }[];
  orders_stored: number;
  order_id: string | null;
}

export async function demoEnabled(): Promise<boolean> {
  try {
    return (await call<{ enabled: boolean }>('/api/demo')).enabled;
  } catch {
    return false;
  }
}

export function sendDemoOrder(provider: Provider, times: 1 | 2) {
  return call<DemoResult>('/api/demo/orders', { method: 'POST', body: JSON.stringify({ provider, times }) });
}

export function nextStatus(status: OrderStatus): OrderStatus | null {
  const i = STATUS_FLOW.indexOf(status as (typeof STATUS_FLOW)[number]);
  return i >= 0 && i < STATUS_FLOW.length - 1 ? STATUS_FLOW[i + 1] : null;
}
