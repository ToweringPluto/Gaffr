import fc from 'fast-check';
import type { SquadPlayer, Fixture, Position, GameweekPoints } from '../models';
import { suggestCorrectedOrder } from '../domain/benchOrderChecker';

/**
 * THE App SHALL suggest a corrected Bench_Order that places all Blank_Bench_Players
 * behind playing bench players, subject to FPL formation rules.
 */

// --- Helpers ---

function teamHasFixture(
  teamId: number,
  fixtures: Fixture[],
  gameweek: number,
): boolean {
  return fixtures.some(
    (f) =>
      f.gameweek === gameweek &&
      (f.homeTeamId === teamId || f.awayTeamId === teamId),
  );
}

// --- Arbitraries ---

const positionArb: fc.Arbitrary<Position> = fc.constantFrom('GKP', 'DEF', 'MID', 'FWD');
const gameweekArb = fc.integer({ min: 1, max: 38 });

/**
 * Generate a mix of playing and blank bench players with shuffled bench orders.
 * Playing teams (1-10) have fixtures; blank teams (11-20) do not.
 */
const testDataArb = fc.record({
  gameweek: gameweekArb,
  playingTeamIds: fc.uniqueArray(fc.integer({ min: 1, max: 10 }), { minLength: 1, maxLength: 5 }),
  blankTeamIds: fc.uniqueArray(fc.integer({ min: 11, max: 20 }), { minLength: 1, maxLength: 5 }),
}).chain(({ gameweek, playingTeamIds, blankTeamIds }) => {
  const allTeamIds = [...playingTeamIds, ...blankTeamIds];

  const fixturesArb = fc.constant(
    playingTeamIds.map((teamId, idx) => ({
      id: idx + 1,
      gameweek,
      homeTeamId: teamId,
      awayTeamId: teamId + 100,
      homeTeamDifficulty: 3,
      awayTeamDifficulty: 3,
      kickoffTime: '2024-01-01T15:00:00Z',
      finished: false,
    }) as Fixture),
  );

  // Generate 2-4 bench players assigned to random teams from both pools
  const benchCountArb = fc.integer({ min: 2, max: 4 });
  const benchArb = benchCountArb.chain((count) => {
    const benchOrders = Array.from({ length: count }, (_, i) => i + 1);
    // Shuffle bench orders so blank players can appear before playing ones
    return fc.tuple(
      fc.shuffledSubarray(benchOrders, { minLength: count, maxLength: count }),
      fc.array(fc.constantFrom(...allTeamIds), { minLength: count, maxLength: count }),
      fc.array(positionArb, { minLength: count, maxLength: count }),
    ).map(([orders, teamIds, positions]) =>
      orders.map((bo, i) => ({
        id: (i + 1) * 100,
        name: `PLAYER_${i + 1}`,
        teamId: teamIds[i],
        position: positions[i],
        totalPoints: 50,
        form: 5,
        cost: 60,
        ownershipPercentage: 10,
        minutesPlayed: 900,
        news: '',
        chanceOfPlaying: null,
        gameweekPoints: [] as GameweekPoints[],
        isCaptain: false,
        isViceCaptain: false,
        isBenched: true,
        benchOrder: bo,
        sellingPrice: 60,
      }) as SquadPlayer),
    );
  });

  return fc.tuple(fixturesArb, benchArb).map(([fixtures, bench]) => ({
    gameweek,
    fixtures,
    bench,
  }));
});

describe('Property 31: Corrected Bench Order Invariant', () => {
  /**
   * All playing bench players appear before all blank bench players in the
   * corrected order.
   */
  it('playing players are ordered before blank players in corrected bench', () => {
    fc.assert(
      fc.property(testDataArb, ({ gameweek, fixtures, bench }) => {
        const corrected = suggestCorrectedOrder(bench, fixtures, gameweek);

        const isPlaying = (p: SquadPlayer) =>
          teamHasFixture(p.teamId, fixtures, gameweek);

        // Find the last playing player index and first blank player index
        let lastPlayingIdx = -1;
        let firstBlankIdx = corrected.length;

        for (let i = 0; i < corrected.length; i++) {
          if (isPlaying(corrected[i])) {
            lastPlayingIdx = i;
          } else if (firstBlankIdx === corrected.length) {
            firstBlankIdx = i;
          }
        }

        // All playing players must come before all blank players
        expect(lastPlayingIdx).toBeLessThan(
          firstBlankIdx === corrected.length ? corrected.length : firstBlankIdx,
        );
      }),
      { numRuns: 200 },
    );
  });

  /**
   * The corrected order preserves all original bench players — same set,
   * no additions, no removals.
   */
  it('corrected order contains exactly the same players as the input', () => {
    fc.assert(
      fc.property(testDataArb, ({ gameweek, fixtures, bench }) => {
        const corrected = suggestCorrectedOrder(bench, fixtures, gameweek);
        const inputIds = bench
          .filter((p) => p.benchOrder >= 1)
          .map((p) => p.id)
          .sort();
        const outputIds = corrected.map((p) => p.id).sort();

        expect(outputIds).toEqual(inputIds);
      }),
      { numRuns: 200 },
    );
  });

  /**
   * Corrected benchOrder values are sequential 1..N where N is the number
   * of bench players.
   */
  it('corrected benchOrder values are sequential starting from 1', () => {
    fc.assert(
      fc.property(testDataArb, ({ gameweek, fixtures, bench }) => {
        const corrected = suggestCorrectedOrder(bench, fixtures, gameweek);
        const orders = corrected.map((p) => p.benchOrder);
        const expected = Array.from({ length: corrected.length }, (_, i) => i + 1);

        expect(orders).toEqual(expected);
      }),
      { numRuns: 200 },
    );
  });

  /**
   * Relative order among playing players is preserved from the original
   * bench order, and relative order among blank players is preserved.
   */
  it('relative order of playing players and blank players is preserved', () => {
    fc.assert(
      fc.property(testDataArb, ({ gameweek, fixtures, bench }) => {
        const corrected = suggestCorrectedOrder(bench, fixtures, gameweek);

        const isPlaying = (p: SquadPlayer) =>
          teamHasFixture(p.teamId, fixtures, gameweek);

        // Original order (sorted by benchOrder)
        const original = [...bench]
          .filter((p) => p.benchOrder >= 1)
          .sort((a, b) => a.benchOrder - b.benchOrder);

        const originalPlayingIds = original.filter(isPlaying).map((p) => p.id);
        const originalBlankIds = original.filter((p) => !isPlaying(p)).map((p) => p.id);

        const correctedPlayingIds = corrected.filter(isPlaying).map((p) => p.id);
        const correctedBlankIds = corrected.filter((p) => !isPlaying(p)).map((p) => p.id);

        expect(correctedPlayingIds).toEqual(originalPlayingIds);
        expect(correctedBlankIds).toEqual(originalBlankIds);
      }),
      { numRuns: 200 },
    );
  });

  /**
   * Idempotency: applying suggestCorrectedOrder twice yields the same result
   * as applying it once.
   */
  it('corrected order is idempotent', () => {
    fc.assert(
      fc.property(testDataArb, ({ gameweek, fixtures, bench }) => {
        const first = suggestCorrectedOrder(bench, fixtures, gameweek);
        const second = suggestCorrectedOrder(first, fixtures, gameweek);

        expect(second.map((p) => p.id)).toEqual(first.map((p) => p.id));
        expect(second.map((p) => p.benchOrder)).toEqual(first.map((p) => p.benchOrder));
      }),
      { numRuns: 200 },
    );
  });
});
