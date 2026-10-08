'use client';

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowLeft, ArrowUp, ArrowUpRight, BookOpen, Check, ChevronRight, Film, ListChecks, LogOut, MessageSquare, Package, Plus, Settings2, Star, Trash2, X } from 'lucide-react';
import { imageHostHint } from '@/lib/images';
import type { BlogPost, ContentDocument, HubChecklistContent, ProductEditorial, ReviewContent, Testimonial, VideoReview } from '@/lib/content/types';
import type { ShopifySnapshot } from '@/lib/shopify/catalog';
import { BLOG_BODY_LIMIT, BLOG_POST_LIMIT, validateContent } from '@/lib/content/types';
import { TestimonialsMarquee } from '@/components/testimonials-marquee';

async function request(url: string, method: string, payload?: unknown) {
  const response = await fetch(url, { method, headers: payload ? { 'Content-Type': 'application/json' } : undefined, body: payload ? JSON.stringify(payload) : undefined });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'The request failed. Please try again.');
  return data;
}

const lines = (value: string) => value.split('\n').map((line) => line.trim()).filter(Boolean);
const joinLines = (value: string[]) => value.join('\n');
const splitPairs = (value: string) => value.split('\n').map((line) => {
  const index = line.indexOf('|');
  if (index < 0) return { left: line.trim(), right: '' };
  return { left: line.slice(0, index).trim(), right: line.slice(index + 1).trim() };
}).filter((row) => row.left || row.right);
const joinPairs = (rows: { left: string; right: string }[]) => rows.map((row) => `${row.left} | ${row.right}`).join('\n');

/** True when any Shopify-backed field on this product has been typed over. */
const overridden = (item: ProductEditorial) =>
  Boolean(item.title || item.shortDescription || item.longDescription || item.images.length || item.price !== null);

export function AdminLogin({ setup, configured }: { setup: boolean; configured: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const form = new FormData(event.currentTarget);
    if (setup && form.get('password') !== form.get('confirm')) { setError('The passwords do not match.'); setBusy(false); return; }
    try { await request('/api/admin/session', 'POST', { action: setup ? 'setup' : 'login', password: form.get('password') }); window.location.assign('/admin'); }
    catch (error) { setError((error as Error).message); setBusy(false); }
  }
  return <main className="admin-login"><div className="admin-login-card">
    <Link href="/" className="admin-wordmark">whaleora<span>®</span></Link><p className="admin-kicker">Your content, in your hands.</p>
    <h1>{setup ? 'Make yourself at home.' : 'Welcome back.'}</h1>
    <p>{setup ? 'Create an admin password to manage products, checklists and reviews. Local setup only—you choose the password.' : 'Sign in to your content studio.'}</p>
    {(configured || setup) ? <form onSubmit={submit}>
      <Field label={setup ? 'Create password' : 'Password'}><input name="password" type="password" required minLength={setup ? 8 : 1} maxLength={200} autoComplete={setup ? 'new-password' : 'current-password'} autoFocus /></Field>
      {setup && <Field label="Confirm password"><input name="confirm" type="password" required minLength={8} maxLength={200} autoComplete="new-password" /><small>At least 8 characters. Store it somewhere safe.</small></Field>}
      {error && <p className="admin-error" role="alert">{error}</p>}
      <button className="admin-button primary" disabled={busy}>{busy ? 'One moment…' : setup ? 'Create password & enter' : 'Sign in'}<ChevronRight size={17} /></button>
    </form> : <p className="admin-error">Admin access needs configuration. Set ADMIN_PASSWORD and ADMIN_SESSION_SECRET on your server. See ADMIN.md in the project.</p>}
    <Link href="/" className="admin-back"><ArrowLeft size={15} strokeWidth={2} aria-hidden="true" /> Back to the store</Link>
  </div><div className="admin-login-note"><span>THE CONTENT STUDIO</span><p>Good stories.<br /><em>Thoughtfully told.</em></p><small>Products · Checklists · Reviews</small></div></main>;
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="admin-field"><span>{label}</span>{children}</label>; }
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="admin-toggle"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span>{label}</span></label>;
}
type Tab = 'testimonials' | 'videos' | 'products' | 'checklists' | 'posts' | 'customer' | 'settings' | 'preview';

type PendingReview = { id: string; productHandle: string; rating: number; name: string; email: string; body: string; images: string[]; status: string; heldReason?: string; verifiedBuyer: boolean; submittedAt: string };
type ReviewView = 'held' | 'published' | 'removed';
const tabs = [
  { id: 'testimonials', label: 'Written testimonials', icon: MessageSquare },
  { id: 'videos', label: 'Video reviews', icon: Film },
  { id: 'products', label: 'Product details', icon: Package },
  { id: 'checklists', label: 'Checklists', icon: ListChecks },
  { id: 'posts', label: 'Blog posts', icon: BookOpen },
  { id: 'customer', label: 'Customer reviews', icon: Star },
  { id: 'settings', label: 'Section settings', icon: Settings2 },
] as const;
const listTabs = new Set<Tab>(['testimonials', 'videos', 'products', 'checklists', 'posts']);
const slugify = (value: string) => value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100);

export function AdminEditor({ initial, shopify, uploadsEnabled, canSave }: { initial: ContentDocument; shopify: { connected: boolean; items: ShopifySnapshot[] }; uploadsEnabled: boolean; canSave: boolean }) {
  const [document, setDocument] = useState(initial);
  const [content, setContent] = useState(initial.draft);
  const [tab, setTab] = useState<Tab>('testimonials');
  const [selectedId, setSelectedId] = useState(initial.draft.testimonials[0]?.id || '');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingReviews, setPendingReviews] = useState<PendingReview[] | null>(null);
  const [reviewView, setReviewView] = useState<ReviewView>('held');
  const [heldCount, setHeldCount] = useState<number | null>(null);
  const [reviewError, setReviewError] = useState('');

  const loadReviews = useCallback(async (view: ReviewView = 'held') => {
    setReviewError('');
    setPendingReviews(null);
    try {
      const data = await request(`/api/admin/reviews?status=${view}`, 'GET');
      const rows = data.reviews as PendingReview[];
      setPendingReviews(rows);
      if (view === 'held') setHeldCount(rows.length);
    } catch (problem) {
      setPendingReviews([]);
      setReviewError((problem as Error).message);
    }
  }, []);

  async function moderate(id: string, status: 'published' | 'removed') {
    setPendingReviews((current) => current?.filter((item) => item.id !== id) ?? current);
    if (reviewView === 'held') setHeldCount((count) => (count === null ? count : Math.max(0, count - 1)));
    try { await request('/api/admin/reviews', 'POST', { id, status }); }
    catch (problem) { setReviewError((problem as Error).message); void loadReviews(reviewView); }
  }

  function showReviews(view: ReviewView) { setReviewView(view); void loadReviews(view); }
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const dirty = JSON.stringify(content) !== JSON.stringify(document.draft);
  const unpublished = JSON.stringify(content) !== JSON.stringify(document.published);
  useEffect(() => {
    if (!dirty) return;
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [dirty]);
  function firstId(next: Tab, source: ReviewContent = content) {
    if (next === 'testimonials') return source.testimonials[0]?.id || '';
    if (next === 'videos') return source.videos[0]?.id || '';
    if (next === 'products') return source.products[0]?.id || '';
    if (next === 'checklists') return source.checklists[0]?.id || '';
    if (next === 'posts') return source.posts[0]?.id || '';
    return '';
  }
  function navigate(next: Tab) { setTab(next); setSelectedId(firstId(next)); setNotice(''); if (next === 'customer') showReviews('held'); }
  function updateWritten(id: string, patch: Partial<Testimonial>) { setContent((value) => ({ ...value, testimonials: value.testimonials.map((item) => item.id === id ? { ...item, ...patch } : item) })); setNotice(''); }
  function updateVideo(id: string, patch: Partial<VideoReview>) { setContent((value) => ({ ...value, videos: value.videos.map((item) => item.id === id ? { ...item, ...patch } : item) })); setNotice(''); }
  function updateProduct(id: string, patch: Partial<ProductEditorial>) { setContent((value) => ({ ...value, products: value.products.map((item) => item.id === id ? { ...item, ...patch } : item) })); setNotice(''); }
  function updateChecklist(id: string, patch: Partial<HubChecklistContent>) {
    setContent((value) => ({ ...value, checklists: value.checklists.map((item) => item.id === id ? { ...item, ...patch } : item) }));
    if (patch.id) setSelectedId(patch.id);
    setNotice('');
  }
  function updatePost(id: string, patch: Partial<BlogPost>) { setContent((value) => ({ ...value, posts: value.posts.map((item) => item.id === id ? { ...item, ...patch } : item) })); setNotice(''); }
  function setting<K extends keyof ReviewContent['settings']>(key: K, value: ReviewContent['settings'][K]) { setContent((current) => ({ ...current, settings: { ...current.settings, [key]: value } })); setNotice(''); }
  function add() {
    const id = crypto.randomUUID();
    if (tab === 'testimonials') setContent((value) => ({ ...value, testimonials: [...value.testimonials, { id, quote: '', name: '', detail: '', row: 1, visible: false, demo: true }] }));
    if (tab === 'videos') setContent((value) => ({ ...value, videos: [...value.videos, { id, title: '', product: '', slug: 'sos-alarm', poster: '', video: '', duration: '0:08', visible: false, demo: true }] }));
    if (tab === 'checklists') {
      const checklistId = `checklist-${id.slice(0, 8)}`;
      setContent((value) => ({ ...value, checklists: [...value.checklists, { id: checklistId, title: 'New checklist', description: 'When to use this list.', items: ['First item', 'Second item', 'Third item'] }] }));
      setSelectedId(checklistId); setNotice(''); return;
    }
    if (tab === 'posts') {
      const postId = `post-${id.slice(0, 8)}`;
      setContent((value) => ({ ...value, posts: [{ id: postId, slug: `new-post-${id.slice(0, 4)}`, title: '', excerpt: '', category: 'Everyday Safety', author: 'Whaleora Team', date: new Date().toISOString().slice(0, 10), coverImage: '', body: '', visible: false }, ...value.posts] }));
      setSelectedId(postId); setNotice(''); return;
    }
    setSelectedId(id); setNotice('');
  }
  function reorder(direction: -1 | 1) {
    if (tab !== 'testimonials' && tab !== 'videos' && tab !== 'checklists') return;
    setContent((value) => {
      const list = [...value[tab]]; const index = list.findIndex((item) => item.id === selectedId); const next = index + direction;
      if (index < 0 || next < 0 || next >= list.length) return value;
      [list[index], list[next]] = [list[next], list[index]];
      return { ...value, [tab]: list };
    });
  }
  function remove() {
    if (tab !== 'testimonials' && tab !== 'videos' && tab !== 'checklists' && tab !== 'posts') return;
    if ((tab === 'checklists' || tab === 'posts') && content[tab].length <= 1) return;
    if (!window.confirm(`Remove this ${tab === 'checklists' ? 'checklist' : tab === 'posts' ? 'post' : 'review'} from the draft? The live store changes only when you publish.`)) return;
    const list = content[tab].filter((item) => item.id !== selectedId);
    setContent((value) => ({ ...value, [tab]: list })); setSelectedId(list[0]?.id || '');
  }
  async function save(publish: boolean) {
    setError(''); setNotice('');
    try {
      const validated = validateContent(content);
      if (publish && !window.confirm('Publish these edits to the live storefront?')) return;
      setBusy(true);
      const saved: ContentDocument = await request('/api/admin/content', 'PUT', { content: validated, revision: document.revision, publish });
      setDocument(saved); setContent(saved.draft); setNotice(publish ? 'Published. Your storefront is up to date.' : 'Draft saved. The live store has not changed.');
    } catch (error) { setError((error as Error).message); } finally { setBusy(false); }
  }
  async function reload() {
    if (dirty && !window.confirm('Discard unsaved edits and load the latest saved draft?')) return;
    setBusy(true); setError('');
    try { const latest = await request('/api/admin/content', 'GET'); setDocument(latest); setContent(latest.draft); setSelectedId(firstId(tab, latest.draft)); setNotice('Latest draft loaded.'); } catch (error) { setError((error as Error).message); } finally { setBusy(false); }
  }
  async function upload(file: File | undefined, key: 'poster' | 'video' | 'howItWorksImage' | 'coverImage', id: string) {
    if (!file) return;
    setError(''); setUploading(true);
    try {
      if (file.size > (key === 'video' ? 30 : 5) * 1024 * 1024) throw new Error(key === 'video' ? 'Videos must be under 30 MB.' : 'Images must be under 5 MB.');
      const response = await fetch('/api/admin/upload', { method: 'POST', headers: { 'Content-Type': file.type }, body: file });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      if (key === 'howItWorksImage') updateProduct(id, { howItWorksImage: data.url });
      else if (key === 'coverImage') updatePost(id, { coverImage: data.url });
      else updateVideo(id, { [key]: data.url });
      setNotice('Media uploaded. Save or publish to use it.');
    } catch (error) { setError((error as Error).message); } finally { setUploading(false); }
  }
  async function logout() {
    if (dirty && !window.confirm('Sign out and discard unsaved changes?')) return;
    setBusy(true);
    try { await request('/api/admin/session', 'DELETE'); window.location.assign('/admin'); } catch (error) { setError((error as Error).message); setBusy(false); }
  }
  const written = content.testimonials.find((item) => item.id === selectedId);
  const video = content.videos.find((item) => item.id === selectedId);
  const product = content.products.find((item) => item.id === selectedId);
  const store = shopify.items.find((item) => item.id === selectedId);
  // Shown under each override so an editor can see what they are replacing.
  const storeHint = (value: string | number | null | undefined, whenEmpty: string) =>
    (!shopify.connected ? 'Shopify is not connected, so this falls back to the built-in copy.'
      : !store?.matched ? 'No matching product in Shopify, so this falls back to the built-in copy.'
      : value === null || value === undefined || value === '' ? whenEmpty
      : `Blank uses Shopify: ${String(value).slice(0, 90)}`);
  const checklist = content.checklists.find((item) => item.id === selectedId);
  const post = content.posts.find((item) => item.id === selectedId);
  const list = tab === 'testimonials' ? content.testimonials : tab === 'videos' ? content.videos : tab === 'products' ? content.products : tab === 'checklists' ? content.checklists : tab === 'posts' ? content.posts : [];
  const index = list.findIndex((item) => item.id === selectedId);
  const locked = busy || uploading;
  const summaries: Record<Tab, string> = {
    testimonials: 'The small details that make a story feel personal.',
    videos: 'A closer look, through your customers’ eyes.',
    products: 'Shopify fills these in. Type over any of them only when you need to.',
    checklists: 'Safety Hub lists people can open, print and take with them.',
    posts: 'Journal posts at /blog. Newest date first; hidden posts stay off the store.',
    customer: 'Reviews publish as written. Only ones caught by the abuse and spam filter wait here — and you can take any published review down.',
    settings: 'Set the rhythm of your review sections and the ten habits.',
    preview: 'A preview of your current edits—not yet published.',
  };
  return <div className="admin-app">
    <aside className="admin-sidebar"><Link href="/" target="_blank" className="admin-wordmark">whaleora<span>®</span></Link><p className="admin-kicker">Content studio</p>
      <nav aria-label="Admin sections">{tabs.map(({ id, label, icon: Icon }) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => navigate(id)}><Icon size={18} />{label}<span>{id === 'settings' ? '' : id === 'customer' ? (heldCount || '') : content[id].length}</span></button>)}</nav>
      <div className="admin-sidebar-bottom"><a href="/" target="_blank" rel="noreferrer">View storefront <ArrowUpRight size={16} /></a><button onClick={logout} disabled={locked}><LogOut size={16} /> Sign out</button><small>Only published changes<br />appear on your store.</small></div>
    </aside>
    <main className="admin-main">
      <header className="admin-topbar"><div><span className="admin-kicker">Storefront / Content</span><h1>{tab === 'preview' ? 'Draft preview' : tabs.find((item) => item.id === tab)?.label}</h1></div><div className="admin-actions"><span className="admin-save-state">{dirty ? 'Unsaved changes' : unpublished ? 'Draft saved · not published' : 'All changes published'}</span><button className="admin-button" onClick={() => navigate(tab === 'preview' ? 'testimonials' : 'preview')}> {tab === 'preview' ? 'Back to editing' : 'Preview'}</button><button className="admin-button" onClick={() => save(false)} disabled={locked || !canSave || !dirty}>Save draft</button><button className="admin-button primary" onClick={() => save(true)} disabled={locked || !canSave || !unpublished}>{busy ? 'Saving…' : 'Publish'}<ArrowUpRight size={15} /></button></div></header>
      <div className="admin-body">
        {!canSave && <p className="admin-error">Connect Convex before saving on this hosted deployment. See ADMIN.md for configuration.</p>}
        {error && <div className="admin-error" role="alert">{error} <button onClick={reload} disabled={locked}>Reload saved draft</button></div>}
        {notice && <p className="admin-notice" role="status"><Check size={16} />{notice}</p>}
        <div className="admin-summary"><p>{summaries[tab]}</p><span>{document.publishedAt ? `Last published ${document.publishedAt.slice(0, 10)}` : 'Using starter demo content'}</span></div>
        {listTabs.has(tab) && <div className="admin-workspace">
          <section className="admin-list"><div className="admin-list-heading"><span>{tab === 'testimonials' || tab === 'videos' || tab === 'posts' ? `${list.filter((item) => 'visible' in item && item.visible).length} visible / ${list.length} total` : `${list.length} ${tab}`}</span>{tab !== 'products' && <button className="admin-button" onClick={add} disabled={locked || list.length >= (tab === 'checklists' ? 24 : tab === 'posts' ? BLOG_POST_LIMIT : 40)}><Plus size={16} /> Add</button>}</div>
            {list.map((item, i) => <button key={item.id} className={`admin-list-item ${selectedId === item.id ? 'selected' : ''}`} onClick={() => setSelectedId(item.id)}><span className="admin-number">{String(i + 1).padStart(2, '0')}</span><span><strong>{tab === 'testimonials' && 'name' in item ? item.name || 'New testimonial' : tab === 'products' ? ('title' in item && item.title) || shopify.items.find((entry) => entry.id === item.id)?.title || item.id : 'title' in item ? item.title || 'Untitled' : item.id}</strong><small>{tab === 'testimonials' && 'quote' in item ? item.quote || 'Add a quote to get started' : tab === 'videos' && 'product' in item ? item.product || 'Add product details' : tab === 'products' && 'shortDescription' in item ? (item.shortDescription || shopify.items.find((entry) => entry.id === item.id)?.description.split('\n')[0] || 'From Shopify') : 'excerpt' in item ? item.excerpt || 'Add an excerpt' : 'description' in item ? item.description : ''}</small><em>{'visible' in item ? `${item.visible ? 'Visible' : 'Hidden'}${'demo' in item && item.demo ? ' · Demo' : ''}${'date' in item ? ` · ${item.date}` : ''}${'row' in item ? ` · Row ${item.row}` : ''}` : tab === 'products' ? (overridden(item as ProductEditorial) ? 'Overridden' : 'From Shopify') : `${'items' in item ? item.items.length : 0} items`}</em></span><ChevronRight size={16} /></button>)}
            {!list.length && <p className="admin-empty">Nothing here yet.</p>}
          </section>
          <section className="admin-editor-panel" aria-label="Content editor">
            {((tab === 'testimonials' && written) || (tab === 'videos' && video) || (tab === 'products' && product) || (tab === 'checklists' && checklist) || (tab === 'posts' && post)) ? <>
              <div className="admin-panel-heading"><h2>{tab === 'testimonials' ? 'Edit testimonial' : tab === 'videos' ? 'Edit video review' : tab === 'products' ? 'Edit product copy' : tab === 'posts' ? 'Edit blog post' : 'Edit checklist'}</h2><div>{tab !== 'products' && <>{tab !== 'posts' && <><button className="admin-icon" aria-label="Move up" disabled={index <= 0 || locked} onClick={() => reorder(-1)}><ArrowUp size={17} /></button><button className="admin-icon" aria-label="Move down" disabled={index >= list.length - 1 || locked} onClick={() => reorder(1)}><ArrowDown size={17} /></button></>}{(tab !== 'checklists' && tab !== 'posts') || list.length > 1 ? <button className="admin-icon danger" aria-label="Delete" onClick={remove} disabled={locked}><Trash2 size={17} /></button> : null}</>}</div></div>
              <fieldset disabled={locked} className="admin-fields">
                {tab === 'testimonials' && written && <>
                  <Field label="Quote"><textarea rows={5} maxLength={600} value={written.quote} onChange={(event) => updateWritten(written.id, { quote: event.target.value })} placeholder="Their experience, in their own words." /><small>{written.quote.length}/600 characters</small></Field>
                  <div className="admin-field-pair"><Field label="Customer name"><input value={written.name} maxLength={80} onChange={(event) => updateWritten(written.id, { name: event.target.value })} /></Field><Field label="Product or description"><input value={written.detail} maxLength={100} onChange={(event) => updateWritten(written.id, { detail: event.target.value })} /></Field></div>
                  <Field label="Marquee row"><select value={written.row} onChange={(event) => updateWritten(written.id, { row: Number(event.target.value) as 1 | 2 })}><option value={1}>Row 1 · scrolls left</option><option value={2}>Row 2 · scrolls right</option></select></Field>
                  <Toggle label="Visible on the storefront" checked={written.visible} onChange={(visible) => updateWritten(written.id, { visible })} /><Toggle label="Demo / fictional testimonial" checked={written.demo} onChange={(demo) => updateWritten(written.id, { demo })} />
                  <div className="admin-card-preview"><span className="admin-kicker">Card preview</span><figure className="written-review"><blockquote>“{written.quote || 'Your customer’s words will appear here.'}”</blockquote><figcaption><i /><strong>{written.name || 'Customer name'}</strong><span>{written.detail}{written.demo ? ' · Demo' : ''}</span></figcaption></figure></div>
                </>}
                {tab === 'videos' && video && <>
                  <Field label="Review title"><input maxLength={120} value={video.title} onChange={(event) => updateVideo(video.id, { title: event.target.value })} /></Field>
                  <div className="admin-field-pair"><Field label="Product name"><input maxLength={100} value={video.product} onChange={(event) => updateVideo(video.id, { product: event.target.value })} /></Field><Field label="Product URL slug"><input maxLength={100} value={video.slug} onChange={(event) => updateVideo(video.id, { slug: event.target.value })} /><small>/products/{video.slug || 'product-slug'}</small></Field></div>
                  {(['video', 'poster'] as const).map((key) => <div key={key}><Field label={key === 'video' ? 'Video URL' : 'Thumbnail URL'}><input value={video[key]} maxLength={2048} placeholder={key === 'video' ? 'https://…/review.mp4' : 'https://…/thumbnail.jpg'} onChange={(event) => updateVideo(video.id, { [key]: event.target.value })} /><small>HTTPS URL or a local path beginning with /</small></Field>{uploadsEnabled && <Field label={key === 'video' ? 'Or upload MP4 · max 30 MB' : 'Or upload JPG, PNG, WebP · max 5 MB'}><input type="file" accept={key === 'video' ? 'video/mp4' : 'image/jpeg,image/png,image/webp'} onChange={(event) => { void upload(event.target.files?.[0], key, video.id); event.target.value = ''; }} /></Field>}</div>)}
                  <Field label="Duration (m:ss)"><input value={video.duration} maxLength={8} placeholder="0:30" onChange={(event) => updateVideo(video.id, { duration: event.target.value })} /></Field>
                  <Toggle label="Visible on the storefront" checked={video.visible} onChange={(visible) => updateVideo(video.id, { visible })} /><Toggle label="Demo / sample video" checked={video.demo} onChange={(demo) => updateVideo(video.id, { demo })} />
                  {video.video && <video className="admin-video-preview" key={`${video.id}-${video.video}`} src={video.video} poster={video.poster} controls playsInline preload="metadata" aria-label="Review video preview" />}
                </>}
                {tab === 'products' && product && <>
                  <div className={`admin-source-band ${shopify.connected && store?.matched ? 'is-live' : ''}`}>
                    <strong>{!shopify.connected ? 'Shopify is not connected' : store?.matched ? 'Live from Shopify' : 'No match in Shopify'}</strong>
                    <p>{!shopify.connected
                      ? 'These five fields have nowhere to read from, so whatever you type here is what the store shows.'
                      : store?.matched
                        ? 'The five fields below come from Shopify and update here whenever they change there. Fill one in only to override it — clearing it hands the field back to Shopify.'
                        : 'This product has no counterpart in the connected store, so the built-in copy is used until you override it here.'}</p>
                  </div>
                  <Field label="Title"><input maxLength={80} value={product.title} placeholder={store?.title || 'Using the built-in name'} onChange={(event) => updateProduct(product.id, { title: event.target.value })} /><small>{storeHint(store?.title, 'Shopify has no title for this product.')}</small></Field>
                  <Field label="Short description"><textarea rows={3} maxLength={280} value={product.shortDescription} placeholder={store?.description.split('\n')[0] || 'Using the built-in summary'} onChange={(event) => updateProduct(product.id, { shortDescription: event.target.value })} /><small>{product.shortDescription.length}/280 · Cards and the Safety Hub. {storeHint(store?.description.split('\n')[0], 'Shopify has no description for this product.')}</small></Field>
                  <Field label="Long description"><textarea rows={5} maxLength={1200} value={product.longDescription} placeholder={store?.description || 'Using the built-in description'} onChange={(event) => updateProduct(product.id, { longDescription: event.target.value })} /><small>{product.longDescription.length}/1200 · {storeHint(store?.description, 'Shopify has no description for this product.')}</small></Field>
                  <Field label="Product photos"><textarea rows={4} value={joinLines(product.images)} placeholder={store?.images.join('\n') || 'Using the built-in photography'} onChange={(event) => updateProduct(product.id, { images: lines(event.target.value) })} /><small>One /local path or {imageHostHint} URL per line, up to 8. {shopify.connected && store?.matched ? `Blank uses the ${store.images.length} photo${store.images.length === 1 ? '' : 's'} on the Shopify product.` : 'Blank uses the built-in photography.'}</small></Field>
                  <Field label="Price override"><input type="number" min={0} step="0.01" value={product.price ?? ''} placeholder={store?.price != null ? String(store.price) : 'Using the built-in price'} onChange={(event) => updateProduct(product.id, { price: event.target.value === '' ? null : Number(event.target.value) })} /><small><b>Changes the displayed price only.</b> When Shopify is connected it still charges its own price at checkout, so a number here that disagrees with Shopify will show one price and bill another. Blank is the safe setting.</small></Field>
                  <Field label="Label"><input maxLength={80} value={product.label} placeholder="Using the built-in label" onChange={(event) => updateProduct(product.id, { label: event.target.value })} /><small>Shopify has no equivalent. Blank uses the built-in label.</small></Field>
                  <Field label="Features"><textarea rows={5} value={joinLines(product.features)} onChange={(event) => updateProduct(product.id, { features: lines(event.target.value) })} /><small>One per line. 1–8 items.</small></Field>
                  <Field label="Specifications"><textarea rows={6} value={joinPairs(product.specifications.map((item) => ({ left: item.label, right: item.value })))} onChange={(event) => updateProduct(product.id, { specifications: splitPairs(event.target.value).map((row) => ({ label: row.left, value: row.right })) })} /><small>One per line as Label | Value. 1–10 rows.</small></Field>
                  <Field label="How it works"><textarea rows={6} value={joinPairs(product.howItWorks.map((item) => ({ left: item.title, right: item.text })))} onChange={(event) => updateProduct(product.id, { howItWorks: splitPairs(event.target.value).map((row) => ({ title: row.left, text: row.right })) })} /><small>One per line as Title | Text. 1–6 steps.</small></Field>
                  <Field label="How-to-use photo"><input value={product.howItWorksImage} maxLength={2048} placeholder="Using the photo bundled with the site" onChange={(event) => updateProduct(product.id, { howItWorksImage: event.target.value })} /><small>The photo beside the steps on the product page. One /local path or {imageHostHint} URL. Blank uses the photo bundled with the site — this slot never falls back to Shopify.</small></Field>
                  {uploadsEnabled && <Field label="Or upload JPG, PNG, WebP · max 5 MB"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { void upload(event.target.files?.[0], 'howItWorksImage', product.id); event.target.value = ''; }} /></Field>}
                  <Field label="Scenarios"><textarea rows={4} value={joinLines(product.scenarios)} onChange={(event) => updateProduct(product.id, { scenarios: lines(event.target.value) })} /><small>One per line. 1–8 short uses.</small></Field>
                  <Field label="What’s included"><textarea rows={4} value={joinLines(product.included)} onChange={(event) => updateProduct(product.id, { included: lines(event.target.value) })} /><small>One per line. 1–8 items.</small></Field>
                  <Field label="Highlights"><textarea rows={3} value={joinPairs(product.highlights.map((item) => ({ left: item.value, right: item.label })))} onChange={(event) => updateProduct(product.id, { highlights: splitPairs(event.target.value).map((row) => ({ value: row.left, label: row.right })) })} /><small>One per line as Figure | Label. 1–3 rows.</small></Field>
                  <Field label="Compare · the job"><input maxLength={160} value={product.compare.job} onChange={(event) => updateProduct(product.id, { compare: { ...product.compare, job: event.target.value } })} /></Field>
                  <Field label="Compare · reach for"><textarea rows={2} maxLength={220} value={product.compare.reachFor} onChange={(event) => updateProduct(product.id, { compare: { ...product.compare, reachFor: event.target.value } })} /></Field>
                  <div className="admin-field-pair"><Field label="Compare · power"><input maxLength={160} value={product.compare.power} onChange={(event) => updateProduct(product.id, { compare: { ...product.compare, power: event.target.value } })} /></Field><Field label="Compare · carry"><input maxLength={160} value={product.compare.carry} onChange={(event) => updateProduct(product.id, { compare: { ...product.compare, carry: event.target.value } })} /></Field></div>
                  <Field label="Compare · caveat"><textarea rows={3} maxLength={280} value={product.compare.caveat} onChange={(event) => updateProduct(product.id, { compare: { ...product.compare, caveat: event.target.value } })} /></Field>
                  <p className="admin-help">Products are added and removed in Shopify, not here. Stock, variants and checkout always come from Shopify and cannot be overridden.</p>
                </>}
                {tab === 'checklists' && checklist && <>
                  <div className="admin-field-pair"><Field label="Title"><input maxLength={80} value={checklist.title} onChange={(event) => updateChecklist(checklist.id, { title: event.target.value })} /></Field><Field label="ID"><input maxLength={80} value={checklist.id} onChange={(event) => { const next = event.target.value.trim(); if (!next) return; updateChecklist(checklist.id, { id: next }); }} /><small>Letters, numbers, hyphens. Used by Safety Hub profiles.</small></Field></div>
                  <Field label="Description"><textarea rows={3} maxLength={220} value={checklist.description} onChange={(event) => updateChecklist(checklist.id, { description: event.target.value })} /></Field>
                  <Field label="Items"><textarea rows={10} value={joinLines(checklist.items)} onChange={(event) => updateChecklist(checklist.id, { items: lines(event.target.value) })} /><small>One item per line. 3–16 items.</small></Field>
                </>}
                {tab === 'posts' && post && <>
                  <Field label="Title"><input maxLength={120} value={post.title} placeholder="A clear, specific headline" onChange={(event) => updatePost(post.id, { title: event.target.value })} /></Field>
                  <Field label="URL slug"><div className="admin-field-pair"><input maxLength={100} value={post.slug} onChange={(event) => updatePost(post.id, { slug: event.target.value.toLowerCase() })} /><button type="button" className="admin-button" onClick={() => updatePost(post.id, { slug: slugify(post.title) || post.slug })} disabled={!post.title.trim()}>Use title</button></div><small>/blog/{post.slug || 'post-slug'} · lowercase letters, numbers and hyphens. Changing it breaks links already shared.</small></Field>
                  <Field label="Excerpt"><textarea rows={3} maxLength={280} value={post.excerpt} onChange={(event) => updatePost(post.id, { excerpt: event.target.value })} placeholder="One or two sentences for the card and search results." /><small>{post.excerpt.length}/280 characters</small></Field>
                  <div className="admin-field-pair"><Field label="Category"><input maxLength={40} value={post.category} onChange={(event) => updatePost(post.id, { category: event.target.value })} /></Field><Field label="Author"><input maxLength={80} value={post.author} onChange={(event) => updatePost(post.id, { author: event.target.value })} /></Field></div>
                  <Field label="Date"><input type="date" value={post.date} onChange={(event) => updatePost(post.id, { date: event.target.value })} /><small>Posts are listed newest first.</small></Field>
                  <Field label="Cover photo"><input value={post.coverImage} maxLength={2048} placeholder="/stock/journey-city.webp" onChange={(event) => updatePost(post.id, { coverImage: event.target.value })} /><small>One /local path or {imageHostHint} URL. Blank shows the post without a photo.</small></Field>
                  {uploadsEnabled && <Field label="Or upload JPG, PNG, WebP · max 5 MB"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { void upload(event.target.files?.[0], 'coverImage', post.id); event.target.value = ''; }} /></Field>}
                  <Field label="Body"><textarea rows={18} maxLength={BLOG_BODY_LIMIT} value={post.body} onChange={(event) => updatePost(post.id, { body: event.target.value })} placeholder={'Leave a blank line between paragraphs.\n\n## A subheading\n\n- A list item\n- Another item'} /><small>{post.body.length}/{BLOG_BODY_LIMIT} · Blank line between paragraphs. Start a line with “## ” for a subheading or “- ” for a list item.</small></Field>
                  <Toggle label="Visible on the storefront" checked={post.visible} onChange={(visible) => updatePost(post.id, { visible })} />
                  {post.visible && document.published.posts.some((item) => item.id === post.id && item.visible) && <a className="icon-link" href={`/blog/${document.published.posts.find((item) => item.id === post.id)?.slug}`} target="_blank" rel="noreferrer">View live post <ArrowUpRight size={14} /></a>}
                </>}
                {(tab === 'testimonials' || tab === 'videos') && <p className="admin-help">Only turn off the demo label for genuine customer content you have permission to use.</p>}
              </fieldset>
            </> : <div className="admin-empty"><MessageSquare size={26} /><h2>Room for another story.</h2><p>Select an item, or add a new one to get started.</p></div>}
          </section>
        </div>}
        {tab === 'customer' && <section className="admin-reviews">
          <div className="admin-review-tabs" role="tablist">
            {([['held', 'Held by the filter'], ['published', 'Live on the store'], ['removed', 'Taken down']] as const).map(([view, label]) => (
              <button key={view} role="tab" aria-selected={reviewView === view} className={reviewView === view ? 'active' : ''} onClick={() => showReviews(view)}>{label}</button>
            ))}
          </div>
          {reviewError && <p className="admin-error" role="alert">{reviewError} <button onClick={() => void loadReviews(reviewView)}>Try again</button></p>}
          {pendingReviews === null && <p className="admin-empty">Loading reviews…</p>}
          {pendingReviews?.length === 0 && !reviewError && <div className="admin-empty"><Star size={26} />
            <h2>{reviewView === 'held' ? 'Nothing held.' : reviewView === 'published' ? 'No reviews yet.' : 'Nothing taken down.'}</h2>
            <p>{reviewView === 'held'
              ? 'Reviews go live as written. Only ones tripping the abuse and spam filter wait here.'
              : reviewView === 'published'
                ? 'Reviews left on product pages appear here once someone writes one.'
                : 'Reviews you take down are kept here, and can be put back.'}</p>
          </div>}
          {pendingReviews?.map((review) => (
            <article key={review.id} className="admin-review">
              <header>
                <div>
                  <strong>{review.name}</strong>
                  {review.verifiedBuyer && <em>Verified buyer</em>}
                  <small>{review.productHandle} · {review.submittedAt.slice(0, 10)}{review.heldReason ? ` · held for ${review.heldReason}` : ''}</small>
                </div>
                <span className="admin-review-rating" aria-label={`${review.rating} out of 5`}>{'★'.repeat(review.rating)}<i>{'★'.repeat(5 - review.rating)}</i></span>
              </header>
              <p>{review.body}</p>
              {/* Photos the reviewer attached. Judge them before publishing: a
                  review takedown is the only thing that hides one. */}
              {review.images?.length > 0 && <div className="admin-review-photos">
                {review.images.map((photo, index) => <a key={photo} href={photo} target="_blank" rel="noreferrer">
                  {/* Remote uploads the studio never sizes; plain <img> keeps
                      the optimiser out of the admin panel. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo} alt={`Photo ${index + 1} on ${review.name}'s review`} loading="lazy" />
                </a>)}
              </div>}
              <footer>
                <a href={`mailto:${review.email}`}>{review.email}</a>
                <div>
                  {reviewView !== 'removed' && <button className="admin-button" onClick={() => void moderate(review.id, 'removed')}><X size={15} /> {reviewView === 'held' ? 'Reject' : 'Take down'}</button>}
                  {reviewView !== 'published' && <button className="admin-button primary" onClick={() => void moderate(review.id, 'published')}><Check size={15} /> {reviewView === 'held' ? 'Publish' : 'Put back'}</button>}
                </div>
              </footer>
            </article>
          ))}
        </section>}
        {tab === 'settings' && <fieldset className="admin-settings admin-fields" disabled={locked}>
          <section><h2>Written testimonials</h2><Toggle label="Show testimonial marquee" checked={content.settings.showWritten} onChange={(value) => setting('showWritten', value)} /><Field label="Section heading"><input maxLength={160} value={content.settings.writtenTitle} onChange={(event) => setting('writtenTitle', event.target.value)} /></Field><Field label="Subtitle (optional)"><textarea maxLength={300} rows={2} value={content.settings.writtenSubtitle} onChange={(event) => setting('writtenSubtitle', event.target.value)} /></Field><Field label={`Scroll duration · ${content.settings.marqueeSeconds} seconds`}><input type="range" min={20} max={180} step={5} value={content.settings.marqueeSeconds} onChange={(event) => setting('marqueeSeconds', Number(event.target.value))} /><small>Higher is slower. The second row runs 10 seconds slower.</small></Field></section>
          <section><h2>Video reviews</h2><Toggle label="Show horizontal video carousel" checked={content.settings.showVideos} onChange={(value) => setting('showVideos', value)} /><Field label="Section heading"><textarea maxLength={160} rows={2} value={content.settings.videoTitle} onChange={(event) => setting('videoTitle', event.target.value)} /><small>Use a new line to split the heading.</small></Field><Field label="Subtitle (optional)"><textarea maxLength={300} rows={2} value={content.settings.videoSubtitle} onChange={(event) => setting('videoSubtitle', event.target.value)} /></Field></section>
          <section className="admin-settings-wide"><h2>Safety Hub habits</h2><Field label="Everyday habits"><textarea rows={12} value={joinLines(content.habits)} onChange={(event) => setContent((current) => ({ ...current, habits: lines(event.target.value) }))} /><small>One habit per line. Keep 6–12. These appear under “Ten habits that take a minute each.”</small></Field></section>
        </fieldset>}
        {tab === 'preview' && <div className="admin-preview"><TestimonialsMarquee items={content.testimonials} settings={content.settings} />{!content.settings.showWritten && <p>Written testimonials are hidden.</p>}{content.settings.showVideos ? <section><h2 style={{ whiteSpace: 'pre-line' }}>{content.settings.videoTitle}</h2><p>{content.settings.videoSubtitle}</p><small>Media preview below. The storefront displays these in the horizontal coverflow carousel.</small><div className="admin-preview-videos">{content.videos.filter((item) => item.visible).map((item) => <article key={item.id}><video src={item.video} poster={item.poster} controls playsInline preload="none" /><h3>{item.title}</h3><p>{item.product} · {item.duration}{item.demo ? ' · Demo' : ''}</p></article>)}</div></section> : <p>Video reviews are hidden.</p>}</div>}
      </div>
    </main>
  </div>;
}
