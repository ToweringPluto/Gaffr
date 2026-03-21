import type { NewsItem } from '../models/news';

const TIMEOUT_MS = 10_000;

export interface NewsSourceClient {
  getLatestNews(): Promise<NewsItem[]>;
  getPlayerNews(playerId: number): Promise<NewsItem[]>;
}

export class NewsSourceError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly endpoint?: string,
  ) {
    super(message);
    this.name = 'NewsSourceError';
  }
}

/**
 * Fetch with a 10-second AbortController timeout.
 * Throws NewsSourceError on network failure, timeout, or non-2xx status.
 */
async function fetchWithTimeout(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new NewsSourceError(
        `News source returned ${response.status}`,
        response.status,
        url,
      );
    }

    return await response.json();
  } catch (error: unknown) {
    if (error instanceof NewsSourceError) throw error;

    const message =
      error instanceof DOMException && error.name === 'AbortError'
        ? `News source request timed out after ${TIMEOUT_MS}ms`
        : `News source request failed: ${error instanceof Error ? error.message : String(error)}`;

    throw new NewsSourceError(message, undefined, url);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Creates a NewsSourceClient that fetches from an external news feed.
 *
 * When the source is unreachable (network error, timeout, non-2xx),
 * methods return an empty array instead of throwing — the app continues
 * to function with FPL API news data alone (Requirement 8.5).
 */
export function createNewsSourceClient(baseUrl: string): NewsSourceClient {
  return {
    async getLatestNews(): Promise<NewsItem[]> {
      try {
        return (await fetchWithTimeout(`${baseUrl}/news/latest`)) as NewsItem[];
      } catch {
        return [];
      }
    },

    async getPlayerNews(playerId: number): Promise<NewsItem[]> {
      try {
        return (await fetchWithTimeout(`${baseUrl}/news/player/${playerId}`)) as NewsItem[];
      } catch {
        return [];
      }
    },
  };
}
