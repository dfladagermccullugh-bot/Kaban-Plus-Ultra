import { PageTransition } from '@/components/page-transition';
import type { ReactNode } from 'react';

export default function AppLayout({ children }: { children: ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
