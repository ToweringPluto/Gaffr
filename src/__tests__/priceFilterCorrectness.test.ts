import fc from 'fast-check';
import { rankByForm, filterByPrice } from '../domain/playerFormRanker';
import type { Player, Position, GameweekPoints, RankedPlayer } from '../models/player';

/**
 * For any list of players and any price range [min, max],
 * all players in the filtered result shall have a cost within that range,
 * and no player within the range shall be excluded.
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

const arbPriceRange: fc.Arbitrary<{ min: number; max: number }> = fc
  .integer({ min: 30, max: 200 })
  .chain((min) =>
    fc.integer({ min, max: 200 }).map((max) => ({ min, max })),
  );

// ── Tests ────────────────────────────────────────────────────────────

describe('Property 8: Price Filter Correctness', () => {
  const GAMEWEEK_WINDOW = 4;

  it('all players in filtered result have cost within [min, max]', () => {
    fc.assert(
      fc.property(arbPlayers, arbPriceRange, (players, range) => {
        const ranked = rankByForm(players, GAMEWEEK_WINDOW);
        const filtered = filterByPrice(ranked, range.min, range.max);

        for (const player of filtered) {
          expect(player.cost).toBeGreaterThanOrEqual(range.min);
          expect(player.cost).toBeLessThanOrEqual(range.max);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('no player within the price range is excluded from the result', () => {
    fc.assert(
      fc.property(arbPlayers, arbPriceRange, (players, range) => {
        const ranked = rankByForm(players, GAMEWEEK_WINDOW);
        const filtered = filterByPrice(ranked, range.min, range.max);

        const expectedCount = ranked.filter(
          (p) => p.cost >= range.min && p.cost <= range.max,
        ).length;
        expect(filtered).toHaveLength(expectedCount);
      }),
      { numRuns: 100 },
    );
  });

  it('filtered result is a subset of the ranked input', () => {
    fc.assert(
      fc.property(arbPlayers, arbPriceRange, (players, range) => {
        const ranked = rankByForm(players, GAMEWEEK_WINDOW);
        const filtered = filterByPrice(ranked, range.min, range.max);

        const rankedIds = new Set(ranked.map((p) => p.id));
        for (const player of filtered) {
          expect(rankedIds.has(player.id)).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });
});
