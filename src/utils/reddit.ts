import { NoticeRangeKey, RedditPost } from '../types';

export function extractCompany(text: string): string | undefined {
  const companyPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g;
  const matches = text.match(companyPattern);
  return matches && matches.length > 0 ? matches[0] : undefined;
}

export function getRedditPostsForRange(posts: RedditPost[], range: NoticeRangeKey): RedditPost[] {
  const sorted = [...posts].sort((a, b) => b.created - a.created);

  if (range === '7d') {
    const cutoff = Date.now() / 1000 - 7 * 24 * 60 * 60;
    return sorted.filter((post) => post.created >= cutoff);
  }

  if (range === '30d') {
    const cutoff = Date.now() / 1000 - 30 * 24 * 60 * 60;
    return sorted.filter((post) => post.created >= cutoff);
  }

  return sorted;
}

export function filterRedditPosts(posts: RedditPost[], query: string): RedditPost[] {
  const q = query.trim().toLowerCase();
  if (!q) return posts;

  return posts.filter((post) =>
    `${post.title} ${post.selftext} ${post.subreddit} ${post.author} ${post.company || ''}`
      .toLowerCase()
      .includes(q)
  );
}
