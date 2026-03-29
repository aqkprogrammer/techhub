import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Create Account',
  description: 'Create a free techhub.cafe account to track your interview prep progress, bookmark questions, and unlock full answers.',
  alternates: { canonical: 'https://techhub.cafe/signup' },
  robots: { index: false, follow: false },
};

export default function SignupLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
