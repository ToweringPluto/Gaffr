import { useState, useEffect, useCallback } from 'react';
import type { Fixture } from '../models/fixture';
import { createFplApiClient } from '../data/fplApiClient';
import { createLocalCache } from '../data/localCache';

const apiClient = createFplApiClient();
const cache = createLocalCache();

export interface UseFixturesResult {
  data: Fixture[] | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useFixtures(): UseFixturesResult {
  const [data, setData] = useState<Fixture[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.getFixtures();
      setData(result);
      await cache.setFixtures(result);
      await cache.setLastRefreshTime(new Date());
    } catch {
      const cached = await cache.getFixtures();
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
