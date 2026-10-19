import { describe, expect, it } from 'vitest';
import { convertDoorDashOrder } from '../src/services/doordash.service';
import { convertUberOrder, mapUberStatus } from '../src/services/uber.service';
import { detectProvider } from '../src/utils/detect-provider';
import { InvalidPayloadError } from '../src/utils/errors';
import { readFixture } from './helpers';

const uberWebhook = JSON.parse(readFixture('uber/webhook.orders-notification.json'));
const uberOrder = JSON.parse(readFixture('uber/get-order.json'));
const doordashWebhook = JSON.parse(readFixture('doordash/webhook.order-create.json'));

describe('detectProvider', () => {
  it('recognises each official sample by its shape', () => {
    expect(detectProvider(uberWebhook)).toBe('uber_eats');
    expect(detectProvider(doordashWebhook)).toBe('doordash');
  });

  it('does not trust a provider field', () => {
    expect(detectProvider({ provider: 'doordash' })).toBeNull();
    expect(detectProvider({ ...doordashWebhook, provider: 'uber_eats' })).toBe('doordash');
  });

  it('does not accept a bare DoorDash order without the webhook envelope', () => {
    expect(detectProvider(doordashWebhook.order)).toBeNull();
  });
});

describe('convertUberOrder (official Get Order sample)', () => {
  const converted = convertUberOrder(uberOrder, uberWebhook);

  it("uses Uber's payment.charges.total as the total, not a sum of the items", () => {
    expect(converted.total_cents).toBe(1399);
    expect(converted.subtotal_cents).toBe(650);
    expect(converted.tax_cents).toBe(52);
  });

  it('converts line items with unit price (modifiers included) and line total', () => {
    expect(converted.line_items[0]).toEqual({
      name: 'Fresh-baked muffin',
      quantity: 1,
      unit_price_cents: 350,
      total_cents: 350,
      modifiers: ['Chocolate deluxe'],
      notes: null,
    });
    expect(converted.line_items[1]).toMatchObject({ name: 'Coffee', modifiers: ['Milk', 'No Sugar'], notes: 'make it iced please' });
  });

  it('maps Uber statuses to ours', () => {
    expect(mapUberStatus('CREATED')).toBe('new');
    expect(mapUberStatus('ACCEPTED')).toBe('accepted');
    expect(mapUberStatus('FINISHED')).toBe('completed');
    expect(mapUberStatus('DENIED')).toBe('cancelled');
    expect(mapUberStatus('CANCELED')).toBe('cancelled');
    expect(mapUberStatus('UNKNOWN')).toBe('new');
  });

  it('rejects an order without a cart', () => {
    expect(() => convertUberOrder({ ...uberOrder, cart: undefined }, uberWebhook)).toThrow(InvalidPayloadError);
  });
});

describe('convertDoorDashOrder (official sample order)', () => {
  const converted = convertDoorDashOrder(doordashWebhook);

  it('computes the total as subtotal + tax', () => {
    expect(converted.total_cents).toBe(2300);
    expect(converted.currency).toBe('USD');
  });

  it('flattens categories[].items[] and the nested options', () => {
    expect(converted.line_items).toEqual([
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
    expect(converted.customer.phone).toBe('+18559731040');
  });

  it('adds priced options to the unit price', () => {
    const webhook = structuredClone(doordashWebhook);
    const item = webhook.order.categories[0].items[0];
    item.price = 1000;
    item.quantity = 2;
    item.extras[0].options[0].price = 150;

    const [line] = convertDoorDashOrder(webhook).line_items;
    expect(line).toMatchObject({ unit_price_cents: 1150, total_cents: 2300 });
  });

  it('rejects money that is not a whole number of cents', () => {
    const webhook = structuredClone(doordashWebhook);
    webhook.order.tax = 3.5;
    expect(() => convertDoorDashOrder(webhook)).toThrow(InvalidPayloadError);
  });
});
