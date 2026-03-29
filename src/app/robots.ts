import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/interview-questions',
          '/interview-questions/',
          '/pricing',
          '/ai-interview',
          '/daily-question',
          '/login',
          '/signup',
        ],
        disallow: [
          '/admin/',
          '/api/',
          '/account/',
          '/dashboard/',
          '/bookmarks/',
        ],
      },
    ],
    sitemap: 'https://techhub.cafe/sitemap.xml',
    host: 'https://techhub.cafe',
  };
}
