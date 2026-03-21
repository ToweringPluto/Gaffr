import type {
  Fixture,
  FixturesByTeam,
  FixtureDetail,
  BlankGameweek,
  DoubleGameweek,
  TeamSchedule,
} from '../models';
import type { Team } from '../models';

// --- FDR Colour Mapping ---

export interface FdrColour {
  background: string;
  borderText: string;
}

const FDR_COLOUR_MAP: Record<number, FdrColour> = {
  1: { background: '#0a2a0a', borderText: '#39ff14' },
  2: { background: '#0f2a0a', borderText: '#88e848' },
  3: { background: '#2a2a00', borderText: '#e8c832' },
  4: { background: '#2a1400', borderText: '#e87832' },
  5: { background: '#2a0a0a', borderText: '#e84848' },
};

export const BGW_COLOUR: FdrColour = { background: '#1a0a0a', borderText: '#e84848' };
export const DGW_COLOUR: FdrColour = { background: '#0a1a2a', borderText: '#39ff14' };

export function getFdrColour(fdr: number): FdrColour {
  const colour = FDR_COLOUR_MAP[fdr];
  if (!colour) {
    // Default to FDR 3 (neutral) for out-of-range values
    return FDR_COLOUR_MAP[3];
  }
  return colour;
}

export function getSpecialGameweekColour(type: 'bgw' | 'dgw'): FdrColour {
  return type === 'bgw' ? BGW_COLOUR : DGW_COLOUR;
}

// --- Fixture Analysis Functions ---

/**
 * Get upcoming fixtures for the next N gameweeks, grouped by team.
 * Pure function — takes all data as parameters.
 */
export function getUpcomingFixtures(
  fixtures: Fixture[],
  teams: Team[],
  currentGameweek: number,
  gameweeks: number,
): FixturesByTeam[] {
  const teamMap = new Map<number, Team>(teams.map((t) => [t.id, t]));
  const startGw = currentGameweek;
  const endGw = currentGameweek + gameweeks - 1;

  const relevantFixtures = fixtures.filter(
    (f) => f.gameweek >= startGw && f.gameweek <= endGw,
  );

  const result: FixturesByTeam[] = [];

  for (const team of teams) {
    const teamFixtures = buildFixtureDetailsForTeam(
      team.id,
      relevantFixtures,
      teamMap,
      startGw,
      endGw,
    );

    const cumulativeDifficulty = teamFixtures.reduce(
      (sum, f) => sum + f.difficulty,
      0,
    );

    result.push({
      teamId: team.id,
      teamName: team.name,
      fixtures: teamFixtures,
      cumulativeDifficulty,
    });
  }

  return result;
}

/**
 * Get a single team's full fixture schedule.
 * Pure function — takes all data as parameters.
 */
export function getTeamFixtureSchedule(
  teamId: number,
  fixtures: Fixture[],
  teams: Team[],
): TeamSchedule {
  const teamMap = new Map<number, Team>(teams.map((t) => [t.id, t]));
  const team = teamMap.get(teamId);

  const teamFixtures = buildFixtureDetailsForTeam(
    teamId,
    fixtures,
    teamMap,
  );

  return {
    teamId,
    teamName: team?.name ?? `Team ${teamId}`,
    fixtures: teamFixtures,
  };
}

/**
 * Sort teams by cumulative fixture difficulty (ascending — easiest first).
 */
export function sortTeamsByDifficulty(
  fixturesByTeam: FixturesByTeam[],
): FixturesByTeam[] {
  return [...fixturesByTeam].sort(
    (a, b) => a.cumulativeDifficulty - b.cumulativeDifficulty,
  );
}

/**
 * Detect blank gameweeks — gameweeks where a team has zero fixtures.
 * Requires allTeamIds to know which teams to check for absence.
 */
export function detectBlankGameweeks(
  fixtures: Fixture[],
  allTeamIds: number[],
): BlankGameweek[] {
  const gameweekTeams = new Map<number, Set<number>>();

  for (const f of fixtures) {
    if (!gameweekTeams.has(f.gameweek)) {
      gameweekTeams.set(f.gameweek, new Set());
    }
    const gwSet = gameweekTeams.get(f.gameweek)!;
    gwSet.add(f.homeTeamId);
    gwSet.add(f.awayTeamId);
  }

  const result: BlankGameweek[] = [];

  for (const [gw, teamsWithFixtures] of gameweekTeams) {
    const affectedTeamIds = allTeamIds.filter(
      (id) => !teamsWithFixtures.has(id),
    );
    if (affectedTeamIds.length > 0) {
      result.push({ gameweek: gw, affectedTeamIds });
    }
  }

  return result.sort((a, b) => a.gameweek - b.gameweek);
}

/**
 * Detect double gameweeks — gameweeks where a team has 2+ fixtures.
 */
export function detectDoubleGameweeks(
  fixtures: Fixture[],
): DoubleGameweek[] {
  // Count fixtures per team per gameweek
  const counts = new Map<number, Map<number, number>>();

  for (const f of fixtures) {
    if (!counts.has(f.gameweek)) {
      counts.set(f.gameweek, new Map());
    }
    const gwMap = counts.get(f.gameweek)!;
    gwMap.set(f.homeTeamId, (gwMap.get(f.homeTeamId) ?? 0) + 1);
    gwMap.set(f.awayTeamId, (gwMap.get(f.awayTeamId) ?? 0) + 1);
  }

  const result: DoubleGameweek[] = [];

  for (const [gw, teamCounts] of counts) {
    const affectedTeamIds: number[] = [];
    for (const [teamId, count] of teamCounts) {
      if (count >= 2) {
        affectedTeamIds.push(teamId);
      }
    }
    if (affectedTeamIds.length > 0) {
      result.push({ gameweek: gw, affectedTeamIds });
    }
  }

  return result.sort((a, b) => a.gameweek - b.gameweek);
}

// --- Internal Helpers ---

function buildFixtureDetailsForTeam(
  teamId: number,
  fixtures: Fixture[],
  teamMap: Map<number, Team>,
  startGw?: number,
  endGw?: number,
): FixtureDetail[] {
  const teamFixtures = fixtures.filter(
    (f) => f.homeTeamId === teamId || f.awayTeamId === teamId,
  );

  // Count fixtures per gameweek for this team to detect DGW
  const fixturesPerGw = new Map<number, number>();
  for (const f of teamFixtures) {
    fixturesPerGw.set(f.gameweek, (fixturesPerGw.get(f.gameweek) ?? 0) + 1);
  }

  // Determine which gameweeks have zero fixtures for this team (BGW)
  const bgwGameweeks = new Set<number>();
  if (startGw !== undefined && endGw !== undefined) {
    for (let gw = startGw; gw <= endGw; gw++) {
      if (!fixturesPerGw.has(gw)) {
        bgwGameweeks.add(gw);
      }
    }
  }

  const details: FixtureDetail[] = [];

  // Add BGW entries for gameweeks with no fixtures
  for (const gw of bgwGameweeks) {
    details.push({
      gameweek: gw,
      opponent: 'BGW',
      isHome: false,
      difficulty: 0,
      isBgw: true,
      isDgw: false,
    });
  }

  // Add actual fixture entries
  for (const f of teamFixtures) {
    const isHome = f.homeTeamId === teamId;
    const opponentId = isHome ? f.awayTeamId : f.homeTeamId;
    const opponent = teamMap.get(opponentId);
    const difficulty = isHome ? f.homeTeamDifficulty : f.awayTeamDifficulty;
    const isDgw = (fixturesPerGw.get(f.gameweek) ?? 0) >= 2;

    details.push({
      gameweek: f.gameweek,
      opponent: opponent?.shortName ?? `T${opponentId}`,
      isHome,
      difficulty,
      isBgw: false,
      isDgw,
    });
  }

  return details.sort((a, b) => a.gameweek - b.gameweek);
}
