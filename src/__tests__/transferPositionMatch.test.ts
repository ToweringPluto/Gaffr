import fc from 'fast-check';
import type { Player, Position, Fixture } from '../models';
import { suggestTransfersIn } from '../domain/transferSuggester';

// ── Arbitraries ──────────────────────────────────────────────────────

const arbPosition: fc.Arbitrary<Position> = fc.constantFrom('GKP', 'DEF', 'MID', 'FWD');

const arbFixture: fc.Arbitrary<Fixture> = fc.record({
  id: fc.nat({ max: 10000 }),
  gameweek: fc.integer({ min: 1, max: 38 }),
  homeTeamId: fc.integer({ min: 1, max: 20 }),
  awayTeamId: fc.integer({ min: 1, max: 20 }),
  homeTeamDifficulty: fc.integer({ min: 1, max: 5 }),
  awayTeamDifficulty: fc.integer({ min: 1, max: 5 }),
  kickoffTime: fc.constant('2025-02-01T15:00:00Z'),
  finished: fc.constant(false),
});

const arbPlayerAtPosition = (pos: Position): fc.Arbitrary<Player> =>
  fc.record({
    id: fc.integer({ min: 1, max: 100000 }),
    name: fc.constant('Player'),
    teamId: fc.integer({ min: 1, max: 20 }),
    position: fc.constant(pos),
    totalPoints: fc.integer({ min: 0, max: 300 }),
    form: fc.float({ min: 0, max: 15, noNaN: true }),
    cost: fc.integer({ min: 30, max: 200 }),
    ownershipPercentage: fc.float({ min: 0, max: 100, noNaN: true }),
    minutesPlayed: fc.integer({ min: 0, max: 3420 }),
    news: fc.constant(''),
    chanceOfPlaying: fc.constant(100 as number | null),
    gameweekPoints: fc.constant([]),
  });

// ── Property Tests ───────────────────────────────────────────────────

describe('Property 13: Transfer Suggestion Position Match', () => {
  /**
   * For any player selected for transfer out and the resulting list of
   * replacement candidates, every candidate shall have the same position
   * as the outgoing player, and the list shall be sorted in non-increasing
   * order of transfer suggestion score.
   */

  it('every suggested replacement matches the requested position', () => {
    fc.assert(
      fc.property(
        arbPosition,
        fc.integer({ min: 50, max: 300 }), // budget
        fc.array(arbFixture, { minLength: 1, maxLength: 8 }),
        arbPosition.chain((mixedPos) =>
          fc.array(arbPlayerAtPosition(mixedPos), { minLength: 1, maxLength: 10 }),
        ),
        (targetPosition, budget, fixtures, mixedPlayers) => {
          // Build a pool with players at various positions
          // Include the mixed players plus some at the target position
          const targetPlayers: Player[] = Array.from({ length: 5 }, (_, i) => ({
            id: 50000 + i,
            name: `Target ${i}`,
            teamId: (i % 20) + 1,
            position: targetPosition,
            totalPoints: 50 + i * 10,
            form: 3.0 + i,
            cost: 40 + i * 20,
            ownershipPercentage: 5 + i * 2,
            minutesPlayed: 900,
            news: '',
            chanceOfPlaying: 100,
            gameweekPoints: [],
          }));

          const allPlayers = [...mixedPlayers, ...targetPlayers];

          const suggestions = suggestTransfersIn(targetPosition, budget, fixtures, allPlayers);

          // Property: every suggested player has the requested position
          for (const s of suggestions) {
            expect(s.playerIn.position).toBe(targetPosition);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it('suggestions are sorted in non-increasing order of transfer score', () => {
    fc.assert(
      fc.property(
        arbPosition,
        fc.integer({ min: 100, max: 300 }), // generous budget to get multiple results
        fc.array(arbFixture, { minLength: 1, maxLength: 8 }),
        fc.array(fc.integer({ min: 30, max: 150 }), { minLength: 2, maxLength: 20 }), // player costs
        (position, budget, fixtures, playerCosts) => {
          const allPlayers: Player[] = playerCosts.map((cost, i) => ({
            id: i + 1,
            name: `Player ${i + 1}`,
            teamId: (i % 20) + 1,
            position,
            totalPoints: 30 + i * 5,
            form: 1.0 + (i % 10),
            cost,
            ownershipPercentage: 5 + i,
            minutesPlayed: 450 + i * 30,
            news: '',
            chanceOfPlaying: 100,
            gameweekPoints: [],
          }));

          const suggestions = suggestTransfersIn(position, budget, fixtures, allPlayers);

          // Property: scores are in non-increasing order
          for (let i = 1; i < suggestions.length; i++) {
            expect(suggestions[i - 1].score).toBeGreaterThanOrEqual(suggestions[i].score);
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});
