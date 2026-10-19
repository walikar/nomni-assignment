import { Provider } from '../types/order';
import { isObject } from './validation';

// Works out who sent a webhook from the shape of its body (never from a query param or a "provider" field).
//
//   Uber:     { event_type: "orders.notification", meta: { resource_id: "..." }, resource_href: "..." }
//   DoorDash: { event: { type: "OrderCreate", status: "NEW" }, order: { ... } }
export function detectProvider(body: unknown): Provider | null {
  if (!isObject(body)) return null;

  const looksLikeUber =
    typeof body.event_type === 'string' &&
    body.event_type.startsWith('orders.') &&
    isObject(body.meta) &&
    typeof body.meta.resource_id === 'string';
  if (looksLikeUber) return 'uber_eats';

  const looksLikeDoorDash = isObject(body.event) && typeof body.event.type === 'string' && isObject(body.order);
  if (looksLikeDoorDash) return 'doordash';

  return null;
}
