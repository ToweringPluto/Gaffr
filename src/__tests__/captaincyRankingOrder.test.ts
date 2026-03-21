import fc from 'fast-check';
import type { Position, Squad, SquadPlayer, Fixture } from '../models';
import { rankCaptainCandidates } from '../domain/captaincyScorer';

// ── Arbitraries ──────────────────────────────────────────────────────

const arbPosition: fc.Arbitrary<Position> = fc.constantFrom('GKP', 'DEF', 'MID', 'FWD');

const arbSquadPlayer = (id: number, teamId: number): fc.Arbitrary<SquadPlayer> =>
  fc.record({
    id: fc.constant(id),
    name: fc.constant(`PLAYER ${id}`),
    teamId: fc.constant(teamId),
    position: arbPosition,
    totalPoints: fc.integer({ min: 0, max: 300 }),
    form: fc.float({ min: 0, max: 15, noNaN: true }),
    cost: fc.integer({ min: 40, max: 130 }),
    ownershipPercentage: fc.float({ min: 0, max: 100, noNaN: true }),
    minutesPlayed: fc.integer({ min: 0, max: 3420 }),
    news: fc.constant(''),
    chanceOfPlaying: fc.constant(100 as number | null),
    gameweekPoints: fc.constant([]),
    isCaptain: fc.constant(false),
    isViceCaptain: fc.constant(false),
    isBenched: fc.constant(false),
    benchOrder: fc.constant(0),
    sellingPrice: fc.integer({ min: 40, max: 130 }),
  });

/**
 * Generate a squad of 11 starters, each on a different team so fixture
 * lookup is straightforward. Team IDs 1–11.
 */
const arbSquad: fc.Arbitrary<Squad> = fc
  .tuple(
    ...Array.from({ length: 11 }, (_, i) => arbSquadPlayer(i + 1, i + 1)),
  )
  .map((players) => ({
    players,
    budget: 50,
    freeTransfers: 1,
    activeChip: null,
  }));

/**
 * Generate one unfinished fixture per team (teams 1–11 each get a home
 * fixture against a unique opponent from teams 12–22).
 */
const arbFixtures: fc.Arbitrary<Fixture[]> = fc
  .tuple(
    ...Array.from({ length: 11 }, (_, i) =>
      fc.record({
        id: fc.constant(i + 1),
        gameweek: fc.constant(10),
        homeTeamId: fc.constant(i + 1),
        awayTeamId: fc.constant(i + 12),
        homeTeamDifficulty: fc.integer({ min: 1, max: 5 }),
        awayTeamDifficulty: fc.integer({ min: 1, max: 5 }),
        kickoffTime: fc.constant('2025-03-01T15:00:00Z'),
        finished: fc.constant(false),
      }),
    ),
  )
  .map((arr) => arr as Fixture[]);


// ── Property Tests ───────────────────────────────────────────────────

describe('Property 15: Captaincy Ranking Order', () => {
  /**
   * For any squad, the top 5 captaincy candidates shall be in
   * non-increasing order of captaincy score, and all candidates
   * shall be members of the squad.
   */

  it('candidates are returned in non-increasing captaincy score order', () => {
    fc.assert(
      fc.property(arbSquad, arbFixtures, (squad, fixtures) => {
        const candidates = rankCaptainCandidates(squad, fixtures, []);

        for (let i = 1; i < candidates.length; i++) {
          expect(candidates[i - 1].captaincyScore).toBeGreaterThanOrEqual(
            candidates[i].captaincyScore,
          );
        }
      }),
      { numRuns: 300 },
    );
  });

  it('returns at most 5 candidates', () => {
    fc.assert(
      fc.property(arbSquad, arbFixtures, (squad, fixtures) => {
        const candidates = rankCaptainCandidates(squad, fixtures, []);
        expect(candidates.length).toBeLessThanOrEqual(5);
      }),
      { numRuns: 200 },
    );
  });

  it('all candidates are members of the squad starters', () => {
    fc.assert(
      fc.property(arbSquad, arbFixtures, (squad, fixtures) => {
        const candidates = rankCaptainCandidates(squad, fixtures, []);
        const starterIds = new Set(
          squad.players.filter((p) => !p.isBenched).map((p) => p.id),
        );

        for (const c of candidates) {
          expect(starterIds).toContain(c.player.id);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('candidate count equals min(starters, 5)', () => {
    fc.assert(
      fc.property(arbSquad, arbFixtures, (squad, fixtures) => {
        const starters = squad.players.filter((p) => !p.isBenched);
        const candidates = rankCaptainCandidates(squad, fixtures, []);
        expect(candidates.length).toBe(Math.min(starters.length, 5));
      }),
      { numRuns: 200 },
    );
  });

  it('each candidate has a unique player id', () => {
    fc.assert(
      fc.property(arbSquad, arbFixtures, (squad, fixtures) => {
        const candidates = rankCaptainCandidates(squad, fixtures, []);
        const ids = candidates.map((c) => c.player.id);
        expect(new Set(ids).size).toBe(ids.length);
      }),
      { numRuns: 200 },
    );
  });
});
