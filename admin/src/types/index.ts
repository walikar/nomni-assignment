export type Provider = 'uber_eats' | 'doordash';

export type OrderStatus = 'new' | 'accepted' | 'preparing' | 'ready' | 'completed' | 'cancelled';

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

export interface Order {
  id: string;
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
  created_at: string;
  updated_at: string;
  raw_payload?: unknown; // only on the detail endpoint
}

// GET /api/orders
export interface OrdersPage {
  items: Order[];
  total: number;
  page: number;
  page_size: number;
}

// What the list page's filter bar controls. All of it lives in the URL.
export interface OrderFilters {
  provider: string; // '' = all
  status: string; // '' = all
  search: string;
  sort: string; // e.g. '-created_at' (newest first) or 'total' (lowest first)
  page: number;
}

// POST /api/demo/orders
export interface DemoResult {
  provider: Provider;
  external_order_id: string;
  deliveries: { status: number; body: unknown }[];
  orders_stored: number;
  order_id: string | null;
}
