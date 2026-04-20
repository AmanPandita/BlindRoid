import { RedditPost } from '../types';
import { extractCompany } from '../utils/reddit';

const SUBREDDITS = ['layoffs', 'cscareerquestions', 'h1b', 'immigration', 'jobs', 'tech'];
const SEARCH_QUERY = 'WARN OR "WARN notice" OR layoff OR layoffs OR "laid off" OR severance';
const KEYWORDS = ['warn', 'warn notice', 'layoff', 'layoffs', 'laid off', 'tech layoff', 'severance'];
const REQUEST_DELAY_MS = 2000;

async function fetchSubreddit(subreddit: string): Promise<RedditPost[]> {
  const url = `https://www.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(SEARCH_QUERY)}&restrict_sr=1&sort=new&limit=100&t=month`;

  const response = await fetch(url, { headers: { 'User-Agent': 'bWARNed/1.0' } });

  if (!response.ok) {
    console.error(`Reddit returned ${response.status} for r/${subreddit}`);
    return [];
  }

  const data = await response.json();
  const children: any[] = data.data?.children || [];

  return children
    .filter((child) => {
      const titleAndText = (child.data.title + ' ' + (child.data.selftext || '')).toLowerCase();
      return KEYWORDS.some((keyword) => titleAndText.includes(keyword));
    })
    .map((child) => {
      const post = child.data;
      return {
        id: post.id,
        title: post.title,
        author: post.author,
        created: post.created_utc,
        url: post.url,
        permalink: `https://reddit.com${post.permalink}`,
        selftext: post.selftext || '',
        subreddit: post.subreddit,
        score: post.score,
        num_comments: post.num_comments,
        company: extractCompany(post.title + ' ' + post.selftext),
      };
    });
}

export async function fetchRedditPosts(): Promise<RedditPost[]> {
  const allPosts: RedditPost[] = [];

  for (const subreddit of SUBREDDITS) {
    if (allPosts.length > 0) {
      await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
    }

    try {
      const posts = await fetchSubreddit(subreddit);
      allPosts.push(...posts);
    } catch (err) {
      console.error(`Error fetching from r/${subreddit}:`, err);
    }
  }

  if (allPosts.length === 0) {
    throw new Error(
      'Could not fetch Reddit posts. Reddit may be rate limiting requests. Try pull-to-refresh in a few minutes.'
    );
  }

  const unique = Array.from(new Map(allPosts.map((post) => [post.id, post])).values());
  return unique.sort((a, b) => b.created - a.created);
}
