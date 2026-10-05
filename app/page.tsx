import Image, { getImageProps } from 'next/image';

import Link from 'next/link';

import { ProductCard } from '@/components/commerce';

import { SafetyJourneyGallery } from '@/components/safety-journey-gallery';

import { TestimonialsMarquee } from '@/components/testimonials-marquee';

import { Chooser, Objections, TrustBar } from '@/components/home-sections';

import { catalogPrices, getCatalog } from '@/lib/shopify/catalog';

import { publishedContent } from '@/lib/content/store';

import { formatPrice } from '@/data/products';

import { ArrowRight, ArrowUpRight } from 'lucide-react';

// The poster paints first on every homepage visit; send it through the optimiser (1920w, WebP/AVIF) instead of as the raw JPEG.
const heroPoster = getImageProps({ src: '/lifestyle/hero-commute-poster.jpg', alt: '', width: 960, height: 540 }).props.src;

export const revalidate = 3600

export default async function Home() {

  const [catalog, content, prices] = await Promise.all([
    getCatalog(),
    publishedContent(),
    catalogPrices()
  ]);

  const alarm = {
    title: prices.titleFor('sos-alarm'),
    price: formatPrice(prices.priceFor('sos-alarm'), prices.currencyCode)
  };

  return (

    <main className="page-main">

      <section className="hero" data-hero-overlay>

        <div className="hero-media">

          {/* Pexels 35574649, Anupriya Datta — Mumbai commute at CST. Pexels License. */}

          <video
            className="hero-video"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster={heroPoster}
            aria-hidden="true"
          >

            <source src="/lifestyle/hero-commute.mp4" type="video/mp4" />

          </video>

          <Image
            className="hero-still"
            src="/lifestyle/whaleora-hero-campaign.webp"
            alt="A woman carrying a small personal-safety keyring outside a Mumbai transit station at blue hour"
            fill
            sizes="100vw"
          />

        </div>

        <div className="hero-scrim" aria-hidden="true" />

        <div className="hero-inner shell">

          <div className="hero-copy">

          <h1>
  Personal safety essentials you’ll actually carry.<br />
  <em>Beautifully designed. Built for the unexpected.</em>
</h1>

            <p className="hero-intro">
              Everyday personal safety essentials designed to be simple, discreet and ready when you need them — from a 130dB SOS alarm to a car window breaker.
              <br /><br />
              No app. No complexity. Just safety within reach.
            </p>

            <div className="hero-actions">

              <Link
                href="/products"
                className="button button-primary"
              >
                Shop the collection
                <span aria-hidden="true">
                  <ArrowRight size={16} strokeWidth={2} />
                </span>
              </Link>

              <Link
                href="/products/sos-alarm"
                className="text-link"
              >
                Start with the SOS Alarm
                <span aria-hidden="true">
                  <ArrowUpRight size={16} strokeWidth={2} />
                </span>
              </Link>

            </div>

          </div>

        </div>

      </section>

      <TrustBar from={formatPrice(prices.min, prices.currencyCode)} />

      <section className="collection-section section-pad" data-reveal>

        <div className="shell section-heading">

          <div>

            <p className="eyebrow dark">The collection</p>

            <h2>Four objects. Nothing you don’t need.</h2>

          </div>

          <p>
          Four thoughtfully designed essentials for the moments that matter. Simple to carry, easy to use, and made for everyday life.
          </p>

        </div>

        <div className="product-grid shell">
          {catalog.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
            />
          ))}
        </div>

        <div className="center-action">

          <Link
            href="/products"
            className="button button-outline"
          >
            See all four, with specs
            <span aria-hidden="true">
              <ArrowRight size={16} strokeWidth={2} />
            </span>
          </Link>

        </div>

      </section>

      <Chooser catalog={catalog} />

      <section className="story-split" data-reveal>

        <div className="story-image">

          <Image
            src="/lifestyle/sosinhand.jpeg"
            alt="Whaleora personal alarm in an everyday flat-lay composition"
            fill
            sizes="(max-width: 800px) 100vw, 50vw"
          />

        </div>

        <div className="story-copy">

          <p className="eyebrow">
            {alarm.title} · {alarm.price}
          </p>

          <h2>One pull. No app, no pairing.</h2>

          <p>
            Pull the pin and it does two things at once — a 130dB dual-siren and a strobe. Push the pin back in and it stops. That’s the entire interface, and it’s deliberate: anything you have to unlock or remember is one step too many.
          </p>

          <dl>

            <div>
              <dt>130dB</dt>
              <dd>Dual siren + strobe</dd>
            </div>

            <div>
              <dt>28g</dt>
              <dd>Sits on a keyring</dd>
            </div>

            <div>
              <dt>C-Type USB</dt>
              <dd>Long Battery Life</dd>
            </div>

          </dl>

          <Link
            href="/products/sos-alarm"
            className="button button-light"
          >
            Buy the {alarm.title} — {alarm.price}
            <span aria-hidden="true">
              <ArrowRight size={16} strokeWidth={2} />
            </span>
          </Link>

        </div>

      </section>

      <section className="how-section shell section-pad" data-reveal>

        <div className="section-heading">

          <div>

            <p className="eyebrow dark">How the alarm works</p>

            <h2>Three seconds to learn. You’ll never forget it.</h2>

          </div>

          <p>
            There is no menu, no pairing screen and no subscription. If you can pull a keyring apart, you already know how to use it.
          </p>

        </div>

        <ol className="how-steps">

          <li>
            <span>01</span>
            <strong>Carry</strong>
            <p>
              Clip it to a keyring or bag strap, somewhere you can reach without looking.
            </p>
          </li>

          <li>
            <span>02</span>
            <strong>Pull</strong>
            <p>
              Yank the top pin out. Siren and strobe start immediately and stay on.
            </p>
          </li>

          <li>
            <span>03</span>
            <strong>Reset</strong>
            <p>
              Push the pin back in to stop it. Nothing to reconfigure afterwards.
            </p>
          </li>

        </ol>

      </section>

      <SafetyJourneyGallery
        items={content.videos}
        settings={content.settings}
      />

      <TestimonialsMarquee
        items={content.testimonials}
        settings={content.settings}
      />

      <div className="scenario-ticker" aria-hidden="true">
        <span>Campus</span>
        <span>Late commute</span>
        <span>Solo travel</span>
        <span>Night shift</span>
        <span>Everyday carry</span>
      </div>

      <section className="hub-preview section-pad" data-reveal>

        <div className="shell hub-intro">

          <div>

            <p className="eyebrow">Whaleora Safety Hub</p>

            <h2>Guides worth reading twice.</h2>

          </div>

          <div>

            <p>
              Checklists and short reads on commuting, campus life and travel. Free, no signup, and written to be useful on a second read — not doom-scrolled once and forgotten.
            </p>

            <Link
              href="/safety-hub"
              className="button button-light"
            >
              Read the guides
              <span aria-hidden="true">
                <ArrowUpRight size={16} strokeWidth={2} />
              </span>
            </Link>

          </div>

        </div>

        <div className="shell editorial-grid">

          <Link
            href="/safety-hub"
            className="feature-story"
          >

            <span>Featured · 7 min read</span>

            <h3>
              Ten habits that take a minute each and hold up for years.
            </h3>

            <p>
              Sharing a live location. Keeping one number written down on paper. Small things, chosen because they still work when your phone doesn’t.
            </p>

            <strong>
              Read the ten habits
              <ArrowRight
                size={15}
                strokeWidth={2}
                aria-hidden="true"
              />
            </strong>

          </Link>

          <div className="secondary-stories">

            <Link href="/safety-hub">
              <small>Checklist · Travel</small>
              <h3>Before the cab arrives</h3>
              <span>
                3 min
                <ArrowUpRight
                  size={14}
                  strokeWidth={2}
                  aria-hidden="true"
                />
              </span>
            </Link>

            <Link href="/safety-hub#emergency-card">
              <small>Tool · Emergency prep</small>
              <h3>Build a contact card</h3>
              <span>
                5 min
                <ArrowUpRight
                  size={14}
                  strokeWidth={2}
                  aria-hidden="true"
                />
              </span>
            </Link>

          </div>

        </div>

      </section>

      <Objections />

      <section className="partnership-strip" data-reveal>

        <div className="shell">

          <p className="eyebrow">
            For campuses, workplaces & communities
          </p>

          <h2>
            Safety training people <em>actually remember.</em>
          </h2>

          <p>
            Most safety sessions are a slide deck and a signature sheet. We run the session, leave the resources behind, and fit the products to the group — not the other way round.
          </p>

          <div className="partnership-types">

            <span>Universities & campuses</span>
            <span>Corporate wellness</span>
            <span>Community programmes</span>
            <span>Retail & distribution</span>

          </div>

          <Link
            href="/institutions"
            className="button button-light"
          >
            See how partnerships work
            <span aria-hidden="true">
              <ArrowRight size={16} strokeWidth={2} />
            </span>
          </Link>

        </div>

      </section>

      <section className="founder-story" data-reveal>

        <div className="founder-photo">

          <Image
            src="/founder/sheuli-founder.webp"
            fill
            alt="Sheuli, founder of Whaleora"
            sizes="(max-width: 800px) 100vw, 58vw"
          />

        </div>

        <div className="founder-copy">

          <p className="eyebrow dark">Why we started</p>

          <blockquote>
            “Safety should be something you’re proud to carry, not something you hesitate to buy.”
          </blockquote>

          <p>
            I kept finding the same two options: tactical gear covered in warnings, or a pretty keychain that didn’t work. Nothing in between, and nothing I’d actually want on my keys.
          </p>

          <p>
            So we build the in-between. Honest specs, prices that don’t need justifying, and guides we give away because a product on its own was never the point.
          </p>

          <cite>
            Sheuli<br />
            <span>Founder, Whaleora</span>
          </cite>

          <Link
            href="/about"
            className="arrow-link"
          >
            Read the full story
            <span aria-hidden="true">
              <ArrowUpRight size={16} strokeWidth={2} />
            </span>
          </Link>

        </div>

      </section>

    </main>

  );

}