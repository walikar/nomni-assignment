// formatMoney(1399, 'USD') -> '$13.99'
export function formatMoney(cents: number | null | undefined, currency: string): string {
  if (cents === null || cents === undefined) return '—';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

const dateTimeFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' });

// formatDateTime('2026-10-08T06:27:26Z') -> 'Oct 8, 2026, 11:57 AM' (in the viewer's time zone)
export function formatDateTime(iso: string | null | undefined): string {
  return iso ? dateTimeFormat.format(new Date(iso)) : '—';
}
