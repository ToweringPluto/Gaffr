import { useState, useEffect, useCallback } from 'react';
import type { ManagerSquad } from '../models/squad';
import { createFplApiClient } from '../data/fplApiClient';
import { createLocalCache } from '../data/localCache';

const apiClient = createFplApiClient();
const cache = createLocalCache();

export interface UseSquadResult {
  data: ManagerSquad | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useSquad(teamId: number | null): UseSquadResult {
  const [data, setData] = useState<ManagerSquad | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (teamId === null) return;
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.getManagerSquad(teamId);
      setData(result);
      await cache.setManagerSquad(result);
      await cache.setLastRefreshTime(new Date());
    } catch {
      const cached = await cache.getManagerSquad();
      if (cached) {
        setData(cached);
        setError('Data source is unavailable. Showing cached data.');
      } else {
        setError('Data source is unavailable. No cached data available.');
      }
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    if (teamId !== null) {
      fetchData();
    } else {
      setData(null);
      setLoading(false);
      setError(null);
    }
  }, [teamId, fetchData]);

  return { data, loading, error, refresh: fetchData };
}
