import fc from 'fast-check';
import type { Fixture } from '../models';
import {
  detectBlankGameweeks,
  detectDoubleGameweeks,
} from '../domain/fixtureAnalyser';

/**
 * For any set of fixtures and a gameweek number, a team with zero fixtures
 * in that gameweek shall be detected as a Blank Gameweek team, and a team
 * with two or more fixtures shall be detected as a Double Gameweek team.
 */

function makeFixture(
  overrides: Partial<Fixture> &
    Pick<Fixture, 'id' | 'gameweek' | 'homeTeamId' | 'awayTeamId'>,
): Fixture {
  return {
    homeTeamDifficulty: 3,
    awayTeamDifficulty: 3,
    kickoffTime: '2025-01-01T15:00:00Z',
    finished: false,
    ...overrides,
  };
}

/** Arbitrary for a single fixture with constrained team IDs and gameweeks. */
const fixtureArb = fc
  .record({
    id: fc.integer({ min: 1, max: 10000 }),
    gameweek: fc.integer({ min: 1, max: 38 }),
    homeTeamId: fc.integer({ min: 1, max: 20 }),
    awayTeamId: fc.integer({ min: 1, max: 20 }),
    homeTeamDifficulty: fc.integer({ min: 1, max: 5 }),
    awayTeamDifficulty: fc.integer({ min: 1, max: 5 }),
  })
  .filter((f) => f.homeTeamId !== f.awayTeamId)
  .map((f) => makeFixture(f));

describe('Property 4: BGW/DGW Detection', () => {
  it('any team with zero fixtures in a gameweek appears in BGW affectedTeamIds', () => {
    fc.assert(
      fc.property(
        fc.array(fixtureArb, { minLength: 1, maxLength: 30 }),
        fc.uniqueArray(fc.integer({ min: 1, max: 20 }), { minLength: 1, maxLength: 20 }),
        (fixtures, allTeamIds) => {
          const bgws = detectBlankGameweeks(fixtures, allTeamIds);

          // For each gameweek present in fixtures, check that teams with no
          // fixtures in that GW are listed as affected
          const gameweeks = [...new Set(fixtures.map((f) => f.gameweek))];

          for (const gw of gameweeks) {
            const teamsWithFixtures = new Set<number>();
            for (const f of fixtures) {
              if (f.gameweek === gw) {
                teamsWithFixtures.add(f.homeTeamId);
                teamsWithFixtures.add(f.awayTeamId);
              }
            }

            const teamsWithoutFixtures = allTeamIds.filter(
              (id) => !teamsWithFixtures.has(id),
            );

            const bgwEntry = bgws.find((b) => b.gameweek === gw);

            for (const teamId of teamsWithoutFixtures) {
              expect(bgwEntry).toBeDefined();
              expect(bgwEntry!.affectedTeamIds).toContain(teamId);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('teams that DO have fixtures in a gameweek are NOT in BGW affectedTeamIds', () => {
    fc.assert(
      fc.property(
        fc.array(fixtureArb, { minLength: 1, maxLength: 30 }),
        fc.uniqueArray(fc.integer({ min: 1, max: 20 }), { minLength: 1, maxLength: 20 }),
        (fixtures, allTeamIds) => {
          const bgws = detectBlankGameweeks(fixtures, allTeamIds);

          const gameweeks = [...new Set(fixtures.map((f) => f.gameweek))];

          for (const gw of gameweeks) {
            const teamsWithFixtures = new Set<number>();
            for (const f of fixtures) {
              if (f.gameweek === gw) {
                teamsWithFixtures.add(f.homeTeamId);
                teamsWithFixtures.add(f.awayTeamId);
              }
            }

            const bgwEntry = bgws.find((b) => b.gameweek === gw);
            if (bgwEntry) {
              for (const teamId of teamsWithFixtures) {
                expect(bgwEntry.affectedTeamIds).not.toContain(teamId);
              }
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('any team with 2+ fixtures in a gameweek appears in DGW affectedTeamIds', () => {
    fc.assert(
      fc.property(
        fc.array(fixtureArb, { minLength: 1, maxLength: 30 }),
        (fixtures) => {
          const dgws = detectDoubleGameweeks(fixtures);

          // Count fixtures per team per gameweek
          const counts = new Map<number, Map<number, number>>();
          for (const f of fixtures) {
            if (!counts.has(f.gameweek)) {
              counts.set(f.gameweek, new Map());
            }
            const gwMap = counts.get(f.gameweek)!;
            gwMap.set(f.homeTeamId, (gwMap.get(f.homeTeamId) ?? 0) + 1);
            gwMap.set(f.awayTeamId, (gwMap.get(f.awayTeamId) ?? 0) + 1);
          }

          for (const [gw, teamCounts] of counts) {
            for (const [teamId, count] of teamCounts) {
              if (count >= 2) {
                const dgwEntry = dgws.find((d) => d.gameweek === gw);
                expect(dgwEntry).toBeDefined();
                expect(dgwEntry!.affectedTeamIds).toContain(teamId);
              }
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('teams with exactly 1 fixture in a gameweek are NOT in DGW affectedTeamIds', () => {
    fc.assert(
      fc.property(
        fc.array(fixtureArb, { minLength: 1, maxLength: 30 }),
        (fixtures) => {
          const dgws = detectDoubleGameweeks(fixtures);

          // Count fixtures per team per gameweek
          const counts = new Map<number, Map<number, number>>();
          for (const f of fixtures) {
            if (!counts.has(f.gameweek)) {
              counts.set(f.gameweek, new Map());
            }
            const gwMap = counts.get(f.gameweek)!;
            gwMap.set(f.homeTeamId, (gwMap.get(f.homeTeamId) ?? 0) + 1);
            gwMap.set(f.awayTeamId, (gwMap.get(f.awayTeamId) ?? 0) + 1);
          }

          for (const [gw, teamCounts] of counts) {
            const dgwEntry = dgws.find((d) => d.gameweek === gw);
            for (const [teamId, count] of teamCounts) {
              if (count === 1 && dgwEntry) {
                expect(dgwEntry.affectedTeamIds).not.toContain(teamId);
              }
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('BGW and DGW are mutually exclusive per team per gameweek', () => {
    fc.assert(
      fc.property(
        fc.array(fixtureArb, { minLength: 1, maxLength: 30 }),
        fc.uniqueArray(fc.integer({ min: 1, max: 20 }), { minLength: 1, maxLength: 20 }),
        (fixtures, allTeamIds) => {
          const bgws = detectBlankGameweeks(fixtures, allTeamIds);
          const dgws = detectDoubleGameweeks(fixtures);

          for (const bgw of bgws) {
            const dgwEntry = dgws.find((d) => d.gameweek === bgw.gameweek);
            if (dgwEntry) {
              // No team should appear in both BGW and DGW for the same gameweek
              const overlap = bgw.affectedTeamIds.filter((id) =>
                dgwEntry.affectedTeamIds.includes(id),
              );
              expect(overlap).toEqual([]);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
