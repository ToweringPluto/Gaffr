import type { Squad, SquadPlayer, Fixture, TeamOverlap } from '../models';

// --- Helpers ---

/**
 * Group squad players by teamId, returning only teams with 2+ players.
 */
function groupPlayersByTeam(players: SquadPlayer[]): Map<number, SquadPlayer[]> {
  const map = new Map<number, SquadPlayer[]>();
  for (const p of players) {
    const list = map.get(p.teamId) ?? [];
    list.push(p);
    map.set(p.teamId, list);
  }
  // Keep only teams with 2+ players (overlap requires at least 2)
  for (const [teamId, list] of map) {
    if (list.length < 2) {
      map.delete(teamId);
    }
  }
  return map;
}

/**
 * Find all fixtures for a given team in a given gameweek.
 */
function getTeamFixturesInGameweek(
  teamId: number,
  fixtures: Fixture[],
  gameweek: number,
): Fixture[] {
  return fixtures.filter(
    (f) =>
      f.gameweek === gameweek &&
      (f.homeTeamId === teamId || f.awayTeamId === teamId),
  );
}

// --- Public API ---

/**
 * Detect team overlaps in a squad for a given gameweek.
 *
 * A Team Overlap occurs when 2 or more squad players share the same team
 * and play in the same fixture. Each overlap is reported per fixture,
 * with all affected players grouped together.
 */
export function detectOverlaps(
  squad: Squad,
  fixtures: Fixture[],
  gameweek: number,
): TeamOverlap[] {
  const teamGroups = groupPlayersByTeam(squad.players);
  const overlaps: TeamOverlap[] = [];

  for (const [teamId, players] of teamGroups) {
    const teamFixtures = getTeamFixturesInGameweek(teamId, fixtures, gameweek);

    for (const fixture of teamFixtures) {
      overlaps.push({
        fixtureId: fixture.id,
        gameweek,
        teamId,
        players,
        maxPotentialLoss: calculateMaxLoss({ fixtureId: fixture.id, gameweek, teamId, players, maxPotentialLoss: 0, severity: 'standard' }),
        severity: getSeverity({ fixtureId: fixture.id, gameweek, teamId, players, maxPotentialLoss: 0, severity: 'standard' }),
      });
    }
  }

  return overlaps;
}

/**
 * Calculate the maximum potential points loss from a team overlap.
 *
 * Estimates worst-case scenario: if the shared fixture goes badly
 * (heavy defeat, no clean sheet), all overlapping players could score
 * minimally. We estimate max loss as the sum of each player's average
 * points per game (form), representing the expected points at risk.
 */
export function calculateMaxLoss(overlap: TeamOverlap): number {
  return overlap.players.reduce((sum, p) => sum + p.form, 0);
}

/**
 * Determine overlap severity.
 * 3+ players from one team = 'high' (FPL maximum from one club).
 * Exactly 2 players = 'standard'.
 */
export function getSeverity(overlap: TeamOverlap): 'standard' | 'high' {
  return overlap.players.length >= 3 ? 'high' : 'standard';
}
