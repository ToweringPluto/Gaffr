import fc from 'fast-check';
import { getFormTrend } from '../domain/playerFormRanker';
import type { Player, Position, GameweekPoints } from '../models/player';

/**
 * For any player with at least 4 gameweeks of points history, the form trend
 * shall be classified as 'rising' if the average of the last 2 gameweeks exceeds
 * the average of the previous 2, 'falling' if it is less, and 'stable' otherwise.
 */

// ── Arbitraries ──────────────────────────────────────────────────────

const arbPosition: fc.Arbitrary<Position> = fc.constantFrom('GKP', 'DEF', 'MID', 'FWD');

const arbGameweekPoints: fc.Arbitrary<GameweekPoints> = fc.record({
  gameweek: fc.integer({ min: 1, max: 38 }),
  points: fc.integer({ min: 0, max: 20 }),
  minutes: fc.integer({ min: 0, max: 90 }),
});

function makePlayer(gameweekPoints: GameweekPoints[]): fc.Arbitrary<Player> {
  return fc.record({
    id: fc.integer({ min: 1, max: 10000 }),
    name: fc.string({ minLength: 1, maxLength: 20 }),
    teamId: fc.integer({ min: 1, max: 20 }),
    position: arbPosition,
    totalPoints: fc.integer({ min: 0, max: 500 }),
    form: fc.double({ min: 0, max: 15, noNaN: true, noDefaultInfinity: true }),
    cost: fc.integer({ min: 30, max: 200 }),
    ownershipPercentage: fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }),
    minutesPlayed: fc.integer({ min: 0, max: 3420 }),
    news: fc.constant(''),
    chanceOfPlaying: fc.oneof(fc.constant(null), fc.constantFrom(0, 25, 50, 75, 100)),
    gameweekPoints: fc.constant(gameweekPoints),
  });
}

/** Player with at least 4 gameweek entries */
const arbPlayerWith4PlusGws: fc.Arbitrary<Player> = fc
  .array(arbGameweekPoints, { minLength: 4, maxLength: 12 })
  .chain((gws) => makePlayer(gws));

/** Player with fewer than 4 gameweek entries */
const arbPlayerWithFewGws: fc.Arbitrary<Player> = fc
  .array(arbGameweekPoints, { minLength: 0, maxLength: 3 })
  .chain((gws) => makePlayer(gws));

// ── Helpers ──────────────────────────────────────────────────────────

function avg(gws: GameweekPoints[]): number {
  if (gws.length === 0) return 0;
  return gws.reduce((s, g) => s + g.points, 0) / gws.length;
}

function expectedTrend(player: Player): 'rising' | 'stable' | 'falling' {
  const gws = player.gameweekPoints;
  if (gws.length < 4) return 'stable';
  const last2 = avg(gws.slice(-2));
  const prev2 = avg(gws.slice(-4, -2));
  if (last2 > prev2) return 'rising';
  if (last2 < prev2) return 'falling';
  return 'stable';
}

// ── Tests ────────────────────────────────────────────────────────────

describe('Property 9: Form Trend Classification', () => {
  it('classifies trend correctly for players with 4+ gameweeks', () => {
    fc.assert(
      fc.property(arbPlayerWith4PlusGws, (player) => {
        const trend = getFormTrend(player);
        expect(trend).toBe(expectedTrend(player));
      }),
      { numRuns: 200 },
    );
  });

  it('returns stable for players with fewer than 4 gameweeks', () => {
    fc.assert(
      fc.property(arbPlayerWithFewGws, (player) => {
        expect(getFormTrend(player)).toBe('stable');
      }),
      { numRuns: 100 },
    );
  });

  it('trend is always one of rising, stable, or falling', () => {
    fc.assert(
      fc.property(arbPlayerWith4PlusGws, (player) => {
        const trend = getFormTrend(player);
        expect(['rising', 'stable', 'falling']).toContain(trend);
      }),
      { numRuns: 100 },
    );
  });

  it('equal last-2 and prev-2 averages produce stable', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 20 }),
        fc.integer({ min: 0, max: 20 }),
        (ptsA, ptsB) => {
          // Build 4 GWs where last2 avg === prev2 avg
          const gws: GameweekPoints[] = [
            { gameweek: 1, points: ptsA, minutes: 90 },
            { gameweek: 2, points: ptsB, minutes: 90 },
            { gameweek: 3, points: ptsA, minutes: 90 },
            { gameweek: 4, points: ptsB, minutes: 90 },
          ];
          const player: Player = {
            id: 1,
            name: 'TEST',
            teamId: 1,
            position: 'MID',
            totalPoints: 0,
            form: 0,
            cost: 50,
            ownershipPercentage: 0,
            minutesPlayed: 0,
            news: '',
            chanceOfPlaying: 100,
            gameweekPoints: gws,
          };
          expect(getFormTrend(player)).toBe('stable');
        },
      ),
      { numRuns: 100 },
    );
  });
});
