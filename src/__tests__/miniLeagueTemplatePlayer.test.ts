import fc from 'fast-check';
import type { Player, MiniLeagueStanding } from '../models';
import { identifyTemplatePlayers } from '../domain/miniLeagueAnalyser';

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

const standingArb = (squad: Player[], index: number): fc.Arbitrary<MiniLeagueStanding> =>
  fc
    .record({
      totalPoints: fc.integer({ min: 0, max: 3000 }),
      gameweekPoints: fc.integer({ min: 0, max: 150 }),
    })
    .map((r) => ({
      ...r,
      managerId: index + 1,
      managerName: `Manager ${index + 1}`,
      teamName: `Team ${index + 1}`,
      rank: index + 1,
      captainId: squad.length > 0 ? squad[0].id : 0,
      squad,
    }));

describe('Property 38: Mini-League Template Player Identification', () => {
  it('every template player is owned by >50% of rivals', () => {
    fc.assert(
      fc.property(
        // Generate a pool of 5 distinct players
        fc.tuple(
          playerArb(1),
          playerArb(2),
          playerArb(3),
          playerArb(4),
          playerArb(5),
        ),
        fc.integer({ min: 2, max: 8 }),
        (playerPool, rivalCount) => {
          // Each rival gets a random subset of the player pool
          const rivals: MiniLeagueStanding[] = [];
          for (let i = 0; i < rivalCount; i++) {
            // Deterministic subset based on index bits
            const squad = playerPool.filter((_, idx) => ((i + idx) % 3) !== 0);
            rivals.push({
              managerId: i + 1,
              managerName: `Manager ${i + 1}`,
              teamName: `Team ${i + 1}`,
              rank: i + 1,
              totalPoints: 1000,
              gameweekPoints: 50,
              captainId: squad.length > 0 ? squad[0].id : 0,
              squad,
            });
          }

          const templates = identifyTemplatePlayers(rivals);

          // Every returned template player must be owned by >50% of rivals
          for (const tp of templates) {
            const ownerCount = rivals.filter((r) =>
              r.squad.some((p) => p.id === tp.player.id),
            ).length;
            expect(ownerCount / rivals.length).toBeGreaterThan(0.5);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it('no non-template player is owned by >50% of rivals', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          playerArb(10),
          playerArb(20),
          playerArb(30),
          playerArb(40),
        ),
        fc.integer({ min: 2, max: 10 }),
        (playerPool, rivalCount) => {
          const rivals: MiniLeagueStanding[] = [];
          for (let i = 0; i < rivalCount; i++) {
            const squad = playerPool.filter((_, idx) => ((i * 3 + idx) % 4) !== 0);
            rivals.push({
              managerId: i + 1,
              managerName: `Manager ${i + 1}`,
              teamName: `Team ${i + 1}`,
              rank: i + 1,
              totalPoints: 1000,
              gameweekPoints: 50,
              captainId: squad.length > 0 ? squad[0].id : 0,
              squad,
            });
          }

          const templates = identifyTemplatePlayers(rivals);
          const templateIds = new Set(templates.map((t) => t.player.id));

          // Collect all unique player ids across all rival squads
          const allPlayerIds = new Set<number>();
          for (const rival of rivals) {
            for (const p of rival.squad) {
              allPlayerIds.add(p.id);
            }
          }

          // Any player NOT in templates must be owned by <=50%
          for (const pid of allPlayerIds) {
            if (!templateIds.has(pid)) {
              const ownerCount = rivals.filter((r) =>
                r.squad.some((p) => p.id === pid),
              ).length;
              expect(ownerCount / rivals.length).toBeLessThanOrEqual(0.5);
            }
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it('ownershipInLeague equals actual ownership percentage', () => {
    fc.assert(
      fc.property(
        fc.tuple(playerArb(1), playerArb(2), playerArb(3)),
        fc.integer({ min: 3, max: 10 }),
        (playerPool, rivalCount) => {
          const rivals: MiniLeagueStanding[] = [];
          for (let i = 0; i < rivalCount; i++) {
            // Give every rival the first player so it's always template
            const squad = [playerPool[0], ...playerPool.slice(1).filter((_, idx) => (i + idx) % 2 === 0)];
            rivals.push({
              managerId: i + 1,
              managerName: `Manager ${i + 1}`,
              teamName: `Team ${i + 1}`,
              rank: i + 1,
              totalPoints: 1000,
              gameweekPoints: 50,
              captainId: squad[0].id,
              squad,
            });
          }

          const templates = identifyTemplatePlayers(rivals);

          for (const tp of templates) {
            const ownerCount = rivals.filter((r) =>
              r.squad.some((p) => p.id === tp.player.id),
            ).length;
            const expectedPct = (ownerCount / rivals.length) * 100;
            expect(Math.abs(tp.ownershipInLeague - expectedPct)).toBeLessThan(0.001);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it('returns empty array when no player exceeds 50% ownership', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 10 }),
        (rivalCount) => {
          // Each rival has a unique player that no one else has
          const rivals: MiniLeagueStanding[] = [];
          for (let i = 0; i < rivalCount; i++) {
            const uniquePlayer: Player = {
              id: 100 + i,
              name: `UNIQUE${i}`,
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
            rivals.push({
              managerId: i + 1,
              managerName: `Manager ${i + 1}`,
              teamName: `Team ${i + 1}`,
              rank: i + 1,
              totalPoints: 1000,
              gameweekPoints: 50,
              captainId: uniquePlayer.id,
              squad: [uniquePlayer],
            });
          }

          const templates = identifyTemplatePlayers(rivals);
          expect(templates).toEqual([]);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('template results are sorted by ownershipInLeague descending', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          playerArb(1),
          playerArb(2),
          playerArb(3),
          playerArb(4),
        ),
        fc.integer({ min: 3, max: 8 }),
        (playerPool, rivalCount) => {
          const rivals: MiniLeagueStanding[] = [];
          for (let i = 0; i < rivalCount; i++) {
            // Vary squad composition so different players get different ownership
            const squad = playerPool.filter((_, idx) => (i + idx) % 2 === 0 || idx === 0);
            rivals.push({
              managerId: i + 1,
              managerName: `Manager ${i + 1}`,
              teamName: `Team ${i + 1}`,
              rank: i + 1,
              totalPoints: 1000,
              gameweekPoints: 50,
              captainId: squad[0].id,
              squad,
            });
          }

          const templates = identifyTemplatePlayers(rivals);

          // Verify descending order of ownershipInLeague
          for (let i = 1; i < templates.length; i++) {
            expect(templates[i - 1].ownershipInLeague).toBeGreaterThanOrEqual(
              templates[i].ownershipInLeague,
            );
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});
