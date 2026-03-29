import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in to techhub.cafe to access your saved progress, bookmarks, and unlock full interview answers.',
  alternates: { canonical: 'https://techhub.cafe/login' },
  robots: { index: false, follow: false },
};

export default function LoginLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
