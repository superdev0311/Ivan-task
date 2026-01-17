import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Analytics Dashboard',
  description: 'Event metrics and user activity analytics',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
