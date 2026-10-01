'use client';

import Image from 'next/image';
import { ProductImage } from '@/components/product-image';
import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Check, Feather, Headphones, Minus, Package, Play, Plus, RotateCcw, ShieldCheck, Truck, X, Zap, ZoomIn } from 'lucide-react';
import { AddToCartButton } from '@/components/commerce';
import type { CatalogProduct } from '@/lib/shopify/catalog';
import type { Testimonial, VideoReview } from '@/lib/content/types';
import { formatPrice } from '@/data/products';

declare global {
  interface Window {
    fbq: any;
  }
}

function MediaDialog({ title, children, close }: { title: string; children: ReactNode; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const modal = ref.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    modal?.showModal(); document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflow; opener?.focus({ preventScroll: true }); };
  }, []);
  return <dialog ref={ref} className="pdp-media-dialog" aria-label={title} onClose={close} onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
    <div className="pdp-media-dialog-top"><span>{title}</span><button type="button" onClick={close} aria-label="Close media"><X size={20} /></button></div>{children}
  </dialog>;
}

export function ProductGallery({ product }: { product: CatalogProduct }) {
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState(false);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const images = product.images.filter(Boolean);
  const index = images.length ? active % images.length : 0;
  const navigate = (direction: number) => setActive((value) => (value + direction + images.length) % images.length);
  const icons = [Zap, Feather, Package];
  return <div className="pdp-gallery-block">
    <div className={`pdp-gallery-stage ${product.highlights.length ? '' : 'without-highlights'}`}>
      <div className="pdp-gallery-image" onTouchStart={(event) => { touch.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }; }} onTouchEnd={(event) => {
        if (!touch.current || images.length < 2) return;
        const dx = event.changedTouches[0].clientX - touch.current.x; const dy = event.changedTouches[0].clientY - touch.current.y; touch.current = null;
        if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) navigate(dx < 0 ? 1 : -1);
      }} onTouchCancel={() => { touch.current = null; }}>
        {images.length ? <><ProductImage key={images[index]} src={images[index]} alt={`${product.title} — view ${index + 1}`} fill priority={index === 0} sizes="(max-width: 600px) 100vw, (max-width: 900px) 75vw, 40vw" /><button type="button" className="pdp-zoom" aria-label="Enlarge product image" onClick={() => setZoom(true)}><ZoomIn size={18} /></button><span className="pdp-image-count" aria-live="polite">{index + 1} / {images.length}</span></> : <span className="pdp-image-fallback">{product.title}</span>}
      </div>
      {product.highlights.length > 0 && <div className="pdp-highlight-rail">{product.highlights.slice(0, 3).map((highlight, i) => { const Icon = icons[i]; return <div key={highlight.label}><Icon size={25} strokeWidth={1.5} aria-hidden="true" /><strong>{highlight.value}</strong><span>{highlight.label}</span></div>; })}</div>}
    </div>
    {images.length > 1 && <div className="pdp-thumbnails" aria-label="Product images"><button type="button" className="pdp-gallery-arrow" aria-label="Previous product image" onClick={() => navigate(-1)}><ArrowLeft size={17} /></button><div>{images.map((image, i) => <button type="button" key={`${image}-${i}`} className={i === index ? 'is-active' : ''} onClick={() => setActive(i)} aria-label={`Show product image ${i + 1}`} aria-pressed={i === index}><ProductImage src={image} alt="" fill sizes="72px" /></button>)}</div><button type="button" className="pdp-gallery-arrow" aria-label="Next product image" onClick={() => navigate(1)}><ArrowRight size={17} /></button></div>}
    {zoom && <MediaDialog title={`${product.title} · Image ${index + 1}`} close={() => setZoom(false)}><div className="pdp-zoom-image"><ProductImage src={images[index]} alt={product.title} fill sizes="90vw" /></div></MediaDialog>}
  </div>;
}

export function ProductQuote({ items }: { items: Testimonial[] }) {
  const [index, setIndex] = useState(0);
  if (!items.length) return null;
  const item = items[index % items.length];
  return <div className="pdp-quote"><div className="pdp-quote-avatar" aria-hidden="true">{item.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</div><figure aria-live="polite"><blockquote>“{item.quote}”</blockquote><figcaption>{item.name}{item.demo && <span>Demo testimonial</span>}</figcaption></figure>{items.length > 1 && <button type="button" aria-label="Next written review" onClick={() => setIndex((value) => (value + 1) % items.length)}><ArrowRight size={17} /></button>}</div>;
}

export function ProductReviewRail({ items }: { items: VideoReview[] }) {
  const [selected, setSelected] = useState<VideoReview | null>(null);
  if (!items.length) return null;
  return <section className="pdp-review-rail" aria-labelledby="pdp-review-heading"><div className="pdp-small-heading"><h2 id="pdp-review-heading">See it in everyday life.</h2>{items.some((item) => item.demo) && <span>Demo clips</span>}</div><div className="pdp-review-clips">{items.map((item) => <button type="button" key={item.id} onClick={() => setSelected(item)} aria-label={`Watch ${item.demo ? 'demo ' : ''}review: ${item.title}`}><Image unoptimized src={item.poster} alt="" fill sizes="150px" /><span className="pdp-clip-play"><Play size={17} fill="currentColor" /></span><span className="pdp-clip-caption">{item.title}</span></button>)}</div>
    {selected && <MediaDialog title={`${selected.demo ? 'Demo review' : 'Review'} · ${selected.product}`} close={() => setSelected(null)}><video src={selected.video} poster={selected.poster} controls autoPlay muted playsInline aria-label={selected.title} />{selected.demo && <p className="pdp-demo-disclosure">Sample clip for preview, not a customer testimonial.</p>}</MediaDialog>}
  </section>;
}

export function ProductPurchase({ product, rating, children }: { product: CatalogProduct; rating?: ReactNode; children?: ReactNode }) {
  const [quantity, setQuantity] = useState(1);
  const [variantId, setVariantId] = useState(product.shopify?.variantId || '');
  const [showSticky, setShowSticky] = useState(false);
  const purchase = useRef<HTMLDivElement>(null);
  const variants = product.shopify?.variants || [];
  const variant = variants.find((item) => item.id === variantId);
  const chosen: CatalogProduct = variant && product.shopify ? { ...product, price: product.priceOverridden ? product.price : variant.price, currencyCode: variant.currencyCode, shopify: { ...product.shopify, variantId: variant.id, availableForSale: variant.availableForSale, compareAtPrice: variant.compareAtPrice } } : product;
  const total = chosen.price * quantity;
  const compareAt = chosen.shopify?.compareAtPrice;
  const onQuantity = (value: number) => { if (Number.isFinite(value)) setQuantity(Math.max(1, Math.min(10, Math.trunc(value)))); };
  
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setShowSticky(!entry.isIntersecting && entry.boundingClientRect.top < 0), { threshold: 0 });
    if (purchase.current) observer.observe(purchase.current);
    return () => observer.disconnect();
  }, []);

  // 1. META PIXEL: ViewContent Event
  useEffect(() => {
    if (typeof window !== 'undefined' && window.fbq) {
      window.fbq('track', 'ViewContent', {
        content_ids: [product.id],
        content_name: product.title,
        content_type: 'product',
        value: product.price,
        currency: product.currencyCode || 'INR'
      });
    }
  }, [product.id, product.title, product.price, product.currencyCode]);

  // 2. META PIXEL: AddToCart Event Logic
  const handleAddToCart = () => {
    if (typeof window !== 'undefined' && window.fbq) {
      window.fbq('track', 'AddToCart', {
        content_ids: [chosen.id],
        content_name: chosen.title,
        content_type: 'product',
        value: total,
        currency: chosen.currencyCode || 'INR',
        num_items: quantity
      });
    }
  };

  return <><div className="pdp-purchase">
    <p className="pdp-category">{product.label}</p><h1>{product.title}</h1>
    {rating}
    <p className="pdp-purchase-description">{product.longDescription}</p>
    <ul className="pdp-benefit-list">{product.features.slice(0, 3).map((feature) => <li key={feature}><Check size={15} aria-hidden="true" />{feature}</li>)}</ul>
    <fieldset className="pdp-set-picker"><legend>Choose your set</legend><div>{[1, 2, 4].map((count) => <label key={count} className={quantity === count ? 'selected' : ''}><input type="radio" name={`set-${product.id}`} value={count} checked={quantity === count} onChange={() => setQuantity(count)} /><strong>{count === 1 ? 'Single' : count === 2 ? 'Duo' : 'Four-piece set'}</strong><span>{formatPrice(chosen.price * count, chosen.currencyCode)}</span><small>{count} {count === 1 ? 'item' : 'items'}</small></label>)}</div><p>Same per-item price. Choose how many you need.</p></fieldset>
    {variants.length > 1 && <fieldset className="pdp-variant-picker"><legend>Choose your option: <span>{variant?.title}</span></legend><div>{variants.map((item) => <label key={item.id} className={variantId === item.id ? 'selected' : ''}><input type="radio" name={`variant-${product.id}`} checked={variantId === item.id} onChange={() => setVariantId(item.id)} /><span>{item.title}{!item.availableForSale && ' · Sold out'}</span></label>)}</div></fieldset>}
    <div className="pdp-order-row"><div className="pdp-quantity"><span>Quantity</span><div><button type="button" aria-label="Decrease quantity" disabled={quantity <= 1} onClick={() => onQuantity(quantity - 1)}><Minus size={15} /></button><input type="number" inputMode="numeric" min={1} max={10} step={1} value={quantity} onChange={(event) => onQuantity(Number(event.target.value))} aria-label="Quantity" /><button type="button" aria-label="Increase quantity" disabled={quantity >= 10} onClick={() => onQuantity(quantity + 1)}><Plus size={15} /></button></div></div><div className="pdp-order-total" aria-live="polite"><strong>{formatPrice(total, chosen.currencyCode)}</strong>{compareAt && compareAt > chosen.price ? <s>{formatPrice(compareAt * quantity, chosen.currencyCode)}</s> : null}<small>Inclusive of all taxes</small></div></div>
    
    {/* ADDED EVENT HERE: Primary Add to Cart Button */}
    <div ref={purchase} className="pdp-primary-purchase" onClick={handleAddToCart}>
      <AddToCartButton product={chosen} quantity={quantity} label="Add to cart" />
    </div>
    
    <div className="pdp-purchase-assurances"><span><ShieldCheck size={17} />Shopify checkout</span><span><Truck size={17} />Ships across India</span><span><RotateCcw size={17} />7-day returns</span><span><Headphones size={17} />Human support</span></div>
    <p className="pdp-shipping-note">{chosen.currencyCode === 'INR' && total >= 1499 ? 'This set qualifies for free shipping.' : 'Free shipping on orders over ₹1,499.'} Delivery estimate shown at checkout.</p>
    <div className="pdp-support-promise"><Headphones size={24} strokeWidth={1.5} /><div><strong>Help when you need it.</strong><p>A question about your order? <Link href="/contact">Talk to our team.</Link></p></div></div>
    {children}
    <details className="pdp-quick-detail"><summary>Good to know before you buy <Plus size={17} /></summary><p>{product.compare.caveat !== '—' ? product.compare.caveat : product.shortDescription}</p><p>A safety tool can help draw attention or create time. It cannot guarantee an outcome.</p></details>
  </div>
  
  <div className={`pdp-sticky-purchase ${showSticky ? 'is-visible' : ''}`} aria-hidden={!showSticky} inert={!showSticky}>
    <div className="shell">
      <div><strong>{product.title}</strong><span>{quantity} {quantity === 1 ? 'item' : 'items'} · {formatPrice(total, chosen.currencyCode)}</span></div>
      
      {/* ADDED EVENT HERE: Sticky Add to Cart Button */}
      <div onClick={handleAddToCart}>
        <AddToCartButton product={chosen} quantity={quantity} label="Add to cart" />
      </div>
      
    </div>
  </div></>;
}