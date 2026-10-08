'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState, type KeyboardEvent } from 'react';
import { fetchOrders, PROVIDERS, STATUSES, type OrderPage } from '@/lib/api';
import { rememberListUrl } from '@/lib/listUrl';
import { DemoPanel } from './DemoPanel';
import { money, PROVIDER_LABEL, STATUS_LABEL, time } from '@/lib/format';

const SORT_OPTIONS = [
  { value: '-created_at', label: 'Newest first' },
  { value: 'created_at', label: 'Oldest first' },
  { value: '-total', label: 'Total: high to low' },
  { value: 'total', label: 'Total: low to high' },
  { value: 'customer', label: 'Customer A–Z' },
  { value: '-customer', label: 'Customer Z–A' },
  { value: 'status', label: 'Status (flow order)' },
  { value: 'provider', label: 'Provider' },
];
const DEFAULT_SORT = '-created_at';

type State =
  | { kind: 'loading'; data?: OrderPage }
  | { kind: 'ready'; data: OrderPage }
  | { kind: 'error'; message: string };

export function OrdersList() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const query = params.toString();

  const provider = params.get('provider') ?? '';
  const status = params.get('status') ?? '';
  const sort = params.get('sort') ?? DEFAULT_SORT;
  const q = params.get('q') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const hasFilters = Boolean(provider || status || q);

  const [state, setState] = useState<State>({ kind: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);
  // Free hosting sleeps when idle; if a load drags on, say why.
  const [slow, setSlow] = useState(false);

  // Everything the list shows is derived from the URL, so refresh/back/share all work.
  const update = useCallback(
    (changes: Record<string, string | null>, mode: 'push' | 'replace' = 'push') => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(changes)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      if (!('page' in changes)) next.delete('page');
      if (next.get('sort') === DEFAULT_SORT) next.delete('sort');
      const qs = next.toString();
      router[mode](qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  useEffect(() => {
    const controller = new AbortController();
    setState((prev) => ({ kind: 'loading', data: prev.kind === 'error' ? undefined : prev.data }));
    setSlow(false);
    const slowTimer = setTimeout(() => setSlow(true), 4000);
    fetchOrders(query, controller.signal)
      .then((data) => setState({ kind: 'ready', data }))
      .catch((err: Error) => {
        if (err.name !== 'AbortError') setState({ kind: 'error', message: err.message });
      })
      .finally(() => clearTimeout(slowTimer));
    return () => {
      controller.abort();
      clearTimeout(slowTimer);
    };
  }, [query, reloadKey]);

  // Search box: local state for typing, written to the URL after a pause.
  const [search, setSearch] = useState(q);
  useEffect(() => setSearch(q), [q]);
  useEffect(() => {
    if (search === q) return;
    const t = setTimeout(() => update({ q: search.trim() || null }, 'replace'), 300);
    return () => clearTimeout(t);
  }, [search, q, update]);

  useEffect(() => rememberListUrl(query ? `${pathname}?${query}` : pathname), [pathname, query]);

  const open = (id: string) => router.push(`/orders/${id}`);

  function onRowKeyDown(e: KeyboardEvent<HTMLTableRowElement>, id: string) {
    if (e.key === 'Enter') {
      e.preventDefault();
      open(id);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const sibling = e.key === 'ArrowDown' ? e.currentTarget.nextElementSibling : e.currentTarget.previousElementSibling;
      (sibling as HTMLElement | null)?.focus();
    }
  }

  function sortBy(key: string) {
    const current = sort.replace(/^-/, '');
    const desc = sort.startsWith('-');
    // First click on a new column: newest/highest first for time and total, A–Z otherwise.
    const next = current === key ? (desc ? key : `-${key}`) : key === 'created_at' || key === 'total' ? `-${key}` : key;
    update({ sort: next });
  }

  function ariaSort(key: string): 'ascending' | 'descending' | undefined {
    if (sort.replace(/^-/, '') !== key) return undefined;
    return sort.startsWith('-') ? 'descending' : 'ascending';
  }

  const data = state.kind === 'error' ? undefined : state.data;
  const pageCount = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;

  return (
    <section>
      <div className="page-head">
        <h1>Orders</h1>
        {data && (
          <span className="muted" aria-live="polite">
            {data.total} {data.total === 1 ? 'order' : 'orders'}
          </span>
        )}
      </div>

      <DemoPanel onSent={() => setReloadKey((k) => k + 1)} />

      <form className="toolbar" role="search" onSubmit={(e) => e.preventDefault()}>
        <label className="field field-search">
          <span className="sr-only">Search</span>
          <input
            type="search"
            placeholder="Search order ID, customer, phone"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label className="field">
          <span className="field-label">Provider</span>
          <select value={provider} onChange={(e) => update({ provider: e.target.value || null })}>
            <option value="">All</option>
            {PROVIDERS.map((p) => (
              <option key={p} value={p}>
                {PROVIDER_LABEL[p]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Status</span>
          <select value={status} onChange={(e) => update({ status: e.target.value || null })}>
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Sort</span>
          <select value={sort} onChange={(e) => update({ sort: e.target.value })}>
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        {hasFilters && (
          <button type="button" className="btn btn-ghost" onClick={() => router.push(pathname)}>
            Clear
          </button>
        )}
      </form>

      {state.kind === 'error' ? (
        <div className="panel state" role="alert">
          <p className="state-title">Couldn’t load orders</p>
          <p className="muted">{state.message}</p>
          <button className="btn" onClick={() => setReloadKey((k) => k + 1)}>
            Retry
          </button>
        </div>
      ) : !data ? (
        <div className="panel" aria-busy="true" aria-label="Loading orders">
          {slow && (
            <p className="muted wake-note">
              Waking up the API — it runs on a free host that sleeps when idle, so the first load can take up to a minute.
            </p>
          )}
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="skeleton-row">
              <span className="skeleton" />
              <span className="skeleton" />
              <span className="skeleton" />
            </div>
          ))}
        </div>
      ) : data.items.length === 0 ? (
        <div className="panel state">
          {hasFilters ? (
            <>
              <p className="state-title">No orders match these filters</p>
              <button className="btn" onClick={() => router.push(pathname)}>
                Clear filters
              </button>
            </>
          ) : (
            <>
              <p className="state-title">No orders yet</p>
              <p className="muted">Orders appear here when Uber Eats or DoorDash webhooks arrive. The README has a curl for each.</p>
            </>
          )}
        </div>
      ) : (
        <>
          <div className={`panel table-wrap${state.kind === 'loading' ? ' is-stale' : ''}`} aria-busy={state.kind === 'loading'}>
            <table className="orders">
              <thead>
                <tr>
                  <SortHeader label="Provider" k="provider" sort={ariaSort('provider')} onSort={sortBy} />
                  <th scope="col">Order ID</th>
                  <SortHeader label="Customer" k="customer" sort={ariaSort('customer')} onSort={sortBy} />
                  <SortHeader label="Status" k="status" sort={ariaSort('status')} onSort={sortBy} />
                  <SortHeader label="Total" k="total" sort={ariaSort('total')} onSort={sortBy} className="num" />
                  <SortHeader label="Time" k="created_at" sort={ariaSort('created_at')} onSort={sortBy} />
                </tr>
              </thead>
              <tbody>
                {data.items.map((o) => (
                  <tr
                    key={o.id}
                    tabIndex={0}
                    className="row-link"
                    aria-label={`Order ${o.external_order_id}, ${o.customer.name ?? 'unknown customer'}. Press Enter to open.`}
                    onClick={() => open(o.id)}
                    onKeyDown={(e) => onRowKeyDown(e, o.id)}
                  >
                    <td data-label="Provider">
                      <span className={`provider provider-${o.provider}`}>{PROVIDER_LABEL[o.provider]}</span>
                    </td>
                    <td data-label="Order ID" className="mono">
                      <Link href={`/orders/${o.id}`} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
                        {o.external_order_id}
                      </Link>
                    </td>
                    <td data-label="Customer">{o.customer.name ?? <span className="muted">—</span>}</td>
                    <td data-label="Status">
                      <span className={`status status-${o.status}`}>{STATUS_LABEL[o.status]}</span>
                    </td>
                    <td data-label="Total" className="num">
                      {money(o.total_cents, o.currency)}
                    </td>
                    <td data-label="Time">
                      <time dateTime={o.created_at}>{time(o.created_at)}</time>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pageCount > 1 && (
            <nav className="pager" aria-label="Pagination">
              <button className="btn" disabled={page <= 1} onClick={() => update({ page: String(page - 1) })}>
                Previous
              </button>
              <span className="muted">
                Page {page} of {pageCount}
              </span>
              <button className="btn" disabled={page >= pageCount} onClick={() => update({ page: String(page + 1) })}>
                Next
              </button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}

function SortHeader(props: {
  label: string;
  k: string;
  sort: 'ascending' | 'descending' | undefined;
  onSort: (k: string) => void;
  className?: string;
}) {
  return (
    <th scope="col" aria-sort={props.sort} className={props.className}>
      <button type="button" className="th-sort" onClick={() => props.onSort(props.k)}>
        {props.label}
        <span aria-hidden="true" className="sort-mark">
          {props.sort === 'ascending' ? '▲' : props.sort === 'descending' ? '▼' : ''}
        </span>
      </button>
    </th>
  );
}
