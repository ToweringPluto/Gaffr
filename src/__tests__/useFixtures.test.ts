import React from 'react';
import { act, create } from 'react-test-renderer';
import type { Fixture } from '../models/fixture';

const mockFixtures: Fixture[] = [
  {
    id: 1, gameweek: 31, homeTeamId: 1, awayTeamId: 2,
    homeTeamDifficulty: 3, awayTeamDifficulty: 3,
    kickoffTime: '2025-04-05T15:00:00Z', finished: false,
  },
];

const mockGetFixturesApi = jest.fn();
const mockGetFixturesCache = jest.fn();
const mockSetFixtures = jest.fn().mockResolvedValue(undefined);
const mockSetLastRefreshTime = jest.fn().mockResolvedValue(undefined);

jest.mock('../data/fplApiClient', () => ({
  createFplApiClient: () => ({
    getFixtures: (...args: unknown[]) => mockGetFixturesApi(...args),
  }),
}));

jest.mock('../data/localCache', () => ({
  createLocalCache: () => ({
    getFixtures: (...args: unknown[]) => mockGetFixturesCache(...args),
    setFixtures: (...args: unknown[]) => mockSetFixtures(...args),
    setLastRefreshTime: (...args: unknown[]) => mockSetLastRefreshTime(...args),
  }),
}));

import { useFixtures, UseFixturesResult } from '../hooks/useFixtures';

function TestComponent({ onResult }: { onResult: (r: UseFixturesResult) => void }) {
  const result = useFixtures();
  onResult(result);
  return null;
}

describe('useFixtures', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSetFixtures.mockResolvedValue(undefined);
    mockSetLastRefreshTime.mockResolvedValue(undefined);
  });

  it('fetches fixtures from API and caches them', async () => {
    mockGetFixturesApi.mockResolvedValue(mockFixtures);

    let result: UseFixturesResult | undefined;
    await act(async () => {
      create(
        React.createElement(TestComponent, {
          onResult: (r: UseFixturesResult) => { result = r; },
        }),
      );
    });

    expect(result!.data).toEqual(mockFixtures);
    expect(result!.loading).toBe(false);
    expect(result!.error).toBeNull();
    expect(mockSetFixtures).toHaveBeenCalledWith(mockFixtures);
  });

  it('falls back to cache when API fails', async () => {
    mockGetFixturesApi.mockRejectedValue(new Error('Network error'));
    mockGetFixturesCache.mockResolvedValue(mockFixtures);

    let result: UseFixturesResult | undefined;
    await act(async () => {
      create(
        React.createElement(TestComponent, {
          onResult: (r: UseFixturesResult) => { result = r; },
        }),
      );
    });

    expect(result!.data).toEqual(mockFixtures);
    expect(result!.error).toBe('Data source is unavailable. Showing cached data.');
  });

  it('shows error when API fails and no cache exists', async () => {
    mockGetFixturesApi.mockRejectedValue(new Error('Network error'));
    mockGetFixturesCache.mockResolvedValue(null);

    let result: UseFixturesResult | undefined;
    await act(async () => {
      create(
        React.createElement(TestComponent, {
          onResult: (r: UseFixturesResult) => { result = r; },
        }),
      );
    });

    expect(result!.data).toBeNull();
    expect(result!.error).toBe('Data source is unavailable. No cached data available.');
  });
});
