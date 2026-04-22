import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useState } from 'react';

import { CACHE_KEY, CACHE_REFRESH_CHECK_MS, sampleNotices } from '../constants';
import { fetchWarnNotices, shouldRefreshCache } from '../services/warnApi';
import { CachePayload, WarnNotice } from '../types';
import { buildAnalytics } from '../utils/analytics';
import { getErrorMessage } from '../utils/format';

export function useWarnData() {
  const [notices, setNotices] = useState<WarnNotice[]>([]);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const analytics = useMemo(() => buildAnalytics(notices), [notices]);

  useEffect(() => {
    loadCachedOrFetch();

    const refreshTimer = setInterval(() => {
      refreshCacheIfDue().catch((err) => setError(getErrorMessage(err)));
    }, CACHE_REFRESH_CHECK_MS);

    return () => clearInterval(refreshTimer);
  }, []);

  async function fetchAndCache() {
    const fetched = await fetchWarnNotices();
    const savedAt = new Date().toISOString();
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt, notices: fetched }));
    setNotices(fetched);
    setLastUpdatedAt(savedAt);
  }

  async function loadCachedOrFetch() {
    setLoading(true);
    setError(null);
    let hasCachedData = false;

    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const payload = JSON.parse(cached) as CachePayload;
        hasCachedData = Boolean(payload.notices.length);
        setNotices(payload.notices);
        setLastUpdatedAt(payload.savedAt);

        if (!shouldRefreshCache(payload.savedAt)) return;
      }

      await fetchAndCache();
    } catch (err) {
      setError(getErrorMessage(err));
      if (!hasCachedData) setNotices(sampleNotices);
    } finally {
      setLoading(false);
    }
  }

  async function refreshCacheIfDue() {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    if (cached) {
      const payload = JSON.parse(cached) as CachePayload;
      if (!shouldRefreshCache(payload.savedAt)) return;
    }

    await fetchAndCache();
  }

  return { analytics, error, lastUpdatedAt, loading, notices };
}
