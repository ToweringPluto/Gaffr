import fc from 'fast-check';
import type { Position, Squad, SquadPlayer, Fixture } from '../models';
import {
  rankCaptainCandidates,
  recommendViceCaptain,
} from '../domain/captaincyScorer';

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
 * Squad of 11 starters on different teams (IDs 1–11).
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
 * One unfinished fixture per team (teams 1–11 vs opponents 12–22).
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

describe('Property 18: Vice Captain Score Ordering', () => {
  /**
   * For any squad, the recommended vice captain's captaincy score shall
   * be less than or equal to the recommended captain's captaincy score,
   * and the vice captain shall be a different player from the captain.
   */

  it('vice captain score is less than or equal to captain score', () => {
    fc.assert(
      fc.property(arbSquad, arbFixtures, (squad, fixtures) => {
        const candidates = rankCaptainCandidates(squad, fixtures, []);
        const vc = recommendViceCaptain(candidates);

        if (candidates.length < 2 || vc === null) return;

        const captain = candidates[0];
        expect(captain.captaincyScore).toBeGreaterThanOrEqual(vc.captaincyScore);
      }),
      { numRuns: 300 },
    );
  });

  it('vice captain is a different player from the captain', () => {
    fc.assert(
      fc.property(arbSquad, arbFixtures, (squad, fixtures) => {
        const candidates = rankCaptainCandidates(squad, fixtures, []);
        const vc = recommendViceCaptain(candidates);

        if (candidates.length < 2 || vc === null) return;

        const captain = candidates[0];
        expect(vc.player.id).not.toBe(captain.player.id);
      }),
      { numRuns: 300 },
    );
  });

  it('vice captain is a member of the squad', () => {
    fc.assert(
      fc.property(arbSquad, arbFixtures, (squad, fixtures) => {
        const candidates = rankCaptainCandidates(squad, fixtures, []);
        const vc = recommendViceCaptain(candidates);

        if (vc === null) return;

        const squadIds = new Set(squad.players.map((p) => p.id));
        expect(squadIds).toContain(vc.player.id);
      }),
      { numRuns: 200 },
    );
  });

  it('returns null when fewer than 2 candidates', () => {
    // A squad with only 1 starter should yield null VC
    const singleStarter = arbSquadPlayer(1, 1).map((p) => ({
      players: [p],
      budget: 50,
      freeTransfers: 1,
      activeChip: null,
    }));

    const singleFixture: fc.Arbitrary<Fixture[]> = fc.constant([
      {
        id: 1,
        gameweek: 10,
        homeTeamId: 1,
        awayTeamId: 12,
        homeTeamDifficulty: 3,
        awayTeamDifficulty: 3,
        kickoffTime: '2025-03-01T15:00:00Z',
        finished: false,
      },
    ]);

    fc.assert(
      fc.property(singleStarter, singleFixture, (squad, fixtures) => {
        const candidates = rankCaptainCandidates(squad, fixtures, []);
        const vc = recommendViceCaptain(candidates);
        expect(vc).toBeNull();
      }),
      { numRuns: 50 },
    );
  });
});
