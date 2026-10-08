import { createHmac, timingSafeEqual } from 'node:crypto';
import { PayloadError, type LineItem, type NormalizedOrder, type OrderStatus } from '../orders/types';
import { cents, isObject, joinName, optionalCents, quantity, str, type Json } from './util';

/**
 * Uber signs the raw request body: X-Uber-Signature = lowercase hex of
 * HMAC-SHA256(key = client secret, message = body). Must run on the exact bytes received.
 */
export function verifyUberSignature(rawBody: Buffer, header: string | undefined, clientSecret: string): boolean {
  if (!header) return false;
  const expected = createHmac('sha256', clientSecret).update(rawBody).digest();
  const given = Buffer.from(header.trim().toLowerCase(), 'hex');
  return given.length === expected.length && timingSafeEqual(given, expected);
}

const UBER_STATUS_MAP: Record<string, OrderStatus> = {
  CREATED: 'new',
  ACCEPTED: 'accepted',
  FINISHED: 'completed',
  DENIED: 'cancelled',
  CANCELED: 'cancelled',
};

/** UNKNOWN (or anything new Uber adds) lands on `new`; the upsert never lets it regress an order. */
export function mapUberStatus(state: string | null): OrderStatus {
  return (state && UBER_STATUS_MAP[state]) || 'new';
}

/**
 * Maps a Get Order response (v2) to the internal shape. The webhook itself carries
 * no cart, so `notification` is only kept alongside it in raw_payload.
 */
export function mapUberOrder(order: unknown, notification: Json): NormalizedOrder {
  if (!isObject(order)) throw new PayloadError('Uber order is not an object');
  const id = str(order.id);
  if (!id) throw new PayloadError('Uber order.id is missing');

  const cart = isObject(order.cart) ? order.cart : {};
  if (!Array.isArray(cart.items)) throw new PayloadError('Uber order.cart.items is missing');

  const charges = isObject(order.payment) && isObject(order.payment.charges) ? order.payment.charges : {};
  const total = isObject(charges.total) ? charges.total : null;
  if (!total) throw new PayloadError('Uber order.payment.charges.total is missing');

  const eater = isObject(order.eater) ? order.eater : {};
  const state = str(order.current_state);

  return {
    provider: 'uber_eats',
    external_order_id: id,
    status: mapUberStatus(state),
    provider_status: state,
    customer: {
      name: joinName(eater.first_name, eater.last_name),
      phone: str(eater.phone),
      email: null,
    },
    line_items: cart.items.map((item, i) => mapUberItem(item, i)),
    subtotal_cents: optionalCents(amountOf(charges.sub_total), 'payment.charges.sub_total.amount'),
    tax_cents: optionalCents(amountOf(charges.tax), 'payment.charges.tax.amount'),
    // Authoritative: equals sub_total + tax + total_fee in the official sample.
    total_cents: cents(total.amount, 'payment.charges.total.amount'),
    currency: str(total.currency_code) ?? 'USD',
    placed_at: str(order.placed_at),
    raw_payload: { notification, order },
  };
}

function mapUberItem(item: unknown, i: number): LineItem {
  if (!isObject(item)) throw new PayloadError(`cart.items[${i}] is not an object`);
  const price = isObject(item.price) ? item.price : {};
  const qty = quantity(item.quantity, `cart.items[${i}].quantity`);
  // unit_price already includes selected modifier prices (sample: base 300 + modifier 50 = 350).
  const unit = cents(amountOf(price.unit_price), `cart.items[${i}].price.unit_price.amount`);
  const lineTotal = optionalCents(amountOf(price.total_price), `cart.items[${i}].price.total_price.amount`);

  const groups = Array.isArray(item.selected_modifier_groups) ? item.selected_modifier_groups.filter(isObject) : [];
  const modifiers = groups.flatMap((g) => [
    ...(Array.isArray(g.selected_items) ? g.selected_items : []).filter(isObject).map((m) => modifierLabel(m)),
    ...(Array.isArray(g.removed_items) ? g.removed_items : []).filter(isObject).map((m) => `No ${str(m.title) ?? '?'}`),
  ]);

  return {
    name: str(item.title) ?? str(item.id) ?? 'Item',
    quantity: qty,
    unit_price_cents: unit,
    total_cents: lineTotal ?? unit * qty,
    modifiers,
    notes: str(item.special_instructions),
  };
}

function modifierLabel(m: Json): string {
  const title = str(m.title) ?? '?';
  return typeof m.quantity === 'number' && m.quantity > 1 ? `${m.quantity}× ${title}` : title;
}

function amountOf(money: unknown): unknown {
  return isObject(money) ? money.amount : undefined;
}
