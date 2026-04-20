import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { REDDIT_CACHE_KEY, REDDIT_LAST_FETCH_KEY, REDDIT_REFRESH_COOLDOWN_MS } from '../constants';
import { fetchRedditPosts } from '../services/redditApi';
import { RedditPost } from '../types';
import { getErrorMessage } from '../utils/format';

export function useRedditData() {
  const [posts, setPosts] = useState<RedditPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadCachedOrFetch();
  }, []);

  async function loadAndCache() {
    const fetched = await fetchRedditPosts();
    await AsyncStorage.setItem(REDDIT_CACHE_KEY, JSON.stringify(fetched));
    await AsyncStorage.setItem(REDDIT_LAST_FETCH_KEY, Date.now().toString());
    setPosts(fetched);
    setError(null);
  }

  async function loadCachedOrFetch() {
    setLoading(true);
    setError(null);

    try {
      const cached = await AsyncStorage.getItem(REDDIT_CACHE_KEY);
      if (cached) {
        setPosts(JSON.parse(cached) as RedditPost[]);
        setLoading(false);
        return;
      }

      await loadAndCache();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    const lastFetchStr = await AsyncStorage.getItem(REDDIT_LAST_FETCH_KEY);
    if (lastFetchStr) {
      const timeSince = Date.now() - parseInt(lastFetchStr, 10);
      if (timeSince < REDDIT_REFRESH_COOLDOWN_MS) {
        const minutesRemaining = Math.ceil((REDDIT_REFRESH_COOLDOWN_MS - timeSince) / 60000);
        setError(`Please wait ${minutesRemaining} more minute${minutesRemaining > 1 ? 's' : ''} before refreshing.`);
        return;
      }
    }

    setRefreshing(true);
    setError(null);

    try {
      await loadAndCache();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setRefreshing(false);
    }
  }

  return { error, handleRefresh, loading, posts, refreshing };
}
