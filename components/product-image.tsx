'use client';

import Image, { getImageProps, type ImageProps } from 'next/image';
import { canOptimiseImage, isShopifyImage, shopifyImageLoader } from '@/lib/images';

/**
 * next/image for catalogue photography, wherever the photo comes from.
 *
 * A Shopify photo is sized by Shopify's CDN, which answers the browser's own
 * Accept header with WebP and turns a 4 MB PNG into about 80 KB — see
 * `shopifyImageLoader`. Local art keeps the Next optimiser, which is the better
 * path for assets we ship ourselves. Either way the caller just renders a
 * product image and gets the right one, including for products added later.
 */
export function ProductImage({ src, alt, ...rest }: ImageProps) {
  const shopify = typeof src === 'string' && isShopifyImage(src);
  // A host next.config.ts does not allow would 400 in the optimiser; show it untouched instead.
  const foreign = typeof src === 'string' && !shopify && !canOptimiseImage(src);
  return <Image {...rest} src={src} alt={alt} {...(shopify ? { loader: shopifyImageLoader } : {})} {...(foreign ? { unoptimized: true } : {})} />;
}

/**
 * One optimised URL for places that take a bare image URL rather than an
 * <img> — chiefly a <video poster>, which the browser fetches at full size
 * otherwise. `width` is the CSS width it is shown at; the URL is sized for 2x.
 */
export function optimisedImageUrl(src: string, width: number): string {
  if (!src) return src;
  if (isShopifyImage(src)) return getImageProps({ src, alt: '', width, height: width, loader: shopifyImageLoader }).props.src;
  if (!canOptimiseImage(src)) return src;
  return getImageProps({ src, alt: '', width, height: width }).props.src;
}
