import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/api/admin', '/checkout', '/cart', '/account'],
      },
      {
        // Explicitly invite AI engines to read your Safety Hub and Products
        userAgent: ['GPTBot', 'ChatGPT-User', 'PerplexityBot', 'Google-Extended', 'ClaudeBot', 'anthropic-ai'],
        allow: ['/', '/products', '/safety-hub', '/blog', '/about'],
      },
    ],
    sitemap: 'https://www.whaleora.com/sitemap.xml',
  };
}