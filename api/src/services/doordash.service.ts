import { timingSafeEqual } from 'crypto';
import { config } from '../config';
import { LineItem, NewOrder, OrderStatus } from '../types/order';
import { InvalidPayloadError } from '../utils/errors';
import {
  asObjectArray,
  isObject,
  joinName,
  labelWithQuantity,
  readCents,
  readQuantity,
  readText,
} from '../utils/validation';

// --- 1. Token check ---

// DoorDash doesn't sign requests. It sends back the Auth Token we configured on the webhook,
// in the Authorization header.
export function isValidDoorDashToken(authorizationHeader: string | undefined): boolean {
  if (!authorizationHeader) return false;

  const received = Buffer.from(authorizationHeader.trim());
  const expected = Buffer.from(config.DOORDASH_WEBHOOK_TOKEN);

  if (received.length !== expected.length) return false;
  return timingSafeEqual(received, expected);
}

// --- 2. Convert to our order format ---

const DOORDASH_STATUS_TO_OURS: Record<string, OrderStatus> = {
  NEW: 'new', // every incoming DoorDash order is NEW
};

export function mapDoorDashStatus(doordashStatus: string | null): OrderStatus {
  return (doordashStatus && DOORDASH_STATUS_TO_OURS[doordashStatus]) || 'new';
}

// Converts an OrderCreate webhook ({ event, order }) into our order.
export function convertDoorDashOrder(body: any): NewOrder {
  const order = body.order;
  if (!isObject(order)) {
    throw new InvalidPayloadError('DoorDash order is missing');
  }

  const orderId = readText(order.id);
  if (!orderId) {
    throw new InvalidPayloadError('DoorDash order.id is missing');
  }

  // Items live under categories[].items[]. There is no top-level items[].
  if (!Array.isArray(order.categories)) {
    throw new InvalidPayloadError('DoorDash order.categories is missing');
  }

  const subtotal = readCents(order.subtotal, 'order.subtotal');
  const tax = readCents(order.tax, 'order.tax');
  const consumer = order.consumer ?? {};
  const doordashStatus = readText(body.event?.status);

  const lineItems: LineItem[] = [];
  asObjectArray(order.categories).forEach((category, categoryIndex) => {
    const items: unknown[] = Array.isArray(category.items) ? category.items : [];
    items.forEach((item, itemIndex) => {
      lineItems.push(convertDoorDashItem(item, `categories[${categoryIndex}].items[${itemIndex}]`));
    });
  });

  return {
    provider: 'doordash',
    external_order_id: orderId,
    status: mapDoorDashStatus(doordashStatus),
    provider_status: doordashStatus,
    customer: {
      name: joinName(consumer.first_name, consumer.last_name),
      phone: readText(consumer.phone),
      email: readText(consumer.email),
    },
    line_items: lineItems,
    subtotal_cents: subtotal,
    tax_cents: tax,
    // DoorDash sends no total. Subtotal is before tax, so total = subtotal + tax (tips left out).
    total_cents: subtotal + tax,
    // DoorDash's order has no currency field.
    currency: 'USD',
    placed_at: null,
    raw_payload: body,
  };
}

function convertDoorDashItem(item: unknown, path: string): LineItem {
  if (!isObject(item)) {
    throw new InvalidPayloadError(`${path} is not an object`);
  }

  const quantity = readQuantity(item.quantity, `${path}.quantity`);
  const options = collectDoorDashOptions(item.extras, `${path}.extras`);

  // Each option's price is added once per unit of the item.
  let unitPrice = readCents(item.price, `${path}.price`);
  for (const option of options) {
    unitPrice += option.price * option.quantity;
  }

  return {
    name: readText(item.name) ?? readText(item.merchant_supplied_id) ?? 'Item',
    quantity,
    unit_price_cents: unitPrice,
    total_cents: unitPrice * quantity,
    modifiers: options.map((option) => labelWithQuantity(option.name, option.quantity)),
    notes: readText(item.special_instructions),
  };
}

interface DoorDashOption {
  name: string;
  price: number;
  quantity: number;
}

// Options are nested: extras[].options[], and an option can have its own extra[].options[].
// This walks the whole tree and returns a flat list.
function collectDoorDashOptions(extras: unknown, path: string): DoorDashOption[] {
  const result: DoorDashOption[] = [];

  asObjectArray(extras).forEach((extra, extraIndex) => {
    asObjectArray(extra.options).forEach((option, optionIndex) => {
      const optionPath = `${path}[${extraIndex}].options[${optionIndex}]`;

      result.push({
        name: readText(option.name) ?? readText(option.merchant_supplied_id) ?? 'Option',
        price: option.price === undefined ? 0 : readCents(option.price, `${optionPath}.price`),
        quantity: option.quantity === undefined ? 1 : readQuantity(option.quantity, `${optionPath}.quantity`),
      });

      result.push(...collectDoorDashOptions(option.extra, `${optionPath}.extra`));
    });
  });

  return result;
}
