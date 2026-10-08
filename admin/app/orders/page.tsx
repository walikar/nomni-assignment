import { Suspense } from 'react';
import { OrdersList } from './OrdersList';

export default function OrdersPage() {
  return (
    <Suspense>
      <OrdersList />
    </Suspense>
  );
}
