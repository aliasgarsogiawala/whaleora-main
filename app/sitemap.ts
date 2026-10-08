import type { MetadataRoute } from 'next';
import { getCatalog } from '@/lib/shopify/catalog';
import { publishedContent } from '@/lib/content/store';
import { livePosts } from '@/lib/content/blog';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = 'https://whaleora.com';
  const routes = ['', '/products', '/about', '/safety-hub', '/blog', '/institutions', '/contact', '/warranty'];
  const [catalog, { checklists, posts }] = await Promise.all([getCatalog(), publishedContent()]);
  
  return [
    // 1. Static Routes
    ...routes.map((route) => ({ url: `${base}${route}`, lastModified: new Date(), changeFrequency: route === '' ? 'weekly' as const : 'monthly' as const, priority: route === '' ? 1 : 0.8 })),
    
    // 2. Shopify Products
    ...catalog.map((product) => ({ url: `${base}/products/${product.slug}`, lastModified: new Date(), changeFrequency: 'monthly' as const, priority: 0.9 })),
    
    // 3. Shopify Product Reviews
    ...catalog.map((product) => ({ url: `${base}/products/${product.slug}/reviews`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.6 })),
    
    // 4. Dynamic Safety Hub Protocols (Newly Added)
    ...checklists.map((checklist) => ({ url: `${base}/safety-hub/${checklist.id}`, lastModified: new Date(), changeFrequency: 'monthly' as const, priority: 0.7 })),

    // 5. Journal posts
    ...livePosts(posts).map((post) => ({ url: `${base}/blog/${post.slug}`, lastModified: new Date(`${post.date}T00:00:00Z`), changeFrequency: 'monthly' as const, priority: 0.6 })),
  ];
}