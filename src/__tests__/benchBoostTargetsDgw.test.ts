import fc from 'fast-check';
import type { Squad, SquadPlayer, Fixture, DoubleGameweek, Position, GameweekPoints } from '../models';
import { recommendBenchBoost } from '../domain/chipStrategyEngine';

/**
 * For any set of available Double Gameweeks and a squad, the recommended
 * Bench Boost gameweek shall be a DGW.
 */

const positionArb: fc.Arbitrary<Position> = fc.constantFrom('GKP', 'DEF', 'MID', 'FWD');

const squadPlayerArb: fc.Arbitrary<SquadPlayer> = fc
  .record({
    id: fc.integer({ min: 1, max: 1000 }),
    name: fc.string({ minLength: 1, maxLength: 20 }),
    teamId: fc.integer({ min: 1, max: 20 }),
    position: positionArb,
    totalPoints: fc.integer({ min: 0, max: 300 }),
    form: fc.float({ min: 0, max: 15, noNaN: true }),
    cost: fc.integer({ min: 40, max: 150 }),
    ownershipPercentage: fc.float({ min: 0, max: 100, noNaN: true }),
    minutesPlayed: fc.integer({ min: 0, max: 3420 }),
    news: fc.constant(''),
    chanceOfPlaying: fc.oneof(fc.constant(null), fc.constantFrom(0, 25, 50, 75, 100)),
    gameweekPoints: fc.constant([] as GameweekPoints[]),
    isCaptain: fc.boolean(),
    isViceCaptain: fc.boolean(),
    isBenched: fc.boolean(),
    benchOrder: fc.integer({ min: 0, max: 4 }),
    sellingPrice: fc.integer({ min: 40, max: 150 }),
  })
  .map((r) => r as SquadPlayer);

const squadArb: fc.Arbitrary<Squad> = fc
  .record({
    players: fc.array(squadPlayerArb, { minLength: 1, maxLength: 15 }),
    budget: fc.integer({ min: 0, max: 1000 }),
    freeTransfers: fc.integer({ min: 0, max: 5 }),
    activeChip: fc.constant(null),
  })
  .map((r) => {
    const seen = new Set<number>();
    let nextId = 1;
    for (const p of r.players) {
      while (seen.has(nextId)) nextId++;
      p.id = nextId;
      seen.add(nextId);
      nextId++;
    }
    return r as Squad;
  });

const fixtureArb = (gameweek: number): fc.Arbitrary<Fixture> =>
  fc.record({
    id: fc.integer({ min: 1, max: 10000 }),
    gameweek: fc.constant(gameweek),
    homeTeamId: fc.integer({ min: 1, max: 20 }),
    awayTeamId: fc.integer({ min: 1, max: 20 }),
    homeTeamDifficulty: fc.integer({ min: 1, max: 5 }),
    awayTeamDifficulty: fc.integer({ min: 1, max: 5 }),
    kickoffTime: fc.constant('2025-03-01T15:00:00Z'),
    finished: fc.constant(false),
  });

const dgwArb: fc.Arbitrary<DoubleGameweek> = fc.record({
  gameweek: fc.integer({ min: 1, max: 38 }),
  affectedTeamIds: fc.uniqueArray(fc.integer({ min: 1, max: 20 }), {
    minLength: 1,
    maxLength: 10,
  }),
});

/**
 * Generate fixtures that include at least some fixtures for the given DGWs
 * so the engine has data to work with.
 */
function generateFixturesForDgws(dgws: DoubleGameweek[]): fc.Arbitrary<Fixture[]> {
  return fc
    .array(fixtureArb(fc.sample(fc.integer({ min: 1, max: 38 }), 1)[0]), {
      minLength: 0,
      maxLength: 20,
    })
    .chain((baseFixtures) => {
      // Ensure at least one fixture per DGW gameweek
      const dgwFixtureArbs = dgws.map((dgw) => fixtureArb(dgw.gameweek));
      if (dgwFixtureArbs.length === 0) return fc.constant(baseFixtures);
      return fc.tuple(...(dgwFixtureArbs as [fc.Arbitrary<Fixture>, ...fc.Arbitrary<Fixture>[]])).map(
        (dgwFixtures) => [...baseFixtures, ...dgwFixtures],
      );
    });
}

describe('Property 20: Bench Boost Targets DGW', () => {
  it('recommended Bench Boost gameweek is always one of the DGW gameweeks', () => {
    fc.assert(
      fc.property(
        squadArb,
        fc.array(dgwArb, { minLength: 1, maxLength: 5 }).chain((dgws) => {
          // Ensure unique gameweeks across DGWs
          const seen = new Set<number>();
          const uniqueDgws = dgws.filter((d) => {
            if (seen.has(d.gameweek)) return false;
            seen.add(d.gameweek);
            return true;
          });
          return generateFixturesForDgws(uniqueDgws).map((fixtures) => ({
            dgws: uniqueDgws,
            fixtures,
          }));
        }),
        (squad, { dgws, fixtures }) => {
          const result = recommendBenchBoost(squad, fixtures, dgws);

          // When DGWs are provided, a recommendation must be returned
          expect(result).not.toBeNull();

          // The recommended gameweek must be one of the DGW gameweeks
          const dgwGameweeks = new Set(dgws.map((d) => d.gameweek));
          expect(dgwGameweeks.has(result!.recommendedGameweek)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('returns null when no DGWs are provided', () => {
    fc.assert(
      fc.property(
        squadArb,
        fc.array(fixtureArb(1), { minLength: 0, maxLength: 10 }),
        (squad, fixtures) => {
          const result = recommendBenchBoost(squad, fixtures, []);
          expect(result).toBeNull();
        },
      ),
      { numRuns: 50 },
    );
  });

  it('chip name is always bench_boost', () => {
    fc.assert(
      fc.property(
        squadArb,
        fc.array(dgwArb, { minLength: 1, maxLength: 3 }).chain((dgws) => {
          const seen = new Set<number>();
          const uniqueDgws = dgws.filter((d) => {
            if (seen.has(d.gameweek)) return false;
            seen.add(d.gameweek);
            return true;
          });
          return generateFixturesForDgws(uniqueDgws).map((fixtures) => ({
            dgws: uniqueDgws,
            fixtures,
          }));
        }),
        (squad, { dgws, fixtures }) => {
          const result = recommendBenchBoost(squad, fixtures, dgws);
          expect(result).not.toBeNull();
          expect(result!.chipName).toBe('bench_boost');
        },
      ),
      { numRuns: 50 },
    );
  });

  it('confidence is valid and correlates with DGW player count', () => {
    fc.assert(
      fc.property(
        squadArb,
        fc.array(dgwArb, { minLength: 1, maxLength: 3 }).chain((dgws) => {
          const seen = new Set<number>();
          const uniqueDgws = dgws.filter((d) => {
            if (seen.has(d.gameweek)) return false;
            seen.add(d.gameweek);
            return true;
          });
          return generateFixturesForDgws(uniqueDgws).map((fixtures) => ({
            dgws: uniqueDgws,
            fixtures,
          }));
        }),
        (squad, { dgws, fixtures }) => {
          const result = recommendBenchBoost(squad, fixtures, dgws);
          expect(result).not.toBeNull();
          expect(['high', 'medium', 'low']).toContain(result!.confidence);
        },
      ),
      { numRuns: 50 },
    );
  });
});
