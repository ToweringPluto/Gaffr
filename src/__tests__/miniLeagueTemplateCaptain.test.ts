import fc from 'fast-check';
import type { Player, MiniLeagueStanding } from '../models';
import { getTemplateCaptain } from '../domain/miniLeagueAnalyser';

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
  entries: { squad: Player[]; captainId: number }[],
): MiniLeagueStanding[] {
  return entries.map((e, i) => ({
    managerId: i + 1,
    managerName: `Manager ${i + 1}`,
    teamName: `Team ${i + 1}`,
    rank: i + 1,
    totalPoints: 1000,
    gameweekPoints: 50,
    captainId: e.captainId,
    squad: e.squad,
  }));
}

describe('Property 40: Mini-League Template Captain', () => {
  it('returns null for empty rivals', () => {
    expect(getTemplateCaptain([])).toBeNull();
  });

  it('when a player is captained by >50% of rivals, that player is returned', () => {
    fc.assert(
      fc.property(
        playerArb(1),
        playerArb(2),
        fc.integer({ min: 3, max: 12 }),
        (majorityPlayer, otherPlayer, rivalCount) => {
          // Give the majority player captaincy to more than half the rivals
          const majorityCount = Math.floor(rivalCount / 2) + 1;
          const entries: { squad: Player[]; captainId: number }[] = [];

          for (let i = 0; i < rivalCount; i++) {
            if (i < majorityCount) {
              entries.push({
                squad: [majorityPlayer, otherPlayer],
                captainId: majorityPlayer.id,
              });
            } else {
              entries.push({
                squad: [majorityPlayer, otherPlayer],
                captainId: otherPlayer.id,
              });
            }
          }

          const result = getTemplateCaptain(makeRivals(entries));
          expect(result).not.toBeNull();
          expect(result!.id).toBe(majorityPlayer.id);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('returns null when no player is captained by >50% of rivals', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 4, max: 10 }),
        (rivalCount) => {
          // Each rival captains a unique player — no one gets majority
          const entries: { squad: Player[]; captainId: number }[] = [];
          for (let i = 0; i < rivalCount; i++) {
            const player: Player = {
              id: 100 + i,
              name: `PLAYER${i}`,
              teamId: 1,
              position: 'MID',
              totalPoints: 50,
              form: 5,
              cost: 80,
              ownershipPercentage: 10,
              minutesPlayed: 900,
              news: '',
              chanceOfPlaying: null,
              gameweekPoints: [],
            };
            entries.push({ squad: [player], captainId: player.id });
          }

          expect(getTemplateCaptain(makeRivals(entries))).toBeNull();
        },
      ),
      { numRuns: 200 },
    );
  });

  it('returned template captain is always a member of at least one rival squad', () => {
    fc.assert(
      fc.property(
        playerArb(1),
        playerArb(2),
        fc.integer({ min: 2, max: 10 }),
        (p1, p2, rivalCount) => {
          const majorityCount = Math.floor(rivalCount / 2) + 1;
          const entries: { squad: Player[]; captainId: number }[] = [];

          for (let i = 0; i < rivalCount; i++) {
            const captain = i < majorityCount ? p1 : p2;
            entries.push({
              squad: [p1, p2],
              captainId: captain.id,
            });
          }

          const result = getTemplateCaptain(makeRivals(entries));
          if (result !== null) {
            const rivals = makeRivals(entries);
            const existsInSquad = rivals.some((r) =>
              r.squad.some((p) => p.id === result.id),
            );
            expect(existsInSquad).toBe(true);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it('exactly 50% captaincy does not qualify as majority', () => {
    fc.assert(
      fc.property(
        playerArb(1),
        playerArb(2),
        // Use even rival counts so exactly 50% is possible
        fc.integer({ min: 1, max: 5 }).map((n) => n * 2),
        (p1, p2, rivalCount) => {
          const halfCount = rivalCount / 2;
          const entries: { squad: Player[]; captainId: number }[] = [];

          for (let i = 0; i < rivalCount; i++) {
            entries.push({
              squad: [p1, p2],
              captainId: i < halfCount ? p1.id : p2.id,
            });
          }

          // Neither player has >50%, so result should be null
          expect(getTemplateCaptain(makeRivals(entries))).toBeNull();
        },
      ),
      { numRuns: 200 },
    );
  });

  it('rivals whose captainId is not in their squad are ignored gracefully', () => {
    fc.assert(
      fc.property(
        playerArb(1),
        fc.integer({ min: 3, max: 8 }),
        (player, rivalCount) => {
          const majorityCount = Math.floor(rivalCount / 2) + 1;
          const entries: { squad: Player[]; captainId: number }[] = [];

          for (let i = 0; i < rivalCount; i++) {
            if (i < majorityCount) {
              // Valid captain
              entries.push({ squad: [player], captainId: player.id });
            } else {
              // Captain id doesn't match any squad player — should be skipped
              entries.push({ squad: [player], captainId: 9999 });
            }
          }

          const result = getTemplateCaptain(makeRivals(entries));
          // majorityCount > rivalCount / 2, so player should be template captain
          expect(result).not.toBeNull();
          expect(result!.id).toBe(player.id);
        },
      ),
      { numRuns: 200 },
    );
  });
});
