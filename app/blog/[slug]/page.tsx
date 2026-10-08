import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { BlogCard, BlogMeta } from '@/components/blog-card';
import { livePosts, parseBody } from '@/lib/content/blog';
import { publishedContent } from '@/lib/content/store';
import '../blog.css';

export const revalidate = 3600;

const loadPosts = async () => livePosts((await publishedContent()).posts);

export async function generateStaticParams() {
  return (await loadPosts()).map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = (await loadPosts()).find((item) => item.slug === slug);
  if (!post) return {};
  return {
    title: `${post.title} | Whaleora Journal`,
    description: post.excerpt,
    openGraph: { type: 'article', title: post.title, description: post.excerpt, publishedTime: post.date, images: post.coverImage ? [post.coverImage] : undefined },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const posts = await loadPosts();
  const post = posts.find((item) => item.slug === slug);
  if (!post) notFound();
  const more = posts.filter((item) => item.id !== post.id).slice(0, 3);

  return (
    <main className="page-main blog-page">
      <article>
        <header className="blog-post-head shell">
          <Link href="/blog" className="blog-back icon-link"><ArrowLeft size={14} aria-hidden="true" /> Journal</Link>
          <h1>{post.title}</h1>
          <p>{post.excerpt}</p>
          <BlogMeta post={post} />
          <p className="blog-meta">By {post.author}</p>
        </header>
        {post.coverImage && <div className="shell"><figure className="blog-cover blog-post-cover"><Image src={post.coverImage} fill priority sizes="(max-width: 1540px) 92vw, 1540px" alt="" /></figure></div>}
        <div className="blog-body shell">
          {parseBody(post.body).map((block, index) => block.kind === 'heading'
            ? <h2 key={index}>{block.text}</h2>
            : block.kind === 'list'
              ? <ul key={index}>{block.items.map((item, i) => <li key={i}>{item}</li>)}</ul>
              : <p key={index}>{block.text}</p>)}
        </div>
      </article>

      {more.length > 0 && (
        <section className="blog-more shell">
          <p className="eyebrow dark">Keep reading</p>
          <div className="blog-grid">{more.map((item) => <BlogCard key={item.id} post={item} />)}</div>
        </section>
      )}
    </main>
  );
}
