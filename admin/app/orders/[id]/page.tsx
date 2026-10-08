'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { advanceOrder, ApiError, fetchOrder, nextStatus, STATUS_FLOW, type Order, type OrderStatus } from '@/lib/api';
import { money, PROVIDER_LABEL, STATUS_LABEL, time } from '@/lib/format';
import { lastListUrl } from '@/lib/listUrl';

type State = { kind: 'loading' } | { kind: 'ready'; order: Order } | { kind: 'error'; message: string; notFound: boolean };

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(
    (signal?: AbortSignal) =>
      fetchOrder(id, signal)
        .then((order) => setState({ kind: 'ready', order }))
        .catch((err: Error) => {
          if (err.name === 'AbortError') return;
          setState({ kind: 'error', message: err.message, notFound: err instanceof ApiError && err.status === 404 });
        }),
    [id],
  );

  useEffect(() => {
    const controller = new AbortController();
    setState({ kind: 'loading' });
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  async function advance(from: OrderStatus) {
    setSaving(true);
    setNotice(null);
    try {
      const order = await advanceOrder(id, from);
      setState({ kind: 'ready', order });
    } catch (err) {
      if (err instanceof ApiError && err.body.error === 'status_changed') {
        setNotice(`This order was already moved to “${STATUS_LABEL[err.body.current as OrderStatus]}”. Showing the latest.`);
        await load();
      } else {
        setNotice(`Couldn’t update the status: ${(err as Error).message}`);
      }
    } finally {
      setSaving(false);
    }
  }

  if (state.kind === 'loading') {
    return (
      <section aria-busy="true" aria-label="Loading order">
        <BackLink />
        <div className="panel">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="skeleton-row">
              <span className="skeleton" />
              <span className="skeleton" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (state.kind === 'error') {
    return (
      <section>
        <BackLink />
        <div className="panel state" role="alert">
          <p className="state-title">{state.notFound ? 'Order not found' : 'Couldn’t load this order'}</p>
          {!state.notFound && <p className="muted">{state.message}</p>}
          {!state.notFound && (
            <button className="btn" onClick={() => load()}>
              Retry
            </button>
          )}
        </div>
      </section>
    );
  }

  const { order } = state;
  const next = nextStatus(order.status);
  const itemsSum = order.line_items.reduce((sum, li) => sum + li.total_cents, 0);

  return (
    <section>
      <BackLink />

      <div className="detail-head">
        <div>
          <p className="eyebrow">
            <span className={`provider provider-${order.provider}`}>{PROVIDER_LABEL[order.provider]}</span>
          </p>
          <h1 className="mono">{order.external_order_id}</h1>
          <p className="muted">
            Received {time(order.created_at)}
            {order.placed_at && <> · placed {time(order.placed_at)}</>}
          </p>
        </div>
        <span className={`status status-${order.status} status-lg`}>{STATUS_LABEL[order.status]}</span>
      </div>

      <div className="detail-grid">
        <div className="panel">
          <h2>Items</h2>
          <table className="items">
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col" className="num">
                  Qty
                </th>
                <th scope="col" className="num">
                  Unit price
                </th>
                <th scope="col" className="num">
                  Line total
                </th>
              </tr>
            </thead>
            <tbody>
              {order.line_items.length === 0 && (
                <tr>
                  <td colSpan={4} className="muted">
                    No line items
                  </td>
                </tr>
              )}
              {order.line_items.map((li, i) => (
                <tr key={i}>
                  <td data-label="Item">
                    <div className="item-name">{li.name}</div>
                    {li.modifiers.length > 0 && <div className="item-sub">{li.modifiers.join(', ')}</div>}
                    {li.notes && <div className="item-note">“{li.notes}”</div>}
                  </td>
                  <td data-label="Qty" className="num">
                    {li.quantity}
                  </td>
                  <td data-label="Unit price" className="num">
                    {money(li.unit_price_cents, order.currency)}
                  </td>
                  <td data-label="Line total" className="num">
                    {money(li.total_cents, order.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <dl className="totals">
            <dt>Subtotal</dt>
            <dd>{money(order.subtotal_cents, order.currency)}</dd>
            <dt>Tax</dt>
            <dd>{money(order.tax_cents, order.currency)}</dd>
            <dt className="grand">Total</dt>
            <dd className="grand">{money(order.total_cents, order.currency)}</dd>
          </dl>
          {order.subtotal_cents !== null && itemsSum !== order.subtotal_cents && (
            <p className="hint">
              Line items add up to {money(itemsSum, order.currency)}, but the provider’s subtotal is{' '}
              {money(order.subtotal_cents, order.currency)}. Totals are shown as the provider reported them.
            </p>
          )}
        </div>

        <aside className="side">
          <div className="panel">
            <h2>Status</h2>
            <ol className="flow">
              {STATUS_FLOW.map((s) => {
                const reached = order.status !== 'cancelled' && STATUS_FLOW.indexOf(s) <= STATUS_FLOW.indexOf(order.status as never);
                return (
                  <li key={s} className={reached ? 'done' : ''} aria-current={s === order.status ? 'step' : undefined}>
                    {STATUS_LABEL[s]}
                  </li>
                );
              })}
            </ol>
            {next ? (
              <button className="btn btn-primary btn-block" disabled={saving} onClick={() => advance(order.status)}>
                {saving ? 'Saving…' : `Mark as ${STATUS_LABEL[next]}`}
              </button>
            ) : (
              <p className="muted">{order.status === 'cancelled' ? 'This order was cancelled.' : 'This order is complete.'}</p>
            )}
            {notice && (
              <p className="notice" role="status">
                {notice}
              </p>
            )}
            {order.provider_status && <p className="hint">Provider status: {order.provider_status}</p>}
          </div>

          <div className="panel">
            <h2>Customer</h2>
            <dl className="kv">
              <dt>Name</dt>
              <dd>{order.customer.name ?? '—'}</dd>
              <dt>Phone</dt>
              <dd>{order.customer.phone ? <a href={`tel:${order.customer.phone}`}>{order.customer.phone}</a> : '—'}</dd>
              {order.customer.email && (
                <>
                  <dt>Email</dt>
                  <dd>{order.customer.email}</dd>
                </>
              )}
            </dl>
          </div>
        </aside>
      </div>

      <details className="debug">
        <summary>Debug: raw provider payload</summary>
        <pre>{JSON.stringify(order.raw_payload, null, 2)}</pre>
      </details>
    </section>
  );
}

function BackLink() {
  const [href, setHref] = useState('/orders');
  useEffect(() => setHref(lastListUrl()), []);
  return (
    <p className="back">
      <Link href={href}>← All orders</Link>
    </p>
  );
}
