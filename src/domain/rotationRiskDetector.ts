import type { Fixture, Squad, RotationRisk } from '../models';

/**
 * Threshold in hours — if a team plays two fixtures within this window,
 * all players from that team are flagged with fixture congestion.
 */
const CONGESTION_THRESHOLD_HOURS = 72;

/**
 * Detect whether a team has fixture congestion — i.e. a cup fixture
 * within 72 hours of an upcoming Premier League fixture.
 */
export function detectCongestion(
  teamId: number,
  fixtures: Fixture[],
  cupFixtures: Fixture[],
): boolean {
  const teamPlFixtures = fixtures.filter(
    (f) => (f.homeTeamId === teamId || f.awayTeamId === teamId) && !f.finished,
  );
  const teamCupFixtures = cupFixtures.filter(
    (f) => (f.homeTeamId === teamId || f.awayTeamId === teamId) && !f.finished,
  );

  for (const plFixture of teamPlFixtures) {
    const plKickoff = new Date(plFixture.kickoffTime).getTime();
    for (const cupFixture of teamCupFixtures) {
      const cupKickoff = new Date(cupFixture.kickoffTime).getTime();
      const hoursBetween = Math.abs(plKickoff - cupKickoff) / (1000 * 60 * 60);
      if (hoursBetween > 0 && hoursBetween <= CONGESTION_THRESHOLD_HOURS) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Flag all squad players who face rotation risk due to fixture congestion.
 * Returns a RotationRisk entry for each affected squad player, including
 * the congestion fixture description and hours between fixtures.
 */
export function flagSquadRotationRisks(
  squad: Squad,
  fixtures: Fixture[],
  cupFixtures: Fixture[],
): RotationRisk[] {
  const risks: RotationRisk[] = [];

  // Group upcoming PL fixtures by team
  const plByTeam = groupUnfinishedByTeam(fixtures);
  const cupByTeam = groupUnfinishedByTeam(cupFixtures);

  // Get unique team IDs from squad
  const teamIds = new Set(squad.players.map((p) => p.teamId));

  for (const teamId of teamIds) {
    const teamPlFixtures = plByTeam.get(teamId) ?? [];
    const teamCupFixtures = cupByTeam.get(teamId) ?? [];

    // Find the closest congestion pair for this team
    const congestionPair = findClosestCongestionPair(teamPlFixtures, teamCupFixtures);
    if (!congestionPair) continue;

    // Flag every squad player from this team
    const affectedPlayers = squad.players.filter((p) => p.teamId === teamId);
    for (const player of affectedPlayers) {
      risks.push({
        player,
        teamId,
        congestionFixture: congestionPair.cupLabel,
        premierLeagueFixture: congestionPair.plLabel,
        hoursBetween: congestionPair.hoursBetween,
      });
    }
  }

  return risks;
}

// --- Internal Helpers ---

interface CongestionPair {
  cupLabel: string;
  plLabel: string;
  hoursBetween: number;
}

function groupUnfinishedByTeam(fixtures: Fixture[]): Map<number, Fixture[]> {
  const map = new Map<number, Fixture[]>();
  for (const f of fixtures) {
    if (f.finished) continue;
    for (const tid of [f.homeTeamId, f.awayTeamId]) {
      if (!map.has(tid)) map.set(tid, []);
      map.get(tid)!.push(f);
    }
  }
  return map;
}

function formatFixtureLabel(fixture: Fixture, teamId: number): string {
  const isHome = fixture.homeTeamId === teamId;
  const opponentId = isHome ? fixture.awayTeamId : fixture.homeTeamId;
  const suffix = isHome ? 'H' : 'A';
  const kickoff = new Date(fixture.kickoffTime);
  const day = kickoff.toLocaleDateString('en-GB', { weekday: 'short' });
  return `Team ${opponentId} ${suffix}, ${day}`;
}

function findClosestCongestionPair(
  plFixtures: Fixture[],
  cupFixtures: Fixture[],
): CongestionPair | null {
  let closest: CongestionPair | null = null;

  for (const plFixture of plFixtures) {
    const plKickoff = new Date(plFixture.kickoffTime).getTime();
    // Determine the team ID from the intersection of PL and cup fixtures
    const plTeamIds = new Set([plFixture.homeTeamId, plFixture.awayTeamId]);

    for (const cupFixture of cupFixtures) {
      const cupKickoff = new Date(cupFixture.kickoffTime).getTime();
      const hoursBetween = Math.abs(plKickoff - cupKickoff) / (1000 * 60 * 60);

      if (hoursBetween > 0 && hoursBetween <= CONGESTION_THRESHOLD_HOURS) {
        if (!closest || hoursBetween < closest.hoursBetween) {
          // Find the shared team between PL and cup fixture
          const sharedTeamId = [cupFixture.homeTeamId, cupFixture.awayTeamId]
            .find((id) => plTeamIds.has(id)) ?? plFixture.homeTeamId;

          closest = {
            cupLabel: formatFixtureLabel(cupFixture, sharedTeamId),
            plLabel: formatFixtureLabel(plFixture, sharedTeamId),
            hoursBetween: Math.round(hoursBetween * 10) / 10,
          };
        }
      }
    }
  }

  return closest;
}
