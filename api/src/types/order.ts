export type Provider = 'uber_eats' | 'doordash';

export type OrderStatus = 'new' | 'accepted' | 'preparing' | 'ready' | 'completed' | 'cancelled';

export const PROVIDERS: Provider[] = ['uber_eats', 'doordash'];

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

// Every provider order is converted into this shape before it is saved.
export interface NewOrder {
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

// A saved order, as returned by the database.
export interface Order extends Omit<NewOrder, 'raw_payload'> {
  id: string;
  created_at: string;
  updated_at: string;
  raw_payload?: unknown;
}
