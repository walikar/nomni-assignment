import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Kitchen Orders',
  description: 'Uber Eats and DoorDash orders as one kitchen ticket',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <Link href="/orders" className="brand">
            Kitchen Orders
          </Link>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
