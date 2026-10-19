import { createHmac, timingSafeEqual } from 'crypto';
import { config } from '../config';
import { LineItem, NewOrder, OrderStatus } from '../types/order';
import { InvalidPayloadError, UpstreamError } from '../utils/errors';
import {
  asObjectArray,
  isObject,
  joinName,
  labelWithQuantity,
  readCents,
  readOptionalCents,
  readQuantity,
  readText,
} from '../utils/validation';

// --- 1. Signature check ---

// Uber signs the raw request body: X-Uber-Signature = lowercase hex of HMAC-SHA256(client secret, body).
// It must be checked against the exact bytes we received, before any JSON parsing.
export function isValidUberSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
  if (!signatureHeader) return false;

  const expected = createHmac('sha256', config.UBER_CLIENT_SECRET).update(rawBody).digest();
  const received = Buffer.from(signatureHeader.trim().toLowerCase(), 'hex');

  // timingSafeEqual throws when lengths differ, so check that first.
  if (received.length !== expected.length) return false;

  // Constant-time compare, so response timing doesn't reveal how much of a guess was right.
  return timingSafeEqual(received, expected);
}

// --- 2. Fetch the full order ---

// The webhook only says "order X changed"; it has no cart. Uber's docs say to fetch the order:
// GET /v2/eats/order/{order_id}
export async function fetchUberOrder(orderId: string): Promise<unknown> {
  const url = `${config.UBER_API_BASE.replace(/\/$/, '')}/v2/eats/order/${encodeURIComponent(orderId)}`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${config.UBER_ACCESS_TOKEN}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
  } catch (err: any) {
    throw new UpstreamError(`Uber Get Order request failed: ${err.message}`);
  }

  if (!response.ok) {
    throw new UpstreamError(`Uber Get Order returned ${response.status}`);
  }
  return response.json();
}

// --- 3. Convert to our order format ---

const UBER_STATUS_TO_OURS: Record<string, OrderStatus> = {
  CREATED: 'new',
  ACCEPTED: 'accepted',
  FINISHED: 'completed',
  DENIED: 'cancelled',
  CANCELED: 'cancelled',
};

// UNKNOWN (or any value Uber adds later) becomes 'new'. Saving never moves an order backwards anyway.
export function mapUberStatus(uberStatus: string | null): OrderStatus {
  return (uberStatus && UBER_STATUS_TO_OURS[uberStatus]) || 'new';
}

// Converts Uber's Get Order response into our order. The original notification is kept in raw_payload.
export function convertUberOrder(uberOrder: any, notification: unknown): NewOrder {
  if (!isObject(uberOrder)) {
    throw new InvalidPayloadError('Uber order is not an object');
  }

  const orderId = readText(uberOrder.id);
  if (!orderId) {
    throw new InvalidPayloadError('Uber order.id is missing');
  }

  const items = uberOrder.cart?.items;
  if (!Array.isArray(items)) {
    throw new InvalidPayloadError('Uber order.cart.items is missing');
  }

  const charges = uberOrder.payment?.charges ?? {};
  if (!isObject(charges.total)) {
    throw new InvalidPayloadError('Uber order.payment.charges.total is missing');
  }

  const eater = uberOrder.eater ?? {};
  const uberStatus = readText(uberOrder.current_state);

  return {
    provider: 'uber_eats',
    external_order_id: orderId,
    status: mapUberStatus(uberStatus),
    provider_status: uberStatus,
    customer: {
      name: joinName(eater.first_name, eater.last_name),
      phone: readText(eater.phone),
      email: null, // Uber doesn't send it
    },
    line_items: items.map((item, index) => convertUberItem(item, index)),
    subtotal_cents: readOptionalCents(charges.sub_total?.amount, 'payment.charges.sub_total.amount'),
    tax_cents: readOptionalCents(charges.tax?.amount, 'payment.charges.tax.amount'),
    // Uber's own total. In the official sample: sub_total 650 + tax 52 + total_fee 697 = 1399.
    total_cents: readCents(charges.total.amount, 'payment.charges.total.amount'),
    currency: readText(charges.total.currency_code) ?? 'USD',
    placed_at: readText(uberOrder.placed_at),
    raw_payload: { notification, order: uberOrder },
  };
}

function convertUberItem(item: any, index: number): LineItem {
  const path = `cart.items[${index}]`;
  if (!isObject(item)) {
    throw new InvalidPayloadError(`${path} is not an object`);
  }

  const quantity = readQuantity(item.quantity, `${path}.quantity`);
  // Uber's unit price already includes chosen modifiers (sample: muffin 300 + chocolate 50 = 350).
  const unitPrice = readCents(item.price?.unit_price?.amount, `${path}.price.unit_price.amount`);
  const lineTotal = readOptionalCents(item.price?.total_price?.amount, `${path}.price.total_price.amount`);

  return {
    name: readText(item.title) ?? readText(item.id) ?? 'Item',
    quantity,
    unit_price_cents: unitPrice,
    total_cents: lineTotal ?? unitPrice * quantity,
    modifiers: listUberModifiers(item),
    notes: readText(item.special_instructions),
  };
}

// e.g. ['Milk', 'No Sugar']
function listUberModifiers(item: Record<string, any>): string[] {
  const modifiers: string[] = [];

  for (const group of asObjectArray(item.selected_modifier_groups)) {
    for (const chosen of asObjectArray(group.selected_items)) {
      modifiers.push(labelWithQuantity(chosen.title, chosen.quantity));
    }
    for (const removed of asObjectArray(group.removed_items)) {
      modifiers.push(`No ${readText(removed.title) ?? '?'}`);
    }
  }

  return modifiers;
}
