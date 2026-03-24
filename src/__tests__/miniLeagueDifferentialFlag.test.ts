import fc from 'fast-check';
import type { Player, MiniLeagueStanding } from '../models';
import { flagDifferential } from '../domain/miniLeagueAnalyser';

// --- Arbitraries ---

const playerArb = (id: number): fc.Arbitrary<Player> =>
  fc
    .record({
      name: fc.string({ minLength: 1, maxLength: 10 }),
      teamId: fc.integer({ min: 1, max: 20 }),
      position: fc.constantFrom('GKP' as const, 'DEF' as const, 'MID' as const, 'FWD' as const),
      totalPoints: fc.integer({ min: 0, max: 300 }),
      form: fc.float({ min: 0, max: 15, noNaN: true }),
      cost: fc.integer({ min: 40, max: 150 }),
      ownershipPercentage: fc.float({ min: 0, max: 100, noNaN: true }),
      minutesPlayed: fc.integer({ min: 0, max: 3420 }),
    })
    .map((r) => ({
      ...r,
      id,
      news: '',
      chanceOfPlaying: null,
      gameweekPoints: [],
    }));

function makeRivals(
  squads: Player[][],
): MiniLeagueStanding[] {
  return squads.map((squad, i) => ({
    managerId: i + 1,
    managerName: `Manager ${i + 1}`,
    teamName: `Team ${i + 1}`,
    rank: i + 1,
    totalPoints: 1000,
    gameweekPoints: 50,
    captainId: squad.length > 0 ? squad[0].id : 0,
    squad,
  }));
}

describe('Property 39: Mini-League Differential Flag', () => {
  it('player owned by no rival is always a differential for any positive threshold', () => {
    fc.assert(
      fc.property(
        playerArb(99),
        fc.integer({ min: 2, max: 10 }),
        fc.integer({ min: 1, max: 100 }),
        (player, rivalCount, threshold) => {
          // No rival owns the player
          const rivals = makeRivals(
            Array.from({ length: rivalCount }, () => []),
          );

          expect(flagDifferential(player, rivals, threshold)).toBe(true);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('player owned by all rivals is never a differential for threshold <= 100', () => {
    fc.assert(
      fc.property(
        playerArb(42),
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 1, max: 100 }),
        (player, rivalCount, threshold) => {
          // Every rival owns the player
          const rivals = makeRivals(
            Array.from({ length: rivalCount }, () => [player]),
          );

          // Ownership is 100%, which is not < any threshold in [1,100]
          expect(flagDifferential(player, rivals, threshold)).toBe(false);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('differential flag is consistent with actual ownership percentage < threshold', () => {
    fc.assert(
      fc.property(
        playerArb(7),
        fc.integer({ min: 2, max: 15 }),
        fc.integer({ min: 1, max: 100 }),
        (player, rivalCount, threshold) => {
          // Randomly assign the player to some rivals using a deterministic pattern
          const squads: Player[][] = [];
          for (let i = 0; i < rivalCount; i++) {
            squads.push(i % 3 === 0 ? [player] : []);
          }
          const rivals = makeRivals(squads);

          const ownerCount = rivals.filter((r) =>
            r.squad.some((p) => p.id === player.id),
          ).length;
          const ownershipPct = (ownerCount / rivals.length) * 100;
          const expected = ownershipPct < threshold;

          expect(flagDifferential(player, rivals, threshold)).toBe(expected);
        },
      ),
      { numRuns: 300 },
    );
  });

  it('increasing the threshold can only keep or widen the differential classification', () => {
    fc.assert(
      fc.property(
        playerArb(5),
        fc.integer({ min: 2, max: 10 }),
        fc.integer({ min: 1, max: 50 }),
        fc.integer({ min: 1, max: 50 }),
        (player, rivalCount, t1, t2) => {
          const lowerThreshold = Math.min(t1, t2);
          const higherThreshold = Math.max(t1, t2);

          const squads: Player[][] = [];
          for (let i = 0; i < rivalCount; i++) {
            squads.push(i % 4 === 0 ? [player] : []);
          }
          const rivals = makeRivals(squads);

          const diffAtLower = flagDifferential(player, rivals, lowerThreshold);
          const diffAtHigher = flagDifferential(player, rivals, higherThreshold);

          // If differential at lower threshold, must also be differential at higher
          if (diffAtLower) {
            expect(diffAtHigher).toBe(true);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it('returns false for empty rivals regardless of threshold', () => {
    fc.assert(
      fc.property(
        playerArb(1),
        fc.integer({ min: 1, max: 100 }),
        (player, threshold) => {
          expect(flagDifferential(player, [], threshold)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});
