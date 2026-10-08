import type { Provider } from '../orders/types';
import { isObject } from './util';

/**
 * Identifies the sender from the body's shape alone.
 *  - Uber:     { event_type: "orders.*", meta: { resource_id }, resource_href }
 *  - DoorDash: { event: { type, status }, order: {...} }
 */
export function detectProvider(body: unknown): Provider | null {
  if (!isObject(body)) return null;
  if (
    typeof body.event_type === 'string' &&
    body.event_type.startsWith('orders.') &&
    isObject(body.meta) &&
    typeof body.meta.resource_id === 'string'
  ) {
    return 'uber_eats';
  }
  if (isObject(body.event) && typeof body.event.type === 'string' && isObject(body.order)) {
    return 'doordash';
  }
  return null;
}
