import fc from 'fast-check';
import type { Player, Position, FixtureDetail, H2HRecord } from '../models';
import {
  calculateCaptaincyScore,
  applyDgwBoost,
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
  isDgw: fc.constant(false), // base: non-DGW
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

describe('Property 16: DGW Captaincy Boost', () => {
  /**
   * For any player and fixture data, the captaincy score calculated
   * with a Double Gameweek fixture shall be strictly greater than the
   * captaincy score calculated without a DGW, all other inputs being equal.
   */

  it('applyDgwBoost with isDgw=true returns strictly greater score than isDgw=false', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.01), max: 1000, noNaN: true }),
        (baseScore) => {
          const withoutDgw = applyDgwBoost(baseScore, false);
          const withDgw = applyDgwBoost(baseScore, true);

          expect(withDgw).toBeGreaterThan(withoutDgw);
        },
      ),
      { numRuns: 500 },
    );
  });

  it('applyDgwBoost with isDgw=false returns the original score unchanged', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 1000, noNaN: true }),
        (baseScore) => {
          expect(applyDgwBoost(baseScore, false)).toBe(baseScore);
        },
      ),
      { numRuns: 300 },
    );
  });

  it('full captaincy score with DGW fixture is strictly greater than without DGW, all else equal', () => {
    fc.assert(
      fc.property(
        arbPlayer,
        arbFixtureDetail,
        arbH2HRecord,
        (player, baseFixture, h2h) => {
          const nonDgwFixture: FixtureDetail = { ...baseFixture, isDgw: false };
          const dgwFixture: FixtureDetail = { ...baseFixture, isDgw: true };

          const baseScore = calculateCaptaincyScore(player, nonDgwFixture, h2h);
          const dgwScore = applyDgwBoost(
            calculateCaptaincyScore(player, dgwFixture, h2h),
            true,
          );
          const nonDgwScore = applyDgwBoost(baseScore, false);

          // The base calculateCaptaincyScore doesn't use isDgw internally,
          // so both base scores are equal. The boost comes from applyDgwBoost.
          // As long as the base score is positive, DGW score > non-DGW score.
          if (nonDgwScore > 0) {
            expect(dgwScore).toBeGreaterThan(nonDgwScore);
          }
        },
      ),
      { numRuns: 500 },
    );
  });

  it('DGW boost multiplier is exactly 1.5x', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.01), max: 1000, noNaN: true }),
        (baseScore) => {
          const boosted = applyDgwBoost(baseScore, true);
          expect(boosted).toBeCloseTo(baseScore * 1.5, 5);
        },
      ),
      { numRuns: 300 },
    );
  });
});
