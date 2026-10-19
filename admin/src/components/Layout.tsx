import Link from 'next/link';
import { ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="bg-surface border-b border-line px-4 py-3">
        <Link href="/orders" className="font-semibold text-ink no-underline">
          Kitchen Orders
        </Link>
      </header>

      <main className="max-w-[1200px] mx-auto px-4 pt-6 pb-12">{children}</main>
    </div>
  );
}
