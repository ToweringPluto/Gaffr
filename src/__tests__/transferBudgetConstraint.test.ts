import fc from 'fast-check';
import type { Player, Position, Fixture } from '../models';
import { suggestTransfersIn } from '../domain/transferSuggester';

// ── Arbitraries ──────────────────────────────────────────────────────

const arbPosition: fc.Arbitrary<Position> = fc.constantFrom('GKP', 'DEF', 'MID', 'FWD');

const arbPlayer = (position: Position, cost: number): Player => ({
  id: Math.floor(Math.random() * 100000),
  name: `Player`,
  teamId: 1,
  position,
  totalPoints: 80,
  form: 5.0,
  cost,
  ownershipPercentage: 10,
  minutesPlayed: 900,
  news: '',
  chanceOfPlaying: 100,
  gameweekPoints: [],
});

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

// ── Property Test ────────────────────────────────────────────────────

describe('Property 12: Transfer Suggestion Budget Constraint', () => {
  /**
   * For any set of transfer-in suggestions given a squad budget and an
   * outgoing player's selling price, every suggested player's cost shall
   * be less than or equal to the available budget plus the outgoing
   * player's selling price.
   */

  it('every suggested transfer-in player costs at most the available budget', () => {
    fc.assert(
      fc.property(
        arbPosition,
        fc.integer({ min: 30, max: 300 }), // budget (in tenths)
        fc.array(arbFixture, { minLength: 1, maxLength: 8 }),
        fc.array(fc.integer({ min: 30, max: 200 }), { minLength: 1, maxLength: 20 }), // player costs
        (position, budget, fixtures, playerCosts) => {
          // Build a pool of players at the target position with varying costs
          const allPlayers: Player[] = playerCosts.map((cost, i) => ({
            id: i + 1,
            name: `Player ${i + 1}`,
            teamId: (i % 20) + 1,
            position,
            totalPoints: 50 + i,
            form: 3.0 + (i % 8),
            cost,
            ownershipPercentage: 5 + i,
            minutesPlayed: 450 + i * 30,
            news: '',
            chanceOfPlaying: 100,
            gameweekPoints: [],
          }));

          const suggestions = suggestTransfersIn(position, budget, fixtures, allPlayers);

          // Property: every suggested player's cost <= budget
          for (const s of suggestions) {
            expect(s.playerIn.cost).toBeLessThanOrEqual(budget);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it('budget includes outgoing player selling price — combined budget respected', () => {
    fc.assert(
      fc.property(
        arbPosition,
        fc.integer({ min: 0, max: 150 }),  // squad remaining budget
        fc.integer({ min: 30, max: 150 }), // outgoing player selling price
        fc.array(arbFixture, { minLength: 1, maxLength: 6 }),
        fc.array(fc.integer({ min: 30, max: 200 }), { minLength: 1, maxLength: 15 }),
        (position, squadBudget, sellingPrice, fixtures, playerCosts) => {
          const totalBudget = squadBudget + sellingPrice;

          const allPlayers: Player[] = playerCosts.map((cost, i) => ({
            id: i + 1,
            name: `Player ${i + 1}`,
            teamId: (i % 20) + 1,
            position,
            totalPoints: 60 + i,
            form: 4.0 + (i % 6),
            cost,
            ownershipPercentage: 8 + i,
            minutesPlayed: 500 + i * 20,
            news: '',
            chanceOfPlaying: 100,
            gameweekPoints: [],
          }));

          const suggestions = suggestTransfersIn(position, totalBudget, fixtures, allPlayers);

          // Property: every suggestion respects the combined budget
          for (const s of suggestions) {
            expect(s.playerIn.cost).toBeLessThanOrEqual(totalBudget);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it('no affordable player is excluded from suggestions', () => {
    fc.assert(
      fc.property(
        arbPosition,
        fc.integer({ min: 50, max: 200 }), // budget
        fc.array(arbFixture, { minLength: 1, maxLength: 4 }),
        fc.array(fc.integer({ min: 30, max: 200 }), { minLength: 1, maxLength: 15 }),
        (position, budget, fixtures, playerCosts) => {
          const allPlayers: Player[] = playerCosts.map((cost, i) => ({
            id: i + 1,
            name: `Player ${i + 1}`,
            teamId: (i % 20) + 1,
            position,
            totalPoints: 70 + i,
            form: 5.0,
            cost,
            ownershipPercentage: 10,
            minutesPlayed: 900,
            news: '',
            chanceOfPlaying: 100,
            gameweekPoints: [],
          }));

          const suggestions = suggestTransfersIn(position, budget, fixtures, allPlayers);
          const suggestedIds = new Set(suggestions.map((s) => s.playerIn.id));

          // Every affordable player at the right position must appear
          for (const p of allPlayers) {
            if (p.cost <= budget) {
              expect(suggestedIds).toContain(p.id);
            }
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});
