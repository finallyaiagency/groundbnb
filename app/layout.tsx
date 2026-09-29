import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Groundbnb · Project Control Center',
  description: 'Evidence-driven delivery dashboard for the Groundbnb rebuild.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
