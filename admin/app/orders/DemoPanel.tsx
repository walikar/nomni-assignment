'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { demoEnabled, sendDemoOrder, type DemoResult, type Provider } from '@/lib/api';
import { PROVIDER_LABEL } from '@/lib/format';

/**
 * Lets a reviewer trigger real webhook deliveries from the hosted demo. The API builds the
 * provider payload, signs it, and POSTs it to its own /webhooks/orders endpoint.
 */
export function DemoPanel({ onSent }: { onSent: () => void }) {
  const [enabled, setEnabled] = useState(false);
  const [twice, setTwice] = useState(true);
  const [busy, setBusy] = useState<Provider | null>(null);
  const [result, setResult] = useState<DemoResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    demoEnabled().then(setEnabled);
  }, []);

  if (!enabled) return null;

  async function send(provider: Provider) {
    setBusy(provider);
    setError(null);
    try {
      const res = await sendDemoOrder(provider, twice ? 2 : 1);
      setResult(res);
      onSent();
    } catch (err) {
      setResult(null);
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="panel demo" aria-labelledby="demo-title">
      <div className="demo-copy">
        <h2 id="demo-title">Try it</h2>
        <p className="muted">
          Sends a real provider webhook to <code>POST /webhooks/orders</code>: Uber is HMAC-signed and triggers a Get Order
          fetch; DoorDash carries the full order with its auth token.
        </p>
      </div>
      <div className="demo-actions">
        <button className="btn" disabled={busy !== null} onClick={() => send('uber_eats')}>
          {busy === 'uber_eats' ? 'Sending…' : 'Send Uber Eats order'}
        </button>
        <button className="btn" disabled={busy !== null} onClick={() => send('doordash')}>
          {busy === 'doordash' ? 'Sending…' : 'Send DoorDash order'}
        </button>
        <label className="check">
          <input type="checkbox" checked={twice} onChange={(e) => setTwice(e.target.checked)} />
          Deliver twice at the same time
        </label>
      </div>
      <div aria-live="polite">
        {result && (
          <p className="demo-result">
            {PROVIDER_LABEL[result.provider]} webhook delivered {result.deliveries.length === 2 ? 'twice' : 'once'} →{' '}
            {result.deliveries.map((d) => d.status).join(', ')} · stored as{' '}
            <strong>
              {result.orders_stored} order{result.orders_stored === 1 ? '' : 's'}
            </strong>
            {result.order_id && (
              <>
                {' '}
                · <Link href={`/orders/${result.order_id}`}>Open {result.external_order_id.slice(0, 13)}…</Link>
              </>
            )}
          </p>
        )}
        {error && (
          <p className="demo-result demo-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
