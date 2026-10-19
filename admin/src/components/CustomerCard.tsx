import { Customer } from '../types';

interface CustomerCardProps {
  customer: Customer;
}

export default function CustomerCard({ customer }: CustomerCardProps) {
  return (
    <div className="bg-surface border border-line rounded-[10px] p-4">
      <h2 className="text-[0.8rem] uppercase tracking-[0.06em] font-bold text-muted mb-3">Customer</h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
        <dt className="text-muted">Name</dt>
        <dd>{customer.name ?? '—'}</dd>

        <dt className="text-muted">Phone</dt>
        <dd>
          {customer.phone ? (
            <a href={`tel:${customer.phone}`} className="text-accent underline">{customer.phone}</a>
          ) : (
            '—'
          )}
        </dd>

        {customer.email && (
          <>
            <dt className="text-muted">Email</dt>
            <dd className="break-words">{customer.email}</dd>
          </>
        )}
      </dl>
    </div>
  );
}
