'use client';

import Link from 'next/link';
import { ArrowUpRight, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CoverFlowCarousel } from '@/components/ui/3-d-coverflow-carousel';
import { optimisedImageUrl } from '@/components/product-image';
import type { ReviewContent, VideoReview } from '@/lib/content/types';

export function SafetyJourneyGallery({ items, settings }: { items: VideoReview[]; settings: ReviewContent['settings'] }) {
  const reviewVideos = items.filter((item) => item.visible);
  const [selected, setSelected] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const player = useRef<HTMLVideoElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const review = selected === null ? null : reviewVideos[selected];
  const openReview = useCallback((index: number) => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSelected(index);
  }, [setSelected]);
  const closeReview = useCallback(() => { dialog.current?.close(); }, []);

  useEffect(() => {
    if (selected === null) return;
    const modal = dialog.current;
    if (!modal) return;
    modal.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    void player.current?.play().catch(() => { /* Native controls provide an explicit play action. */ });
    return () => { document.body.style.overflow = previousOverflow; opener.current?.focus({ preventScroll: true }); };
  }, [selected]);

  if (!settings.showVideos || !reviewVideos.length) return null;
  return (
    <section className="journey-section review-section" id="video-reviews" data-reveal>
      <div className="shell journey-heading">
        <div>
          <p className="eyebrow">Product video reviews</p>
          <h2>{settings.videoTitle.split('\n').map((line, index) => index === 0 ? line : <span key={index}><br /><em>{line}</em></span>)}</h2>
        </div>
        <div className="journey-aside">
          <span className="journey-count">{String(reviewVideos.length).padStart(2, '0')}</span>
          <p>{settings.videoSubtitle}{reviewVideos.some((item) => item.demo) && <><br /><span className="review-demo-note">Browse through product videos.</span></>}</p>
        </div>
      </div>

      <CoverFlowCarousel
        sectionLabel=""
        autoplay={selected === null}
        items={reviewVideos.map((item) => ({ id: item.id, tag: `${item.demo ? 'Demo review' : 'Product review'} · ${item.duration}`, titleLine1: item.title, titleLine2: item.product, img: item.poster, ctaText: 'Watch review' }))}
        onCtaClick={(item) => { const index = reviewVideos.findIndex((video) => video.id === item.id); if (index >= 0) openReview(index); }}
      />

      <dialog ref={dialog} className="review-dialog" aria-labelledby="review-player-title" onClose={() => { player.current?.pause(); setSelected(null); }} onClick={(event) => { if (event.target === event.currentTarget) closeReview(); }}>
        {review && <div className="review-player-shell">
          <div className="review-player-head"><span>{review.demo ? 'Demo review' : 'Product review'} · {review.duration}</span><button type="button" onClick={closeReview} aria-label="Close video"><X size={22} /></button></div>
          <video key={review.id} ref={player} src={review.video} poster={optimisedImageUrl(review.poster, 760)} controls autoPlay muted playsInline preload="metadata" aria-label={`${review.product} video review`} />
          <div className="review-player-caption"><h2 id="review-player-title">{review.title}</h2>{review.demo && <p>Customer testimonial</p>}<Link href={`/products/${review.slug}`} onClick={closeReview}>Explore {review.product} <span aria-hidden="true"><ArrowUpRight size={16} strokeWidth={2} /></span></Link></div>
        </div>}
      </dialog>
    </section>
  );
}
