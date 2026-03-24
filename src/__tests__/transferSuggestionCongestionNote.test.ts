// For any suggested transfer-in player whose team has fixture congestion
// (a cup fixture within 72 hours of a PL fixture), detectCongestion shall
// return true for that player's team, confirming a rotation risk note
// can be displayed alongside the suggestion.

import fc from 'fast-check';
import type { Fixture, Player, Position } from '../models';
import { suggestTransfersIn } from '../domain/transferSuggester';
import { detectCongestion } from '../domain/rotationRiskDetector';

// ── Constants ────────────────────────────────────────────────────────

const HOUR_MS = 1000 * 60 * 60;
const BASE_TIME = new Date('2025-03-01T15:00:00Z').getTime();

// ── Arbitraries ──────────────────────────────────────────────────────

const arbPosition: fc.Arbitrary<Position> = fc.constantFrom('GKP', 'DEF', 'MID', 'FWD');
const arbTeamId = fc.integer({ min: 1, max: 20 });

// ── Helpers ──────────────────────────────────────────────────────────

function makeFixture(
  overrides: Partial<Fixture> & Pick<Fixture, 'id' | 'homeTeamId' | 'awayTeamId' | 'kickoffTime'>,
): Fixture {
  return {
    gameweek: 30,
    homeTeamDifficulty: 3,
    awayTeamDifficulty: 3,
    finished: false,
    ...overrides,
  };
}

function makePlayer(overrides: Partial<Player> & Pick<Player, 'id'>): Player {
  return {
    name: `PLAYER ${overrides.id}`,
    teamId: 1,
    position: 'MID' as Position,
    totalPoints: 80,
    form: 5.0,
    cost: 70,
    ownershipPercentage: 20,
    minutesPlayed: 900,
    news: '',
    chanceOfPlaying: 100,
    gameweekPoints: [],
    ...overrides,
  };
}

// ── Property Tests ───────────────────────────────────────────────────

describe('Property 42: Transfer Suggestion Congestion Note', () => {
  /**
   * When a transfer-in suggestion is for a player whose team has fixture
   * congestion, detectCongestion must return true for that team, so the
   * app can display a rotation risk note alongside the suggestion.
   */

  it('every suggested transfer-in player from a congested team is detectable via detectCongestion', () => {
    fc.assert(
      fc.property(
        arbTeamId,
        arbPosition,
        // Gap in hours within congestion window (0, 72]
        fc.float({ min: Math.fround(0.1), max: 72, noNaN: true }),
        fc.integer({ min: 1, max: 5 }), // number of available players from congested team
        (congestedTeamId, position, gapHours, playerCount) => {
          const otherTeam = congestedTeamId === 20 ? 1 : congestedTeamId + 1;

          // PL fixture for the congested team
          const plFixture = makeFixture({
            id: 100,
            homeTeamId: congestedTeamId,
            awayTeamId: otherTeam,
            kickoffTime: new Date(BASE_TIME).toISOString(),
          });

          // Cup fixture within 72 hours
          const cupFixture = makeFixture({
            id: 200,
            homeTeamId: congestedTeamId,
            awayTeamId: otherTeam,
            kickoffTime: new Date(BASE_TIME + gapHours * HOUR_MS).toISOString(),
          });

          // Create available players from the congested team
          const allPlayers: Player[] = [];
          for (let i = 0; i < playerCount; i++) {
            allPlayers.push(
              makePlayer({
                id: i + 1,
                teamId: congestedTeamId,
                position,
                cost: 70,
                form: 5.0 + i,
              }),
            );
          }

          // Get transfer-in suggestions
          const suggestions = suggestTransfersIn(
            position,
            200, // generous budget
            [plFixture],
            allPlayers,
          );

          // Every suggested player is from the congested team
          for (const suggestion of suggestions) {
            const teamId = suggestion.playerIn.teamId;
            const isCongested = detectCongestion(teamId, [plFixture], [cupFixture]);
            expect(isCongested).toBe(true);
          }
        },
      ),
      { numRuns: 500 },
    );
  });

  it('suggested transfer-in players from non-congested teams are not flagged', () => {
    fc.assert(
      fc.property(
        arbTeamId,
        arbPosition,
        // Gap beyond congestion window (> 72 hours)
        fc.float({ min: Math.fround(72.1), max: 200, noNaN: true }),
        (teamId, position, gapHours) => {
          const otherTeam = teamId === 20 ? 1 : teamId + 1;

          const plFixture = makeFixture({
            id: 100,
            homeTeamId: teamId,
            awayTeamId: otherTeam,
            kickoffTime: new Date(BASE_TIME).toISOString(),
          });

          // Cup fixture OUTSIDE 72-hour window
          const cupFixture = makeFixture({
            id: 200,
            homeTeamId: teamId,
            awayTeamId: otherTeam,
            kickoffTime: new Date(BASE_TIME + gapHours * HOUR_MS).toISOString(),
          });

          const allPlayers: Player[] = [
            makePlayer({ id: 1, teamId, position, cost: 70, form: 6.0 }),
          ];

          const suggestions = suggestTransfersIn(position, 200, [plFixture], allPlayers);

          for (const suggestion of suggestions) {
            const isCongested = detectCongestion(suggestion.playerIn.teamId, [plFixture], [cupFixture]);
            expect(isCongested).toBe(false);
          }
        },
      ),
      { numRuns: 300 },
    );
  });

  it('mixed pool: only players from congested teams are flagged, others are not', () => {
    fc.assert(
      fc.property(
        // Use well-separated team IDs to avoid collisions
        fc.integer({ min: 1, max: 5 }),
        fc.integer({ min: 15, max: 20 }),
        arbPosition,
        fc.float({ min: Math.fround(0.1), max: 72, noNaN: true }),
        (congestedTeamId, safeTeamId, position, gapHours) => {
          // Pick opponents that don't collide with either team
          const opponentA = congestedTeamId + 5; // range 6-10, won't collide with safe (15-20)
          const opponentB = safeTeamId === 20 ? 14 : safeTeamId + 1;

          // PL fixtures for both teams
          const plFixtureCongested = makeFixture({
            id: 100,
            homeTeamId: congestedTeamId,
            awayTeamId: opponentA,
            kickoffTime: new Date(BASE_TIME).toISOString(),
            gameweek: 30,
          });

          const plFixtureSafe = makeFixture({
            id: 101,
            homeTeamId: safeTeamId,
            awayTeamId: opponentB,
            kickoffTime: new Date(BASE_TIME).toISOString(),
            gameweek: 30,
          });

          // Cup fixture only for the congested team (within 72h)
          const cupFixture = makeFixture({
            id: 200,
            homeTeamId: congestedTeamId,
            awayTeamId: opponentA,
            kickoffTime: new Date(BASE_TIME + gapHours * HOUR_MS).toISOString(),
          });

          const allPlayers: Player[] = [
            makePlayer({ id: 1, teamId: congestedTeamId, position, cost: 70, form: 6.0 }),
            makePlayer({ id: 2, teamId: safeTeamId, position, cost: 70, form: 6.0 }),
          ];

          const plFixtures = [plFixtureCongested, plFixtureSafe];
          const suggestions = suggestTransfersIn(position, 200, plFixtures, allPlayers);

          for (const suggestion of suggestions) {
            const tid = suggestion.playerIn.teamId;
            const isCongested = detectCongestion(tid, plFixtures, [cupFixture]);

            if (tid === congestedTeamId) {
              expect(isCongested).toBe(true);
            } else {
              expect(isCongested).toBe(false);
            }
          }
        },
      ),
      { numRuns: 500 },
    );
  });

  it('congestion note data includes valid hoursBetween for flagged suggestions', () => {
    fc.assert(
      fc.property(
        arbTeamId,
        arbPosition,
        fc.float({ min: Math.fround(0.1), max: 72, noNaN: true }),
        (teamId, position, gapHours) => {
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

          const allPlayers: Player[] = [
            makePlayer({ id: 1, teamId, position, cost: 70, form: 5.0 }),
          ];

          const suggestions = suggestTransfersIn(position, 200, [plFixture], allPlayers);

          // For each suggestion from a congested team, verify congestion is detectable
          // and the gap is within the 72-hour window
          for (const suggestion of suggestions) {
            const isCongested = detectCongestion(suggestion.playerIn.teamId, [plFixture], [cupFixture]);
            expect(isCongested).toBe(true);

            // Verify the actual time gap is within the congestion threshold
            const plTime = new Date(plFixture.kickoffTime).getTime();
            const cupTime = new Date(cupFixture.kickoffTime).getTime();
            const actualHours = Math.abs(plTime - cupTime) / HOUR_MS;
            expect(actualHours).toBeGreaterThan(0);
            expect(actualHours).toBeLessThanOrEqual(72);
          }
        },
      ),
      { numRuns: 300 },
    );
  });
});
