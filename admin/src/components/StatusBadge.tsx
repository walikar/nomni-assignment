import { STATUS_LABELS } from '../constants';
import { OrderStatus } from '../types';

const STATUS_COLORS: Record<OrderStatus, string> = {
  new: 'bg-status-new-bg text-status-new',
  accepted: 'bg-status-accepted-bg text-status-accepted',
  preparing: 'bg-status-preparing-bg text-status-preparing',
  ready: 'bg-status-ready-bg text-status-ready',
  completed: 'bg-status-completed-bg text-status-completed',
  cancelled: 'bg-status-cancelled-bg text-status-cancelled',
};

interface StatusBadgeProps {
  status: OrderStatus;
  large?: boolean;
}

export default function StatusBadge({ status, large = false }: StatusBadgeProps) {
  const size = large ? 'text-[0.95rem] px-3 py-1' : 'text-[0.8rem] px-2 py-0.5';
  return (
    <span className={`inline-block font-semibold rounded-full whitespace-nowrap ${size} ${STATUS_COLORS[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
