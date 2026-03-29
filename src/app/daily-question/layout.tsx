import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Daily Interview Question',
  description: 'A new technical interview question every day. Practice consistently and build your interview confidence across Full-Stack, DSA, System Design and ML.',
  keywords: ['daily interview question', 'interview practice', 'coding challenge of the day'],
  openGraph: {
    title: 'Daily Interview Question | techhub.cafe',
    description: 'A new technical interview question every day. Practice consistently and build your interview confidence.',
    url: 'https://techhub.cafe/daily-question',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Daily Interview Question | techhub.cafe',
    description: 'A new technical interview question every day. Practice consistently and build your interview confidence.',
  },
  alternates: { canonical: 'https://techhub.cafe/daily-question' },
};

export default function DailyQuestionLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
