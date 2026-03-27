import React from 'react';
import { act, create } from 'react-test-renderer';
import type { ManagerSquad } from '../models/squad';
import type { Player } from '../models/player';

const mockSquad: ManagerSquad = {
  teamId: 12345,
  squad: { players: [], budget: 50, freeTransfers: 1, activeChip: null },
  chipStatus: [],
};

const mockBootstrapPlayers: Player[] = [
  {
    id: 1,
    name: 'HAALAND',
    teamId: 10,
    position: 'FWD',
    totalPoints: 150,
    form: 8.5,
    cost: 140,
    ownershipPercentage: 85,
    minutesPlayed: 900,
    news: '',
    chanceOfPlaying: null,
    gameweekPoints: [],
  },
];

const mockGetManagerSquad = jest.fn();
const mockGetManagerPicks = jest.fn();
const mockGetManagerHistory = jest.fn();
const mockGetManagerSquadCache = jest.fn();
const mockSetManagerSquad = jest.fn().mockResolvedValue(undefined);
const mockSetLastRefreshTime = jest.fn().mockResolvedValue(undefined);

jest.mock('../data/fplApiClient', () => ({
  createFplApiClient: () => ({
    getManagerSquad: (...args: unknown[]) => mockGetManagerSquad(...args),
    getManagerPicks: (...args: unknown[]) => mockGetManagerPicks(...args),
    getManagerHistory: (...args: unknown[]) => mockGetManagerHistory(...args),
  }),
}));

jest.mock('../data/localCache', () => ({
  createLocalCache: () => ({
    getManagerSquad: (...args: unknown[]) => mockGetManagerSquadCache(...args),
    setManagerSquad: (...args: unknown[]) => mockSetManagerSquad(...args),
    setLastRefreshTime: (...args: unknown[]) => mockSetLastRefreshTime(...args),
  }),
}));

jest.mock('../data/dataParser', () => ({
  createDataParser: () => ({}),
}));

import { useSquad, UseSquadResult } from '../hooks/useSquad';

function TestComponent({
  teamId,
  bootstrapPlayers,
  currentGameweek,
  onResult,
}: {
  teamId: number | null;
  bootstrapPlayers?: Player[];
  currentGameweek?: number;
  onResult: (r: UseSquadResult) => void;
}) {
  const result = useSquad(teamId, bootstrapPlayers, currentGameweek);
  onResult(result);
  return null;
}

// Raw API responses matching FPL API shape
const mockEntryResponse = {
  id: 12345,
  last_deadline_bank: 50,
  last_deadline_value: 1000,
};

const mockPicksResponse = {
  picks: [
    { element: 1, position: 1, multiplier: 2, is_captain: true, is_vice_captain: false },
  ],
  active_chip: null,
};

const mockHistoryResponse = {
  current: [{ event: 10, points: 55, total_points: 500 }],
  chips: [],
};

describe('useSquad', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSetManagerSquad.mockResolvedValue(undefined);
    mockSetLastRefreshTime.mockResolvedValue(undefined);
  });

  it('fetches composite squad when teamId, players, and gameweek are provided', async () => {
    mockGetManagerSquad.mockResolvedValue(mockEntryResponse);
    mockGetManagerPicks.mockResolvedValue(mockPicksResponse);
    mockGetManagerHistory.mockResolvedValue(mockHistoryResponse);

    let result: UseSquadResult | undefined;
    await act(async () => {
      create(
        React.createElement(TestComponent, {
          teamId: 12345,
          bootstrapPlayers: mockBootstrapPlayers,
          currentGameweek: 10,
          onResult: (r: UseSquadResult) => { result = r; },
        }),
      );
    });

    expect(result!.data).not.toBeNull();
    expect(result!.data!.teamId).toBe(12345);
    expect(result!.data!.squad.players).toHaveLength(1);
    expect(result!.data!.squad.players[0].name).toBe('HAALAND');
    expect(result!.data!.squad.players[0].isCaptain).toBe(true);
    expect(result!.data!.squad.budget).toBe(50);
    expect(result!.loading).toBe(false);
    expect(result!.error).toBeNull();
    expect(mockGetManagerSquad).toHaveBeenCalledWith(12345);
    expect(mockGetManagerPicks).toHaveBeenCalledWith(12345, 10);
    expect(mockGetManagerHistory).toHaveBeenCalledWith(12345);
    expect(mockSetManagerSquad).toHaveBeenCalled();
  });

  it('does not fetch when teamId is null', async () => {
    let result: UseSquadResult | undefined;
    await act(async () => {
      create(
        React.createElement(TestComponent, {
          teamId: null,
          bootstrapPlayers: mockBootstrapPlayers,
          currentGameweek: 10,
          onResult: (r: UseSquadResult) => { result = r; },
        }),
      );
    });

    expect(result!.data).toBeNull();
    expect(result!.loading).toBe(false);
    expect(result!.error).toBeNull();
    expect(mockGetManagerSquad).not.toHaveBeenCalled();
  });

  it('does not fetch when bootstrapPlayers is missing', async () => {
    let result: UseSquadResult | undefined;
    await act(async () => {
      create(
        React.createElement(TestComponent, {
          teamId: 12345,
          currentGameweek: 10,
          onResult: (r: UseSquadResult) => { result = r; },
        }),
      );
    });

    expect(result!.data).toBeNull();
    expect(mockGetManagerSquad).not.toHaveBeenCalled();
  });

  it('does not fetch when currentGameweek is missing', async () => {
    let result: UseSquadResult | undefined;
    await act(async () => {
      create(
        React.createElement(TestComponent, {
          teamId: 12345,
          bootstrapPlayers: mockBootstrapPlayers,
          onResult: (r: UseSquadResult) => { result = r; },
        }),
      );
    });

    expect(result!.data).toBeNull();
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
          bootstrapPlayers: mockBootstrapPlayers,
          currentGameweek: 10,
          onResult: (r: UseSquadResult) => { result = r; },
        }),
      );
    });

    expect(result!.data).toEqual(mockSquad);
    expect(result!.error).toBe('Data source is unavailable. Showing cached data.');
  });

  it('builds chip status from history data', async () => {
    mockGetManagerSquad.mockResolvedValue(mockEntryResponse);
    mockGetManagerPicks.mockResolvedValue(mockPicksResponse);
    mockGetManagerHistory.mockResolvedValue({
      current: [],
      chips: [
        { name: 'wildcard', event: 5 },
        { name: 'bench_boost', event: 8 },
      ],
    });

    let result: UseSquadResult | undefined;
    await act(async () => {
      create(
        React.createElement(TestComponent, {
          teamId: 12345,
          bootstrapPlayers: mockBootstrapPlayers,
          currentGameweek: 10,
          onResult: (r: UseSquadResult) => { result = r; },
        }),
      );
    });

    const chips = result!.data!.chipStatus;
    expect(chips).toHaveLength(4);

    const wildcard = chips.find((c) => c.chipName === 'wildcard');
    expect(wildcard!.used).toBe(true);
    expect(wildcard!.usedGameweek).toBe(5);

    const benchBoost = chips.find((c) => c.chipName === 'bench_boost');
    expect(benchBoost!.used).toBe(true);
    expect(benchBoost!.usedGameweek).toBe(8);

    const freeHit = chips.find((c) => c.chipName === 'free_hit');
    expect(freeHit!.used).toBe(false);
    expect(freeHit!.usedGameweek).toBeNull();
  });
});
