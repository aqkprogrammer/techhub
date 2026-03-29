import type { ReactNode } from 'react';

import { AuthProvider } from '@/components/auth-provider';
import { TaxonomyProvider } from '@/components/taxonomy-provider';

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <TaxonomyProvider>{children}</TaxonomyProvider>
    </AuthProvider>
  );
}
