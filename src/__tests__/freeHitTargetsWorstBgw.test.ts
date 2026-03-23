import fc from 'fast-check';
import type { Squad, SquadPlayer, Fixture, BlankGameweek, Position, GameweekPoints } from '../models';
import { recommendFreeHit } from '../domain/chipStrategyEngine';

/**
 * For any set of available Blank Gameweeks and a squad, the recommended
 * Free Hit gameweek shall be the BGW where the squad has the most players
 * without fixtures.
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

const bgwArb: fc.Arbitrary<BlankGameweek> = fc.record({
  gameweek: fc.integer({ min: 1, max: 38 }),
  affectedTeamIds: fc.uniqueArray(fc.integer({ min: 1, max: 20 }), {
    minLength: 1,
    maxLength: 10,
  }),
});

function generateFixturesForBgws(bgws: BlankGameweek[]): fc.Arbitrary<Fixture[]> {
  return fc
    .array(fixtureArb(fc.sample(fc.integer({ min: 1, max: 38 }), 1)[0]), {
      minLength: 0,
      maxLength: 20,
    })
    .chain((baseFixtures) => {
      const bgwFixtureArbs = bgws.map((bgw) => fixtureArb(bgw.gameweek));
      if (bgwFixtureArbs.length === 0) return fc.constant(baseFixtures);
      return fc.tuple(...(bgwFixtureArbs as [fc.Arbitrary<Fixture>, ...fc.Arbitrary<Fixture>[]])).map(
        (bgwFixtures) => [...baseFixtures, ...bgwFixtures],
      );
    });
}

/**
 * Compute the number of squad players affected by a BGW (players whose
 * team is in the BGW's affected team list — i.e. players without a fixture).
 */
function countAffectedPlayers(squad: Squad, bgw: BlankGameweek): number {
  const teamSet = new Set(bgw.affectedTeamIds);
  return squad.players.filter((p) => teamSet.has(p.teamId)).length;
}

describe('Property 22: Free Hit Targets Worst BGW', () => {
  it('recommended Free Hit gameweek is the BGW with the most affected squad players', () => {
    fc.assert(
      fc.property(
        squadArb,
        fc.array(bgwArb, { minLength: 1, maxLength: 5 }).chain((bgws) => {
          const seen = new Set<number>();
          const uniqueBgws = bgws.filter((b) => {
            if (seen.has(b.gameweek)) return false;
            seen.add(b.gameweek);
            return true;
          });
          return generateFixturesForBgws(uniqueBgws).map((fixtures) => ({
            bgws: uniqueBgws,
            fixtures,
          }));
        }),
        (squad, { bgws, fixtures }) => {
          const result = recommendFreeHit(squad, fixtures, bgws);

          // When BGWs are provided, a recommendation must be returned
          expect(result).not.toBeNull();

          // The recommended gameweek must be one of the BGW gameweeks
          const bgwGameweeks = new Set(bgws.map((b) => b.gameweek));
          expect(bgwGameweeks.has(result!.recommendedGameweek)).toBe(true);

          // The recommended gameweek must be the one with the most affected players
          const maxAffected = Math.max(...bgws.map((b) => countAffectedPlayers(squad, b)));
          const recommendedBgw = bgws.find((b) => b.gameweek === result!.recommendedGameweek)!;
          expect(countAffectedPlayers(squad, recommendedBgw)).toBe(maxAffected);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('returns null when no BGWs are provided', () => {
    fc.assert(
      fc.property(
        squadArb,
        fc.array(fixtureArb(1), { minLength: 0, maxLength: 10 }),
        (squad, fixtures) => {
          const result = recommendFreeHit(squad, fixtures, []);
          expect(result).toBeNull();
        },
      ),
      { numRuns: 50 },
    );
  });

  it('chip name is always free_hit', () => {
    fc.assert(
      fc.property(
        squadArb,
        fc.array(bgwArb, { minLength: 1, maxLength: 3 }).chain((bgws) => {
          const seen = new Set<number>();
          const uniqueBgws = bgws.filter((b) => {
            if (seen.has(b.gameweek)) return false;
            seen.add(b.gameweek);
            return true;
          });
          return generateFixturesForBgws(uniqueBgws).map((fixtures) => ({
            bgws: uniqueBgws,
            fixtures,
          }));
        }),
        (squad, { bgws, fixtures }) => {
          const result = recommendFreeHit(squad, fixtures, bgws);
          expect(result).not.toBeNull();
          expect(result!.chipName).toBe('free_hit');
        },
      ),
      { numRuns: 50 },
    );
  });

  it('confidence is a valid level', () => {
    fc.assert(
      fc.property(
        squadArb,
        fc.array(bgwArb, { minLength: 1, maxLength: 3 }).chain((bgws) => {
          const seen = new Set<number>();
          const uniqueBgws = bgws.filter((b) => {
            if (seen.has(b.gameweek)) return false;
            seen.add(b.gameweek);
            return true;
          });
          return generateFixturesForBgws(uniqueBgws).map((fixtures) => ({
            bgws: uniqueBgws,
            fixtures,
          }));
        }),
        (squad, { bgws, fixtures }) => {
          const result = recommendFreeHit(squad, fixtures, bgws);
          expect(result).not.toBeNull();
          expect(['high', 'medium', 'low']).toContain(result!.confidence);
        },
      ),
      { numRuns: 50 },
    );
  });
});
