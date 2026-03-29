import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'AI Mock Interview',
  description: 'Practice technical interviews with an AI interviewer. Get real-time feedback on your answers for Full-Stack, DSA, System Design and ML topics.',
  keywords: ['AI mock interview', 'technical interview practice', 'coding interview simulator', 'interview feedback'],
  openGraph: {
    title: 'AI Mock Interview | techhub.cafe',
    description: 'Practice technical interviews with an AI interviewer. Get real-time feedback on your answers.',
    url: 'https://techhub.cafe/ai-interview',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Mock Interview | techhub.cafe',
    description: 'Practice technical interviews with an AI interviewer. Get real-time feedback on your answers.',
  },
  alternates: { canonical: 'https://techhub.cafe/ai-interview' },
};

export default function AiInterviewLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
