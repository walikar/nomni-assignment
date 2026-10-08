import { timingSafeEqual } from 'node:crypto';
import { PayloadError, type LineItem, type NormalizedOrder, type OrderStatus } from '../orders/types';
import { cents, isObject, joinName, quantity, str, type Json } from './util';

/**
 * DoorDash has no request signing: you configure an Auth Token on the webhook
 * subscription and DoorDash sends it back in the Authorization header.
 */
export function verifyDoorDashToken(header: string | undefined, token: string): boolean {
  if (!header) return false;
  const given = Buffer.from(header.trim());
  const expected = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

const DOORDASH_STATUS_MAP: Record<string, OrderStatus> = {
  NEW: 'new',
};

export function mapDoorDashStatus(status: string | null): OrderStatus {
  return (status && DOORDASH_STATUS_MAP[status]) || 'new';
}

/** Maps an `OrderCreate` webhook ({ event, order }) to the internal shape. */
export function mapDoorDashOrder(body: Json): NormalizedOrder {
  const event = isObject(body.event) ? body.event : {};
  const order = body.order;
  if (!isObject(order)) throw new PayloadError('DoorDash order is missing');
  const id = str(order.id);
  if (!id) throw new PayloadError('DoorDash order.id is missing');
  // Items live under categories[].items[]; there is no top-level items[].
  if (!Array.isArray(order.categories)) throw new PayloadError('DoorDash order.categories is missing');

  const subtotal = cents(order.subtotal, 'order.subtotal');
  const tax = cents(order.tax, 'order.tax');
  const consumer = isObject(order.consumer) ? order.consumer : {};
  const status = str(event.status);

  const lineItems = order.categories.filter(isObject).flatMap((category, c) =>
    (Array.isArray(category.items) ? category.items : []).map((item, i) => mapDoorDashItem(item, `categories[${c}].items[${i}]`)),
  );

  return {
    provider: 'doordash',
    external_order_id: id,
    status: mapDoorDashStatus(status),
    provider_status: status,
    customer: {
      name: joinName(consumer.first_name, consumer.last_name),
      phone: str(consumer.phone),
      email: str(consumer.email),
    },
    line_items: lineItems,
    subtotal_cents: subtotal,
    tax_cents: tax,
    // DoorDash sends no total: subtotal is pre-tax, so total = subtotal + tax (tips excluded).
    total_cents: subtotal + tax,
    // The Order model has no currency field.
    currency: 'USD',
    placed_at: null,
    raw_payload: body,
  };
}

function mapDoorDashItem(item: unknown, path: string): LineItem {
  if (!isObject(item)) throw new PayloadError(`${path} is not an object`);
  const qty = quantity(item.quantity, `${path}.quantity`);
  const options = collectOptions(item.extras, `${path}.extras`);
  // Option prices are added per unit of the parent item.
  const unit = cents(item.price, `${path}.price`) + options.reduce((sum, o) => sum + o.price * o.quantity, 0);
  return {
    name: str(item.name) ?? str(item.merchant_supplied_id) ?? 'Item',
    quantity: qty,
    unit_price_cents: unit,
    total_cents: unit * qty,
    modifiers: options.map((o) => (o.quantity > 1 ? `${o.quantity}× ${o.name}` : o.name)),
    notes: str(item.special_instructions),
  };
}

interface Option {
  name: string;
  price: number;
  quantity: number;
}

/** extras[].options[] can nest further via options[].extra[] — flatten all of it. */
function collectOptions(extras: unknown, path: string): Option[] {
  if (!Array.isArray(extras)) return [];
  return extras.filter(isObject).flatMap((extra, e) =>
    (Array.isArray(extra.options) ? extra.options : []).filter(isObject).flatMap((opt, o) => {
      const optPath = `${path}[${e}].options[${o}]`;
      return [
        {
          name: str(opt.name) ?? str(opt.merchant_supplied_id) ?? 'Option',
          price: opt.price === undefined ? 0 : cents(opt.price, `${optPath}.price`),
          quantity: opt.quantity === undefined ? 1 : quantity(opt.quantity, `${optPath}.quantity`),
        },
        ...collectOptions(opt.extra, `${optPath}.extra`),
      ];
    }),
  );
}
