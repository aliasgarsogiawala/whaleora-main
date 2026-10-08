import type { BlogPost } from './types';

export type BlogBlock =
  | { kind: 'heading'; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; items: string[] };

/**
 * Splits a post body into blocks: blank lines separate paragraphs, "## " starts
 * a subheading and consecutive "- " lines form a list. Plain text only, so the
 * page renders it as elements rather than trusting it as HTML.
 */
export function parseBody(body: string): BlogBlock[] {
  const blocks: BlogBlock[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  const flush = () => {
    if (paragraph.length) blocks.push({ kind: 'paragraph', text: paragraph.join(' ') });
    if (list.length) blocks.push({ kind: 'list', items: list });
    paragraph = []; list = [];
  };
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    if (line.startsWith('## ')) { flush(); blocks.push({ kind: 'heading', text: line.slice(3).trim() }); continue; }
    if (line.startsWith('- ')) { if (paragraph.length) flush(); list.push(line.slice(2).trim()); continue; }
    if (list.length) flush();
    paragraph.push(line);
  }
  flush();
  return blocks;
}

/** Visible posts, newest first. */
export const livePosts = (posts: BlogPost[]) => posts.filter((post) => post.visible).sort((a, b) => b.date.localeCompare(a.date));

/** Rough reading time at 220 words a minute, never under one. */
export const readingMinutes = (body: string) => Math.max(1, Math.round(body.split(/\s+/).filter(Boolean).length / 220));

export const formatPostDate = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
