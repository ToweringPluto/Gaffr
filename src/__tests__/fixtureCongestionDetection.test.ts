import fc from 'fast-check';
import type { Fixture, Position, SquadPlayer, Squad } from '../models';
import { detectCongestion, flagSquadRotationRisks } from '../domain/rotationRiskDetector';

// ── Arbitraries ──────────────────────────────────────────────────────

const arbPosition: fc.Arbitrary<Position> = fc.constantFrom('GKP', 'DEF', 'MID', 'FWD');

const arbTeamId = fc.integer({ min: 1, max: 20 });
const arbOtherTeamId = (exclude: number) =>
  fc.integer({ min: 1, max: 20 }).filter((id) => id !== exclude);

const HOUR_MS = 1000 * 60 * 60;

/** Base time: a fixed future date to anchor generated kickoff times */
const BASE_TIME = new Date('2025-03-01T15:00:00Z').getTime();

function makeFixture(overrides: Partial<Fixture> & { homeTeamId: number; awayTeamId: number; kickoffTime: string }): Fixture {
  return {
    id: 1,
    gameweek: 30,
    homeTeamDifficulty: 3,
    awayTeamDifficulty: 3,
    finished: false,
    ...overrides,
  };
}

function makeSquadPlayer(overrides: Partial<SquadPlayer>): SquadPlayer {
  return {
    id: 1,
    name: 'TEST PLAYER',
    teamId: 1,
    position: 'MID' as Position,
    totalPoints: 50,
    form: 5,
    cost: 70,
    ownershipPercentage: 10,
    minutesPlayed: 900,
    news: '',
    chanceOfPlaying: 100,
    gameweekPoints: [],
    isCaptain: false,
    isViceCaptain: false,
    isBenched: false,
    benchOrder: 0,
    sellingPrice: 70,
    ...overrides,
  };
}

// ── Property Tests ───────────────────────────────────────────────────

describe('Property 41: Fixture Congestion Detection', () => {
  /**
   * For any team with a European or domestic cup fixture within 72 hours
   * of an upcoming Premier League fixture, all squad players from that
   * team shall be flagged with a Fixture Congestion indicator.
   */

  it('detectCongestion returns true when PL and cup fixtures are within 72 hours', () => {
    fc.assert(
      fc.property(
        arbTeamId,
        // Gap in hours: > 0 and <= 72
        fc.float({ min: Math.fround(0.1), max: 72, noNaN: true }),
        fc.boolean(), // whether team is home in PL fixture
        fc.boolean(), // whether team is home in cup fixture
        (teamId, gapHours, isHomePl, isHomeCup) => {
          const plKickoff = BASE_TIME;
          const cupKickoff = BASE_TIME + gapHours * HOUR_MS;

          const otherTeam = teamId === 20 ? 1 : teamId + 1;

          const plFixture = makeFixture({
            id: 100,
            homeTeamId: isHomePl ? teamId : otherTeam,
            awayTeamId: isHomePl ? otherTeam : teamId,
            kickoffTime: new Date(plKickoff).toISOString(),
          });

          const cupFixture = makeFixture({
            id: 200,
            homeTeamId: isHomeCup ? teamId : otherTeam,
            awayTeamId: isHomeCup ? otherTeam : teamId,
            kickoffTime: new Date(cupKickoff).toISOString(),
          });

          expect(detectCongestion(teamId, [plFixture], [cupFixture])).toBe(true);
        },
      ),
      { numRuns: 500 },
    );
  });

  it('detectCongestion returns false when no cup fixtures are within 72 hours', () => {
    fc.assert(
      fc.property(
        arbTeamId,
        // Gap in hours: > 72 (up to 200)
        fc.float({ min: Math.fround(72.1), max: 200, noNaN: true }),
        fc.boolean(),
        (teamId, gapHours, isHomePl) => {
          const plKickoff = BASE_TIME;
          const cupKickoff = BASE_TIME + gapHours * HOUR_MS;

          const otherTeam = teamId === 20 ? 1 : teamId + 1;

          const plFixture = makeFixture({
            id: 100,
            homeTeamId: isHomePl ? teamId : otherTeam,
            awayTeamId: isHomePl ? otherTeam : teamId,
            kickoffTime: new Date(plKickoff).toISOString(),
          });

          const cupFixture = makeFixture({
            id: 200,
            homeTeamId: teamId,
            awayTeamId: otherTeam,
            kickoffTime: new Date(cupKickoff).toISOString(),
          });

          expect(detectCongestion(teamId, [plFixture], [cupFixture])).toBe(false);
        },
      ),
      { numRuns: 300 },
    );
  });

  it('detectCongestion returns false when there are no cup fixtures for the team', () => {
    fc.assert(
      fc.property(
        arbTeamId,
        fc.boolean(),
        (teamId, isHomePl) => {
          const otherTeam = teamId === 20 ? 1 : teamId + 1;
          // A third team that is neither teamId nor otherTeam
          const thirdTeam = [1, 2, 3, 4, 5].find((t) => t !== teamId && t !== otherTeam) ?? 6;

          const plFixture = makeFixture({
            id: 100,
            homeTeamId: isHomePl ? teamId : otherTeam,
            awayTeamId: isHomePl ? otherTeam : teamId,
            kickoffTime: new Date(BASE_TIME).toISOString(),
          });

          // Cup fixture for a different team entirely
          const cupFixtureOtherTeam = makeFixture({
            id: 200,
            homeTeamId: otherTeam,
            awayTeamId: thirdTeam,
            kickoffTime: new Date(BASE_TIME + 24 * HOUR_MS).toISOString(),
          });

          // Case 1: no cup fixtures at all
          expect(detectCongestion(teamId, [plFixture], [])).toBe(false);

          // Case 2: cup fixtures exist but for other teams
          expect(detectCongestion(teamId, [plFixture], [cupFixtureOtherTeam])).toBe(false);
        },
      ),
      { numRuns: 300 },
    );
  });

  it('flagSquadRotationRisks flags ALL squad players from a congested team', () => {
    fc.assert(
      fc.property(
        arbTeamId,
        // Number of players from the congested team (2-5)
        fc.integer({ min: 2, max: 5 }),
        // Gap in hours within congestion window
        fc.float({ min: Math.fround(0.1), max: 72, noNaN: true }),
        (teamId, playerCount, gapHours) => {
          const otherTeam = teamId === 20 ? 1 : teamId + 1;

          const plFixture = makeFixture({
            id: 100,
            homeTeamId: teamId,
            awayTeamId: otherTeam,
            kickoffTime: new Date(BASE_TIME).toISOString(),
          });

          const cupFixture = makeFixture({
            id: 200,
            homeTeamId: teamId,
            awayTeamId: otherTeam,
            kickoffTime: new Date(BASE_TIME + gapHours * HOUR_MS).toISOString(),
          });

          // Create squad players from the congested team
          const players: SquadPlayer[] = [];
          for (let i = 0; i < playerCount; i++) {
            players.push(
              makeSquadPlayer({
                id: i + 1,
                name: `PLAYER ${i + 1}`,
                teamId,
              }),
            );
          }

          const squad: Squad = {
            players,
            budget: 100,
            freeTransfers: 1,
            activeChip: null,
          };

          const risks = flagSquadRotationRisks(squad, [plFixture], [cupFixture]);

          // Every player from the congested team must appear in risks
          const flaggedPlayerIds = risks.map((r) => r.player.id).sort();
          const expectedPlayerIds = players.map((p) => p.id).sort();
          expect(flaggedPlayerIds).toEqual(expectedPlayerIds);

          // All risks should reference the correct team
          for (const risk of risks) {
            expect(risk.teamId).toBe(teamId);
          }
        },
      ),
      { numRuns: 300 },
    );
  });

  it('flagSquadRotationRisks returns empty when no congestion exists', () => {
    fc.assert(
      fc.property(
        arbTeamId,
        fc.integer({ min: 1, max: 4 }),
        // Gap > 72 hours — no congestion
        fc.float({ min: Math.fround(72.1), max: 200, noNaN: true }),
        (teamId, playerCount, gapHours) => {
          const otherTeam = teamId === 20 ? 1 : teamId + 1;

          const plFixture = makeFixture({
            id: 100,
            homeTeamId: teamId,
            awayTeamId: otherTeam,
            kickoffTime: new Date(BASE_TIME).toISOString(),
          });

          const cupFixture = makeFixture({
            id: 200,
            homeTeamId: teamId,
            awayTeamId: otherTeam,
            kickoffTime: new Date(BASE_TIME + gapHours * HOUR_MS).toISOString(),
          });

          const players: SquadPlayer[] = [];
          for (let i = 0; i < playerCount; i++) {
            players.push(
              makeSquadPlayer({
                id: i + 1,
                name: `PLAYER ${i + 1}`,
                teamId,
              }),
            );
          }

          const squad: Squad = {
            players,
            budget: 100,
            freeTransfers: 1,
            activeChip: null,
          };

          const risks = flagSquadRotationRisks(squad, [plFixture], [cupFixture]);
          expect(risks).toHaveLength(0);
        },
      ),
      { numRuns: 300 },
    );
  });

  it('flagSquadRotationRisks hoursBetween is > 0 and <= 72 for all returned risks', () => {
    fc.assert(
      fc.property(
        arbTeamId,
        fc.integer({ min: 1, max: 5 }),
        fc.float({ min: Math.fround(0.1), max: 72, noNaN: true }),
        (teamId, playerCount, gapHours) => {
          const otherTeam = teamId === 20 ? 1 : teamId + 1;

          const plFixture = makeFixture({
            id: 100,
            homeTeamId: teamId,
            awayTeamId: otherTeam,
            kickoffTime: new Date(BASE_TIME).toISOString(),
          });

          const cupFixture = makeFixture({
            id: 200,
            homeTeamId: teamId,
            awayTeamId: otherTeam,
            kickoffTime: new Date(BASE_TIME + gapHours * HOUR_MS).toISOString(),
          });

          const players: SquadPlayer[] = [];
          for (let i = 0; i < playerCount; i++) {
            players.push(
              makeSquadPlayer({
                id: i + 1,
                name: `PLAYER ${i + 1}`,
                teamId,
              }),
            );
          }

          const squad: Squad = {
            players,
            budget: 100,
            freeTransfers: 1,
            activeChip: null,
          };

          const risks = flagSquadRotationRisks(squad, [plFixture], [cupFixture]);

          for (const risk of risks) {
            expect(risk.hoursBetween).toBeGreaterThan(0);
            expect(risk.hoursBetween).toBeLessThanOrEqual(72);
          }
        },
      ),
      { numRuns: 500 },
    );
  });
});
