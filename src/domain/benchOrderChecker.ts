import type {
  SquadPlayer,
  Fixture,
  NewsItem,
  BenchOrderWarning,
  HighPriorityAlert,
} from '../models';

// --- Local Types ---

export interface BlankBenchPlayer {
  player: SquadPlayer;
  benchOrder: number;
}

// --- Helpers ---

/**
 * Returns true if the player's team has at least one fixture in the given gameweek.
 */
function teamHasFixture(
  teamId: number,
  fixtures: Fixture[],
  gameweek: number,
): boolean {
  return fixtures.some(
    (f) =>
      f.gameweek === gameweek &&
      (f.homeTeamId === teamId || f.awayTeamId === teamId),
  );
}

/**
 * Sort bench players by benchOrder ascending.
 */
function sortByBenchOrder(players: SquadPlayer[]): SquadPlayer[] {
  return [...players].sort((a, b) => a.benchOrder - b.benchOrder);
}

// --- Public API ---

/**
 * Detect bench players whose team has no fixture in the current gameweek.
 * Returns only benched players (benchOrder 1-4) that are blank.
 */
export function detectBlankBenchPlayers(
  bench: SquadPlayer[],
  fixtures: Fixture[],
  gameweek: number,
): BlankBenchPlayer[] {
  return sortByBenchOrder(bench)
    .filter((p) => p.benchOrder >= 1 && !teamHasFixture(p.teamId, fixtures, gameweek))
    .map((p) => ({ player: p, benchOrder: p.benchOrder }));
}

/**
 * Check bench order for warnings: a blank bench player positioned ahead of
 * a playing bench player generates a warning.
 *
 * For each blank bench player, if there exists any playing bench player with
 * a higher benchOrder number (lower priority), a warning is generated.
 */
export function checkBenchOrder(
  bench: SquadPlayer[],
  fixtures: Fixture[],
  gameweek: number,
): BenchOrderWarning[] {
  const sorted = sortByBenchOrder(bench).filter((p) => p.benchOrder >= 1);

  const isBlank = (p: SquadPlayer) => !teamHasFixture(p.teamId, fixtures, gameweek);

  const warnings: BenchOrderWarning[] = [];

  for (let i = 0; i < sorted.length; i++) {
    if (!isBlank(sorted[i])) continue;

    // Look for any playing player behind this blank player
    for (let j = i + 1; j < sorted.length; j++) {
      if (!isBlank(sorted[j])) {
        warnings.push({
          blankPlayer: sorted[i],
          blockingPosition: sorted[i].benchOrder,
          playingPlayerBehind: sorted[j],
        });
        // One warning per blank player — pair with the first playing player behind
        break;
      }
    }
  }

  return warnings;
}

/**
 * Suggest a corrected bench order: playing bench players first (maintaining
 * their relative order), then blank bench players (maintaining their relative order).
 * Returns a new array with updated benchOrder values (1-based).
 */
export function suggestCorrectedOrder(
  bench: SquadPlayer[],
  fixtures: Fixture[],
  gameweek: number,
): SquadPlayer[] {
  const sorted = sortByBenchOrder(bench).filter((p) => p.benchOrder >= 1);

  const playing = sorted.filter((p) => teamHasFixture(p.teamId, fixtures, gameweek));
  const blank = sorted.filter((p) => !teamHasFixture(p.teamId, fixtures, gameweek));

  const corrected = [...playing, ...blank];

  return corrected.map((p, idx) => ({
    ...p,
    benchOrder: idx + 1,
  }));
}

/**
 * Check if any starting player with an injury doubt has a blank bench player
 * as their first eligible bench replacement.
 *
 * A starter has an injury doubt when chanceOfPlaying is not null and < 75.
 * The first eligible bench replacement is the bench player with the lowest
 * benchOrder whose position allows a valid formation substitution.
 *
 * Simplified eligibility: any outfield bench player can replace any outfield
 * starter, and a GKP can only be replaced by a GKP. This mirrors FPL's
 * auto-sub rules where formation validity is checked but the primary constraint
 * is position compatibility for GKP.
 */
export function checkStarterInjuryRisk(
  starters: SquadPlayer[],
  bench: SquadPlayer[],
  _news: NewsItem[],
  fixtures: Fixture[],
  gameweek: number,
): HighPriorityAlert[] {
  const sortedBench = sortByBenchOrder(bench).filter((p) => p.benchOrder >= 1);
  const alerts: HighPriorityAlert[] = [];

  const injuredStarters = starters.filter(
    (s) => s.chanceOfPlaying !== null && s.chanceOfPlaying < 75,
  );

  for (const starter of injuredStarters) {
    // Find first eligible bench replacement
    const replacement = findFirstEligibleReplacement(starter, sortedBench);

    if (replacement && !teamHasFixture(replacement.teamId, fixtures, gameweek)) {
      alerts.push({
        starter,
        benchReplacement: replacement,
        reason: `${starter.name} (${starter.chanceOfPlaying}% chance) would be replaced by ${replacement.name} who has no fixture in GW${gameweek}`,
      });
    }
  }

  return alerts;
}

/**
 * Find the first eligible bench replacement for a starter.
 * GKP can only be replaced by GKP (bench position 1 is typically GKP).
 * Outfield players can be replaced by any outfield bench player.
 */
function findFirstEligibleReplacement(
  starter: SquadPlayer,
  sortedBench: SquadPlayer[],
): SquadPlayer | undefined {
  if (starter.position === 'GKP') {
    return sortedBench.find((b) => b.position === 'GKP');
  }
  // Outfield starter — any outfield bench player is eligible
  return sortedBench.find((b) => b.position !== 'GKP');
}
