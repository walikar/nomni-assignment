import Link from 'next/link';
import { useEffect, useState } from 'react';
import { fetchDemoEnabled, sendDemoOrder } from '../api';
import { PROVIDER_LABELS } from '../constants';
import { DemoResult, Provider } from '../types';

interface DemoPanelProps {
  // Called after a demo order is sent, so the list can reload.
  onOrderSent: () => void;
}

const buttonClass =
  'min-h-[40px] px-3.5 py-2 bg-surface text-ink border border-line rounded-lg cursor-pointer ' +
  'disabled:opacity-50 disabled:cursor-default flex-[1_1_calc(50%-6px)] md:flex-none';

// "Try it" box for the hosted demo. Only shown when the API has DEMO_MODE on.
// The API builds a real provider webhook, signs it, and sends it to its own /webhooks/orders endpoint.
export default function DemoPanel({ onOrderSent }: DemoPanelProps) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [sendTwice, setSendTwice] = useState(true);
  const [sendingProvider, setSendingProvider] = useState<Provider | null>(null);
  const [result, setResult] = useState<DemoResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDemoEnabled().then(setIsEnabled);
  }, []);

  if (!isEnabled) return null;

  const handleSend = async (provider: Provider) => {
    setSendingProvider(provider);
    setError(null);
    try {
      const response = await sendDemoOrder(provider, sendTwice ? 2 : 1);
      setResult(response);
      onOrderSent();
    } catch (err: any) {
      setResult(null);
      setError(err.message || 'Could not send the demo order');
    } finally {
      setSendingProvider(null);
    }
  };

  return (
    <section aria-labelledby="demo-title" className="bg-surface border border-line rounded-[10px] p-4 mb-4 grid gap-3">
      <div>
        <h2 id="demo-title" className="text-[0.8rem] uppercase tracking-[0.06em] font-bold text-muted mb-1">Try it</h2>
        <p className="text-muted text-[0.9rem]">
          Sends a real provider webhook to <code className="font-mono text-[0.85em]">POST /webhooks/orders</code>: Uber is
          HMAC-signed and triggers a Get Order fetch; DoorDash carries the full order with its auth token.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <button className={buttonClass} disabled={sendingProvider !== null} onClick={() => handleSend('uber_eats')}>
          {sendingProvider === 'uber_eats' ? 'Sending…' : 'Send Uber Eats order'}
        </button>
        <button className={buttonClass} disabled={sendingProvider !== null} onClick={() => handleSend('doordash')}>
          {sendingProvider === 'doordash' ? 'Sending…' : 'Send DoorDash order'}
        </button>
        <label className="inline-flex items-center gap-1.5 text-[0.9rem] text-muted cursor-pointer">
          <input
            type="checkbox"
            checked={sendTwice}
            onChange={(e) => setSendTwice(e.target.checked)}
            className="w-4 h-4 accent-[var(--accent)]"
          />
          Deliver twice at the same time
        </label>
      </div>

      <div aria-live="polite">
        {result && (
          <p className="text-[0.9rem]">
            {PROVIDER_LABELS[result.provider]} webhook delivered {result.deliveries.length === 2 ? 'twice' : 'once'} →{' '}
            {result.deliveries.map((delivery) => delivery.status).join(', ')} · stored as{' '}
            <strong>{result.orders_stored} order{result.orders_stored === 1 ? '' : 's'}</strong>
            {result.order_id && (
              <>
                {' · '}
                <Link href={`/orders/${result.order_id}`} className="text-accent underline">
                  Open {result.external_order_id.slice(0, 13)}…
                </Link>
              </>
            )}
          </p>
        )}
        {error && (
          <p className="text-[0.9rem] text-status-cancelled" role="alert">{error}</p>
        )}
      </div>
    </section>
  );
}
