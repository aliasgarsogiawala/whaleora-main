'use client';

import Image from 'next/image';
import { ProductImage } from '@/components/product-image';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Plus, ShoppingCart } from 'lucide-react';
import { usePathname, useSearchParams } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition, type CSSProperties } from 'react';
import { AccountLink } from '@/components/account-link';
import { addToCartAction, getCartAction, removeCartLineAction, updateCartLineAction } from '@/app/actions/cart';
import type { CatalogProduct } from '@/lib/shopify/catalog';
import type { CartState, CartStateLine } from '@/lib/shopify/types';
import { addLine, dropLine, lineIdFor, setLineQuantity, unsellable, withLines } from '@/lib/shopify/cart-state';
import { whatsappHref } from '@/lib/content/contact';
import { burstConfetti } from '@/lib/confetti';
import { formatPrice, products, PRODUCT_IMAGE_FALLBACK } from '@/data/products';
import { CheckoutGateDialog } from '@/components/checkout-gate';
import { PolicyDialog } from '@/components/policy-dialog';
import type { PolicyKey } from '@/lib/content/policies';
import { sendInitiateCheckoutCAPI, sendAddToCartCAPI, sendPageViewCAPI } from '@/app/actions/meta-capi';

declare global {
  interface Window {
    fbq: any;
    gtag: any;
  }
}

/** Product as rendered by the shop: local editorial plus whatever Shopify knows. */
export type ShopProduct = CatalogProduct;

const FREE_SHIPPING_THRESHOLD = 1499;
/** Footer entries whose href is a '#<policy>' open that dialog instead of navigating. */
const policyKey = (href: string) => (href.startsWith('#') ? href.slice(1) as PolicyKey : null);

const emptyCart: CartState = {
  connected: false,
  id: null,
  checkoutUrl: null,
  currencyCode: 'INR',
  subtotal: 0,
  totalQuantity: 0,
  lines: [],
};

type CartContextValue = {
  cart: CartState;
  pending: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
  add: (product: ShopProduct, quantity?: number) => void;
  update: (line: CartStateLine, quantity: number) => void;
  remove: (line: CartStateLine) => void;
  count: number;
};

const CartContext = createContext<CartContextValue | null>(null);

const LOCAL_KEY = 'whaleora-cart';
/**
 * Set the moment we hand off to Shopify checkout. Shopify stops resolving a
 * cart id once it becomes an order, so on the way back this tells us to ask
 * again rather than trust the state we left with.
 */
const HANDOFF_KEY = 'whaleora-checkout-handoff';

export function markCheckoutHandoff() {
  try { window.sessionStorage.setItem(HANDOFF_KEY, '1'); } catch { /* private mode */ }
}
/** Local-bag maths, used only while Shopify is unreachable or unconfigured. */
const localLine = (product: ShopProduct, quantity: number): CartStateLine => ({
  id: null,
  productId: product.id,
  variantId: product.shopify?.variantId ?? null,
  handle: product.shopify?.handle ?? product.slug,
  title: product.title,
  image: product.images[0] ?? null,
  quantity,
  unitPrice: product.price,
  currencyCode: product.currencyCode ?? 'INR',
});

const recalculate = (lines: CartStateLine[]): CartState => withLines(emptyCart, lines);

export function CommerceProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartState>(emptyCart);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [pending, startTransition] = useTransition();
  /** The last cart Shopify actually confirmed, which is where real line ids live. */
  const confirmed = useRef<CartState | null>(null);

  // Read the Shopify cart from its cookie. If the store is not connected, fall
  // back to whatever the previous local-only bag held.
  useEffect(() => {
    let active = true;
    getCartAction()
      .then((serverCart) => {
        if (!active) return;
        if (serverCart.connected) {
          confirmed.current = serverCart;
          setCart(serverCart);
          setReady(true);
          return;
        }
        try {
          const saved = window.localStorage.getItem(LOCAL_KEY);
          if (saved) setCart(recalculate(JSON.parse(saved) as CartStateLine[]));
        } catch { /* device storage may be unavailable */ }
        setReady(true);
      })
      .catch(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!ready || cart.connected) return;
    try {
      window.localStorage.setItem(LOCAL_KEY, JSON.stringify(cart.lines));
    } catch { /* device storage may be unavailable */ }
  }, [cart, ready]);

  // Coming back from checkout. A plain return re-mounts and refetches on its
  // own, but a Back press restored from bfcache does not, so listen for that
  // and for the tab regaining focus. Only runs when we actually handed off.
  useEffect(() => {
    const settle = () => {
      let handedOff = false;
      try { handedOff = window.sessionStorage.getItem(HANDOFF_KEY) === '1'; } catch { /* private mode */ }
      if (!handedOff) return;
      getCartAction()
        .then((serverCart) => {
          if (!serverCart.connected) return;
          confirmed.current = serverCart;
          setCart(serverCart);
          // The cart is only gone once Shopify stops resolving it, which is
          // what an order does. Anything else means checkout was abandoned and
          // the bag should survive.
          if (serverCart.totalQuantity === 0) {
            try { window.sessionStorage.removeItem(HANDOFF_KEY); window.localStorage.removeItem(LOCAL_KEY); } catch { /* private mode */ }
            setOpen(false);
          }
        })
        .catch(() => { /* keep what is on screen */ });
    };
    const onPageShow = (event: PageTransitionEvent) => { if (event.persisted) settle(); };
    const onVisible = () => { if (document.visibilityState === 'visible') settle(); };
    settle();
    window.addEventListener('pageshow', onPageShow);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('pageshow', onPageShow);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // Confetti should come from wherever the shopper actually acted, so track the
  // pointer and drop it on keydown, which leaves the focused button as the origin.
  const lastPointer = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const remember = (event: PointerEvent) => { lastPointer.current = { x: event.clientX, y: event.clientY }; };
    const forget = () => { lastPointer.current = null; };
    window.addEventListener('pointerdown', remember);
    window.addEventListener('keydown', forget);
    return () => {
      window.removeEventListener('pointerdown', remember);
      window.removeEventListener('keydown', forget);
    };
  }, []);

  const celebrate = useCallback(() => {
    const point = lastPointer.current;
    if (point) return burstConfetti(point.x, point.y);
    const rect = (document.activeElement as HTMLElement | null)?.getBoundingClientRect();
    if (rect?.width) return burstConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return burstConfetti(window.innerWidth / 2, window.innerHeight / 3);
  }, []);

  const applyLocal = useCallback((next: (lines: CartStateLine[]) => CartStateLine[]) => {
    setCart((current) => withLines(current, next(current.lines)));
  }, []);

  /**
   * Shopify takes the better part of a second to answer a cart mutation, so the
   * drawer must not wait for it: every change lands on screen at once and the
   * response reconciles it when it arrives. Only the newest request may write
   * that response, so a slow reply can never undo a later click.
   */
  const issued = useRef(0);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const reconcile = useCallback((send: () => Promise<CartState>) => {
    const mine = ++issued.current;
    startTransition(async () => {
      // One at a time: Shopify applies each mutation to the cart it holds, so
      // overlapping calls could answer out of order and reconcile the drawer
      // back to a state the shopper has already moved past.
      const run = queue.current.then(send, send);
      queue.current = run.catch(() => undefined);
      const next = await run;
      if (!next.connected) return;
      confirmed.current = next;
      if (issued.current === mine) setCart(next);
    });
  }, []);

  const add = useCallback((product: ShopProduct, quantity = 1) => {
    celebrate();
    setOpen(true);
    const variantId = product.shopify?.variantId ?? null;
    applyLocal((lines) => addLine(lines, localLine(product, quantity)));
    if (cart.connected && variantId) reconcile(() => addToCartAction(variantId, quantity));
  }, [applyLocal, cart.connected, celebrate, reconcile]);

  const update = useCallback((line: CartStateLine, quantity: number) => {
    applyLocal((lines) => setLineQuantity(lines, line, quantity));
    if (!cart.connected) return;
    reconcile(async () => {
      const id = lineIdFor(line, confirmed.current);
      // No id even after the queue drained means Shopify never took this line;
      // ask for the cart it does hold rather than leave the drawer guessing.
      return id ? updateCartLineAction(id, quantity) : getCartAction();
    });
  }, [applyLocal, cart.connected, reconcile]);

  const remove = useCallback((line: CartStateLine) => {
    applyLocal((lines) => dropLine(lines, line));
    if (!cart.connected) return;
    reconcile(async () => {
      const id = lineIdFor(line, confirmed.current);
      return id ? removeCartLineAction(id) : getCartAction();
    });
  }, [applyLocal, cart.connected, reconcile]);

  const value = useMemo<CartContextValue>(
    () => ({ cart, pending, open, setOpen, add, update, remove, count: cart.totalQuantity }),
    [cart, pending, open, add, update, remove],
  );

  return <CartContext.Provider value={value}>{children}<CartDrawer /></CartContext.Provider>;
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error('useCart must be used inside CommerceProvider');
  return value;
}

const NAV_LINKS = [
  { href: '/products', label: 'Shop' },
  { href: '/safety-hub', label: 'Safety Hub' },
  { href: '/about', label: 'About' },
  { href: '/institutions', label: 'Partnerships' },
];

const MENU_LINKS = [...NAV_LINKS, { href: '/account', label: 'Account' }, { href: '/contact', label: 'Contact' }];

/** A link is current on its own page and on anything nested beneath it. */
const isCurrent = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

function useOverlayFocus(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open || !ref.current) return;
    const panel = ref.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusable = () => Array.from(panel.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, select, textarea, [tabindex="0"]')).filter((element) => element.getClientRects().length > 0);
    focusable()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close(); }
      if (event.key !== 'Tab') return;
      const elements = focusable();
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', onKey); previous?.focus(); };
  }, [open, close]);
  return ref;
}

export function Header() {
  const { count, setOpen } = useCart();
  const pathname = usePathname() ?? '/';
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const menuRef = useOverlayFocus(menuOpen, closeMenu);
  const [scrolled, setScrolled] = useState(false);
  // Only the home hero is meant to run under the bar. Everywhere else the
  // header keeps a solid paper surface so photos never show through on scroll.
  const [overHero, setOverHero] = useState(pathname === '/');
  useLayoutEffect(() => {
    const hero = document.querySelector<HTMLElement>('[data-hero-overlay]');
    const onScroll = () => {
      setScrolled(window.scrollY > 30);
      setOverHero(Boolean(hero && hero.getBoundingClientRect().bottom > 120));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [pathname]);

  return (
    <>
      <div className={`announcement ${scrolled ? 'is-tucked' : ''}`}><span>Free shipping over ₹1,499 · Delivered across India</span></div>
      <header className={`site-header ${scrolled ? 'is-scrolled' : ''} ${overHero ? 'is-over-hero' : ''}`}>
        <button className="menu-button" onClick={() => setMenuOpen(true)} aria-label="Open menu" aria-expanded={menuOpen}><span /><span /><span /></button>
        <Link href="/" className="brand" aria-label="Whaleora home"><Image src="/brand/whaleora-logo.svg" width={186} height={48} alt="Whaleora" priority /></Link>
        <nav aria-label="Primary navigation">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} aria-current={isCurrent(pathname, link.href) ? 'page' : undefined}>{link.label}</Link>
          ))}
        </nav>
        <div className="header-actions">
          <Link href="/contact" className="contact-link" aria-current={isCurrent(pathname, '/contact') ? 'page' : undefined}>Contact</Link>
          <AccountLink />
          <button className="cart-button" onClick={() => setOpen(true)} aria-label={`Open cart with ${count} items`}>
            <ShoppingCart className="nav-cart-icon" size={22} strokeWidth={1.7} aria-hidden="true" />
            {/* Keyed on the count so the badge replays its pop each time the bag changes. */}
            <span key={count} className="cart-count" data-empty={count === 0}>{count}</span>
          </button>
        </div>
      </header>
      {/* The bar is fixed, so this holds its place in the flow and keeps the
          announcement tucking away from shifting the page. */}
      <div className="site-top-spacer" aria-hidden="true" />
      <div ref={menuRef} className={`mobile-menu ${menuOpen ? 'open' : ''}`} role="dialog" aria-modal={menuOpen || undefined} aria-label="Navigation menu" aria-hidden={!menuOpen} inert={!menuOpen}>
        <button className="menu-close" onClick={() => setMenuOpen(false)} aria-label="Close menu"><span /><span /></button>
        <nav>
          {MENU_LINKS.map((link, index) => (
            <Link
              key={link.href}
              href={link.href}
              style={{ '--i': index } as CSSProperties}
              aria-current={isCurrent(pathname, link.href) ? 'page' : undefined}
              onClick={() => setMenuOpen(false)}
            >
              <small>0{index + 1}</small>{link.label}<ArrowUpRight size={17} strokeWidth={1.5} aria-hidden="true" />
            </Link>
          ))}
        </nav>
        <div className="mobile-menu-footer">
          <Link href="/products" className="button button-primary menu-cta" onClick={() => setMenuOpen(false)}>Shop the collection <span aria-hidden="true"><ArrowRight size={16} strokeWidth={2} /></span></Link>
          <p>Your Safety. Our Priority.<br />Designed in India.</p>
        </div>
      </div>
    </>
  );
}

/** Local record for a cart line, so the drawer keeps the site's own imagery and links. */
const localRecord = (line: CartStateLine) =>
  products.find((product) => product.id === line.productId)
  ?? products.find((product) => product.slug === line.handle);

function CartDrawer() {
  const { cart, pending, open, setOpen, update, remove } = useCart();
  const closeCart = useCallback(() => setOpen(false), [setOpen]);
  const drawerRef = useOverlayFocus(open, closeCart);
  const [checkoutNote, setCheckoutNote] = useState(false);
  const [gate, setGate] = useState(false);
  const { subtotal, currencyCode, lines } = cart;
  const shippingGap = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);

  const goToCheckout = () => {
    if (cart.checkoutUrl) {
      markCheckoutHandoff();
      window.location.href = cart.checkoutUrl;
      return;
    }
    // Nothing to hand off to. Drop back to the bag, which is where the note
    // explaining that lives — leaving the gate up would look like a dead button.
    setGate(false);
    setOpen(true);
    setCheckoutNote(true);
  };

  const checkout = () => {
    const eventId = crypto.randomUUID();
    
    // 1. Fire Browser Pixels (Meta + Google)
    if (typeof window !== 'undefined') {
      if (window.fbq) {
        window.fbq('track', 'InitiateCheckout', {
          value: subtotal,
          currency: currencyCode,
          num_items: cart.totalQuantity,
        }, { eventID: eventId });
      }

      if (window.gtag) {
        window.gtag('event', 'begin_checkout', {
          currency: currencyCode,
          value: subtotal,
          items: lines.map(line => ({
            item_id: line.productId,
            item_name: line.title,
            price: line.unitPrice,
            quantity: line.quantity
          }))
        });
      }
    }

    // 2. Fire Meta CAPI Server Action
    sendInitiateCheckoutCAPI({
      eventId: eventId,
      value: subtotal,
      currency: currencyCode,
      cartItems: lines.map(line => ({ id: line.variantId?.split('/').pop() || line.productId }))
    });

    let signedIn = false;
    try { signedIn = document.cookie.split('; ').some((entry) => entry.startsWith('whaleora_signed_in=')); } catch { /* private mode */ }
    if (!signedIn) {
      setOpen(false);
      setGate(true);
      return;
    }
    goToCheckout();
  };

  return (
    <>
    <div ref={drawerRef} className={`cart-layer ${open ? 'open' : ''}`} role="dialog" aria-modal={open || undefined} aria-label="Shopping bag" aria-hidden={!open} inert={!open}>
      <button className="cart-backdrop" onClick={() => setOpen(false)} aria-label="Close cart" />
      <aside className="cart-drawer" aria-label="Shopping bag" aria-busy={pending}>
        <div className="cart-head"><div><small>Your selection</small><h2>Shopping bag <sup>{cart.totalQuantity}</sup></h2></div><button onClick={() => setOpen(false)} aria-label="Close cart">×</button></div>
        {lines.length === 0 ? (
          <div className="empty-cart"><span>○</span><h3>Nothing in here yet.</h3><p>Four objects, one job each. Most people begin with the alarm.</p><Link href="/products" onClick={() => setOpen(false)} className="button button-primary">Browse all four <span aria-hidden="true"><ArrowRight size={16} strokeWidth={2} /></span></Link></div>
        ) : (
          <>
            <div className="shipping-progress"><div><span style={{ width: `${Math.min(100, subtotal / FREE_SHIPPING_THRESHOLD * 100)}%` }} /></div><p>{shippingGap ? `${formatPrice(shippingGap, currencyCode)} away from free shipping.` : 'You have unlocked free shipping.'}</p></div>
            <div className="cart-lines">{lines.map((line) => {
              const record = localRecord(line);
              // A Shopify-only line may carry no handle; then the title is plain text.
              const lineSlug = record?.slug ?? line.handle;
              return <div className="cart-line" key={line.id ?? line.variantId ?? line.productId}>
                <ProductImage src={line.image || record?.images[0] || PRODUCT_IMAGE_FALLBACK} width={130} height={130} alt="" />
                <div><small>{record?.category ?? 'Whaleora'}</small>{lineSlug ? <Link href={`/products/${lineSlug}`} onClick={() => setOpen(false)}>{line.title}</Link> : line.title}<strong>{formatPrice(line.unitPrice, line.currencyCode)}</strong><div className="quantity"><button onClick={() => update(line, line.quantity - 1)} aria-label="Decrease quantity">−</button><span>{line.quantity}</span><button onClick={() => update(line, line.quantity + 1)} aria-label="Increase quantity">+</button></div><button className="remove" onClick={() => remove(line)}>Remove</button></div>
              </div>;
            })}</div>
            <div className="cart-total"><div><span>Subtotal</span><strong>{formatPrice(subtotal, currencyCode)}</strong></div><p>Taxes included. Shipping calculated at checkout.</p>
              <button className="button button-primary" onClick={checkout} disabled={pending}>{pending ? 'Updating…' : 'Checkout securely'} <span aria-hidden="true"><ArrowRight size={16} strokeWidth={2} /></span></button>{checkoutNote && !cart.checkoutUrl && <p className="drawer-note" role="status">Checkout isn’t connected on this build yet. To order now, message us on <a href={whatsappHref("Hi Whaleora! I'd like to place an order.")}>WhatsApp</a> or email hello@whaleora.com.</p>}</div>
          </>
        )}
      </aside>
    </div>
    {/* Outside .cart-layer: that subtree turns inert the moment the drawer closes. */}
    {gate && <CheckoutGateDialog pending={pending} onGuest={goToCheckout} onBack={() => { setGate(false); setOpen(true); }} />}
    </>
  );
}

export function AddToCartButton({ product, quantity = 1, className = '', label = 'Add to bag' }: { product: ShopProduct; quantity?: number; className?: string; label?: string }) {
  const { add, cart, pending } = useCart();
  if (unsellable(product, cart.connected)) return <button className={`button button-primary ${className}`} disabled>Sold out</button>;
  return <button className={`button button-primary ${className}`} onClick={() => add(product, quantity)} disabled={pending}>{pending ? 'Adding…' : label} <span aria-hidden="true"><ArrowRight size={16} strokeWidth={2} /></span></button>;
}

export function ProductCard({ product, index = 0 }: { product: ShopProduct; index?: number }) {
  const { add, cart, pending } = useCart();
  const soldOut = unsellable(product, cart.connected);

  const handleQuickAdd = () => {
    const eventId = crypto.randomUUID();
    
    // 1. Meta & Google Browser Events
    if (typeof window !== 'undefined') {
      if (window.fbq) {
        window.fbq('track', 'AddToCart', {
          content_ids: [product.shopify?.variantId?.split('/').pop() || product.id],
          content_name: product.title,
          content_type: 'product',
          value: product.price,
          currency: product.currencyCode || 'INR',
          num_items: 1
        }, { eventID: eventId });
      }
      if (window.gtag) {
        window.gtag('event', 'add_to_cart', {
          currency: product.currencyCode || 'INR',
          value: product.price,
          items: [{
            item_id: product.id,
            item_name: product.title,
            price: product.price,
            quantity: 1
          }]
        });
      }
    }
    
    // 2. Meta CAPI Server Action
    sendAddToCartCAPI({
      eventId: eventId,
      productId: product.id,
      productName: product.title,
      value: product.price,
      currency: product.currencyCode || 'INR'
    });

    // 3. Proceed with adding to cart
    add(product);
  };

  return (
    <article className="product-card" style={{ '--accent': product.accent } as React.CSSProperties}>
      <Link href={`/products/${product.slug}`} className="product-visual">
        <small>0{index + 1} · {product.category}</small>
        <ProductImage src={product.images[0] || PRODUCT_IMAGE_FALLBACK} width={700} height={700} alt={product.title} sizes="(max-width: 1100px) 50vw, 25vw" />
        <span className="product-card-cue">View object <ArrowUpRight size={14} strokeWidth={2} aria-hidden="true" /></span>
      </Link>
      <div className="product-meta"><div><Link href={`/products/${product.slug}`}>{product.title}</Link><small>{product.shortDescription}</small></div><strong>{formatPrice(product.price, product.currencyCode)}</strong></div>
      <button className="quick-add" onClick={handleQuickAdd} disabled={soldOut || pending} aria-label={`Add ${product.title} to bag`}>{soldOut ? 'Sold out' : pending ? 'Adding…' : <>Add to bag <Plus size={15} strokeWidth={2.2} aria-hidden="true" /></>}</button>
    </article>
  );
}

/** Footer social marks, drawn inline: lucide ships no brand glyphs. */
const socialIcon = { viewBox: '0 0 24 24', width: 17, height: 17, fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;

const socials = [
  {
    label: 'Instagram',
    href: 'https://www.instagram.com/whaleora.safety',
    icon: (
      <svg {...socialIcon}>
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.1" cy="6.9" r="1.05" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/company/whaleora-safety/',
    icon: (
      <svg {...socialIcon}>
        <rect x="3" y="3" width="18" height="18" rx="4.5" />
        <circle cx="7.6" cy="7.6" r="1.05" fill="currentColor" stroke="none" />
        <path d="M7.6 10.5v6.3" />
        <path d="M11.6 16.8v-6.3" />
        <path d="M11.6 13.6a2.6 2.6 0 0 1 5.2 0v3.2" />
      </svg>
    ),
  },
];

export function Footer() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [policy, setPolicy] = useState<PolicyKey | null>(null);
  const groups = useMemo(() => [
    { title: 'Shop', links: [['Shop all', '/products'], ['SOS Alarm', '/products/sos-alarm'], ['Pepper Spray', '/products/pepperspray']] },
    { title: 'Explore', links: [['Our story', '/about'], ['Safety Hub', '/safety-hub'], ['Partnerships', '/institutions']] },
    { title: 'Support', links: [['Account', '/account'], ['Contact & FAQ', '/contact'], ['Shipping', '#shipping'], ['Returns', '#returns']] },
  ], []);
  return (
    <footer className="footer">
      <section className="community-signup"><p className="eyebrow">The monthly note</p><div><h2>One email a month. No fear-mongering.</h2><form onSubmit={(event) => { event.preventDefault(); if (email) setSent(true); }}><label htmlFor="community-email">A checklist, a short read, and anything new we’ve made. Unsubscribe in one click.</label><div><input id="community-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Your email address" required /><button type="submit" aria-label="Subscribe">{sent ? 'Thank you' : 'Join'} <span aria-hidden="true"><ArrowRight size={16} strokeWidth={2} /></span></button></div></form></div></section>
      <section className="footer-main"><div className="footer-brand"><Image src="/brand/whaleora-logo.svg" width={220} height={60} alt="Whaleora" /><p>Your Safety.<br />Our Priority.</p><address><strong>Whale Being</strong>Sambhaji Nagar, Thane<br />Maharashtra, India</address></div><div className="footer-links">{groups.map((group) => <div key={group.title}><h3>{group.title}</h3>{group.links.map(([label, href]) => policyKey(href)
        ? <button type="button" key={label} onClick={() => setPolicy(policyKey(href))}>{label}</button>
        : <Link href={href} key={label}>{label}</Link>)}</div>)}</div></section>
      <div className="footer-bottom"><span>© 2026 Whaleora</span><div><a href="mailto:hello@whaleora.com">hello@whaleora.com</a><span className="footer-socials">{socials.map((social) => <a key={social.label} className="footer-social" href={social.href} aria-label={social.label} title={social.label} target="_blank" rel="noreferrer noopener">{social.icon}</a>)}</span></div></div>
      {policy && <PolicyDialog policy={policy} close={() => setPolicy(null)} />}
    </footer>
  );
}
export function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const url = window.location.href;
    const eventId = crypto.randomUUID();

    if (typeof window !== 'undefined') {
      // 1. Fire Browser Pixel (with Deduplication ID)
      if (window.fbq) {
        window.fbq('track', 'PageView', {}, { eventID: eventId });
      }
    }

    // 2. Fire Server CAPI
    sendPageViewCAPI({ eventId: eventId, url: url });
  }, [pathname, searchParams]);

  return null; // This component is invisible
}