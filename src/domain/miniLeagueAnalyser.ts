import type { Player, MiniLeagueStanding, TemplatePlayer } from '../models';

// --- Public API ---

/**
 * Return mini-league standings sorted by rank (ascending).
 *
 * This is a pure function that operates on already-fetched data.
 * The data layer (FPL API Client) is responsible for fetching.
 */
export function getStandings(
  standings: MiniLeagueStanding[],
): MiniLeagueStanding[] {
  return [...standings].sort((a, b) => a.rank - b.rank);
}

/**
 * Identify template players — those owned by >50% of rivals.
 *
 * Counts how many rival squads contain each player (by id).
 * Any player appearing in more than half the rival squads is
 * flagged as a template player with their league ownership %.
 */
export function identifyTemplatePlayers(
  rivals: MiniLeagueStanding[],
): TemplatePlayer[] {
  if (rivals.length === 0) {
    return [];
  }

  const playerCounts = new Map<number, { player: Player; count: number }>();

  for (const rival of rivals) {
    for (const player of rival.squad) {
      const entry = playerCounts.get(player.id);
      if (entry) {
        entry.count += 1;
      } else {
        playerCounts.set(player.id, { player, count: 1 });
      }
    }
  }

  const totalRivals = rivals.length;
  const threshold = totalRivals / 2; // >50%
  const templatePlayers: TemplatePlayer[] = [];

  for (const { player, count } of playerCounts.values()) {
    if (count > threshold) {
      templatePlayers.push({
        player,
        ownershipInLeague: (count / totalRivals) * 100,
      });
    }
  }

  // Sort by ownership descending for consistent output
  templatePlayers.sort((a, b) => b.ownershipInLeague - a.ownershipInLeague);

  return templatePlayers;
}

/**
 * Flag whether a player is a differential among mini-league rivals.
 *
 * A player is a differential if they are owned by fewer than
 * `threshold`% of rivals. Default concept is <20%.
 */
export function flagDifferential(
  player: Player,
  rivals: MiniLeagueStanding[],
  threshold: number,
): boolean {
  if (rivals.length === 0) {
    return false;
  }

  let ownerCount = 0;
  for (const rival of rivals) {
    if (rival.squad.some((p) => p.id === player.id)) {
      ownerCount += 1;
    }
  }

  const ownershipPercentage = (ownerCount / rivals.length) * 100;
  return ownershipPercentage < threshold;
}

/**
 * Identify the template captain — the player selected as captain
 * by the majority of rivals.
 *
 * Returns the Player object of the most-captained player if they
 * are captained by more than 50% of rivals, or null if no player
 * holds a majority.
 */
export function getTemplateCaptain(
  rivals: MiniLeagueStanding[],
): Player | null {
  if (rivals.length === 0) {
    return null;
  }

  const captainCounts = new Map<number, { player: Player; count: number }>();

  for (const rival of rivals) {
    const captainId = rival.captainId;
    const captain = rival.squad.find((p) => p.id === captainId);
    if (!captain) {
      continue;
    }

    const entry = captainCounts.get(captainId);
    if (entry) {
      entry.count += 1;
    } else {
      captainCounts.set(captainId, { player: captain, count: 1 });
    }
  }

  let bestCaptain: { player: Player; count: number } | null = null;
  for (const entry of captainCounts.values()) {
    if (!bestCaptain || entry.count > bestCaptain.count) {
      bestCaptain = entry;
    }
  }

  if (!bestCaptain) {
    return null;
  }

  // Majority means >50% of rivals
  const majorityThreshold = rivals.length / 2;
  if (bestCaptain.count > majorityThreshold) {
    return bestCaptain.player;
  }

  return null;
}
