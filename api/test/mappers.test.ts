import { describe, expect, it } from 'vitest';
import { PayloadError } from '../src/orders/types';
import { detectProvider } from '../src/webhooks/detect';
import { mapDoorDashOrder } from '../src/webhooks/doordash';
import { mapUberOrder, mapUberStatus } from '../src/webhooks/uber';
import { fixture } from './helpers';

const uberWebhook = JSON.parse(fixture('uber/webhook.orders-notification.json'));
const uberOrder = JSON.parse(fixture('uber/get-order.json'));
const doordashWebhook = JSON.parse(fixture('doordash/webhook.order-create.json'));

describe('detectProvider', () => {
  it('recognises each official sample by shape', () => {
    expect(detectProvider(uberWebhook)).toBe('uber_eats');
    expect(detectProvider(doordashWebhook)).toBe('doordash');
  });

  it('does not trust a provider field', () => {
    expect(detectProvider({ provider: 'doordash' })).toBeNull();
    expect(detectProvider({ ...doordashWebhook, provider: 'uber_eats' })).toBe('doordash');
  });

  it('a bare DoorDash order (no envelope) is not accepted', () => {
    expect(detectProvider(doordashWebhook.order)).toBeNull();
  });
});

describe('mapUberOrder (official Get Order sample)', () => {
  const mapped = mapUberOrder(uberOrder, uberWebhook);

  it('uses payment.charges.total as the total, not a sum of items', () => {
    expect(mapped.total_cents).toBe(1399);
    expect(mapped.subtotal_cents).toBe(650);
    expect(mapped.tax_cents).toBe(52);
  });

  it('maps line items with unit price (modifiers included) and line total', () => {
    expect(mapped.line_items[0]).toEqual({
      name: 'Fresh-baked muffin',
      quantity: 1,
      unit_price_cents: 350,
      total_cents: 350,
      modifiers: ['Chocolate deluxe'],
      notes: null,
    });
    expect(mapped.line_items[1]).toMatchObject({ name: 'Coffee', modifiers: ['Milk', 'No Sugar'], notes: 'make it iced please' });
  });

  it('maps statuses', () => {
    expect(mapUberStatus('CREATED')).toBe('new');
    expect(mapUberStatus('ACCEPTED')).toBe('accepted');
    expect(mapUberStatus('FINISHED')).toBe('completed');
    expect(mapUberStatus('DENIED')).toBe('cancelled');
    expect(mapUberStatus('CANCELED')).toBe('cancelled');
    expect(mapUberStatus('UNKNOWN')).toBe('new');
  });

  it('rejects an order without a cart', () => {
    expect(() => mapUberOrder({ ...uberOrder, cart: undefined }, uberWebhook)).toThrow(PayloadError);
  });
});

describe('mapDoorDashOrder (official sample order)', () => {
  const mapped = mapDoorDashOrder(doordashWebhook);

  it('computes the total as subtotal + tax', () => {
    expect(mapped.total_cents).toBe(2300);
    expect(mapped.currency).toBe('USD');
  });

  it('flattens categories[].items[] and nested extras/options', () => {
    expect(mapped.line_items).toEqual([
      {
        name: 'Burrito Scram-Bowl',
        quantity: 1,
        unit_price_cents: 0,
        total_cents: 0,
        modifiers: ['KETCHUP', 'Salt'],
        notes: null,
      },
    ]);
  });

  it('reads the phone from consumer.phone', () => {
    expect(mapped.customer.phone).toBe('+18559731040');
  });

  it('adds priced options to the unit price', () => {
    const order = structuredClone(doordashWebhook);
    const item = order.order.categories[0].items[0];
    item.price = 1000;
    item.quantity = 2;
    item.extras[0].options[0].price = 150;
    const [line] = mapDoorDashOrder(order).line_items;
    expect(line).toMatchObject({ unit_price_cents: 1150, total_cents: 2300 });
  });

  it('rejects non-integer money', () => {
    const order = structuredClone(doordashWebhook);
    order.order.tax = 3.5;
    expect(() => mapDoorDashOrder(order)).toThrow(PayloadError);
  });
});
