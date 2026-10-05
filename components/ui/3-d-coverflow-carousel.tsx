'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import { ProductImage } from '@/components/product-image';
import './3-d-coverflow-carousel.css';

const ChevronLeftIcon = () => <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>;
const ChevronRightIcon = () => <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>;
const ArrowRightIcon = () => <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>;

export interface CarouselItem {
  id?: string;
  tag?: string;
  titleLine1: string;
  titleLine2?: string;
  desc?: string;
  img: string;
  ctaText?: string;
  ctaUrl?: string;
}

export interface CoverFlowCarouselProps {
  items?: CarouselItem[];
  sectionLabel?: string;
  autoplay?: boolean;
  autoplayDelay?: number;
  className?: string;
  onCtaClick?: (item: CarouselItem) => void;
}

// The storefront supplies its admin-managed review data instead of restaurant demos.
const emptyItems: CarouselItem[] = [];

export function CoverFlowCarousel({ items = emptyItems, sectionLabel = 'Product reviews', autoplay = true, autoplayDelay = 5000, className, onCtaClick }: CoverFlowCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [inView, setInView] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const root = useRef<HTMLElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const total = items.length;
  const activeIndex = total ? currentIndex % total : 0;
  const nextSlide = useCallback(() => setCurrentIndex((previous) => total ? (previous + 1) % total : 0), [total]);
  const prevSlide = useCallback(() => setCurrentIndex((previous) => total ? (previous - 1 + total) % total : 0), [total]);
  const rotating = autoplay && !paused && !hovered && !reducedMotion && inView && pageVisible && total > 1;

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncMotion = () => setReducedMotion(media.matches);
    const syncVisibility = () => setPageVisible(!document.hidden);
    syncMotion(); syncVisibility();
    media.addEventListener('change', syncMotion);
    document.addEventListener('visibilitychange', syncVisibility);
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.2 });
    if (root.current) observer.observe(root.current);
    return () => { media.removeEventListener('change', syncMotion); document.removeEventListener('visibilitychange', syncVisibility); observer.disconnect(); };
  }, [total]);

  useEffect(() => {
    if (!rotating) return;
    const interval = window.setInterval(nextSlide, Math.max(3000, autoplayDelay));
    return () => window.clearInterval(interval);
  }, [rotating, autoplayDelay, nextSlide]);

  if (!total) return null;
  function move(direction: -1 | 1) { setPaused(true); if (direction === 1) nextSlide(); else prevSlide(); }

  return <section ref={root} tabIndex={0} className={cn('coverflow-carousel relative w-full overflow-hidden', className)} aria-label={sectionLabel || 'Product reviews'} aria-roledescription="carousel"
    onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    onFocusCapture={(event) => { if (!(event.target instanceof Element && event.target.closest('.coverflow-pause'))) setPaused(true); }}
    onKeyDown={(event) => {
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) && event.target instanceof Element && event.target.closest('.coverflow-card')) root.current?.focus({ preventScroll: true });
      if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1); }
      if (event.key === 'ArrowRight') { event.preventDefault(); move(1); }
      if (event.key === 'Home') { event.preventDefault(); setPaused(true); setCurrentIndex(0); }
      if (event.key === 'End') { event.preventDefault(); setPaused(true); setCurrentIndex(total - 1); }
    }}>
    {sectionLabel && <p className="coverflow-label">{sectionLabel}</p>}
    <div className="coverflow-stage relative flex items-center justify-center"
      onTouchStart={(event) => { touchStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }; }}
      onTouchCancel={() => { touchStart.current = null; }}
      onTouchEnd={(event) => {
        if (!touchStart.current) return;
        const dx = event.changedTouches[0].clientX - touchStart.current.x;
        const dy = event.changedTouches[0].clientY - touchStart.current.y;
        touchStart.current = null;
        if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) move(dx < 0 ? 1 : -1);
      }}>
      {items.map((item, index) => {
        // Signed circular offsets also handle one, two, three and four reviews.
        const forward = (index - activeIndex + total) % total;
        const offset = forward > total / 2 ? forward - total : forward;
        const distance = Math.abs(offset);
        const center = offset === 0;
        const side = Math.sign(offset);
        const style = {
          '--slide-x': distance === 0 ? '0px' : `calc(var(--coverflow-${distance === 1 ? 'near' : 'far'}) * ${side})`,
          '--slide-scale': center ? 1 : distance === 1 ? .84 : .68,
          '--slide-rotation': `${-side * (distance === 1 ? 24 : 38)}deg`,
          opacity: distance > 2 ? 0 : center ? 1 : distance === 1 ? .72 : .4,
          zIndex: 30 - Math.min(distance, 3) * 10,
          pointerEvents: distance > 2 ? 'none' : 'auto',
        } as CSSProperties;
        const cta = <>{item.ctaText || 'View details'}<ArrowRightIcon /></>;
        return <article key={item.id || `${item.img}-${index}`} className={`coverflow-card ${center ? 'is-center' : ''}`} style={style} role="group" aria-roledescription="slide" aria-label={`${index + 1} of ${total}: ${item.titleLine1}`} aria-hidden={!center}>
          {/* Optimised and sized for the card; an admin URL on an unlisted host falls back to the original. */}
          <ProductImage src={item.img} alt={item.titleLine1} fill sizes="(max-width: 700px) 232px, 280px" loading={distance <= 1 ? 'eager' : 'lazy'} draggable={false} />
          <div className="coverflow-shade" />
          <div className="coverflow-content">
            {item.tag && <span className="coverflow-tag">{item.tag}</span>}
            <div className="coverflow-copy"><h3>{item.titleLine1}</h3>{item.titleLine2 && <span className="coverflow-subtitle">{item.titleLine2}</span>}{item.desc && <p>{item.desc}</p>}
              {onCtaClick ? <button type="button" className="coverflow-cta" tabIndex={center ? 0 : -1} onClick={() => { setPaused(true); onCtaClick(item); }}>{cta}</button> : item.ctaUrl ? <Link href={item.ctaUrl} className="coverflow-cta" tabIndex={center ? 0 : -1}>{cta}</Link> : null}
            </div>
          </div>
          {!center && distance <= 2 && <button type="button" className="coverflow-select" tabIndex={-1} aria-label={`Select ${item.titleLine1}`} onClick={() => { setPaused(true); setCurrentIndex(index); }} />}
        </article>;
      })}
    </div>
    <div className="coverflow-controls">
      <button type="button" className="coverflow-arrow" onClick={() => move(-1)} aria-label="Previous review" disabled={total < 2}><ChevronLeftIcon /></button>
      <div className="coverflow-dots" aria-label="Choose a review">{items.map((item, index) => <button type="button" key={item.id || index} onClick={() => { setPaused(true); setCurrentIndex(index); }} aria-label={`Go to review ${index + 1}`} aria-current={index === activeIndex ? 'true' : undefined}><span /></button>)}</div>
      <button type="button" className="coverflow-arrow" onClick={() => move(1)} aria-label="Next review" disabled={total < 2}><ChevronRightIcon /></button>
      {autoplay && !reducedMotion && total > 1 && <button type="button" className="coverflow-pause" onClick={() => setPaused((value) => !value)} aria-label={paused ? 'Resume review slideshow' : 'Pause review slideshow'}>{paused ? 'Play' : 'Pause'}</button>}
    </div>
    <p className="visually-hidden" aria-live={rotating ? 'off' : 'polite'} aria-atomic="true">Review {activeIndex + 1} of {total}: {items[activeIndex].titleLine1}</p>
  </section>;
}

export const Component = CoverFlowCarousel;
export default CoverFlowCarousel;
