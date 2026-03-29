import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { headers } from 'next/headers';

import '../styles/globals.css';
import AnimatedBackground from '@/components/animated-background';
import PurchaseSocialProofToast from '@/components/purchase-social-proof-toast';
import SiteFooter from '@/components/site-footer';
import SiteHeader from '@/components/site-header';
import Providers from './providers';

const SITE_URL = 'https://techhub.cafe';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'techhub.cafe — Ace Your Tech Interview',
    template: '%s | techhub.cafe',
  },
  description:
    'Curated technical interview questions with full answers across Full-Stack, JavaScript, TypeScript, React, Node.js, DSA, System Design and ML. Prepare smarter, land your next role.',
  keywords: [
    'technical interview questions',
    'coding interview prep',
    'javascript interview questions',
    'react interview questions',
    'system design interview',
    'fullstack interview',
    'DSA interview questions',
    'machine learning interview',
  ],
  openGraph: {
    type: 'website',
    siteName: 'techhub.cafe',
    title: 'techhub.cafe — Ace Your Tech Interview',
    description:
      'Curated technical interview questions with full answers across Full-Stack, JavaScript, TypeScript, React, Node.js, DSA, System Design and ML.',
    url: SITE_URL,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'techhub.cafe — Ace Your Tech Interview',
    description:
      'Curated technical interview questions with full answers across Full-Stack, JavaScript, TypeScript, React, Node.js, DSA, System Design and ML.',
  },
  alternates: {
    canonical: SITE_URL,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large' },
  },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const headerList = await headers();
  const isAdminRoute = headerList.get('x-admin-route') === '1';

  return (
    <html lang="en">
      <body className="min-h-screen bg-[rgb(var(--bg))] text-[rgb(var(--text))] antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              name: 'techhub.cafe',
              url: 'https://techhub.cafe',
              description:
                'Curated technical interview questions with full answers across Full-Stack, JavaScript, TypeScript, React, Node.js, DSA, System Design and ML.',
              potentialAction: {
                '@type': 'SearchAction',
                target: {
                  '@type': 'EntryPoint',
                  urlTemplate: 'https://techhub.cafe/interview-questions?q={search_term_string}',
                },
                'query-input': 'required name=search_term_string',
              },
            }),
          }}
        />
        <Providers>
          {isAdminRoute ? (
            <div className="flex min-h-screen flex-col">{children}</div>
          ) : (
            <>
              <AnimatedBackground />
              <div className="relative z-10 flex min-h-screen flex-col">
                <SiteHeader />
                <div className="flex min-h-0 flex-1 flex-col">{children}</div>
                <SiteFooter />
                <PurchaseSocialProofToast />
              </div>
            </>
          )}
        </Providers>
      </body>
    </html>
  );
}
