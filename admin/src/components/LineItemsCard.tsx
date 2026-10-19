import { Order } from '../types';
import { formatMoney } from '../utils/format';

interface LineItemsCardProps {
  order: Order;
}

const headingClass = 'text-[0.8rem] uppercase tracking-[0.06em] font-bold text-muted mb-3';

export default function LineItemsCard({ order }: LineItemsCardProps) {
  const itemsTotal = order.line_items.reduce((sum, item) => sum + item.total_cents, 0);
  // The official provider samples don't add up, so say so instead of hiding it.
  const itemsDontMatchSubtotal = order.subtotal_cents !== null && itemsTotal !== order.subtotal_cents;

  return (
    <div className="bg-surface border border-line rounded-[10px] p-4">
      <h2 className={headingClass}>Items</h2>

      <table className="w-full border-collapse">
        <thead className="hidden md:table-header-group">
          <tr className="text-[0.8rem] font-semibold text-muted">
            <th scope="col" className="text-left py-2">Item</th>
            <th scope="col" className="text-right py-2 pl-3">Qty</th>
            <th scope="col" className="text-right py-2 pl-3">Unit price</th>
            <th scope="col" className="text-right py-2 pl-3">Line total</th>
          </tr>
        </thead>
        <tbody>
          {order.line_items.length === 0 && (
            <tr>
              <td colSpan={4} className="py-2 text-muted">No line items</td>
            </tr>
          )}
          {order.line_items.map((item, index) => (
            <tr key={index} className="border-t border-line grid grid-cols-3 py-2.5 md:table-row md:py-0">
              <td className="col-span-3 mb-1 md:mb-0 md:py-2 align-top">
                <div className="font-medium">{item.name}</div>
                {item.modifiers.length > 0 && <div className="text-[0.85rem] text-muted">{item.modifiers.join(', ')}</div>}
                {item.notes && <div className="text-[0.85rem] text-muted italic">“{item.notes}”</div>}
              </td>
              <td className="md:text-right md:py-2 md:pl-3 align-top tabular-nums">
                <span className="md:hidden block text-xs text-muted">Qty</span>
                {item.quantity}
              </td>
              <td className="md:text-right md:py-2 md:pl-3 align-top tabular-nums">
                <span className="md:hidden block text-xs text-muted">Unit price</span>
                {formatMoney(item.unit_price_cents, order.currency)}
              </td>
              <td className="text-right md:py-2 md:pl-3 align-top tabular-nums">
                <span className="md:hidden block text-xs text-muted">Line total</span>
                {formatMoney(item.total_cents, order.currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 mt-4 pt-3 border-t border-line tabular-nums">
        <dt className="text-right text-muted">Subtotal</dt>
        <dd className="text-right">{formatMoney(order.subtotal_cents, order.currency)}</dd>
        <dt className="text-right text-muted">Tax</dt>
        <dd className="text-right">{formatMoney(order.tax_cents, order.currency)}</dd>
        <dt className="text-right font-bold text-ink text-[1.05rem]">Total</dt>
        <dd className="text-right font-bold text-[1.05rem]">{formatMoney(order.total_cents, order.currency)}</dd>
      </dl>

      {itemsDontMatchSubtotal && (
        <p className="mt-3 text-[0.8rem] text-muted">
          Line items add up to {formatMoney(itemsTotal, order.currency)}, but the provider’s subtotal is{' '}
          {formatMoney(order.subtotal_cents, order.currency)}. Totals are shown as the provider reported them.
        </p>
      )}
    </div>
  );
}
