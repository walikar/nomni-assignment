import { OrderStatus } from '../types/order';

// The kitchen flow. Orders only ever move left to right.
// 'cancelled' sits outside the flow and is final, like 'completed'.
export const STATUS_FLOW: OrderStatus[] = ['new', 'accepted', 'preparing', 'ready', 'completed'];

export const ALL_STATUSES: OrderStatus[] = [...STATUS_FLOW, 'cancelled'];

// getNextStatus('new') -> 'accepted'; getNextStatus('completed') -> null
export function getNextStatus(current: OrderStatus): OrderStatus | null {
  const position = STATUS_FLOW.indexOf(current);
  const isLastOrNotInFlow = position === -1 || position === STATUS_FLOW.length - 1;
  return isLastOrNotInFlow ? null : STATUS_FLOW[position + 1];
}
