import Link from 'next/link';
import { KeyboardEvent } from 'react';
import { Order } from '../types';
import { formatDateTime, formatMoney } from '../utils/format';
import ProviderBadge from './ProviderBadge';
import StatusBadge from './StatusBadge';

interface OrdersTableProps {
  orders: Order[];
  sort: string; // current sort, e.g. '-created_at'
  isRefreshing: boolean;
  onSort: (sort: string) => void;
  onOpenOrder: (id: string) => void;
}

// Columns you can click to sort. Time and total start with highest first; the rest A–Z.
const SORTABLE_COLUMNS = [
  { key: 'provider', label: 'Provider', startDescending: false },
  { key: 'customer', label: 'Customer', startDescending: false },
  { key: 'status', label: 'Status', startDescending: false },
  { key: 'total', label: 'Total', startDescending: true },
  { key: 'created_at', label: 'Time', startDescending: true },
];

const cellClass = 'px-4 py-2.5 align-top';
const headerCellClass = 'px-4 py-2.5 text-left text-[0.8rem] font-semibold text-muted';
const rowClass =
  'border-t border-line cursor-pointer ' +
  'hover:bg-[color-mix(in_srgb,var(--accent)_5%,transparent)] ' +
  'focus-visible:[outline-offset:-2px] focus-visible:bg-[color-mix(in_srgb,var(--focus)_8%,transparent)]';

export default function OrdersTable({ orders, sort, isRefreshing, onSort, onOpenOrder }: OrdersTableProps) {
  const sortKey = sort.replace(/^-/, '');
  const isDescending = sort.startsWith('-');

  // Clicking the current column flips the direction; clicking a new column starts with its default direction.
  function handleSortClick(key: string, startDescending: boolean) {
    if (key === sortKey) {
      onSort(isDescending ? key : `-${key}`);
    } else {
      onSort(startDescending ? `-${key}` : key);
    }
  }

  // Enter opens the row; arrow keys move between rows.
  function handleRowKeyDown(e: KeyboardEvent<HTMLTableRowElement>, orderId: string) {
    if (e.key === 'Enter') {
      e.preventDefault();
      onOpenOrder(orderId);
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const nextRow = e.key === 'ArrowDown' ? e.currentTarget.nextElementSibling : e.currentTarget.previousElementSibling;
      (nextRow as HTMLElement | null)?.focus();
    }
  }

  function sortableHeader(key: string, alignRight = false) {
    const column = SORTABLE_COLUMNS.find((c) => c.key === key)!;
    const isActive = key === sortKey;
    return (
      <th
        scope="col"
        aria-sort={isActive ? (isDescending ? 'descending' : 'ascending') : undefined}
        className={`${headerCellClass} ${alignRight ? 'text-right' : ''}`}
      >
        <button
          type="button"
          onClick={() => handleSortClick(column.key, column.startDescending)}
          className="inline-flex items-center gap-1 cursor-pointer"
        >
          {column.label}
          <span aria-hidden="true" className="text-[0.65rem] min-w-[0.7em]">
            {isActive ? (isDescending ? '▼' : '▲') : ''}
          </span>
        </button>
      </th>
    );
  }

  return (
    <div className={`bg-surface border border-line rounded-[10px] overflow-hidden transition-opacity ${isRefreshing ? 'opacity-60' : ''}`}>
      {/* Desktop: a table */}
      <table className="hidden md:table w-full border-collapse">
        <thead>
          <tr>
            {sortableHeader('provider')}
            <th scope="col" className={headerCellClass}>Order ID</th>
            {sortableHeader('customer')}
            {sortableHeader('status')}
            {sortableHeader('total', true)}
            {sortableHeader('created_at')}
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr
              key={order.id}
              tabIndex={0}
              onClick={() => onOpenOrder(order.id)}
              onKeyDown={(e) => handleRowKeyDown(e, order.id)}
              aria-label={`Order ${order.external_order_id}, ${order.customer.name ?? 'unknown customer'}. Press Enter to open.`}
              className={rowClass}
            >
              <td className={cellClass}><ProviderBadge provider={order.provider} /></td>
              <td className={`${cellClass} font-mono`}>{order.external_order_id}</td>
              <td className={cellClass}>{order.customer.name ?? <span className="text-muted">—</span>}</td>
              <td className={cellClass}><StatusBadge status={order.status} /></td>
              <td className={`${cellClass} text-right tabular-nums`}>{formatMoney(order.total_cents, order.currency)}</td>
              <td className={cellClass}>{formatDateTime(order.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Phone: a list of cards. Each card is a link, so Enter opens it. */}
      <ul className="md:hidden">
        {orders.map((order, index) => (
          <li key={order.id} className={index > 0 ? 'border-t border-line' : ''}>
            <Link
              href={`/orders/${order.id}`}
              className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 px-4 py-3 text-ink no-underline hover:bg-[color-mix(in_srgb,var(--accent)_5%,transparent)]"
            >
              <span><ProviderBadge provider={order.provider} /></span>
              <span className="text-right"><StatusBadge status={order.status} /></span>
              <span className="font-mono font-semibold break-all">{order.external_order_id}</span>
              <span className="font-semibold tabular-nums">{formatMoney(order.total_cents, order.currency)}</span>
              <span>{order.customer.name ?? '—'}</span>
              <span className="text-right text-muted text-[0.85rem]">{formatDateTime(order.created_at)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
