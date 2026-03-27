import { useState, useEffect, useCallback } from 'react';
import type { ManagerSquad, SquadPlayer, ChipStatus } from '../models/squad';
import type { Player } from '../models/player';
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

/**
 * Build a ManagerSquad by combining data from multiple FPL API endpoints:
 * - /entry/{id}/             → budget, free transfers
 * - /entry/{id}/event/{gw}/picks/ → squad picks (player IDs, captain, bench)
 * - /entry/{id}/history/     → chips used
 * - bootstrap players        → player details (name, team, form, etc.)
 */
async function fetchCompositeSquad(
  teamId: number,
  bootstrapPlayers: Player[],
  currentGameweek: number,
): Promise<ManagerSquad> {
  // Fetch all needed data in parallel
  // Fetch raw JSON from all endpoints in parallel — cast through unknown
  // because the API client types don't match the raw response shape
  const [entry, picks, history] = await Promise.all([
    apiClient.getManagerSquad(teamId) as unknown as Record<string, unknown>,
    apiClient.getManagerPicks(teamId, currentGameweek) as unknown as Record<string, unknown>,
    apiClient.getManagerHistory(teamId) as unknown as Record<string, unknown>,
  ]);

  // Build a player lookup from bootstrap data
  const playerMap = new Map<number, Player>();
  for (const p of bootstrapPlayers) {
    playerMap.set(p.id, p);
  }

  // Parse picks into SquadPlayer objects
  const rawPicks = Array.isArray(picks.picks) ? picks.picks : [];
  const squadPlayers: SquadPlayer[] = rawPicks.map((pick: Record<string, unknown>, index: number) => {
    const playerId = Number(pick.element ?? pick.playerId ?? 0);
    const bootstrapPlayer = playerMap.get(playerId);
    const multiplier = Number(pick.multiplier ?? 0);

    return {
      id: playerId,
      name: bootstrapPlayer?.name ?? `Player ${playerId}`,
      teamId: bootstrapPlayer?.teamId ?? 0,
      position: bootstrapPlayer?.position ?? 'MID',
      totalPoints: bootstrapPlayer?.totalPoints ?? 0,
      form: bootstrapPlayer?.form ?? 0,
      cost: bootstrapPlayer?.cost ?? 0,
      ownershipPercentage: bootstrapPlayer?.ownershipPercentage ?? 0,
      minutesPlayed: bootstrapPlayer?.minutesPlayed ?? 0,
      news: bootstrapPlayer?.news ?? '',
      chanceOfPlaying: bootstrapPlayer?.chanceOfPlaying ?? null,
      gameweekPoints: bootstrapPlayer?.gameweekPoints ?? [],
      isCaptain: Boolean(pick.is_captain ?? pick.isCaptain),
      isViceCaptain: Boolean(pick.is_vice_captain ?? pick.isViceCaptain),
      isBenched: multiplier === 0,
      benchOrder: multiplier === 0 ? (index - 10) : 0, // Picks 12-15 are bench (0-indexed 11-14)
      sellingPrice: Number(pick.selling_price ?? pick.sellingPrice ?? bootstrapPlayer?.cost ?? 0),
    };
  });

  // Parse budget from entry data
  const budget = Number(entry.last_deadline_bank ?? entry.bank ?? 0);

  // Parse transfers info
  // Free transfers: not directly available from API, default to 1
  // (the API doesn't expose this directly; we approximate)
  const freeTransfers = 1;

  // Parse active chip
  const activeChip = picks.active_chip != null
    ? String(picks.active_chip)
    : null;

  // Parse chip status from history
  const rawChips = Array.isArray(history.chips) ? history.chips : [];
  const CHIP_NAMES: ChipStatus['chipName'][] = ['bench_boost', 'triple_captain', 'free_hit', 'wildcard'];
  const usedChips = new Set(rawChips.map((c: Record<string, unknown>) => String(c.name)));
  const chipStatus: ChipStatus[] = CHIP_NAMES.map((chipName) => {
    const chipEntry = rawChips.find((c: Record<string, unknown>) => String(c.name) === chipName) as Record<string, unknown> | undefined;
    return {
      chipName,
      used: usedChips.has(chipName),
      usedGameweek: chipEntry ? Number(chipEntry.event ?? 0) : null,
    };
  });

  return {
    teamId,
    squad: {
      players: squadPlayers,
      budget,
      freeTransfers,
      activeChip,
    },
    chipStatus,
  };
}

export function useSquad(
  teamId: number | null,
  bootstrapPlayers?: Player[],
  currentGameweek?: number,
): UseSquadResult {
  const [data, setData] = useState<ManagerSquad | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (teamId === null || !bootstrapPlayers || !currentGameweek) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchCompositeSquad(teamId, bootstrapPlayers, currentGameweek);
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
  }, [teamId, bootstrapPlayers, currentGameweek]);

  useEffect(() => {
    if (teamId !== null && bootstrapPlayers && currentGameweek) {
      fetchData();
    } else if (teamId === null) {
      setData(null);
      setLoading(false);
      setError(null);
    }
  }, [teamId, bootstrapPlayers, currentGameweek, fetchData]);

  return { data, loading, error, refresh: fetchData };
}
