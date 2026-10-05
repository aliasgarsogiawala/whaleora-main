import { handleFor, products, type Product } from '@/data/products';
import { publishedContent } from '@/lib/content/store';
import type { ProductEditorial } from '@/lib/content/types';
import { isShopifyConfigured, safely, shopifyFetch, SHOPIFY_PRODUCTS_TAG } from './client';
import { PRODUCTS_QUERY } from './queries';
import type { ShopifyMedia, ShopifyProduct, ShopifyVariant } from './types';

export type CatalogVariant = {
  id: string;
  title: string;
  availableForSale: boolean;
  price: number;
  currencyCode: string;
  compareAtPrice: number | null;
  selectedOptions: { name: string; value: string }[];
};

const variantsFor = (remote: ShopifyProduct): CatalogVariant[] => remote.variants.nodes.map((variant: ShopifyVariant) => ({
  id: variant.id, title: variant.title, availableForSale: remote.availableForSale && variant.availableForSale,
  price: Number(variant.price.amount), currencyCode: variant.price.currencyCode,
  compareAtPrice: variant.compareAtPrice ? Number(variant.compareAtPrice.amount) : null,
  selectedOptions: variant.selectedOptions,
}));

/**
 * How long a Storefront catalogue read is reused before Shopify is asked again.
 * The products webhook busts this the moment anything changes, so this is only
 * the fallback for when that webhook is not set up or fails to arrive. Kept
 * short so a price edit shows up within a minute either way.
 */
const CATALOG_REVALIDATE_SECONDS = 60;

/** One slide of the product gallery. */
export type GalleryMedia =
  | { kind: 'image'; src: string; alt: string | null }
  | { kind: 'video'; sources: { url: string; mimeType: string }[]; poster: string | null; alt: string | null }
  | { kind: 'embed'; embedUrl: string; poster: string | null; alt: string | null };

/**
 * Shopify serves each uploaded video as several MP4 renditions plus an HLS
 * playlist. Browsers take the first <source> they can play, so the sharpest
 * MP4 that is still a sensible download goes first, HLS (Safari-only without a
 * player library) last.
 */
const orderSources = (sources: NonNullable<ShopifyMedia['sources']>) => {
  const mp4 = sources.filter((source) => source.mimeType === 'video/mp4').sort((a, b) => b.height - a.height);
  const fitting = mp4.filter((source) => source.height <= 1080);
  const rest = sources.filter((source) => source.mimeType !== 'video/mp4');
  return [...fitting, ...mp4.filter((source) => source.height > 1080), ...rest].map(({ url, mimeType }) => ({ url, mimeType }));
};

function toGalleryMedia(media: ShopifyMedia): GalleryMedia | null {
  const poster = media.previewImage?.url ?? null;
  if (media.mediaContentType === 'IMAGE') {
    const src = media.image?.url ?? poster;
    return src ? { kind: 'image', src, alt: media.alt } : null;
  }
  if (media.mediaContentType === 'VIDEO' && media.sources?.length) return { kind: 'video', sources: orderSources(media.sources), poster, alt: media.alt };
  if (media.mediaContentType === 'EXTERNAL_VIDEO' && media.embedUrl) return { kind: 'embed', embedUrl: media.embedUrl, poster, alt: media.alt };
  return null; // 3D models have no gallery treatment yet.
}

const storeMedia = (remote: ShopifyProduct | undefined) => (remote?.media?.nodes ?? []).map(toGalleryMedia).filter((item): item is GalleryMedia => item !== null);

/**
 * The gallery. When the photos come from Shopify, the store's own media list is
 * used as-is, so videos land wherever the merchant dragged them. When the photos
 * come from the studio or the bundled record instead, Shopify's videos still
 * follow them — an override replaces photography, not the product video.
 */
function galleryFor(images: string[], remote: ShopifyProduct | undefined, photosFromStore: boolean): GalleryMedia[] {
  const fromStore = storeMedia(remote);
  if (photosFromStore && fromStore.length) return fromStore;
  const videos = fromStore.filter((item) => item.kind !== 'image');
  return [...images.map((src): GalleryMedia => ({ kind: 'image', src, alt: null })), ...videos];
}

export type CatalogProduct = Product & {
  currencyCode: string;
  /** Photos and videos for the product page gallery, in display order. */
  media: GalleryMedia[];
  /**
   * True when `price` came from an admin override rather than Shopify. The
   * purchase box reads this so a per-variant Shopify price does not quietly
   * replace the overridden number in one corner of the page.
   */
  priceOverridden: boolean;
  /** Null when this product has no counterpart in the connected store. */
  shopify: {
    productId: string;
    handle: string;
    variantId: string;
    availableForSale: boolean;
    compareAtPrice: number | null;
    variants: CatalogVariant[];
  } | null;
};

const normalise = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '');

async function fetchShopifyProducts(): Promise<ShopifyProduct[]> {
  if (!isShopifyConfigured()) return [];
  const data = await safely(
    () => shopifyFetch<{ products: { nodes: ShopifyProduct[] } }>({
      query: PRODUCTS_QUERY,
      variables: { first: 100 },
      revalidate: CATALOG_REVALIDATE_SECONDS,
      tags: [SHOPIFY_PRODUCTS_TAG],
    }),
    'catalogue fetch failed — serving the local catalogue',
  );
  return data?.products.nodes ?? [];
}

const toNumber = (amount: string) => Number.parseFloat(amount);

/** The first paragraph of a Shopify description, used where a summary is wanted. */
const summarise = (description: string) => description.split(/\n+/)[0]?.trim() ?? '';

/** What the connected store knows about one product, flattened. */
type RemoteFields = { title: string; description: string; images: string[]; price: number | null; currencyCode: string | null };

function remoteFields(remote: ShopifyProduct | undefined): RemoteFields {
  if (!remote) return { title: '', description: '', images: [], price: null, currencyCode: null };
  const variant = remote.variants.nodes[0];
  return {
    title: remote.title ?? '',
    description: remote.description?.trim() ?? '',
    images: remote.images.nodes.map((image) => image.url).filter(Boolean),
    price: variant ? toNumber(variant.price.amount) : toNumber(remote.priceRange.minVariantPrice.amount),
    currencyCode: variant?.price.currencyCode ?? remote.priceRange.minVariantPrice.currencyCode ?? null,
  };
}

const shopifyLink = (remote: ShopifyProduct) => {
  const variant = remote.variants.nodes[0];
  if (!variant) return null;
  return {
    productId: remote.id,
    handle: remote.handle,
    variantId: variant.id,
    availableForSale: remote.availableForSale && variant.availableForSale,
    compareAtPrice: variant.compareAtPrice ? toNumber(variant.compareAtPrice.amount) : null,
    variants: variantsFor(remote),
  };
};

/**
 * One product, resolved. Precedence, highest first:
 *   1. an admin override, whenever that field has been filled in
 *   2. Shopify, for everything the connected store knows
 *   3. the bundled record in data/products.ts
 *
 * Stock, variants and compare-at price are deliberately absent from that list:
 * they drive checkout, so they stay whatever Shopify says. A price override
 * only changes the number on the page — Shopify still charges its own.
 *
 * `howItWorksImage` sits outside it too, in the other direction: step 2 is
 * skipped for it, so the store can never supply the how-to-use photo.
 */
function resolve(local: Product, remote: ShopifyProduct | undefined, editorial: ProductEditorial | undefined): CatalogProduct {
  const store = remoteFields(remote);
  const photosFromStore = !editorial?.images.length && store.images.length > 0;
  const images = editorial?.images.length ? editorial.images : (photosFromStore ? store.images : local.images);
  const pick = (override: string | undefined, fromStore: string, bundled: string) => override?.trim() || fromStore.trim() || bundled;

  return {
    ...local,
    // Copy that exists only in the studio; blank hands it back to the bundled record.
    label: editorial?.label?.trim() || local.label,
    features: editorial?.features.length ? editorial.features : local.features,
    specifications: editorial?.specifications.length ? editorial.specifications : local.specifications,
    howItWorks: editorial?.howItWorks.length ? editorial.howItWorks : local.howItWorks,
    // Falls back through the *bundled* photos, not the merged ones: the how-to
    // shot is instructional art that ships with the site, and letting it reach
    // `images` would put a Shopify merchandising photo beside the steps the
    // moment the store had a second photo.
    howItWorksImage: editorial?.howItWorksImage?.trim() || local.howItWorksImage || local.images[1] || local.images[0] || '',
    scenarios: editorial?.scenarios.length ? editorial.scenarios : local.scenarios,
    included: editorial?.included.length ? editorial.included : local.included,
    highlights: editorial?.highlights.length ? editorial.highlights : local.highlights,
    compare: editorial?.compare ?? local.compare,

    // Fields Shopify also knows about.
    title: pick(editorial?.title, store.title, local.title),
    shortDescription: pick(editorial?.shortDescription, summarise(store.description), local.shortDescription),
    longDescription: pick(editorial?.longDescription, store.description, local.longDescription),
    images,
    media: galleryFor(images, remote, photosFromStore),
    price: editorial?.price ?? store.price ?? local.price,
    priceOverridden: editorial?.price != null,
    currencyCode: store.currencyCode ?? local.currencyCode ?? 'INR',

    shopify: remote ? shopifyLink(remote) : null,
  };
}

/** A store product with no local record still gets a page, built from what Shopify knows. */
function adopt(remote: ShopifyProduct): CatalogProduct {
  const variant = remote.variants.nodes[0];
  const price = variant ? toNumber(variant.price.amount) : toNumber(remote.priceRange.minVariantPrice.amount);
  const currencyCode = variant?.price.currencyCode ?? remote.priceRange.minVariantPrice.currencyCode;
  const description = remote.description.trim();
  const summary = description.split(/\n+/)[0] || `${remote.title} from Whaleora.`;
  const images = remote.images.nodes.map((image) => image.url);

  return {
    id: remote.handle,
    slug: remote.handle,
    shopifyHandle: remote.handle,
    title: remote.title,
    category: remote.tags.includes('Alarms') ? 'Alarms' : 'Tools',
    label: remote.tags[0] ?? 'Whaleora',
    shortDescription: summary,
    longDescription: description || summary,
    price,
    priceOverridden: false,
    currencyCode,
    images,
    media: galleryFor(images, remote, true),
    features: [],
    specifications: [],
    howItWorks: [],
    scenarios: [],
    included: [],
    accent: '#102844',
    highlights: [],
    compare: { job: summary, reachFor: '—', power: '—', carry: '—', caveat: '—' },
    shopify: shopifyLink(remote),
  };
}

/**
 * The merged catalogue: every local product in its authored order, followed by
 * anything else the connected store sells.
 */
export async function getCatalog(): Promise<CatalogProduct[]> {
  const editorialById = new Map((await publishedContent()).products.map((item) => [item.id, item]));
  const remote = await fetchShopifyProducts();
  if (!remote.length) return products.map((local) => resolve(local, undefined, editorialById.get(local.id)));

  const byHandle = new Map(remote.map((item) => [item.handle, item]));
  const byTitle = new Map(remote.map((item) => [normalise(item.title), item]));
  const claimed = new Set<string>();

  const merged = products.map((local) => {
    // Matched on the bundled identity, so renaming a product in the studio
    // never detaches it from its Shopify record.
    const match = byHandle.get(handleFor(local)) ?? byTitle.get(normalise(local.title));
    if (match) claimed.add(match.handle);
    return resolve(local, match, editorialById.get(local.id));
  });

  const extras = remote.filter((item) => !claimed.has(item.handle)).map(adopt);
  return [...merged, ...extras];
}

/** What Shopify currently holds for each editable product, for the studio to
 *  show beside the override fields. Null price means the store has no answer. */
export type ShopifySnapshot = { id: string; matched: boolean; title: string; description: string; images: string[]; price: number | null; currencyCode: string | null };

export async function shopifySnapshots(): Promise<{ connected: boolean; items: ShopifySnapshot[] }> {
  const connected = isShopifyConfigured();
  const remote = connected ? await fetchShopifyProducts() : [];
  const byHandle = new Map(remote.map((item) => [item.handle, item]));
  const byTitle = new Map(remote.map((item) => [normalise(item.title), item]));
  return {
    connected,
    items: products.map((local) => {
      const match = byHandle.get(handleFor(local)) ?? byTitle.get(normalise(local.title));
      const store = remoteFields(match);
      return { id: local.id, matched: Boolean(match), title: store.title, description: store.description, images: store.images, price: store.price, currencyCode: store.currencyCode };
    }),
  };
}

/**
 * Price facts for copy that names real money — the hero range, "from ₹299",
 * the SOS Alarm's buy button. These were hardcoded in JSX, so a Shopify price
 * edit changed the product page and left the marketing copy contradicting it.
 */
export async function catalogPrices() {
  const catalog = await getCatalog();
  const prices = catalog.map((product) => product.price).filter((price) => Number.isFinite(price) && price > 0);
  const currencyCode = catalog[0]?.currencyCode ?? 'INR';
  const bySlug = new Map(catalog.map((product) => [product.slug, product] as const));
  return {
    currencyCode,
    min: prices.length ? Math.min(...prices) : 0,
    max: prices.length ? Math.max(...prices) : 0,
    priceFor: (slug: string) => bySlug.get(slug)?.price ?? 0,
    titleFor: (slug: string) => bySlug.get(slug)?.title ?? '',
  };
}

export async function getCatalogProduct(slug: string): Promise<CatalogProduct | undefined> {
  const catalog = await getCatalog();
  return catalog.find((product) => product.slug === slug);
}

/**
 * Handle → local product id, so Shopify cart lines can be shown with local copy.
 * Deliberately not built on `getCatalog`: every cart action funnels through
 * here, and a studio override can change what a product *says* but never which
 * handle it lives at — so the cart should not wait on a content read to learn
 * a mapping that only the bundled records and Shopify decide.
 */
export async function handleToProductId(): Promise<Map<string, string>> {
  const remote = await fetchShopifyProducts();
  const byHandle = new Map(remote.map((item) => [item.handle, item]));
  const byTitle = new Map(remote.map((item) => [normalise(item.title), item]));
  const pairs = products.flatMap((local) => {
    const match = byHandle.get(handleFor(local)) ?? byTitle.get(normalise(local.title));
    return match?.variants.nodes.length ? [[match.handle, local.id] as const] : [];
  });
  return new Map(pairs);
}
