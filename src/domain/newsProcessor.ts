import type { NewsItem, NewsSeverity, SquadPlayer } from '../models';

// --- Severity Mapping ---

/**
 * Map a player's chanceOfPlaying value to a NewsSeverity.
 *
 * 100       → 'available'
 * 75        → 'doubtful_75'
 * 50        → 'doubtful_50'
 * 25        → 'doubtful_25'
 * 0 or null → 'injured_suspended' (when the player has an injury flag / news)
 * null with no injury context → 'available' (FPL default: null means no news)
 */
export function categoriseSeverity(
  chanceOfPlaying: number | null,
  hasInjuryFlag: boolean = false,
): NewsSeverity {
  if (chanceOfPlaying === null) {
    return hasInjuryFlag ? 'injured_suspended' : 'available';
  }
  if (chanceOfPlaying >= 100) return 'available';
  if (chanceOfPlaying >= 75) return 'doubtful_75';
  if (chanceOfPlaying >= 50) return 'doubtful_50';
  if (chanceOfPlaying >= 25) return 'doubtful_25';
  return 'injured_suspended';
}

// --- Severity Priority (lower = more urgent) ---

const SEVERITY_PRIORITY: Record<NewsSeverity, number> = {
  injured_suspended: 0,
  doubtful_25: 1,
  doubtful_50: 2,
  doubtful_75: 3,
  available: 4,
};

// --- Squad Injury Notifications ---

export interface SquadInjuryNotification {
  player: SquadPlayer;
  severity: NewsSeverity;
  chanceOfPlaying: number | null;
}

/**
 * Generate dashboard notifications for squad players with chanceOfPlaying < 75.
 */
export function generateSquadInjuryNotifications(
  squadPlayers: SquadPlayer[],
): SquadInjuryNotification[] {
  return squadPlayers
    .filter((p) => p.chanceOfPlaying !== null && p.chanceOfPlaying < 75)
    .map((p) => ({
      player: p,
      severity: categoriseSeverity(p.chanceOfPlaying, true),
      chanceOfPlaying: p.chanceOfPlaying,
    }))
    .sort(
      (a, b) =>
        SEVERITY_PRIORITY[a.severity] - SEVERITY_PRIORITY[b.severity],
    );
}

// --- News Priority Sorting ---

/**
 * Sort news items by priority.
 *
 * Ordering rules:
 * 1. Squad injury news first (player is in squad AND severity is not 'available')
 * 2. Within each group, sort by severity (most urgent first)
 * 3. Within same severity, sort by timestamp descending (most recent first)
 */
export function sortNewsByPriority(
  newsItems: NewsItem[],
  squadPlayerIds: Set<number>,
): NewsItem[] {
  return [...newsItems].sort((a, b) => {
    const aIsSquadInjury =
      squadPlayerIds.has(a.playerId) && a.severity !== 'available';
    const bIsSquadInjury =
      squadPlayerIds.has(b.playerId) && b.severity !== 'available';

    // Squad injury news comes first
    if (aIsSquadInjury && !bIsSquadInjury) return -1;
    if (!aIsSquadInjury && bIsSquadInjury) return 1;

    // Within same group, sort by severity (most urgent first)
    const severityDiff =
      SEVERITY_PRIORITY[a.severity] - SEVERITY_PRIORITY[b.severity];
    if (severityDiff !== 0) return severityDiff;

    // Within same severity, most recent first
    return b.timestamp.localeCompare(a.timestamp);
  });
}

/**
 * Build a set of squad player IDs for use with sortNewsByPriority.
 */
export function getSquadPlayerIds(squadPlayers: SquadPlayer[]): Set<number> {
  return new Set(squadPlayers.map((p) => p.id));
}

/**
 * Attach press conference speaker info to a news item.
 */
export function createPressConferenceNewsItem(
  playerId: number,
  playerName: string,
  quote: string,
  speakerName: string,
  timestamp: string,
  chanceOfPlaying: number | null,
  hasInjuryFlag: boolean = false,
): NewsItem {
  return {
    playerId,
    playerName,
    content: quote,
    severity: categoriseSeverity(chanceOfPlaying, hasInjuryFlag),
    source: 'external',
    timestamp,
    speakerName,
  };
}
