import fc from 'fast-check';
import type { SquadPlayer, Fixture, Position, GameweekPoints } from '../models';
import {
  detectBlankBenchPlayers,
  checkBenchOrder,
} from '../domain/benchOrderChecker';

/**
 * WHEN the Manager's Squad contains one or more bench players with no fixture
 * in the current gameweek, THE App SHALL detect those players as Blank_Bench_Players.
 * 
 * WHEN a Blank_Bench_Player is positioned ahead of a playing bench player in the
 * Bench_Order, THE App SHALL display a warning indicating that the auto-sub system
 * may substitute on a player with no fixture.
 */

// --- Arbitraries ---

const positionArb: fc.Arbitrary<Position> = fc.constantFrom('GKP', 'DEF', 'MID', 'FWD');

const gameweekArb = fc.integer({ min: 1, max: 38 });

/**
 * Strategy: generate disjoint sets of "playing" and "blank" team IDs,
 * fixtures only for playing teams, and bench players assigned to either group.
 */
const testDataArb = fc.record({
  gameweek: gameweekArb,
  playingTeamIds: fc.uniqueArray(fc.integer({ min: 1, max: 10 }), { minLength: 0, maxLength: 5 }),
  blankTeamIds: fc.uniqueArray(fc.integer({ min: 11, max: 20 }), { minLength: 0, maxLength: 5 }),
}).chain(({ gameweek, playingTeamIds, blankTeamIds }) => {
  const allTeamIds = [...playingTeamIds, ...blankTeamIds];
  if (allTeamIds.length === 0) {
    // Need at least one team to generate players
    return fc.constant({
      gameweek,
      playingTeamIds: [] as number[],
      blankTeamIds: [] as number[],
      fixtures: [] as Fixture[],
      bench: [] as SquadPlayer[],
    });
  }

  // Generate fixtures only for playing teams
  const fixturesArb = fc.constant(
    playingTeamIds.map((teamId, idx) =>
      ({
        id: idx + 1,
        gameweek,
        homeTeamId: teamId,
        awayTeamId: teamId + 100, // dummy opponent not in our team sets
        homeTeamDifficulty: 3,
        awayTeamDifficulty: 3,
        kickoffTime: '2024-01-01T15:00:00Z',
        finished: false,
      }) as Fixture,
    ),
  );

  // Generate 1-4 bench players with unique benchOrders
  const benchCountArb = fc.integer({ min: 1, max: 4 });
  const benchArb = benchCountArb.chain((count) => {
    const benchOrders = Array.from({ length: count }, (_, i) => i + 1);
    return fc.tuple(
      ...benchOrders.map((bo) =>
        fc.record({
          id: fc.constant(bo * 100),
          name: fc.constant(`PLAYER_${bo}`),
          teamId: fc.constantFrom(...allTeamIds),
          position: positionArb,
          totalPoints: fc.integer({ min: 0, max: 300 }),
          form: fc.float({ min: 0, max: 15, noNaN: true }),
          cost: fc.integer({ min: 40, max: 150 }),
          ownershipPercentage: fc.float({ min: 0, max: 100, noNaN: true }),
          minutesPlayed: fc.integer({ min: 0, max: 3420 }),
          news: fc.constant(''),
          chanceOfPlaying: fc.constant(null),
          gameweekPoints: fc.constant([] as GameweekPoints[]),
          isCaptain: fc.constant(false),
          isViceCaptain: fc.constant(false),
          isBenched: fc.constant(true),
          benchOrder: fc.constant(bo),
          sellingPrice: fc.integer({ min: 40, max: 150 }),
        }).map((r) => r as SquadPlayer),
      ),
    );
  });

  return fc.tuple(fixturesArb, benchArb).map(([fixtures, benchTuple]) => ({
    gameweek,
    playingTeamIds,
    blankTeamIds,
    fixtures,
    bench: benchTuple as unknown as SquadPlayer[],
  }));
});

// Helper: check if a team has a fixture
function teamHasFixtureHelper(
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

describe('Property 30: Blank Bench Detection and Warning', () => {
  /**
   * Detection completeness: detectBlankBenchPlayers returns exactly those bench
   * players whose team has no fixture in that gameweek. No false positives, no
   * false negatives.
   */
  it('detection completeness — returns exactly bench players with no fixture (no false positives, no false negatives)', () => {
    fc.assert(
      fc.property(testDataArb, ({ gameweek, fixtures, bench }) => {
        const result = detectBlankBenchPlayers(bench, fixtures, gameweek);

        const expectedBlank = bench.filter(
          (p) => p.benchOrder >= 1 && !teamHasFixtureHelper(p.teamId, fixtures, gameweek),
        );

        // No false negatives: every expected blank player is in the result
        const resultPlayerIds = new Set(result.map((r) => r.player.id));
        for (const ep of expectedBlank) {
          expect(resultPlayerIds.has(ep.id)).toBe(true);
        }

        // No false positives: every result player is expected
        const expectedIds = new Set(expectedBlank.map((p) => p.id));
        for (const r of result) {
          expect(expectedIds.has(r.player.id)).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Detection count: the length of the returned array equals the number of
   * bench players whose team has no fixture.
   */
  it('detection count — result length equals number of bench players with no fixture', () => {
    fc.assert(
      fc.property(testDataArb, ({ gameweek, fixtures, bench }) => {
        const result = detectBlankBenchPlayers(bench, fixtures, gameweek);

        const expectedCount = bench.filter(
          (p) => p.benchOrder >= 1 && !teamHasFixtureHelper(p.teamId, fixtures, gameweek),
        ).length;

        expect(result).toHaveLength(expectedCount);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Warning correctness: when a blank player is ahead of a playing player,
   * checkBenchOrder produces at least one warning. Every warning's blankPlayer
   * must have no fixture, and every warning's playingPlayerBehind must have a fixture.
   */
  it('warning correctness — warnings produced when blank ahead of playing, with correct player types', () => {
    fc.assert(
      fc.property(testDataArb, ({ gameweek, fixtures, bench }) => {
        const warnings = checkBenchOrder(bench, fixtures, gameweek);

        const sorted = [...bench]
          .filter((p) => p.benchOrder >= 1)
          .sort((a, b) => a.benchOrder - b.benchOrder);

        const isBlank = (p: SquadPlayer) =>
          !teamHasFixtureHelper(p.teamId, fixtures, gameweek);

        // Check if there exists a blank player ahead of a playing player
        let hasBlankAheadOfPlaying = false;
        for (let i = 0; i < sorted.length; i++) {
          if (isBlank(sorted[i])) {
            for (let j = i + 1; j < sorted.length; j++) {
              if (!isBlank(sorted[j])) {
                hasBlankAheadOfPlaying = true;
                break;
              }
            }
          }
          if (hasBlankAheadOfPlaying) break;
        }

        if (hasBlankAheadOfPlaying) {
          expect(warnings.length).toBeGreaterThanOrEqual(1);
        }

        // Every warning's blankPlayer must have no fixture
        for (const w of warnings) {
          expect(isBlank(w.blankPlayer)).toBe(true);
        }

        // Every warning's playingPlayerBehind must have a fixture
        for (const w of warnings) {
          expect(
            teamHasFixtureHelper(w.playingPlayerBehind.teamId, fixtures, gameweek),
          ).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * No false warnings: when all blank players are behind all playing players
   * in bench order, checkBenchOrder returns zero warnings.
   */
  it('no false warnings — zero warnings when all blank players are behind all playing players', () => {
    // Custom arbitrary: playing players get lower benchOrders, blank players get higher
    const orderedDataArb = fc.record({
      gameweek: gameweekArb,
      playingCount: fc.integer({ min: 1, max: 3 }),
      blankCount: fc.integer({ min: 1, max: 3 }),
    }).chain(({ gameweek, playingCount, blankCount }) => {
      const total = playingCount + blankCount;
      if (total > 4) {
        // Cap at 4 bench slots
        const pc = Math.min(playingCount, 2);
        const bc = Math.min(blankCount, 2);
        return fc.constant({ gameweek, playingCount: pc, blankCount: bc });
      }
      return fc.constant({ gameweek, playingCount, blankCount });
    }).map(({ gameweek, playingCount, blankCount }) => {
      const playingTeamId = 1;
      const blankTeamId = 11;

      const fixtures: Fixture[] = [
        {
          id: 1,
          gameweek,
          homeTeamId: playingTeamId,
          awayTeamId: playingTeamId + 100,
          homeTeamDifficulty: 3,
          awayTeamDifficulty: 3,
          kickoffTime: '2024-01-01T15:00:00Z',
          finished: false,
        },
      ];

      const bench: SquadPlayer[] = [];
      let order = 1;

      // Playing players first (lower bench orders)
      for (let i = 0; i < playingCount; i++) {
        bench.push({
          id: order * 100,
          name: `PLAYING_${order}`,
          teamId: playingTeamId,
          position: 'MID',
          totalPoints: 50,
          form: 5,
          cost: 60,
          ownershipPercentage: 10,
          minutesPlayed: 900,
          news: '',
          chanceOfPlaying: null,
          gameweekPoints: [],
          isCaptain: false,
          isViceCaptain: false,
          isBenched: true,
          benchOrder: order,
          sellingPrice: 60,
        });
        order++;
      }

      // Blank players after (higher bench orders)
      for (let i = 0; i < blankCount; i++) {
        bench.push({
          id: order * 100,
          name: `BLANK_${order}`,
          teamId: blankTeamId,
          position: 'DEF',
          totalPoints: 30,
          form: 3,
          cost: 45,
          ownershipPercentage: 5,
          minutesPlayed: 600,
          news: '',
          chanceOfPlaying: null,
          gameweekPoints: [],
          isCaptain: false,
          isViceCaptain: false,
          isBenched: true,
          benchOrder: order,
          sellingPrice: 45,
        });
        order++;
      }

      return { gameweek, fixtures, bench };
    });

    fc.assert(
      fc.property(orderedDataArb, ({ gameweek, fixtures, bench }) => {
        const warnings = checkBenchOrder(bench, fixtures, gameweek);
        expect(warnings).toHaveLength(0);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Warning blocking position matches blank player's bench order: every
   * warning's blockingPosition equals the blankPlayer's benchOrder.
   */
  it('blocking position matches blank player benchOrder in every warning', () => {
    fc.assert(
      fc.property(testDataArb, ({ gameweek, fixtures, bench }) => {
        const warnings = checkBenchOrder(bench, fixtures, gameweek);

        for (const w of warnings) {
          expect(w.blockingPosition).toBe(w.blankPlayer.benchOrder);
        }
      }),
      { numRuns: 100 },
    );
  });
});
