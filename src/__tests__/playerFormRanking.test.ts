import fc from 'fast-check';
import { rankByForm } from '../domain/playerFormRanker';
import type { Player, Position, GameweekPoints } from '../models/player';

/**
 * For any list of players with gameweek history, ranking by Player Form
 * over the last 4 gameweeks shall produce a list in non-increasing form order.
 */

// ── Arbitraries ──────────────────────────────────────────────────────

const arbPosition: fc.Arbitrary<Position> = fc.constantFrom('GKP', 'DEF', 'MID', 'FWD');

const arbGameweekPoints: fc.Arbitrary<GameweekPoints> = fc.record({
  gameweek: fc.integer({ min: 1, max: 38 }),
  points: fc.integer({ min: 0, max: 20 }),
  minutes: fc.integer({ min: 0, max: 90 }),
});

const arbPlayer: fc.Arbitrary<Player> = fc.record({
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
  gameweekPoints: fc.array(arbGameweekPoints, { minLength: 0, maxLength: 10 }),
});

const arbPlayers: fc.Arbitrary<Player[]> = fc.array(arbPlayer, { minLength: 0, maxLength: 20 });

// ── Helper ───────────────────────────────────────────────────────────

function computeFormScore(player: Player, window: number): number {
  const recent = player.gameweekPoints.slice(-window);
  if (recent.length === 0) return 0;
  return recent.reduce((sum, gw) => sum + gw.points, 0) / recent.length;
}

// ── Tests ────────────────────────────────────────────────────────────

describe('Property 6: Player Form Ranking Order', () => {
  const GAMEWEEK_WINDOW = 4;

  it('ranked list is in non-increasing form order', () => {
    fc.assert(
      fc.property(arbPlayers, (players) => {
        const ranked = rankByForm(players, GAMEWEEK_WINDOW);

        for (let i = 0; i < ranked.length - 1; i++) {
          const currentForm = computeFormScore(ranked[i], GAMEWEEK_WINDOW);
          const nextForm = computeFormScore(ranked[i + 1], GAMEWEEK_WINDOW);
          expect(currentForm).toBeGreaterThanOrEqual(nextForm);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('ranks are sequential starting from 1', () => {
    fc.assert(
      fc.property(arbPlayers, (players) => {
        const ranked = rankByForm(players, GAMEWEEK_WINDOW);

        for (let i = 0; i < ranked.length; i++) {
          expect(ranked[i].rank).toBe(i + 1);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('all input players appear in the output (length preserved)', () => {
    fc.assert(
      fc.property(arbPlayers, (players) => {
        const ranked = rankByForm(players, GAMEWEEK_WINDOW);
        expect(ranked).toHaveLength(players.length);
      }),
      { numRuns: 100 },
    );
  });
});
