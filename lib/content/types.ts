import { imageHostHint, isOptimisableImage } from '../images.ts';
export type Testimonial = { id: string; quote: string; name: string; detail: string; row: 1 | 2; visible: boolean; demo: boolean };
export type VideoReview = { id: string; title: string; product: string; slug: string; poster: string; video: string; duration: string; visible: boolean; demo: boolean };
/**
 * Admin-editable product copy. The first five fields have a Shopify equivalent,
 * so they are *overrides*: blank (or null for price) means "use whatever the
 * store says", and the bundled record in data/products.ts is the last resort.
 * Everything below them exists only here.
 */
export type ProductEditorial = {
  id: string;
  title: string;
  shortDescription: string;
  longDescription: string;
  images: string[];
  price: number | null;
  label: string;
  features: string[];
  specifications: { label: string; value: string }[];
  howItWorks: { title: string; text: string }[];
  /** The photo beside the how-to-use steps; blank falls back to the second product photo. */
  howItWorksImage: string;
  scenarios: string[];
  included: string[];
  highlights: { value: string; label: string }[];
  compare: { job: string; reachFor: string; power: string; carry: string; caveat: string };
};
export type HubChecklistContent = { id: string; title: string; description: string; items: string[] };
/**
 * A journal post. The body is plain text: blank lines split paragraphs, a line
 * starting "## " is a subheading and lines starting "- " form a list. Rendered
 * as React elements, never as HTML, so nothing typed here can inject markup.
 */
export type BlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  author: string;
  /** YYYY-MM-DD, shown on the post and used to order the index. */
  date: string;
  /** Blank shows the post without a photo. */
  coverImage: string;
  body: string;
  visible: boolean;
};
export const BLOG_POST_LIMIT = 24;
export const BLOG_BODY_LIMIT = 8000;
export type ReviewContent = {
  testimonials: Testimonial[];
  videos: VideoReview[];
  products: ProductEditorial[];
  checklists: HubChecklistContent[];
  habits: string[];
  posts: BlogPost[];
  settings: { writtenTitle: string; writtenSubtitle: string; videoTitle: string; videoSubtitle: string; showWritten: boolean; showVideos: boolean; marqueeSeconds: number };
};
export type ContentDocument = { revision: number; draft: ReviewContent; published: ReviewContent; updatedAt: string | null; publishedAt: string | null };

/** Local catalogue IDs. Shopify extras are not editable here. */
const PRODUCT_IDS = ['sos-alarm', 'pepper-spray', 'window-breaker', 'survival-whistle'] as const;

export function validateContent(input: unknown): ReviewContent {
  const record = (value: unknown): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid content format.');
    return value as Record<string, unknown>;
  };
  const text = (value: unknown, label: string, max: number, required = true) => {
    if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new Error(`${label} ${required ? 'is required and' : ''} must be at most ${max} characters.`);
    return value.trim();
  };
  const flag = (value: unknown) => { if (typeof value !== 'boolean') throw new Error('Invalid visibility setting.'); return value; };
  const id = (value: unknown) => { const result = text(value, 'ID', 80); if (!/^[a-zA-Z0-9_-]+$/.test(result)) throw new Error('Invalid ID.'); return result; };
  const media = (value: unknown, label: string) => {
    const result = text(value, label, 2048);
    if (result.startsWith('/') && !result.startsWith('//') && !/[\\\s]/.test(result) && !result.includes('..')) return result;
    try { const url = new URL(result); if (url.protocol === 'https:' && !url.username && !url.password) return result; } catch { /* Report a field error below. */ }
    throw new Error(`${label} must be a local path or an HTTPS media URL.`);
  };
  /**
   * Product photos are the one media field that goes through next/image, so
   * they are also the one field whose host has to be on the optimiser's list.
   * Video and poster URLs stay unrestricted: both render through plain markup,
   * which will fetch from anywhere.
   */
  const imageMedia = (value: unknown, label: string) => {
    const result = media(value, label);
    if (!isOptimisableImage(result)) throw new Error(`${label} must be a local path or an image URL on ${imageHostHint}.`);
    return result;
  };
  const list = (value: unknown) => { if (!Array.isArray(value) || value.length > 40) throw new Error('Each section supports up to 40 reviews.'); return value; };
  const strings = (value: unknown, label: string, maxItems: number, maxLen: number, minItems = 1) => {
    if (!Array.isArray(value) || value.length < minItems || value.length > maxItems) throw new Error(`${label} needs ${minItems}–${maxItems} entries.`);
    return value.map((item, index) => text(item, `${label} ${index + 1}`, maxLen));
  };
  const source = record(input);
  const settings = record(source.settings);
  const testimonials = list(source.testimonials).map((item): Testimonial => {
    const entry = record(item);
    if (entry.row !== 1 && entry.row !== 2) throw new Error('Choose marquee row 1 or 2.');
    return { id: id(entry.id), quote: text(entry.quote, 'Quote', 600), name: text(entry.name, 'Reviewer name', 80), detail: text(entry.detail, 'Product or detail', 100), row: entry.row, visible: flag(entry.visible), demo: flag(entry.demo) };
  });
  const videos = list(source.videos).map((item): VideoReview => {
    const entry = record(item);
    const slug = text(entry.slug, 'Product slug', 100);
    if (!/^[a-z0-9-]+$/.test(slug)) throw new Error('Product slug must contain lowercase letters, numbers or hyphens.');
    const duration = text(entry.duration, 'Duration', 8);
    if (!/^\d{1,3}:[0-5]\d$/.test(duration)) throw new Error('Use m:ss for video duration, for example 0:08.');
    return { id: id(entry.id), title: text(entry.title, 'Video title', 120), product: text(entry.product, 'Product name', 100), slug, poster: media(entry.poster, 'Poster image'), video: media(entry.video, 'Video'), duration, visible: flag(entry.visible), demo: flag(entry.demo) };
  });
  for (const entries of [testimonials, videos]) if (new Set(entries.map((item) => item.id)).size !== entries.length) throw new Error('Review IDs must be unique.');
  const seconds = settings.marqueeSeconds;
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 20 || seconds > 180) throw new Error('Marquee speed must be between 20 and 180 seconds.');

  const productIds = new Set<string>(PRODUCT_IDS);
  const readProduct = (item: unknown): ProductEditorial => {
    const entry = record(item);
    const productId = id(entry.id);
    if (!productIds.has(productId)) throw new Error(`Unknown product ${productId}.`);
    const compare = record(entry.compare);
    if (!Array.isArray(entry.specifications) || entry.specifications.length < 1 || entry.specifications.length > 10) throw new Error('Each product needs 1–10 specifications.');
    if (!Array.isArray(entry.howItWorks) || entry.howItWorks.length < 1 || entry.howItWorks.length > 6) throw new Error('Each product needs 1–6 how-it-works steps.');
    if (!Array.isArray(entry.highlights) || entry.highlights.length < 1 || entry.highlights.length > 3) throw new Error('Each product needs 1–3 highlights.');
    // Overrides may be blank; that is how an editor hands the field back to Shopify.
    if (entry.images !== undefined && (!Array.isArray(entry.images) || entry.images.length > 8)) throw new Error('A product takes up to 8 image URLs.');
    const price = entry.price ?? null;
    if (price !== null && (typeof price !== 'number' || !Number.isFinite(price) || price < 0 || price > 10_000_000)) throw new Error('Product price override must be a positive number, or blank to use Shopify.');
    return {
      id: productId,
      title: text(entry.title, 'Product title', 80, false),
      shortDescription: text(entry.shortDescription, 'Short description', 280, false),
      longDescription: text(entry.longDescription, 'Long description', 1200, false),
      images: Array.isArray(entry.images) ? entry.images.map((item, index) => imageMedia(item, `Product image ${index + 1}`)) : [],
      price,
      label: text(entry.label, 'Product label', 80, false),
      features: strings(entry.features, 'Feature', 8, 80),
      specifications: entry.specifications.map((spec): { label: string; value: string } => {
        const row = record(spec);
        return { label: text(row.label, 'Spec label', 60), value: text(row.value, 'Spec value', 120) };
      }),
      howItWorks: entry.howItWorks.map((step): { title: string; text: string } => {
        const row = record(step);
        return { title: text(row.title, 'Step title', 40), text: text(row.text, 'Step text', 240) };
      }),
      // Blank is the normal setting: it hands the section back to the second product photo.
      howItWorksImage: typeof entry.howItWorksImage === 'string' && entry.howItWorksImage.trim() ? imageMedia(entry.howItWorksImage, 'How-to-use photo') : '',
      scenarios: strings(entry.scenarios, 'Scenario', 8, 40),
      included: strings(entry.included, 'Included item', 8, 80),
      highlights: entry.highlights.map((item): { value: string; label: string } => {
        const row = record(item);
        return { value: text(row.value, 'Highlight figure', 24), label: text(row.label, 'Highlight label', 40) };
      }),
      compare: {
        job: text(compare.job, 'Compare job', 160),
        reachFor: text(compare.reachFor, 'Compare reach-for', 220),
        power: text(compare.power, 'Compare power', 160),
        carry: text(compare.carry, 'Compare carry', 160),
        caveat: text(compare.caveat, 'Compare caveat', 280),
      },
    };
  };
  let products: ProductEditorial[];
  if (!Array.isArray(source.products)) products = [];
  else {
    const edited = new Map(source.products.map((item) => {
      const next = readProduct(item);
      return [next.id, next] as const;
    }));
    products = PRODUCT_IDS.flatMap((productId) => {
      const item = edited.get(productId);
      return item ? [item] : [];
    });
  }

  let checklists: HubChecklistContent[];
  if (!Array.isArray(source.checklists)) checklists = [];
  else {
    if (source.checklists.length < 1 || source.checklists.length > 24) throw new Error('Keep between 1 and 24 checklists.');
    checklists = source.checklists.map((item): HubChecklistContent => {
      const entry = record(item);
      return {
        id: id(entry.id),
        title: text(entry.title, 'Checklist title', 80),
        description: text(entry.description, 'Checklist description', 220),
        items: strings(entry.items, 'Checklist item', 16, 180, 3),
      };
    });
    if (new Set(checklists.map((item) => item.id)).size !== checklists.length) throw new Error('Checklist IDs must be unique.');
  }

  const habits = Array.isArray(source.habits) ? strings(source.habits, 'Habit', 12, 180, 6) : [];

  // Absent on content saved before the blog existed; hydrateContent seeds it.
  let posts: BlogPost[];
  if (!Array.isArray(source.posts)) posts = [];
  else {
    if (source.posts.length < 1 || source.posts.length > BLOG_POST_LIMIT) throw new Error(`Keep between 1 and ${BLOG_POST_LIMIT} blog posts. Hide a post instead of deleting the last one.`);
    posts = source.posts.map((item): BlogPost => {
      const entry = record(item);
      const slug = text(entry.slug, 'Post URL slug', 100);
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error('Post URL slug must be lowercase letters and numbers separated by single hyphens.');
      const date = text(entry.date, 'Post date', 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) throw new Error('Use YYYY-MM-DD for the post date.');
      return {
        id: id(entry.id),
        slug,
        title: text(entry.title, 'Post title', 120),
        excerpt: text(entry.excerpt, 'Post excerpt', 280),
        category: text(entry.category, 'Post category', 40),
        author: text(entry.author, 'Post author', 80),
        date,
        coverImage: typeof entry.coverImage === 'string' && entry.coverImage.trim() ? imageMedia(entry.coverImage, 'Cover photo') : '',
        body: text(entry.body, 'Post body', BLOG_BODY_LIMIT),
        visible: flag(entry.visible),
      };
    });
    if (new Set(posts.map((item) => item.id)).size !== posts.length) throw new Error('Post IDs must be unique.');
    if (new Set(posts.map((item) => item.slug)).size !== posts.length) throw new Error('Each post needs its own URL slug.');
  }

  return {
    testimonials,
    videos,
    products,
    checklists,
    habits,
    posts,
    settings: {
      writtenTitle: text(settings.writtenTitle, 'Written reviews heading', 160),
      writtenSubtitle: text(settings.writtenSubtitle, 'Written reviews description', 300, false),
      videoTitle: text(settings.videoTitle, 'Video reviews heading', 160),
      videoSubtitle: text(settings.videoSubtitle, 'Video reviews description', 300, false),
      showWritten: flag(settings.showWritten),
      showVideos: flag(settings.showVideos),
      marqueeSeconds: seconds,
    },
  };
}
