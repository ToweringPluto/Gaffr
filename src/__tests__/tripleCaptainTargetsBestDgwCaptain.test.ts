import fc from 'fast-check';
import type { Squad, SquadPlayer, Fixture, DoubleGameweek, Position, GameweekPoints } from '../models';
import { recommendTripleCaptain } from '../domain/chipStrategyEngine';

/**
 * For any set of available Double Gameweeks and a squad, the recommended
 * Triple Captain gameweek shall be the DGW that produces the highest
 * captaincy score among squad players.
 */

const positionArb: fc.Arbitrary<Position> = fc.constantFrom('GKP', 'DEF', 'MID', 'FWD');

const squadPlayerArb = (isBenched: boolean): fc.Arbitrary<SquadPlayer> =>
  fc
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
      isCaptain: fc.constant(false),
      isViceCaptain: fc.constant(false),
      isBenched: fc.constant(isBenched),
      benchOrder: fc.constant(isBenched ? 1 : 0),
      sellingPrice: fc.integer({ min: 40, max: 150 }),
    })
    .map((r) => r as SquadPlayer);

// Squad with at least one starter
const squadArb: fc.Arbitrary<Squad> = fc
  .record({
    starters: fc.array(squadPlayerArb(false), { minLength: 1, maxLength: 11 }),
    bench: fc.array(squadPlayerArb(true), { minLength: 0, maxLength: 4 }),
    budget: fc.integer({ min: 0, max: 1000 }),
    freeTransfers: fc.integer({ min: 0, max: 5 }),
  })
  .map((r) => {
    const players = [...r.starters, ...r.bench];
    const seen = new Set<number>();
    let nextId = 1;
    for (const p of players) {
      while (seen.has(nextId)) nextId++;
      p.id = nextId;
      seen.add(nextId);
      nextId++;
    }
    return { players, budget: r.budget, freeTransfers: r.freeTransfers, activeChip: null } as Squad;
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
 * Generate fixtures that include at least one fixture per DGW gameweek
 * so the engine has data to work with.
 */
function generateFixturesForDgws(dgws: DoubleGameweek[]): fc.Arbitrary<Fixture[]> {
  return fc
    .array(fixtureArb(fc.sample(fc.integer({ min: 1, max: 38 }), 1)[0]), {
      minLength: 0,
      maxLength: 20,
    })
    .chain((baseFixtures) => {
      const dgwFixtureArbs = dgws.map((dgw) => fixtureArb(dgw.gameweek));
      if (dgwFixtureArbs.length === 0) return fc.constant(baseFixtures);
      return fc
        .tuple(...(dgwFixtureArbs as [fc.Arbitrary<Fixture>, ...fc.Arbitrary<Fixture>[]]))
        .map((dgwFixtures) => [...baseFixtures, ...dgwFixtures]);
    });
}

/**
 * Replicates the engine's internal captaincy scoring logic so we can
 * independently verify which DGW should be selected.
 */
function computeBestDgwGameweek(
  squad: Squad,
  fixtures: Fixture[],
  dgws: DoubleGameweek[],
): number {
  let bestGw = dgws[0].gameweek;
  let bestScore = -Infinity;

  for (const dgw of dgws) {
    const dgwTeamSet = new Set(dgw.affectedTeamIds);
    const starters = squad.players.filter((p) => !p.isBenched && dgwTeamSet.has(p.teamId));

    for (const player of starters) {
      const gwFixtures = fixtures.filter(
        (f) =>
          f.gameweek === dgw.gameweek &&
          (f.homeTeamId === player.teamId || f.awayTeamId === player.teamId),
      );
      let fdr = 3;
      if (gwFixtures.length > 0) {
        const total = gwFixtures.reduce(
          (sum, f) =>
            sum + (f.homeTeamId === player.teamId ? f.homeTeamDifficulty : f.awayTeamDifficulty),
          0,
        );
        fdr = total / gwFixtures.length;
      }
      const score = player.form * (6 - fdr) * 1.5;
      if (score > bestScore) {
        bestScore = score;
        bestGw = dgw.gameweek;
      }
    }
  }

  return bestGw;
}

function ensureUniqueDgws(dgws: DoubleGameweek[]): DoubleGameweek[] {
  const seen = new Set<number>();
  return dgws.filter((d) => {
    if (seen.has(d.gameweek)) return false;
    seen.add(d.gameweek);
    return true;
  });
}

describe('Property 21: Triple Captain Targets Best DGW Captain', () => {
  it('recommended Triple Captain gameweek is always one of the DGW gameweeks', () => {
    fc.assert(
      fc.property(
        squadArb,
        fc.array(dgwArb, { minLength: 1, maxLength: 5 }).chain((dgws) => {
          const uniqueDgws = ensureUniqueDgws(dgws);
          return generateFixturesForDgws(uniqueDgws).map((fixtures) => ({
            dgws: uniqueDgws,
            fixtures,
          }));
        }),
        (squad, { dgws, fixtures }) => {
          const result = recommendTripleCaptain(squad, fixtures, dgws);
          expect(result).not.toBeNull();

          const dgwGameweeks = new Set(dgws.map((d) => d.gameweek));
          expect(dgwGameweeks.has(result!.recommendedGameweek)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('recommended gameweek matches the DGW with the highest captaincy score', () => {
    fc.assert(
      fc.property(
        squadArb,
        fc.array(dgwArb, { minLength: 1, maxLength: 5 }).chain((dgws) => {
          const uniqueDgws = ensureUniqueDgws(dgws);
          return generateFixturesForDgws(uniqueDgws).map((fixtures) => ({
            dgws: uniqueDgws,
            fixtures,
          }));
        }),
        (squad, { dgws, fixtures }) => {
          const result = recommendTripleCaptain(squad, fixtures, dgws);
          expect(result).not.toBeNull();

          const expectedGw = computeBestDgwGameweek(squad, fixtures, dgws);
          expect(result!.recommendedGameweek).toBe(expectedGw);
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
          const result = recommendTripleCaptain(squad, fixtures, []);
          expect(result).toBeNull();
        },
      ),
      { numRuns: 50 },
    );
  });

  it('chip name is always triple_captain', () => {
    fc.assert(
      fc.property(
        squadArb,
        fc.array(dgwArb, { minLength: 1, maxLength: 3 }).chain((dgws) => {
          const uniqueDgws = ensureUniqueDgws(dgws);
          return generateFixturesForDgws(uniqueDgws).map((fixtures) => ({
            dgws: uniqueDgws,
            fixtures,
          }));
        }),
        (squad, { dgws, fixtures }) => {
          const result = recommendTripleCaptain(squad, fixtures, dgws);
          expect(result).not.toBeNull();
          expect(result!.chipName).toBe('triple_captain');
        },
      ),
      { numRuns: 50 },
    );
  });

  it('confidence is a valid level', () => {
    fc.assert(
      fc.property(
        squadArb,
        fc.array(dgwArb, { minLength: 1, maxLength: 3 }).chain((dgws) => {
          const uniqueDgws = ensureUniqueDgws(dgws);
          return generateFixturesForDgws(uniqueDgws).map((fixtures) => ({
            dgws: uniqueDgws,
            fixtures,
          }));
        }),
        (squad, { dgws, fixtures }) => {
          const result = recommendTripleCaptain(squad, fixtures, dgws);
          expect(result).not.toBeNull();
          expect(['high', 'medium', 'low']).toContain(result!.confidence);
        },
      ),
      { numRuns: 50 },
    );
  });
});
