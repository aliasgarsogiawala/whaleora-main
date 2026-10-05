/**
 * The hosts next/image is allowed to optimise from, and therefore the only
 * hosts a product photo may point at.
 *
 * These two things have to be decided in one place. next/image turns an
 * unlisted host into a 400 from the optimiser with nothing on the page to
 * explain it, so a studio that accepts any HTTPS URL — as the field's own hint
 * invites — quietly ships a broken image to the live site. Checking saved URLs
 * against the same list tells the editor at save time instead.
 *
 * Deliberately static, with no environment lookups: the studio validates in the
 * browser as well as on the server, and the two answers must agree.
 */
export const IMAGE_HOSTS = ['cdn.shopify.com', '**.myshopify.com'] as const;

/**
 * Where customer review photos live: UploadThing, on the legacy `utfs.io` host
 * and the per-app `<appId>.ufs.sh` one it now issues.
 *
 * Kept apart from IMAGE_HOSTS so the studio's product-photo field stays a
 * Shopify-only field — a review photo is not catalogue photography. Both lists
 * reach next/image through next.config.ts, and convex/reviews.ts holds a
 * matching pattern it checks review URLs against before storing them.
 */
export const REVIEW_IMAGE_HOSTS = ['utfs.io', '**.ufs.sh'] as const;

const matchesHost = (pattern: string, hostname: string) => (pattern.startsWith('**.')
  ? hostname === pattern.slice(3) || hostname.endsWith(pattern.slice(2))
  : hostname === pattern);

/** True for a local path, or an HTTPS URL on a host the optimiser will accept. */
export function isOptimisableImage(value: string): boolean {
  if (value.startsWith('/')) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && IMAGE_HOSTS.some((pattern) => matchesHost(pattern, url.hostname));
  } catch {
    return false;
  }
}

/**
 * True when next/image can serve this src through its optimiser: a local path,
 * or a host on either list next.config.ts allows. Video posters and review
 * thumbnails are free-form studio URLs, so anything else is shown as-is rather
 * than handed to the optimiser to fail with a 400.
 */
export function canOptimiseImage(value: string): boolean {
  if (value.startsWith('/')) return !value.startsWith('//');
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && [...IMAGE_HOSTS, ...REVIEW_IMAGE_HOSTS].some((pattern) => matchesHost(pattern, url.hostname));
  } catch {
    return false;
  }
}

/** Human-readable host list, for the error an editor actually reads. */
export const imageHostHint = IMAGE_HOSTS.join(' or ');

/** Product media lives on the Shopify CDN; everything else is a local asset. */
export const isShopifyImage = (src: string) => /^https:\/\/cdn\.shopify\.com\//.test(src);

/** A `_1600x` already in the filename, which Shopify put there and we replace. */
const SIZED = /_\d+x\d*(?=\.|$)/;
/** Shopify writes a converted format as a second extension: name.png.webp. */
const FORMAT_SUFFIX = /\.(webp|avif)$/i;

/**
 * Sizes a Shopify image through Shopify's own CDN rather than next/image.
 *
 * It is the only way to get a sensible number of bytes out of this store. The
 * media is 2048px PNGs of 3–6 MB, and Shopify will happily serve them as ~80 KB
 * WebP — but only to a client whose Accept header names the format, and it sets
 * `Vary: Accept` to prove it. Next's optimiser fetches upstream with no Accept
 * header at all, so it always pulls the multi-megabyte PNG and re-encodes it,
 * which is both the slowest possible path and a billed transformation. Handing
 * the browser a Shopify URL instead lets its own Accept header do the work.
 *
 * next/image still builds the srcset; this just answers each width with the URL
 * Shopify serves that width at.
 */
export function shopifyImageLoader({ src, width }: { src: string; width: number }): string {
  let url: URL;
  try { url = new URL(src); } catch { return src; }
  const format = FORMAT_SUFFIX.exec(url.pathname)?.[0] ?? '';
  const path = url.pathname.slice(0, url.pathname.length - format.length).replace(SIZED, '');
  const dot = path.lastIndexOf('.');
  const stem = dot > path.lastIndexOf('/') ? path.slice(0, dot) : path;
  const extension = dot > path.lastIndexOf('/') ? path.slice(dot) : '';
  url.pathname = `${stem}_${width}x${extension}${format}`;
  return url.toString();
}
