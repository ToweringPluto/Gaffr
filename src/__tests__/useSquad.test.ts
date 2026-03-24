import React from 'react';
import { act, create } from 'react-test-renderer';
import type { ManagerSquad } from '../models/squad';

const mockSquad: ManagerSquad = {
  teamId: 12345,
  squad: { players: [], budget: 50, freeTransfers: 1, activeChip: null },
  chipStatus: [],
};

const mockGetManagerSquad = jest.fn();
const mockGetManagerSquadCache = jest.fn();
const mockSetManagerSquad = jest.fn().mockResolvedValue(undefined);
const mockSetLastRefreshTime = jest.fn().mockResolvedValue(undefined);

jest.mock('../data/fplApiClient', () => ({
  createFplApiClient: () => ({
    getManagerSquad: (...args: unknown[]) => mockGetManagerSquad(...args),
  }),
}));

jest.mock('../data/localCache', () => ({
  createLocalCache: () => ({
    getManagerSquad: (...args: unknown[]) => mockGetManagerSquadCache(...args),
    setManagerSquad: (...args: unknown[]) => mockSetManagerSquad(...args),
    setLastRefreshTime: (...args: unknown[]) => mockSetLastRefreshTime(...args),
  }),
}));

import { useSquad, UseSquadResult } from '../hooks/useSquad';

function TestComponent({ teamId, onResult }: { teamId: number | null; onResult: (r: UseSquadResult) => void }) {
  const result = useSquad(teamId);
  onResult(result);
  return null;
}

describe('useSquad', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSetManagerSquad.mockResolvedValue(undefined);
    mockSetLastRefreshTime.mockResolvedValue(undefined);
  });

  it('fetches squad from API when teamId is provided', async () => {
    mockGetManagerSquad.mockResolvedValue(mockSquad);

    let result: UseSquadResult | undefined;
    await act(async () => {
      create(
        React.createElement(TestComponent, {
          teamId: 12345,
          onResult: (r: UseSquadResult) => { result = r; },
        }),
      );
    });

    expect(result!.data).toEqual(mockSquad);
    expect(result!.loading).toBe(false);
    expect(result!.error).toBeNull();
    expect(mockGetManagerSquad).toHaveBeenCalledWith(12345);
    expect(mockSetManagerSquad).toHaveBeenCalledWith(mockSquad);
  });

  it('does not fetch when teamId is null', async () => {
    let result: UseSquadResult | undefined;
    await act(async () => {
      create(
        React.createElement(TestComponent, {
          teamId: null,
          onResult: (r: UseSquadResult) => { result = r; },
        }),
      );
    });

    expect(result!.data).toBeNull();
    expect(result!.loading).toBe(false);
    expect(result!.error).toBeNull();
    expect(mockGetManagerSquad).not.toHaveBeenCalled();
  });

  it('falls back to cache when API fails', async () => {
    mockGetManagerSquad.mockRejectedValue(new Error('Network error'));
    mockGetManagerSquadCache.mockResolvedValue(mockSquad);

    let result: UseSquadResult | undefined;
    await act(async () => {
      create(
        React.createElement(TestComponent, {
          teamId: 12345,
          onResult: (r: UseSquadResult) => { result = r; },
        }),
      );
    });

    expect(result!.data).toEqual(mockSquad);
    expect(result!.error).toBe('Data source is unavailable. Showing cached data.');
  });
});
