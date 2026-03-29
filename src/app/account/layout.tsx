import type { ReactNode } from 'react';

import AccountShell from './shell';

export default function AccountLayout({ children }: { children: ReactNode }) {
  return <AccountShell>{children}</AccountShell>;
}
