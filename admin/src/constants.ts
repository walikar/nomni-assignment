import { OrderStatus, Provider } from './types';

export const PROVIDERS: Provider[] = ['uber_eats', 'doordash'];

export const PROVIDER_LABELS: Record<Provider, string> = {
  uber_eats: 'Uber Eats',
  doordash: 'DoorDash',
};

// The kitchen flow. The status button moves an order one step to the right.
export const STATUS_FLOW: OrderStatus[] = ['new', 'accepted', 'preparing', 'ready', 'completed'];

export const ALL_STATUSES: OrderStatus[] = [...STATUS_FLOW, 'cancelled'];

export const STATUS_LABELS: Record<OrderStatus, string> = {
  new: 'New',
  accepted: 'Accepted',
  preparing: 'Preparing',
  ready: 'Ready',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

// getNextStatus('new') -> 'accepted'; getNextStatus('completed') -> null
export function getNextStatus(status: OrderStatus): OrderStatus | null {
  const position = STATUS_FLOW.indexOf(status);
  if (position === -1 || position === STATUS_FLOW.length - 1) return null;
  return STATUS_FLOW[position + 1];
}

// A leading "-" means descending.
export const DEFAULT_SORT = '-created_at';

export const SORT_OPTIONS = [
  { value: '-created_at', label: 'Newest first' },
  { value: 'created_at', label: 'Oldest first' },
  { value: '-total', label: 'Total: high to low' },
  { value: 'total', label: 'Total: low to high' },
  { value: 'customer', label: 'Customer A–Z' },
  { value: '-customer', label: 'Customer Z–A' },
  { value: 'status', label: 'Status (flow order)' },
  { value: 'provider', label: 'Provider' },
];
