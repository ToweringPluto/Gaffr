import fc from 'fast-check';
import type { Player, Position, FixtureDetail, H2HRecord } from '../models';
import {
  calculateCaptaincyScore,
  applyRotationPenalty,
} from '../domain/captaincyScorer';

// ── Arbitraries ──────────────────────────────────────────────────────

const arbPosition: fc.Arbitrary<Position> = fc.constantFrom('GKP', 'DEF', 'MID', 'FWD');

const arbPlayer: fc.Arbitrary<Player> = fc.record({
  id: fc.integer({ min: 1, max: 500 }),
  name: fc.constant('TEST PLAYER'),
  teamId: fc.integer({ min: 1, max: 20 }),
  position: arbPosition,
  totalPoints: fc.integer({ min: 0, max: 300 }),
  form: fc.float({ min: Math.fround(0.1), max: 15, noNaN: true }),
  cost: fc.integer({ min: 40, max: 130 }),
  ownershipPercentage: fc.float({ min: 0, max: 100, noNaN: true }),
  minutesPlayed: fc.integer({ min: 0, max: 3420 }),
  news: fc.constant(''),
  chanceOfPlaying: fc.constant(100 as number | null),
  gameweekPoints: fc.constant([]),
});

const arbFixtureDetail: fc.Arbitrary<FixtureDetail> = fc.record({
  gameweek: fc.integer({ min: 1, max: 38 }),
  opponent: fc.constant('OPP'),
  isHome: fc.boolean(),
  difficulty: fc.integer({ min: 1, max: 5 }),
  isBgw: fc.constant(false),
  isDgw: fc.constant(false),
});

const arbH2HRecord: fc.Arbitrary<H2HRecord | null> = fc.oneof(
  fc.constant(null),
  fc.record({
    playerId: fc.integer({ min: 1, max: 500 }),
    opponentTeamId: fc.integer({ min: 1, max: 20 }),
    matchesPlayed: fc.integer({ min: 1, max: 20 }),
    totalPoints: fc.integer({ min: 0, max: 200 }),
    averagePoints: fc.float({ min: 0, max: 15, noNaN: true }),
  }),
);

// ── Property Tests ───────────────────────────────────────────────────

describe('Property 19: Congestion Captaincy Penalty', () => {
  /**
   * For any player and fixture data, the captaincy score calculated
   * with a Fixture Congestion flag shall be strictly less than the
   * captaincy score calculated without congestion, all other inputs
   * being equal.
   */

  it('applyRotationPenalty with hasCongestion=true returns strictly less than hasCongestion=false', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.01), max: 1000, noNaN: true }),
        (baseScore) => {
          const withoutCongestion = applyRotationPenalty(baseScore, false);
          const withCongestion = applyRotationPenalty(baseScore, true);

          expect(withCongestion).toBeLessThan(withoutCongestion);
        },
      ),
      { numRuns: 500 },
    );
  });

  it('applyRotationPenalty with hasCongestion=false returns the original score unchanged', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 1000, noNaN: true }),
        (baseScore) => {
          expect(applyRotationPenalty(baseScore, false)).toBe(baseScore);
        },
      ),
      { numRuns: 300 },
    );
  });

  it('full captaincy score with congestion is strictly less than without congestion, all else equal', () => {
    fc.assert(
      fc.property(
        arbPlayer,
        arbFixtureDetail,
        arbH2HRecord,
        (player, fixture, h2h) => {
          const baseScore = calculateCaptaincyScore(player, fixture, h2h);

          const withoutCongestion = applyRotationPenalty(baseScore, false);
          const withCongestion = applyRotationPenalty(baseScore, true);

          // When the base score is positive, congestion must reduce it
          if (withoutCongestion > 0) {
            expect(withCongestion).toBeLessThan(withoutCongestion);
          }
        },
      ),
      { numRuns: 500 },
    );
  });

  it('congestion penalty multiplier is exactly 0.8x', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.01), max: 1000, noNaN: true }),
        (baseScore) => {
          const penalised = applyRotationPenalty(baseScore, true);
          expect(penalised).toBeCloseTo(baseScore * 0.8, 5);
        },
      ),
      { numRuns: 300 },
    );
  });
});
