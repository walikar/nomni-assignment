import type { OrderStatus, Provider } from './api';

export function money(cents: number | null | undefined, currency: string): string {
  if (cents === null || cents === undefined) return '—';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

const dateTime = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' });

export function time(iso: string | null | undefined): string {
  return iso ? dateTime.format(new Date(iso)) : '—';
}

export const PROVIDER_LABEL: Record<Provider, string> = {
  uber_eats: 'Uber Eats',
  doordash: 'DoorDash',
};

export const STATUS_LABEL: Record<OrderStatus, string> = {
  new: 'New',
  accepted: 'Accepted',
  preparing: 'Preparing',
  ready: 'Ready',
  completed: 'Completed',
  cancelled: 'Cancelled',
};
