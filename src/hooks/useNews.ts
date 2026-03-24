import { useState, useEffect, useCallback } from 'react';
import type { NewsItem } from '../models/news';
import { createNewsSourceClient } from '../data/newsSourceClient';

const NEWS_BASE_URL = process.env.NEWS_BASE_URL ?? '';
const newsClient = createNewsSourceClient(NEWS_BASE_URL);

export interface UseNewsResult {
  data: NewsItem[] | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useNews(): UseNewsResult {
  const [data, setData] = useState<NewsItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await newsClient.getLatestNews();
      setData(result);
    } catch {
      setData([]);
      setError('News source is unavailable.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refresh: fetchData };
}
