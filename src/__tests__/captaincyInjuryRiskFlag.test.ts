import fc from 'fast-check';
import type { Position, Squad, SquadPlayer, Fixture } from '../models';
import type { NewsItem, NewsSeverity } from '../models/news';
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

/** Squad of 11 starters on different teams (IDs 1–11). */
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

/** One unfinished fixture per team (teams 1–11 vs 12–22). */
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


/** Severities that indicate injury risk in news items. */
const injuryNewsSeverities: NewsSeverity[] = [
  'injured_suspended',
  'doubtful_25',
  'doubtful_50',
];

/** chanceOfPlaying values that should trigger injury risk (< 75). */
const arbLowChance: fc.Arbitrary<number> = fc.constantFrom(0, 25, 50);

/** chanceOfPlaying values that should NOT trigger injury risk (>= 75). */
const arbHighChance: fc.Arbitrary<number> = fc.constantFrom(75, 100);

function makeNewsItem(
  playerId: number,
  severity: NewsSeverity,
): NewsItem {
  return {
    playerId,
    playerName: `PLAYER ${playerId}`,
    content: 'Test news',
    severity,
    source: 'fpl_api',
    timestamp: '2025-03-01T12:00:00Z',
  };
}

// ── Property Tests ───────────────────────────────────────────────────

describe('Property 17: Captaincy Injury Risk Flag', () => {
  /**
   * For any captaincy candidate whose associated news indicates a
   * chance of playing less than 75%, the candidate's hasInjuryRisk
   * flag shall be true.
   */

  it('hasInjuryRisk is true when player chanceOfPlaying < 75', () => {
    fc.assert(
      fc.property(
        arbSquad,
        arbFixtures,
        arbLowChance,
        fc.integer({ min: 0, max: 10 }),
        (squad, fixtures, chance, targetIdx) => {
          const idx = targetIdx % squad.players.length;
          const targetPlayer = squad.players[idx];
          // Override chanceOfPlaying to a low value
          (targetPlayer as any).chanceOfPlaying = chance;

          const candidates = rankCaptainCandidates(squad, fixtures, []);
          const match = candidates.find((c) => c.player.id === targetPlayer.id);

          if (match) {
            expect(match.hasInjuryRisk).toBe(true);
          }
          // If the player didn't make top 5, the property still holds —
          // we just can't observe it in the output.
        },
      ),
      { numRuns: 500 },
    );
  });

  it('hasInjuryRisk is true when news contains injury severity for the player', () => {
    fc.assert(
      fc.property(
        arbSquad,
        arbFixtures,
        fc.constantFrom(...injuryNewsSeverities),
        fc.integer({ min: 0, max: 10 }),
        (squad, fixtures, severity, targetIdx) => {
          const idx = targetIdx % squad.players.length;
          const targetPlayer = squad.players[idx];
          // Ensure chanceOfPlaying alone wouldn't trigger the flag
          (targetPlayer as any).chanceOfPlaying = 100;

          const news: NewsItem[] = [makeNewsItem(targetPlayer.id, severity)];
          const candidates = rankCaptainCandidates(squad, fixtures, news);
          const match = candidates.find((c) => c.player.id === targetPlayer.id);

          if (match) {
            expect(match.hasInjuryRisk).toBe(true);
          }
        },
      ),
      { numRuns: 500 },
    );
  });

  it('hasInjuryRisk is false when chanceOfPlaying >= 75 and no injury news', () => {
    fc.assert(
      fc.property(
        arbSquad,
        arbFixtures,
        arbHighChance,
        (squad, fixtures, chance) => {
          // Set all players to high chance, no injury news
          for (const p of squad.players) {
            (p as any).chanceOfPlaying = chance;
          }

          const candidates = rankCaptainCandidates(squad, fixtures, []);

          for (const c of candidates) {
            expect(c.hasInjuryRisk).toBe(false);
          }
        },
      ),
      { numRuns: 300 },
    );
  });

  it('hasInjuryRisk is false when chanceOfPlaying is null and no injury news', () => {
    fc.assert(
      fc.property(arbSquad, arbFixtures, (squad, fixtures) => {
        for (const p of squad.players) {
          (p as any).chanceOfPlaying = null;
        }

        const candidates = rankCaptainCandidates(squad, fixtures, []);

        for (const c of candidates) {
          expect(c.hasInjuryRisk).toBe(false);
        }
      }),
      { numRuns: 300 },
    );
  });

  it('news with "available" or "doubtful_75" severity does not trigger injury risk alone', () => {
    fc.assert(
      fc.property(
        arbSquad,
        arbFixtures,
        fc.constantFrom<NewsSeverity>('available', 'doubtful_75'),
        fc.integer({ min: 0, max: 10 }),
        (squad, fixtures, severity, targetIdx) => {
          const idx = targetIdx % squad.players.length;
          const targetPlayer = squad.players[idx];
          (targetPlayer as any).chanceOfPlaying = 100;

          const news: NewsItem[] = [makeNewsItem(targetPlayer.id, severity)];
          const candidates = rankCaptainCandidates(squad, fixtures, news);
          const match = candidates.find((c) => c.player.id === targetPlayer.id);

          if (match) {
            expect(match.hasInjuryRisk).toBe(false);
          }
        },
      ),
      { numRuns: 300 },
    );
  });
});
