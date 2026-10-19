import { ParsedUrlQuery } from 'querystring';
import { DEFAULT_SORT } from '../constants';
import { OrderFilters } from '../types';

// The list page keeps its filters in the URL, e.g. /orders?provider=doordash&sort=-total&q=priya&page=2,
// so refresh, the back button and shared links all show the same view.

function firstValue(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? '';
}

// URL query -> filters
export function readFiltersFromQuery(query: ParsedUrlQuery): OrderFilters {
  return {
    provider: firstValue(query.provider),
    status: firstValue(query.status),
    search: firstValue(query.q),
    sort: firstValue(query.sort) || DEFAULT_SORT,
    page: Math.max(1, Number(firstValue(query.page)) || 1),
  };
}

// filters -> URL query. Default values are left out to keep the URL short.
export function filtersToQuery(filters: OrderFilters): Record<string, string> {
  const query: Record<string, string> = {};
  if (filters.provider) query.provider = filters.provider;
  if (filters.status) query.status = filters.status;
  if (filters.search) query.q = filters.search;
  if (filters.sort !== DEFAULT_SORT) query.sort = filters.sort;
  if (filters.page > 1) query.page = String(filters.page);
  return query;
}

export function hasActiveFilters(filters: OrderFilters): boolean {
  return Boolean(filters.provider || filters.status || filters.search);
}
