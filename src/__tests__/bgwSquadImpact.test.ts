import fc from 'fast-check';
import type { Squad, SquadPlayer, BlankGameweek, Position, GameweekPoints } from '../models';
import { getAffectedSquadPlayersBgw } from '../domain/bgwDgwPlanner';

/**
 * For any squad and Blank Gameweek, the set of highlighted players shall be
 * exactly those squad players whose team appears in the BGW affected team list,
 * and the count of affected players shall equal the size of that set.
 */

const positionArb: fc.Arbitrary<Position> = fc.constantFrom(
  'GKP',
  'DEF',
  'MID',
  'FWD',
);

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
    chanceOfPlaying: fc.oneof(
      fc.constant(null),
      fc.constantFrom(0, 25, 50, 75, 100),
    ),
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
    // Ensure unique player ids within a squad
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

const bgwArb: fc.Arbitrary<BlankGameweek> = fc.record({
  gameweek: fc.integer({ min: 1, max: 38 }),
  affectedTeamIds: fc.uniqueArray(fc.integer({ min: 1, max: 20 }), {
    minLength: 0,
    maxLength: 10,
  }),
});

describe('Property 10: BGW Squad Impact', () => {
  it('affected players are exactly those whose teamId is in bgw.affectedTeamIds (no false positives, no false negatives)', () => {
    fc.assert(
      fc.property(squadArb, bgwArb, (squad, bgw) => {
        const result = getAffectedSquadPlayersBgw(squad, bgw);
        const affectedTeamSet = new Set(bgw.affectedTeamIds);

        // Every returned player must have a teamId in the affected set
        for (const player of result.affectedPlayers) {
          expect(affectedTeamSet.has(player.teamId)).toBe(true);
        }

        // Every squad player whose teamId IS in the affected set must be returned
        const expectedPlayers = squad.players.filter((p) =>
          affectedTeamSet.has(p.teamId),
        );
        expect(result.affectedPlayers).toHaveLength(expectedPlayers.length);

        const resultIds = new Set(result.affectedPlayers.map((p) => p.id));
        for (const ep of expectedPlayers) {
          expect(resultIds.has(ep.id)).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('affectedCount equals the length of affectedPlayers', () => {
    fc.assert(
      fc.property(squadArb, bgwArb, (squad, bgw) => {
        const result = getAffectedSquadPlayersBgw(squad, bgw);
        expect(result.affectedCount).toBe(result.affectedPlayers.length);
      }),
      { numRuns: 100 },
    );
  });

  it('squad players NOT in the BGW affected list are NOT in the result', () => {
    fc.assert(
      fc.property(squadArb, bgwArb, (squad, bgw) => {
        const result = getAffectedSquadPlayersBgw(squad, bgw);
        const affectedTeamSet = new Set(bgw.affectedTeamIds);

        const unaffectedPlayers = squad.players.filter(
          (p) => !affectedTeamSet.has(p.teamId),
        );
        const resultIds = new Set(result.affectedPlayers.map((p) => p.id));

        for (const player of unaffectedPlayers) {
          expect(resultIds.has(player.id)).toBe(false);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('result gameweek matches the BGW gameweek', () => {
    fc.assert(
      fc.property(squadArb, bgwArb, (squad, bgw) => {
        const result = getAffectedSquadPlayersBgw(squad, bgw);
        expect(result.gameweek).toBe(bgw.gameweek);
      }),
      { numRuns: 100 },
    );
  });
});
