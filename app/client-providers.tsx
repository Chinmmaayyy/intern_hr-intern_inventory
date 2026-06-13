'use client';

import dynamic from 'next/dynamic';
import { ThemeProvider } from 'next-themes';
import { ToastProvider } from '@/app/components/ui/Toast';

const Toaster = dynamic(
  () => import('react-hot-toast').then((m) => m.Toaster),
  { ssr: false }
);

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" forcedTheme="light" disableTransitionOnChange>
      <ToastProvider>
        {children}
        <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
      </ToastProvider>
    </ThemeProvider>
  );
}
