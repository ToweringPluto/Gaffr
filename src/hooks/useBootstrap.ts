import { useState, useEffect, useCallback } from 'react';
import type { BootstrapStatic } from '../models/bootstrapStatic';
import { createFplApiClient } from '../data/fplApiClient';
import { createLocalCache } from '../data/localCache';
import { createDataParser } from '../data/dataParser';

const apiClient = createFplApiClient();
const cache = createLocalCache();
const parser = createDataParser();

export interface UseBootstrapResult {
  data: BootstrapStatic | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useBootstrap(): UseBootstrapResult {
  const [data, setData] = useState<BootstrapStatic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const raw = await apiClient.getBootstrapStatic();
      const result = parser.parseBootstrap(raw);
      setData(result);
      await cache.setBootstrap(result);
      await cache.setLastRefreshTime(new Date());
    } catch {
      const cached = await cache.getBootstrap();
      if (cached) {
        setData(cached);
        setError('Data source is unavailable. Showing cached data.');
      } else {
        setError('Data source is unavailable. No cached data available.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refresh: fetchData };
}
