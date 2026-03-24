import React from 'react';
import { act, create } from 'react-test-renderer';
import type { NewsItem } from '../models/news';

const mockNews: NewsItem[] = [
  {
    playerId: 1,
    playerName: 'Haaland',
    content: 'Fit to play',
    severity: 'available',
    source: 'external',
    timestamp: '2025-04-05T12:00:00Z',
  },
];

const mockGetLatestNews = jest.fn();

jest.mock('../data/newsSourceClient', () => ({
  createNewsSourceClient: () => ({
    getLatestNews: (...args: unknown[]) => mockGetLatestNews(...args),
  }),
}));

import { useNews, UseNewsResult } from '../hooks/useNews';

function TestComponent({ onResult }: { onResult: (r: UseNewsResult) => void }) {
  const result = useNews();
  onResult(result);
  return null;
}

describe('useNews', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches news from news source client', async () => {
    mockGetLatestNews.mockResolvedValue(mockNews);

    let result: UseNewsResult | undefined;
    await act(async () => {
      create(
        React.createElement(TestComponent, {
          onResult: (r: UseNewsResult) => { result = r; },
        }),
      );
    });

    expect(result!.data).toEqual(mockNews);
    expect(result!.loading).toBe(false);
    expect(result!.error).toBeNull();
  });

  it('returns empty array when news source fails', async () => {
    mockGetLatestNews.mockRejectedValue(new Error('Network error'));

    let result: UseNewsResult | undefined;
    await act(async () => {
      create(
        React.createElement(TestComponent, {
          onResult: (r: UseNewsResult) => { result = r; },
        }),
      );
    });

    expect(result!.data).toEqual([]);
    expect(result!.error).toBe('News source is unavailable.');
  });
});
