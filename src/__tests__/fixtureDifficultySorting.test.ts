import fc from 'fast-check';
import type { FixturesByTeam } from '../models';
import { sortTeamsByDifficulty } from '../domain/fixtureAnalyser';

/**
 * For any list of teams with fixture data over a selected gameweek range,
 * sorting by cumulative fixture difficulty shall produce a list in
 * non-decreasing order of cumulative difficulty.
 */

/** Arbitrary for a single FixturesByTeam with varying teamId, teamName, and cumulativeDifficulty. */
const fixturesByTeamArb: fc.Arbitrary<FixturesByTeam> = fc.record({
  teamId: fc.integer({ min: 1, max: 100 }),
  teamName: fc.string({ minLength: 1, maxLength: 20 }),
  fixtures: fc.constant([]),
  cumulativeDifficulty: fc.integer({ min: 0, max: 200 }),
});

describe('Property 5: Team Fixture Difficulty Sorting', () => {
  it('sorted output is in non-decreasing order of cumulativeDifficulty', () => {
    fc.assert(
      fc.property(
        fc.array(fixturesByTeamArb, { minLength: 0, maxLength: 30 }),
        (teams) => {
          const sorted = sortTeamsByDifficulty(teams);
          for (let i = 1; i < sorted.length; i++) {
            expect(sorted[i].cumulativeDifficulty).toBeGreaterThanOrEqual(
              sorted[i - 1].cumulativeDifficulty,
            );
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('sorted output contains exactly the same elements as the input', () => {
    fc.assert(
      fc.property(
        fc.array(fixturesByTeamArb, { minLength: 0, maxLength: 30 }),
        (teams) => {
          const sorted = sortTeamsByDifficulty(teams);
          expect(sorted).toHaveLength(teams.length);

          // Every input element must appear in the output
          const sortedIds = sorted.map((t) => t.teamId).sort((a, b) => a - b);
          const inputIds = [...teams].map((t) => t.teamId).sort((a, b) => a - b);
          expect(sortedIds).toEqual(inputIds);

          // Verify cumulative difficulties are preserved (same multiset)
          const sortedDiffs = sorted
            .map((t) => t.cumulativeDifficulty)
            .sort((a, b) => a - b);
          const inputDiffs = [...teams]
            .map((t) => t.cumulativeDifficulty)
            .sort((a, b) => a - b);
          expect(sortedDiffs).toEqual(inputDiffs);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('sort is deterministic — sorting the same input twice produces the same output', () => {
    fc.assert(
      fc.property(
        fc.array(fixturesByTeamArb, { minLength: 0, maxLength: 30 }),
        (teams) => {
          const first = sortTeamsByDifficulty(teams);
          const second = sortTeamsByDifficulty(teams);
          expect(first).toEqual(second);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('empty arrays sort to empty arrays', () => {
    const sorted = sortTeamsByDifficulty([]);
    expect(sorted).toEqual([]);
  });

  it('single-element arrays are returned unchanged', () => {
    fc.assert(
      fc.property(fixturesByTeamArb, (team) => {
        const sorted = sortTeamsByDifficulty([team]);
        expect(sorted).toHaveLength(1);
        expect(sorted[0]).toEqual(team);
      }),
      { numRuns: 100 },
    );
  });
});
