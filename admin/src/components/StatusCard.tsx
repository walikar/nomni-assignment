import { getNextStatus, STATUS_FLOW, STATUS_LABELS } from '../constants';
import { Order } from '../types';

interface StatusCardProps {
  order: Order;
  isSaving: boolean;
  notice: string | null;
  onMoveForward: () => void;
}

export default function StatusCard({ order, isSaving, notice, onMoveForward }: StatusCardProps) {
  const nextStatus = getNextStatus(order.status);
  const currentPosition = STATUS_FLOW.indexOf(order.status); // -1 when cancelled

  return (
    <div className="bg-surface border border-line rounded-[10px] p-4">
      <h2 className="text-[0.8rem] uppercase tracking-[0.06em] font-bold text-muted mb-3">Status</h2>

      {/* Progress through the kitchen flow */}
      <ol className="grid gap-1.5 mb-4">
        {STATUS_FLOW.map((status, position) => {
          const isReached = currentPosition >= position;
          const isCurrent = status === order.status;
          return (
            <li
              key={status}
              aria-current={isCurrent ? 'step' : undefined}
              className={`flex items-center gap-2 ${isReached ? 'text-ink' : 'text-muted'} ${isCurrent ? 'font-semibold' : ''}`}
            >
              <span className={`w-2.5 h-2.5 rounded-full border-2 ${isReached ? 'bg-accent border-accent' : 'border-line'}`} />
              {STATUS_LABELS[status]}
            </li>
          );
        })}
      </ol>

      {nextStatus ? (
        <button
          onClick={onMoveForward}
          disabled={isSaving}
          className="w-full min-h-[40px] px-3.5 py-2 bg-accent text-accent-text border border-accent rounded-lg font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-default"
        >
          {isSaving ? 'Saving…' : `Mark as ${STATUS_LABELS[nextStatus]}`}
        </button>
      ) : (
        <p className="text-muted">{order.status === 'cancelled' ? 'This order was cancelled.' : 'This order is complete.'}</p>
      )}

      {notice && (
        <p className="mt-3 text-[0.85rem]" role="status">{notice}</p>
      )}
      {order.provider_status && (
        <p className="mt-3 text-[0.8rem] text-muted">Provider status: {order.provider_status}</p>
      )}
    </div>
  );
}
