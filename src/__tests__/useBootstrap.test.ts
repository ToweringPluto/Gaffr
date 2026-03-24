import React from 'react';
import { act, create } from 'react-test-renderer';
import type { BootstrapStatic } from '../models/bootstrapStatic';

const mockBootstrap: BootstrapStatic = {
  players: [],
  teams: [{ id: 1, name: 'Arsenal', shortName: 'ARS' }],
  gameweeks: [],
  currentGameweek: 31,
};

const mockGetBootstrapStatic = jest.fn();
const mockGetBootstrap = jest.fn();
const mockSetBootstrap = jest.fn().mockResolvedValue(undefined);
const mockSetLastRefreshTime = jest.fn().mockResolvedValue(undefined);

jest.mock('../data/fplApiClient', () => ({
  createFplApiClient: () => ({
    getBootstrapStatic: (...args: unknown[]) => mockGetBootstrapStatic(...args),
  }),
}));

jest.mock('../data/localCache', () => ({
  createLocalCache: () => ({
    getBootstrap: (...args: unknown[]) => mockGetBootstrap(...args),
    setBootstrap: (...args: unknown[]) => mockSetBootstrap(...args),
    setLastRefreshTime: (...args: unknown[]) => mockSetLastRefreshTime(...args),
  }),
}));

import { useBootstrap, UseBootstrapResult } from '../hooks/useBootstrap';

function TestComponent({ onResult }: { onResult: (r: UseBootstrapResult) => void }) {
  const result = useBootstrap();
  onResult(result);
  return null;
}

describe('useBootstrap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSetBootstrap.mockResolvedValue(undefined);
    mockSetLastRefreshTime.mockResolvedValue(undefined);
  });

  it('fetches bootstrap data from API and caches it', async () => {
    mockGetBootstrapStatic.mockResolvedValue(mockBootstrap);

    let result: UseBootstrapResult | undefined;
    await act(async () => {
      create(
        React.createElement(TestComponent, {
          onResult: (r: UseBootstrapResult) => { result = r; },
        }),
      );
    });

    expect(result!.data).toEqual(mockBootstrap);
    expect(result!.loading).toBe(false);
    expect(result!.error).toBeNull();
    expect(mockSetBootstrap).toHaveBeenCalledWith(mockBootstrap);
    expect(mockSetLastRefreshTime).toHaveBeenCalled();
  });

  it('falls back to cache when API fails', async () => {
    mockGetBootstrapStatic.mockRejectedValue(new Error('Network error'));
    mockGetBootstrap.mockResolvedValue(mockBootstrap);

    let result: UseBootstrapResult | undefined;
    await act(async () => {
      create(
        React.createElement(TestComponent, {
          onResult: (r: UseBootstrapResult) => { result = r; },
        }),
      );
    });

    expect(result!.data).toEqual(mockBootstrap);
    expect(result!.loading).toBe(false);
    expect(result!.error).toBe('Data source is unavailable. Showing cached data.');
  });

  it('shows error when API fails and no cache exists', async () => {
    mockGetBootstrapStatic.mockRejectedValue(new Error('Network error'));
    mockGetBootstrap.mockResolvedValue(null);

    let result: UseBootstrapResult | undefined;
    await act(async () => {
      create(
        React.createElement(TestComponent, {
          onResult: (r: UseBootstrapResult) => { result = r; },
        }),
      );
    });

    expect(result!.data).toBeNull();
    expect(result!.loading).toBe(false);
    expect(result!.error).toBe('Data source is unavailable. No cached data available.');
  });
});
