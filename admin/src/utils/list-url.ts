// Remembers the list URL (with its filters) so "← All orders" on the detail page returns to the same view.
const STORAGE_KEY = 'orders:list-url';

export function rememberListUrl(url: string) {
  try {
    sessionStorage.setItem(STORAGE_KEY, url);
  } catch {
    // Storage blocked (e.g. private mode). The back link falls back to /orders.
  }
}

export function getLastListUrl(): string {
  try {
    return sessionStorage.getItem(STORAGE_KEY) || '/orders';
  } catch {
    return '/orders';
  }
}
