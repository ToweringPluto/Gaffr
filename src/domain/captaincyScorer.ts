import type {
  Player,
  Squad,
  Fixture,
  SquadPlayer,
  CaptainCandidate,
  H2HRecord,
  FixtureDetail,
} from '../models';
import type { NewsItem } from '../models';

// --- Scoring Weights ---

const WEIGHTS = {
  form: 0.35,
  fdr: 0.30,
  homeAway: 0.15,
  h2h: 0.20,
};

/** Multiplier applied to captaincy score when the player has a DGW fixture. */
const DGW_BOOST_MULTIPLIER = 1.5;

/** Multiplier applied to captaincy score when the player has fixture congestion. */
const CONGESTION_PENALTY_MULTIPLIER = 0.8;

// --- Core Functions ---

/**
 * Rank captaincy candidates from the manager's squad.
 * Returns the top 5 candidates in non-increasing captaincy score order.
 * All candidates are members of the squad.
 *
 * Top 5 captaincy candidates from the Manager's current Squad.
 * Weighted combination of form, FDR, home/away, H2H.
 * Display score, fixture, FDR, form, H2H summary.
 * DGW boost.
 * Injury/rotation risk warning.
 * Fixture congestion rotation risk warning.
 */
export function rankCaptainCandidates(
  squad: Squad,
  fixtures: Fixture[],
  news: NewsItem[],
  h2hRecords: H2HRecord[] = [],
  congestionTeamIds: number[] = [],
): CaptainCandidate[] {
  const starters = squad.players.filter((p) => !p.isBenched);

  const candidates: CaptainCandidate[] = starters.map((player) => {
    const fixtureDetail = getNextFixtureDetail(player.teamId, fixtures);
    const fdr = fixtureDetail.difficulty;
    const h2h = findH2HRecord(player.id, fixtureDetail, h2hRecords);

    let score = calculateCaptaincyScore(player, fixtureDetail, h2h);
    score = applyDgwBoost(score, fixtureDetail.isDgw);

    const hasCongestion = congestionTeamIds.includes(player.teamId);
    score = applyRotationPenalty(score, hasCongestion);

    const hasInjuryRisk = checkInjuryRisk(player, news);

    return {
      player,
      captaincyScore: score,
      fixture: fixtureDetail,
      fdr,
      formValue: player.form,
      h2hSummary: formatH2HSummary(h2h),
      isDgw: fixtureDetail.isDgw,
      hasInjuryRisk,
      hasCongestionRisk: hasCongestion,
    };
  });

  // Sort non-increasing by captaincy score.
  // Tie-break: total season points desc, then player ID asc for determinism.
  candidates.sort((a, b) => {
    if (b.captaincyScore !== a.captaincyScore) {
      return b.captaincyScore - a.captaincyScore;
    }
    if (b.player.totalPoints !== a.player.totalPoints) {
      return b.player.totalPoints - a.player.totalPoints;
    }
    return a.player.id - b.player.id;
  });

  return candidates.slice(0, 5);
}


/**
 * Calculate the captaincy score for a player given their upcoming fixture
 * and head-to-head record against the opponent.
 */
export function calculateCaptaincyScore(
  player: Player,
  fixture: FixtureDetail,
  h2h: H2HRecord | null,
): number {
  const formScore = player.form;

  // Invert FDR: lower difficulty = higher score. FDR 1-5 → score 5-1.
  const fdrScore = fixture.difficulty > 0 ? 6 - fixture.difficulty : 3;

  // Home advantage: home = 1.2, away = 0.8
  const homeAwayScore = fixture.isHome ? 1.2 : 0.8;

  // H2H: use average points against this opponent, default to 0
  const h2hScore = h2h ? h2h.averagePoints : 0;

  return (
    WEIGHTS.form * formScore +
    WEIGHTS.fdr * fdrScore +
    WEIGHTS.homeAway * homeAwayScore +
    WEIGHTS.h2h * h2hScore
  );
}

/**
 * Apply a DGW boost to a captaincy score.
 * When the player has a double gameweek, the score is multiplied by the
 * DGW boost multiplier, making it strictly greater than the non-DGW score.
 */
export function applyDgwBoost(score: number, isDgw: boolean): number {
  if (!isDgw) return score;
  return score * DGW_BOOST_MULTIPLIER;
}

/**
 * Apply a rotation penalty to a captaincy score when the player has
 * fixture congestion (European/cup fixture within 72 hours).
 */
export function applyRotationPenalty(
  score: number,
  hasCongestion: boolean,
): number {
  if (!hasCongestion) return score;
  return score * CONGESTION_PENALTY_MULTIPLIER;
}

/**
 * Recommend a vice captain from the squad.
 * The vice captain is the candidate with the highest captaincy score
 * who is a different player from the captain (first in the list).
 */
export function recommendViceCaptain(
  candidates: CaptainCandidate[],
): CaptainCandidate | null {
  if (candidates.length < 2) return null;
  // candidates[0] is the captain; candidates[1] is the vice captain
  return candidates[1];
}

// --- Internal Helpers ---

/**
 * Get the next unfinished fixture detail for a team.
 * Returns a default BGW-style detail if no upcoming fixture is found.
 */
function getNextFixtureDetail(
  teamId: number,
  fixtures: Fixture[],
): FixtureDetail {
  const teamFixtures = fixtures
    .filter(
      (f) =>
        !f.finished &&
        (f.homeTeamId === teamId || f.awayTeamId === teamId),
    )
    .sort((a, b) => a.gameweek - b.gameweek);

  if (teamFixtures.length === 0) {
    return {
      gameweek: 0,
      opponent: 'N/A',
      isHome: false,
      difficulty: 3,
      isBgw: true,
      isDgw: false,
    };
  }

  const nextGw = teamFixtures[0].gameweek;
  const gwFixtures = teamFixtures.filter((f) => f.gameweek === nextGw);
  const isDgw = gwFixtures.length >= 2;
  const f = gwFixtures[0];
  const isHome = f.homeTeamId === teamId;
  const opponentId = isHome ? f.awayTeamId : f.homeTeamId;

  return {
    gameweek: f.gameweek,
    opponent: `T${opponentId}`,
    isHome,
    difficulty: isHome ? f.homeTeamDifficulty : f.awayTeamDifficulty,
    isBgw: false,
    isDgw,
  };
}

/**
 * Find the H2H record for a player against the opponent in the upcoming fixture.
 */
function findH2HRecord(
  playerId: number,
  fixture: FixtureDetail,
  h2hRecords: H2HRecord[],
): H2HRecord | null {
  // Parse opponent team ID from the fixture detail opponent string (e.g. "T5")
  const opponentMatch = fixture.opponent.match(/^T(\d+)$/);
  if (!opponentMatch) return null;
  const opponentTeamId = parseInt(opponentMatch[1], 10);

  return (
    h2hRecords.find(
      (r) => r.playerId === playerId && r.opponentTeamId === opponentTeamId,
    ) ?? null
  );
}

/**
 * Check if a player has injury risk based on news data.
 * A player has injury risk if their chanceOfPlaying is less than 75,
 * or if there's a news item indicating injury/doubt.
 */
function checkInjuryRisk(player: Player, news: NewsItem[]): boolean {
  if (
    player.chanceOfPlaying !== null &&
    player.chanceOfPlaying !== undefined &&
    player.chanceOfPlaying < 75
  ) {
    return true;
  }

  // Check news items for this player with injury/doubt severity
  return news.some(
    (n) =>
      n.playerId === player.id &&
      (n.severity === 'injured_suspended' ||
        n.severity === 'doubtful_25' ||
        n.severity === 'doubtful_50'),
  );
}

/**
 * Format an H2H record into a human-readable summary string.
 */
function formatH2HSummary(h2h: H2HRecord | null): string {
  if (!h2h || h2h.matchesPlayed === 0) return 'No H2H data';
  return `${h2h.matchesPlayed} matches, avg ${h2h.averagePoints.toFixed(1)} pts`;
}
