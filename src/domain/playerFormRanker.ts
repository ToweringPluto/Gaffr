import type {
  Player,
  RankedPlayer,
  Position,
  FormTrend,
  GameweekPoints,
} from '../models';

/**
 * Calculate the average points over the last N gameweeks for a player.
 * Gameweek points are assumed to be ordered by gameweek ascending.
 */
function averageLastN(gameweekPoints: GameweekPoints[], n: number): number {
  if (gameweekPoints.length === 0 || n <= 0) return 0;
  const recent = gameweekPoints.slice(-n);
  if (recent.length === 0) return 0;
  return recent.reduce((sum, gw) => sum + gw.points, 0) / recent.length;
}

/**
 * Rank players by form over the last `gameweekWindow` gameweeks.
 * Returns a list sorted in non-increasing form order with rank and trend assigned.
 */
export function rankByForm(
  players: Player[],
  gameweekWindow: number = 4,
): RankedPlayer[] {
  const scored = players.map((player) => {
    const recentGws = player.gameweekPoints.slice(-gameweekWindow);
    const formScore =
      recentGws.length > 0
        ? recentGws.reduce((sum, gw) => sum + gw.points, 0) / recentGws.length
        : 0;

    return {
      player,
      formScore,
    };
  });

  scored.sort((a, b) => b.formScore - a.formScore);

  return scored.map((entry, index) => ({
    ...entry.player,
    rank: index + 1,
    formTrend: getFormTrend(entry.player),
  }));
}

/**
 * Filter ranked players by position.
 * Returns only players matching the given position — no player matching is excluded.
 */
export function filterByPosition(
  players: RankedPlayer[],
  position: Position,
): RankedPlayer[] {
  return players.filter((p) => p.position === position);
}

/**
 * Filter ranked players by price range [min, max] inclusive.
 * Cost is in tenths (e.g. 100 = £10.0m).
 */
export function filterByPrice(
  players: RankedPlayer[],
  min: number,
  max: number,
): RankedPlayer[] {
  return players.filter((p) => p.cost >= min && p.cost <= max);
}

/**
 * Determine a player's form trend by comparing the average of the last 2
 * gameweeks against the average of the 2 gameweeks before that.
 * - 'rising' if last2 > prev2
 * - 'falling' if last2 < prev2
 * - 'stable' otherwise (equal, or insufficient data)
 */
export function getFormTrend(player: Player): FormTrend {
  const gws = player.gameweekPoints;
  if (gws.length < 4) return 'stable';

  const last2Avg = averageLastN(gws, 2);
  // Previous 2 = the 2 gameweeks before the last 2
  const prev2 = gws.slice(-(4), -(2));
  const prev2Avg =
    prev2.length > 0
      ? prev2.reduce((sum, gw) => sum + gw.points, 0) / prev2.length
      : 0;

  if (last2Avg > prev2Avg) return 'rising';
  if (last2Avg < prev2Avg) return 'falling';
  return 'stable';
}

/**
 * Get a gameweek-by-gameweek points breakdown for the last N gameweeks.
 * Returns the most recent `gameweeks` entries, ordered by gameweek ascending.
 */
export function getGameweekBreakdown(
  player: Player,
  gameweeks: number = 10,
): GameweekPoints[] {
  return player.gameweekPoints.slice(-gameweeks);
}
