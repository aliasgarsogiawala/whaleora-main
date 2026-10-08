import Image from 'next/image';
import Link from 'next/link';
import type { BlogPost } from '@/lib/content/types';
import { formatPostDate, readingMinutes } from '@/lib/content/blog';

export function BlogMeta({ post }: { post: BlogPost }) {
  return <p className="blog-meta"><b>{post.category}</b><time dateTime={post.date}>{formatPostDate(post.date)}</time><span>{readingMinutes(post.body)} min read</span></p>;
}

export function BlogCard({ post }: { post: BlogPost }) {
  return (
    <Link href={`/blog/${post.slug}`} className="blog-card">
      {post.coverImage && <figure className="blog-cover"><Image src={post.coverImage} fill sizes="(max-width: 600px) 100vw, (max-width: 900px) 50vw, 33vw" alt="" /></figure>}
      <BlogMeta post={post} />
      <h3>{post.title}</h3>
      <p>{post.excerpt}</p>
    </Link>
  );
}
