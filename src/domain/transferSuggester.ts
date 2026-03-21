import type {
  Player,
  Position,
  Fixture,
  Squad,
  SquadPlayer,
  TransferSuggestion,
  TransferValidation,
  PriceDirection,
} from '../models';

// --- Scoring Weights ---

const WEIGHTS = {
  form: 0.35,
  fdr: 0.30,
  cost: 0.20,
  ownership: 0.15,
};

const LOOKAHEAD_GWS = 4;

// --- Core Functions ---

/**
 * Calculate a transfer score for a player based on form, upcoming FDR,
 * cost (value for money), and ownership.
 * Higher score = more desirable to bring in.
 */
export function calculateTransferScore(
  player: Player,
  fixtures: Fixture[],
): number {
  const formScore = player.form;

  const avgDifficulty = getAverageUpcomingDifficulty(player.teamId, fixtures);
  // Invert FDR: lower difficulty = higher score. FDR range is 1-5, so (6 - avg) gives 1-5 inverted.
  const fdrScore = avgDifficulty > 0 ? 6 - avgDifficulty : 3;

  // Cost score: cheaper players = better value. Normalise cost (typically 40-130 tenths).
  // Use inverse: higher score for cheaper players relative to their output.
  const costScore = player.totalPoints > 0 ? player.totalPoints / (player.cost / 10) : 0;
  // Normalise cost score to roughly 0-10 range
  const normalisedCostScore = Math.min(costScore, 10);

  // Ownership: higher ownership = more "safe" pick, slight positive signal
  const ownershipScore = player.ownershipPercentage / 10;

  return (
    WEIGHTS.form * formScore +
    WEIGHTS.fdr * fdrScore +
    WEIGHTS.cost * normalisedCostScore +
    WEIGHTS.ownership * ownershipScore
  );
}

/**
 * Suggest players to transfer out from the squad.
 * Identifies underperforming squad players: low form, tough upcoming fixtures.
 */
export function suggestTransfersOut(
  squad: Squad,
  fixtures: Fixture[],
): TransferSuggestion[] {
  const scored = squad.players.map((player) => ({
    player,
    score: calculateTransferScore(player, fixtures),
  }));

  // Sort ascending — lowest score = worst performer = first to transfer out
  scored.sort((a, b) => a.score - b.score);

  return scored.map(({ player, score }) => ({
    playerOut: player,
    playerIn: player, // placeholder — actual replacement found via suggestTransfersIn
    score,
    projectedPointsGain: 0,
    priceChange: 'stable' as PriceDirection,
  }));
}

/**
 * Suggest players to transfer in for a given position and budget.
 * Ranks available players by transfer score, filtered by position and affordability.
 */
export function suggestTransfersIn(
  position: Position,
  budget: number,
  fixtures: Fixture[],
  allPlayers: Player[],
): TransferSuggestion[] {
  const affordable = allPlayers.filter(
    (p) => p.position === position && p.cost <= budget,
  );

  const scored = affordable.map((player) => ({
    player,
    score: calculateTransferScore(player, fixtures),
  }));

  // Sort descending — highest score = best transfer target
  scored.sort((a, b) => b.score - a.score);

  return scored.map(({ player, score }) => ({
    playerOut: null,
    playerIn: player,
    score,
    projectedPointsGain: 0,
    priceChange: 'stable' as PriceDirection,
  }));
}


/**
 * Validate whether a proposed transfer (playerOut → playerIn) would leave
 * the squad in a valid FPL state.
 */
export function validateTransfer(
  squad: Squad,
  playerOut: Player,
  playerIn: Player,
): TransferValidation {
  // Build the hypothetical squad after the transfer
  const newPlayers = squad.players.map((p) =>
    p.id === playerOut.id ? { ...p, ...playerIn, id: playerIn.id } : p,
  );

  // Check max 3 players from one team
  const teamCounts = new Map<number, number>();
  for (const p of newPlayers) {
    teamCounts.set(p.teamId, (teamCounts.get(p.teamId) ?? 0) + 1);
  }
  for (const [, count] of teamCounts) {
    if (count > 3) {
      return { valid: false, reason: 'Exceeds 3-player team limit' };
    }
  }

  // Check valid formation — starters must have min 1 GKP, 3 DEF, 2 MID, 1 FWD
  const starters = newPlayers.filter(
    (p) => !(p as SquadPlayer).isBenched,
  );

  const positionCounts: Record<Position, number> = {
    GKP: 0,
    DEF: 0,
    MID: 0,
    FWD: 0,
  };
  for (const p of starters) {
    positionCounts[p.position]++;
  }

  const MIN_FORMATION: Record<Position, number> = {
    GKP: 1,
    DEF: 3,
    MID: 2,
    FWD: 1,
  };

  for (const pos of Object.keys(MIN_FORMATION) as Position[]) {
    if (positionCounts[pos] < MIN_FORMATION[pos]) {
      return {
        valid: false,
        reason: `Invalid formation: need at least ${MIN_FORMATION[pos]} ${pos}`,
      };
    }
  }

  return { valid: true };
}

/**
 * Project the points gain (or loss) of replacing playerOut with playerIn
 * over the next N gameweeks.
 *
 * Uses form as a per-gameweek estimate: form represents average recent points.
 */
export function projectPointsGain(
  playerOut: Player,
  playerIn: Player,
  gameweeks: number = LOOKAHEAD_GWS,
): number {
  const projectedIn = playerIn.form * gameweeks;
  const projectedOut = playerOut.form * gameweeks;
  return projectedIn - projectedOut;
}

// --- Internal Helpers ---

/**
 * Get the average fixture difficulty for a team over upcoming (unfinished) fixtures.
 * Uses the next LOOKAHEAD_GWS unfinished fixtures for the team.
 */
function getAverageUpcomingDifficulty(
  teamId: number,
  fixtures: Fixture[],
): number {
  const teamFixtures = fixtures
    .filter(
      (f) =>
        !f.finished &&
        (f.homeTeamId === teamId || f.awayTeamId === teamId),
    )
    .sort((a, b) => a.gameweek - b.gameweek)
    .slice(0, LOOKAHEAD_GWS);

  if (teamFixtures.length === 0) return 3; // neutral default

  const totalDifficulty = teamFixtures.reduce((sum, f) => {
    const difficulty =
      f.homeTeamId === teamId ? f.homeTeamDifficulty : f.awayTeamDifficulty;
    return sum + difficulty;
  }, 0);

  return totalDifficulty / teamFixtures.length;
}
