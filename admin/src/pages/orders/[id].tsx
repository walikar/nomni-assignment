import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { ApiError, fetchOrderById, isRequestCancelled, moveOrderForward } from '../../api';
import CustomerCard from '../../components/CustomerCard';
import ErrorState from '../../components/ErrorState';
import LineItemsCard from '../../components/LineItemsCard';
import LoadingState from '../../components/LoadingState';
import ProviderBadge from '../../components/ProviderBadge';
import StatusBadge from '../../components/StatusBadge';
import StatusCard from '../../components/StatusCard';
import { STATUS_LABELS } from '../../constants';
import { Order, OrderStatus } from '../../types';
import { formatDateTime } from '../../utils/format';
import { getLastListUrl } from '../../utils/list-url';

export default function OrderDetailPage() {
  const router = useRouter();
  const orderId = typeof router.query.id === 'string' ? router.query.id : null;

  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isNotFound, setIsNotFound] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);
  const [backUrl, setBackUrl] = useState('/orders');

  // "← All orders" goes back to the list with the same filters.
  useEffect(() => {
    setBackUrl(getLastListUrl());
  }, []);

  // Load the order. (orderId is null until the router has read the URL.)
  useEffect(() => {
    if (!orderId) return;

    const controller = new AbortController();
    setError(null);
    setIsNotFound(false);

    fetchOrderById(orderId, controller.signal)
      .then((data) => setOrder(data))
      .catch((err) => {
        if (isRequestCancelled(err)) return;
        if (err instanceof ApiError && err.status === 404) {
          setIsNotFound(true);
        } else {
          setError(err.message);
        }
      });

    return () => controller.abort();
  }, [orderId, reloadCount]);

  // "Mark as …" button. We send the status we're showing; if someone else already moved the order,
  // the API answers 409 status_changed and we reload to show the latest.
  const handleMoveForward = async () => {
    if (!order) return;
    setIsSaving(true);
    setNotice(null);
    try {
      const updatedOrder = await moveOrderForward(order.id, order.status);
      setOrder(updatedOrder);
    } catch (err: any) {
      if (err instanceof ApiError && err.body.error === 'status_changed') {
        const currentLabel = STATUS_LABELS[err.body.current as OrderStatus] ?? err.body.current;
        setNotice(`This order was already moved to “${currentLabel}”. Showing the latest.`);
        setReloadCount((count) => count + 1);
      } else {
        setNotice(`Couldn’t update the status: ${err.message}`);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const backLink = (
    <Link href={backUrl} className="inline-block mb-3 text-accent no-underline">
      ← All orders
    </Link>
  );

  if (isNotFound) {
    return (
      <>
        {backLink}
        <ErrorState title="Order not found" />
      </>
    );
  }

  if (error && !order) {
    return (
      <>
        {backLink}
        <ErrorState title="Couldn’t load this order" message={error} onRetry={() => setReloadCount((count) => count + 1)} />
      </>
    );
  }

  if (!order) {
    return (
      <>
        {backLink}
        <LoadingState label="Loading order" rows={4} />
      </>
    );
  }

  return (
    <>
      <Head>
        <title>{`Order ${order.external_order_id} · Kitchen Orders`}</title>
      </Head>

      {backLink}

      {/* Header: provider, order id, times, status */}
      <div className="flex flex-col-reverse md:flex-row md:items-start md:justify-between gap-4 mb-4">
        <div className="min-w-0">
          <ProviderBadge provider={order.provider} />
          <h1 className="mt-1.5 text-2xl font-bold leading-tight font-mono break-all">{order.external_order_id}</h1>
          <p className="mt-1 text-muted">
            Received {formatDateTime(order.created_at)}
            {order.placed_at && <> · placed {formatDateTime(order.placed_at)}</>}
          </p>
        </div>
        <div>
          <StatusBadge status={order.status} large />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_300px] gap-4 items-start">
        <LineItemsCard order={order} />

        <div className="grid gap-4">
          <StatusCard order={order} isSaving={isSaving} notice={notice} onMoveForward={handleMoveForward} />
          <CustomerCard customer={order.customer} />
        </div>
      </div>

      {/* The original provider payload, only in this collapsed debug section. */}
      <details className="mt-6">
        <summary className="cursor-pointer text-muted text-[0.85rem]">Debug: raw provider payload</summary>
        <pre className="mt-2 p-3 bg-surface border border-line rounded-[10px] text-[0.8rem] font-mono overflow-auto max-h-[480px]">
          {JSON.stringify(order.raw_payload, null, 2)}
        </pre>
      </details>
    </>
  );
}
