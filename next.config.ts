import type { NextConfig } from 'next';
import { IMAGE_HOSTS, REVIEW_IMAGE_HOSTS } from './lib/images';

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  allowedDevOrigins: ['127.0.0.1'],
  // Built from the same lists the studio validates product photo URLs against
  // and Convex validates review photo URLs against, so a URL we are willing to
  // store is a URL the optimiser will serve.
  images: {
    // AVIF is roughly a fifth smaller than WebP for photography; browsers
    // without it still get WebP. Optimised images are keyed by deployment, so a
    // long cache costs nothing when a photo changes and saves every repeat fetch.
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 2678400,
    remotePatterns: [...IMAGE_HOSTS, ...REVIEW_IMAGE_HOSTS].map((hostname) => ({ protocol: 'https' as const, hostname, pathname: '/**' })),
  },
  // Older "leave a review" links pointed at /reviews; keep them landing somewhere real.
  async redirects() {
    return [{ source: '/reviews', destination: '/review', permanent: false }];
  },
};

export default nextConfig;
