import Head from 'next/head';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useState } from 'react';
import { fetchOrders, isRequestCancelled } from '../../api';
import DemoPanel from '../../components/DemoPanel';
import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';
import LoadingState from '../../components/LoadingState';
import OrderFilters from '../../components/OrderFilters';
import OrdersTable from '../../components/OrdersTable';
import Pagination from '../../components/Pagination';
import { OrderFilters as Filters, OrdersPage } from '../../types';
import { filtersToQuery, hasActiveFilters, readFiltersFromQuery } from '../../utils/filters';
import { rememberListUrl } from '../../utils/list-url';

const SLOW_LOAD_MS = 4000;

export default function OrdersListPage() {
  const router = useRouter();

  // The filters come from the URL (?provider=…&status=…&q=…&sort=…&page=…). There is no separate filter state.
  const filters = readFiltersFromQuery(router.query);
  const queryParams = filtersToQuery(filters);
  const queryString = new URLSearchParams(queryParams).toString(); // a plain string, so the effect below can depend on it

  const [ordersPage, setOrdersPage] = useState<OrdersPage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSlow, setIsSlow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0); // bump it to fetch again (Retry, demo orders)

  // Fetch orders whenever the URL's filters change.
  useEffect(() => {
    // On first render the Pages Router hasn't read the query string yet. Wait, so we don't fetch the wrong list.
    if (!router.isReady) return;

    // If the filters change while a request is in flight, cancel the old one so it can't overwrite the new result.
    const controller = new AbortController();
    setIsLoading(true);
    setIsSlow(false);
    setError(null);
    const slowTimer = setTimeout(() => setIsSlow(true), SLOW_LOAD_MS);

    fetchOrders(queryParams, controller.signal)
      .then((page) => setOrdersPage(page))
      .catch((err) => {
        if (!isRequestCancelled(err)) setError(err.message);
      })
      .finally(() => {
        clearTimeout(slowTimer);
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => {
      controller.abort();
      clearTimeout(slowTimer);
    };
  }, [router.isReady, queryString, reloadCount]);

  // Remember this URL so the detail page's "← All orders" comes back to the same filters.
  useEffect(() => {
    if (router.isReady) rememberListUrl(router.asPath);
  }, [router.isReady, router.asPath]);

  // Writes new filters to the URL, which triggers the fetch above.
  // Any change other than the page number goes back to page 1.
  const updateFilters = useCallback(
    (changes: Partial<Filters>, replace = false) => {
      const nextFilters = { ...readFiltersFromQuery(router.query), ...changes };
      if (changes.page === undefined) nextFilters.page = 1;

      const url = { pathname: '/orders', query: filtersToQuery(nextFilters) };
      const options = { shallow: true, scroll: false };
      if (replace) {
        router.replace(url, undefined, options);
      } else {
        router.push(url, undefined, options);
      }
    },
    [router],
  );

  const handleClearFilters = () => router.push('/orders');
  const handleOpenOrder = (id: string) => router.push(`/orders/${id}`);
  const handleReload = () => setReloadCount((count) => count + 1);

  const pageCount = ordersPage ? Math.max(1, Math.ceil(ordersPage.total / ordersPage.page_size)) : 1;

  return (
    <>
      <Head>
        <title>Orders · Kitchen Orders</title>
      </Head>

      <div className="flex items-baseline gap-3 mb-4">
        <h1 className="text-2xl font-bold leading-tight">Orders</h1>
        {ordersPage && (
          <span className="text-muted" aria-live="polite">
            {ordersPage.total} {ordersPage.total === 1 ? 'order' : 'orders'}
          </span>
        )}
      </div>

      <DemoPanel onOrderSent={handleReload} />

      <OrderFilters
        filters={filters}
        showClear={hasActiveFilters(filters)}
        onChange={updateFilters}
        onClear={handleClearFilters}
      />

      {error ? (
        <ErrorState title="Couldn’t load orders" message={error} onRetry={handleReload} />
      ) : !ordersPage ? (
        <LoadingState label="Loading orders" isSlow={isSlow} />
      ) : ordersPage.items.length === 0 ? (
        hasActiveFilters(filters) ? (
          <EmptyState
            title="No orders match these filters"
            action={
              <button onClick={handleClearFilters} className="min-h-[40px] px-3.5 py-2 bg-surface text-ink border border-line rounded-lg cursor-pointer">
                Clear filters
              </button>
            }
          />
        ) : (
          <EmptyState
            title="No orders yet"
            description="Orders appear here when Uber Eats or DoorDash webhooks arrive. The README has a curl for each."
          />
        )
      ) : (
        <>
          <OrdersTable
            orders={ordersPage.items}
            sort={filters.sort}
            isRefreshing={isLoading}
            onSort={(sort) => updateFilters({ sort })}
            onOpenOrder={handleOpenOrder}
          />
          <Pagination page={filters.page} pageCount={pageCount} onPageChange={(page) => updateFilters({ page })} />
        </>
      )}
    </>
  );
}
