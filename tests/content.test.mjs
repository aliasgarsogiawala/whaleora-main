import assert from 'node:assert/strict';
import test from 'node:test';
import { validateContent } from '../lib/content/types.ts';

const fixture = () => ({ testimonials: [{ id: 'one', quote: 'A useful little tool.', name: 'Sample reviewer', detail: 'Alarm', row: 1, visible: true, demo: true }], videos: [{ id: 'two', title: 'A closer look', product: 'Alarm', slug: 'sos-alarm', poster: '/products/example.webp', video: 'https://cdn.example.com/review.mp4', duration: '0:08', visible: true, demo: true }], settings: { writtenTitle: 'Written reviews', writtenSubtitle: '', videoTitle: 'Video reviews', videoSubtitle: '', showWritten: true, showVideos: true, marqueeSeconds: 65 } });
const sampleProduct = () => ({
  id: 'sos-alarm',
  title: 'Personal SOS Alarm',
  label: 'Acoustic defence',
  shortDescription: 'Pull the pin.',
  longDescription: 'A longer description of the alarm for the product page.',
  features: ['Pull-pin activation'],
  specifications: [{ label: 'Siren', value: '130dB' }],
  howItWorks: [{ title: 'Pull', text: 'Pull the pin to start the siren.' }],
  scenarios: ['Night walk'],
  included: ['Alarm'],
  highlights: [{ value: '130dB', label: 'Siren' }],
  compare: { job: 'Make noise', reachFor: 'When you need attention', power: 'Battery', carry: 'Keys', caveat: 'It is loud.' },
});

test('validates and trims content without retaining unknown fields', () => {
  const value = fixture(); value.testimonials[0].name = '  Sample  '; value.extra = 'discard';
  const result = validateContent(value); assert.equal(result.testimonials[0].name, 'Sample'); assert.equal(result.extra, undefined);
});
test('rejects unsafe media protocols, traversal and credential URLs', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,hello', '//evil.example/video', '/a/../b', '/\\evil.example', 'https://user:pass@example.com/video']) {
    const value = fixture(); value.videos[0].video = url; assert.throws(() => validateContent(value), /HTTPS/);
  }
});
test('rejects duplicate IDs, invalid duration, row and flags', () => {
  const duplicate = fixture(); duplicate.testimonials.push(duplicate.testimonials[0]); assert.throws(() => validateContent(duplicate), /unique/);
  const duration = fixture(); duration.videos[0].duration = '0:99'; assert.throws(() => validateContent(duration), /m:ss/);
  const row = fixture(); row.testimonials[0].row = 3; assert.throws(() => validateContent(row), /row/);
  const flag = fixture(); flag.videos[0].visible = 'true'; assert.throws(() => validateContent(flag), /visibility/);
});
test('enforces lengths, limits and required content even for hidden reviews', () => {
  const empty = fixture(); empty.testimonials[0].visible = false; empty.testimonials[0].quote = ''; assert.throws(() => validateContent(empty), /Quote/);
  const tooLong = fixture(); tooLong.testimonials[0].quote = 'x'.repeat(601); assert.throws(() => validateContent(tooLong), /600/);
  const many = fixture(); many.testimonials = Array.from({ length: 41 }, (_, i) => ({ ...many.testimonials[0], id: String(i) })); assert.throws(() => validateContent(many), /40/);
  const speed = fixture(); speed.settings.marqueeSeconds = Infinity; assert.throws(() => validateContent(speed), /speed/);
});
test('supports empty review sections and leaves missing catalogue fields empty', () => {
  const value = fixture(); value.testimonials = []; value.videos = []; value.settings.showWritten = false;
  const result = validateContent(value);
  assert.deepEqual(result.testimonials, []);
  assert.deepEqual(result.videos, []);
  assert.deepEqual(result.products, []);
  assert.deepEqual(result.checklists, []);
  assert.deepEqual(result.habits, []);
  assert.equal(result.settings.showWritten, false);
});
test('rejects unknown product ids', () => {
  const value = fixture();
  value.products = [{ ...sampleProduct(), id: 'not-a-product' }];
  assert.throws(() => validateContent(value), /Unknown product/);
});
test('keeps edited product copy for known ids', () => {
  const value = fixture();
  value.products = [{ ...sampleProduct(), title: 'Edited alarm' }];
  assert.equal(validateContent(value).products[0].title, 'Edited alarm');
});

test('treats blank Shopify-backed fields as "use the store"', () => {
  const value = fixture();
  value.products = [{ ...sampleProduct(), title: '', shortDescription: '', longDescription: '', images: [], price: null }];
  const product = validateContent(value).products[0];
  assert.equal(product.title, '');
  assert.equal(product.longDescription, '');
  assert.deepEqual(product.images, []);
  assert.equal(product.price, null);
  // Studio-only copy is still required alongside the blank overrides.
  assert.deepEqual(product.features, ['Pull-pin activation']);
});
test('defaults absent override fields rather than failing', () => {
  const value = fixture();
  const { ...product } = sampleProduct();
  delete product.images; delete product.price;
  value.products = [product];
  const result = validateContent(value).products[0];
  assert.deepEqual(result.images, []);
  assert.equal(result.price, null);
});
test('keeps a deliberate price and image override', () => {
  const value = fixture();
  value.products = [{ ...sampleProduct(), price: 1499.5, images: ['/products/alarm.webp', 'https://cdn.shopify.com/s/files/1/alarm.jpg'] }];
  const product = validateContent(value).products[0];
  assert.equal(product.price, 1499.5);
  assert.equal(product.images.length, 2);
});
test('rejects a product photo the image optimiser could not serve', () => {
  // next/image answers an unlisted host with a 400 and no explanation, so the
  // studio has to refuse the URL rather than let it reach the live site.
  const value = fixture();
  value.products = [{ ...sampleProduct(), images: ['https://images.unsplash.com/photo-1.jpg'] }];
  assert.throws(() => validateContent(value), /cdn\.shopify\.com/);
});
test('rejects an unusable price override or image URL', () => {
  for (const price of [-1, Number.NaN, '1499']) {
    const value = fixture(); value.products = [{ ...sampleProduct(), price }];
    assert.throws(() => validateContent(value), /price override/i, `accepted ${String(price)}`);
  }
  const value = fixture();
  value.products = [{ ...sampleProduct(), images: ['javascript:alert(1)'] }];
  assert.throws(() => validateContent(value), /must be a local path or an HTTPS media URL/);
});

const samplePost = () => ({ id: 'post-one', slug: 'first-post', title: 'First post', excerpt: 'A short summary.', category: 'Travel', author: 'Whaleora Team', date: '2026-10-01', coverImage: '', body: 'Hello.', visible: true });
test('validates blog posts and leaves them empty when absent', () => {
  assert.deepEqual(validateContent(fixture()).posts, []);
  const value = fixture(); value.posts = [{ ...samplePost(), title: '  Trimmed  ' }];
  assert.equal(validateContent(value).posts[0].title, 'Trimmed');
});
test('rejects bad post slugs, dates, duplicates, cover hosts and an empty list', () => {
  for (const slug of ['Upper', 'two--hyphens', '-lead', 'spa ce', '../x']) {
    const value = fixture(); value.posts = [{ ...samplePost(), slug }]; assert.throws(() => validateContent(value), /slug/);
  }
  for (const date of ['2026-13-01', '01-10-2026', 'soon']) {
    const value = fixture(); value.posts = [{ ...samplePost(), date }]; assert.throws(() => validateContent(value), /YYYY-MM-DD/);
  }
  const duplicate = fixture(); duplicate.posts = [samplePost(), { ...samplePost(), id: 'post-two' }]; assert.throws(() => validateContent(duplicate), /slug/);
  const cover = fixture(); cover.posts = [{ ...samplePost(), coverImage: 'https://example.com/a.jpg' }]; assert.throws(() => validateContent(cover), /Cover photo/);
  const empty = fixture(); empty.posts = []; assert.throws(() => validateContent(empty), /blog posts/);
});
test('parses a post body into paragraphs, headings and lists', async () => {
  const { parseBody } = await import('../lib/content/blog.ts');
  assert.deepEqual(parseBody('One\ntwo\n\n## Head\n- a\n- b\nAfter <b>x</b>'), [
    { kind: 'paragraph', text: 'One two' },
    { kind: 'heading', text: 'Head' },
    { kind: 'list', items: ['a', 'b'] },
    { kind: 'paragraph', text: 'After <b>x</b>' },
  ]);
});
