import type { ReactNode } from 'react';
import { Navbar } from './Navbar';
import { Footer } from './Footer';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen text-[rgb(var(--fg))]">
      <div className="ambient" />
      <Navbar />
      <main className="mx-auto w-full max-w-6xl px-4 py-8">{children}</main>
      <Footer />
    </div>
  );
}