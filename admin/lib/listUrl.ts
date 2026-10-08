// Remembers the list URL (with its filters) so "back" from a detail page returns to the same view.
const KEY = 'orders:list-url';

export function rememberListUrl(url: string) {
  try {
    sessionStorage.setItem(KEY, url);
  } catch {
    // Storage unavailable (private mode etc.) — the plain /orders link still works.
  }
}

export function lastListUrl(): string {
  try {
    return sessionStorage.getItem(KEY) ?? '/orders';
  } catch {
    return '/orders';
  }
}
