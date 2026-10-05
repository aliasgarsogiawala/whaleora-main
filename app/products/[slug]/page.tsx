import type { Metadata } from 'next';
import { ProductImage } from '@/components/product-image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AddToCartButton, ProductCard } from '@/components/commerce';
import { ProductGallery, ProductPurchase, ProductQuote, ProductReviewRail } from '@/components/product-detail';
import { ReviewPhotos } from '@/components/review-photos';
import { RatingBadge, RatingSummary, Stars } from '@/components/review-rating';
import { ArrowRight, ArrowUpRight, Headphones, PackageCheck, Truck } from 'lucide-react';
import { publishedContent } from '@/lib/content/store';
import { productReviews } from '@/lib/content/product-reviews';
import { productRating } from '@/lib/convex';
import { formatPrice, PRODUCT_IMAGE_FALLBACK } from '@/data/products';
import { getCatalog, getCatalogProduct } from '@/lib/shopify/catalog';
import './product-page.css';

export const dynamic = 'force-dynamic';

export async function generateStaticParams() {
  const catalog = await getCatalog();
  return catalog.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getCatalogProduct(slug);
  if (!product) return {};

  // --- NEW: High-intent SEO modifiers ---
  const seoOverrides: Record<string, { title: string; description: string }> = {
    'pepperspray': {
      title: 'Maximum Strength Pepper Spray | Whaleora Personal Safety',
      description: 'Reliable, easy-to-use pepper spray for everyday preparedness. Designed for quick access during commutes, campus life, and late shifts in India.'
    },
    'sos-alarm': {
      title: 'Personal SOS Safety Alarm (130dB) | Whaleora',
      description: 'A loud, 130dB personal safety alarm designed for urban commutes and night travel. Pull the pin for an instant, attention-grabbing siren.'
    },
    'windowbreaker': {
      title: 'Car Window Breaker & Seatbelt Cutter | Whaleora',
      description: 'An essential 2-in-1 emergency escape tool for your car. Shatter tempered glass and cut jammed seatbelts instantly during transit emergencies.'
    }
  };

  const override = seoOverrides[slug];
  const title = override ? override.title : `${product.title} — ${formatPrice(product.price, product.currencyCode)} | Whaleora`;
  const description = override ? override.description : product.shortDescription;
  const card = product.images[0] || PRODUCT_IMAGE_FALLBACK;

  return {
    title,
    description,
    openGraph: { title, description, images: [{ url: card }] },
    twitter: { card: 'summary_large_image', title, description, images: [card] },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [catalog, content] = await Promise.all([getCatalog(), publishedContent()]);
  const product = catalog.find((item) => item.slug === slug);
  if (!product) notFound();
  
  const related = catalog.filter((item) => item.id !== product.id).slice(0, 3);
  const { quotes, videos } = productReviews(content, product);
  const handle = product.shopify?.handle ?? product.slug;
  const { written, rating } = await productRating(handle);
  
  // The page shows a taste of the reviews; the full set lives on /products/[slug]/reviews.
  const writtenPreview = written.slice(0, 5);
  const quotePreview = quotes.slice(0, Math.max(0, 3 - writtenPreview.length));

  // --- EXISTING: AI & SEO Data Structure ---
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: product.shortDescription,
    image: product.images,
    brand: {
      '@type': 'Brand',
      name: 'Whaleora',
    },
    offers: {
      '@type': 'Offer',
      url: `https://www.whaleora.com/products/${product.slug}`,
      priceCurrency: product.currencyCode || 'INR',
      price: product.price,
      itemCondition: 'https://schema.org/NewCondition',
      availability: 'https://schema.org/InStock',
      seller: {
        '@type': 'Organization',
        name: 'Whaleora',
      },
    },
  };

  return <main className="page-main pdp-reference">
    {/* --- EXISTING: Invisible Schema Injection --- */}
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
    
    <nav className="pdp-breadcrumb shell" aria-label="Breadcrumb"><Link href="/">Home</Link><span>/</span><Link href="/products">Shop</Link><span>/</span><span aria-current="page">{product.title}</span></nav>
    <section className="pdp-layout shell">
      <div className="pdp-media-column"><ProductGallery key={product.id} product={product} /><ProductQuote items={quotes} /></div>
      <ProductPurchase key={product.id} product={product} rating={content.settings.showWritten ? <RatingBadge summary={rating} href={`/products/${product.slug}#product-reviews`} /> : null}>
        {content.settings.showWritten && <Link className="pdp-reviews-link" href={`/products/${product.slug}/reviews`}>Read product reviews ({quotes.length + written.length}) <span aria-hidden="true"><ArrowUpRight size={16} strokeWidth={2} /></span></Link>}
        <ProductReviewRail items={videos} />
        {related.length > 0 && <section className="pdp-pair-with"><h2>Pair it with</h2>{related.slice(0, 2).map((item) => <div className="pdp-pair-row" key={item.id}><Link href={`/products/${item.slug}`} className="pdp-pair-image"><ProductImage src={item.images[0] || PRODUCT_IMAGE_FALLBACK} alt={item.title} fill sizes="64px" /></Link><div><Link href={`/products/${item.slug}`}>{item.title}</Link><span>{formatPrice(item.price, item.currencyCode)}</span></div><AddToCartButton product={item} label="Add" /></div>)}</section>}
      </ProductPurchase>
    </section>

    <div className="pdp-service-strip"><div className="shell"><span><Truck size={22} strokeWidth={1.5} />Delivery across India</span><span><PackageCheck size={22} strokeWidth={1.5} />Free shipping over ₹1,499</span><span><Headphones size={22} strokeWidth={1.5} />Support from a real person</span></div></div>

    {content.settings.showWritten && <section className="pdp-written-reviews shell pdp-section" id="product-reviews" aria-labelledby="product-reviews-title">
      <div className="pdp-reviews-heading">
        <div><p className="eyebrow dark">Reviews · {product.title}</p><h2 id="product-reviews-title">A few words from everyday life.</h2></div>
        <span>{quotes.length + written.length} written {quotes.length + written.length === 1 ? 'review' : 'reviews'}</span>
      </div>
      {quotes.some((item) => item.demo) && <p className="pdp-reviews-disclosure">Reviews marked “Demo” are sample content, not customer feedback.</p>}
      <RatingSummary summary={rating} writeHref={`/products/${product.slug}/reviews#write`} />
      {(quotes.length + written.length) ? <div className="pdp-written-grid">
        {writtenPreview.map((review) => <figure className="pdp-written-card" key={review.id}>
          <Stars value={review.rating} />
          <blockquote>“{review.body}”</blockquote>
          {review.images.length > 0 && <ReviewPhotos photos={review.images} heading={null} compact />}
          <figcaption><span className="pdp-review-initials" aria-hidden="true">{review.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('')}</span><span><strong>{review.name}</strong><span>{product.title}</span></span>{review.verifiedBuyer && <small className="is-verified">Verified buyer</small>}</figcaption>
        </figure>)}
        {quotePreview.map((review) => <figure className="pdp-written-card" key={review.id}>
          <blockquote>“{review.quote}”</blockquote>
          <figcaption><span className="pdp-review-initials" aria-hidden="true">{review.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('')}</span><span><strong>{review.name}</strong><span>{product.title}</span></span>{review.demo && <small>Demo</small>}</figcaption>
        </figure>)}
      </div> : <p className="pdp-reviews-empty">No written reviews for this product yet. Be the first.</p>}
      {(quotes.length + written.length) > 0 && <div className="pdp-reviews-actions">
        <Link className="icon-link pdp-reviews-all" href={`/products/${product.slug}/reviews`}>Read all {quotes.length + written.length} {quotes.length + written.length === 1 ? 'review' : 'reviews'} <span aria-hidden="true"><ArrowUpRight size={15} strokeWidth={2} /></span></Link>
      </div>}
    </section>}

    {product.howItWorks.length > 0 && <section className="pdp-how shell pdp-section" id="how-to-use"><div className="pdp-section-heading"><p className="eyebrow dark">Simple by design</p><h2>How to use it.</h2><p>Get familiar with it before you need it. Start with the instructions included with your product.</p></div><div className="pdp-how-layout"><div className="pdp-how-image"><ProductImage src={product.howItWorksImage || PRODUCT_IMAGE_FALLBACK} alt={`${product.title} up close`} fill sizes="(max-width: 800px) 90vw, 40vw" /></div><ol>{product.howItWorks.map((step, i) => <li key={step.title}><span>0{i + 1}</span><div><h3>{step.title}</h3><p>{step.text}</p></div></li>)}</ol></div></section>}

    {product.scenarios.length > 0 && <section className="pdp-use-section pdp-section"><div className="shell"><div className="pdp-section-heading"><p className="eyebrow dark">Made for your everyday</p><h2>A little more prepared.<br />Wherever the day takes you.</h2><p>{product.shortDescription}</p></div><div className="pdp-use-grid">{product.scenarios.map((scenario, i) => <article key={scenario}><span>0{i + 1}</span><h3>{scenario}</h3><p>{i % 2 === 0 ? 'Keep it somewhere easy to reach.' : 'Make it part of your everyday kit.'}</p></article>)}</div><p className="pdp-use-caveat">{product.compare.caveat}</p></div></section>}

    {catalog.length > 1 && <section className="pdp-comparison shell pdp-section"><div className="pdp-section-heading"><p className="eyebrow dark">Different tools. Different jobs.</p><h2>Find the right fit for your day.</h2><p>A side-by-side look at what each tool does, and what it needs from you.</p></div><div className="pdp-compare-scroll" tabIndex={0} role="region" aria-label="Product comparison, scroll horizontally on smaller screens"><table><caption className="visually-hidden">Compare Whaleora safety products</caption><thead><tr><th scope="col">At a glance</th>{[product, ...related].map((item) => <th scope="col" key={item.id} className={item.id === product.id ? 'current' : ''}><Link href={`/products/${item.slug}`}>{item.title}</Link>{item.id === product.id && <small>You’re viewing</small>}<span>{formatPrice(item.price, item.currencyCode)}</span></th>)}</tr></thead><tbody>{([{ label: 'The job', key: 'job' }, { label: 'Powered by', key: 'power' }, { label: 'Where to keep it', key: 'carry' }, { label: 'Worth knowing', key: 'caveat' }] as const).map((row) => <tr key={row.key}><th scope="row">{row.label}</th>{[product, ...related].map((item) => <td key={item.id} className={item.id === product.id ? 'current' : ''}>{item.compare[row.key]}</td>)}</tr>)}</tbody></table></div><p className="pdp-compare-hint" aria-hidden="true">Swipe to compare <ArrowRight size={15} strokeWidth={2} aria-hidden="true" /></p></section>}

    <section className="pdp-faq pdp-section"><div className="shell"><div className="pdp-section-heading"><p className="eyebrow dark">Before you decide</p><h2>Your questions, answered.</h2><p>The practical details, in one place.</p></div><div className="pdp-faq-list">
      {product.specifications.length > 0 && <details><summary>What are the specifications?<span>+</span></summary><dl>{product.specifications.map((spec) => <div key={spec.label}><dt>{spec.label}</dt><dd>{spec.value}</dd></div>)}</dl></details>}
      {product.included.length > 0 && <details><summary>What comes in the box?<span>+</span></summary><ul>{product.included.map((item) => <li key={item}>{item}</li>)}</ul></details>}
      <details><summary>How much does shipping cost?<span>+</span></summary><p>Free shipping on orders over ₹1,499 across India. Below that, shipping charges and the delivery estimate for your pincode are shown at checkout.</p></details>
      <details><summary>What if I need help with my order?<span>+</span></summary><p>Email <a href="mailto:hello@whaleora.com">hello@whaleora.com</a> or <Link href="/contact">contact our team</Link>. If your unit arrived faulty, tell us what happened so we can help. Contact us before returning an item.</p></details>
      <details><summary>Can I take it when I travel?<span>+</span></summary><p>Check the rules for your destination, airline, and venue before travelling, especially with pepper spray or tools containing a blade. Follow the product instructions and local requirements.</p></details>
      <details><summary>What should I know before relying on it?<span>+</span></summary><p>{product.compare.caveat !== '—' ? product.compare.caveat : product.shortDescription} A safety tool cannot guarantee an outcome. Keep it accessible and learn how to use it before you need it.</p></details>
    </div></div></section>

    {related.length > 0 && <section className="pdp-recommendations shell pdp-section"><div className="pdp-section-heading"><p className="eyebrow dark">Better prepared, together</p><h2>Build your everyday kit.</h2><p>Choose the tools that suit your routine.</p></div><div className="product-grid">{related.map((item) => <ProductCard key={item.id} product={item} />)}</div></section>}
  </main>;
}