import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { BlogCard, BlogMeta } from '@/components/blog-card';
import { livePosts } from '@/lib/content/blog';
import { publishedContent } from '@/lib/content/store';
import './blog.css';

// Same cadence as the Safety Hub, so an admin publish shows up within the hour.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Journal — practical safety reading | Whaleora',
  description: 'Short, practical reads on everyday safety, commuting, travel and preparedness from the Whaleora team.',
};

export default async function BlogPage() {
  const posts = livePosts((await publishedContent()).posts);
  const [featured, ...rest] = posts;
  return (
    <main className="page-main blog-page">
      <header className="blog-hero shell">
        <p className="eyebrow dark">The Whaleora journal</p>
        <h1>Short reads, <em>worth a second look.</em></h1>
        <p>Practical notes on commuting, travel, campus life and being prepared — written to be useful, not to make you nervous.</p>
      </header>

      {!featured && <p className="blog-empty shell">New posts are on the way. In the meantime, the <Link href="/safety-hub" className="icon-link">Safety Hub <ArrowRight size={14} aria-hidden="true" /></Link> has guides and checklists.</p>}

      {featured && (
        <article className="blog-featured shell">
          {featured.coverImage && <Link href={`/blog/${featured.slug}`} tabIndex={-1} aria-hidden="true"><figure className="blog-cover"><Image src={featured.coverImage} fill priority sizes="(max-width: 900px) 100vw, 55vw" alt="" /></figure></Link>}
          <div>
            <BlogMeta post={featured} />
            <h2><Link href={`/blog/${featured.slug}`}>{featured.title}</Link></h2>
            <p>{featured.excerpt}</p>
            <Link href={`/blog/${featured.slug}`} className="text-link">Read the post <ArrowRight size={16} strokeWidth={2} aria-hidden="true" /></Link>
          </div>
        </article>
      )}

      {rest.length > 0 && <section className="blog-grid shell" aria-label="More posts">{rest.map((post) => <BlogCard key={post.id} post={post} />)}</section>}
    </main>
  );
}
