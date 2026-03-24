import fc from 'fast-check';
import { calculateSellingPrice } from '../domain/priceChangePredictor';
import type { Player, Position, SquadPlayer } from '../models';

// ── Arbitraries ──────────────────────────────────────────────────────

const arbPosition: fc.Arbitrary<Position> = fc.constantFrom('GKP', 'DEF', 'MID', 'FWD');

function arbPlayer(): fc.Arbitrary<Player> {
  return fc.record({
    id: fc.integer({ min: 1, max: 999 }),
    name: fc.constant('PLAYER'),
    teamId: fc.integer({ min: 1, max: 20 }),
    position: arbPosition,
    totalPoints: fc.integer({ min: 0, max: 300 }),
    form: fc.float({ min: 0, max: 15, noNaN: true }),
    cost: fc.integer({ min: 40, max: 200 }),
    ownershipPercentage: fc.float({ min: 0, max: 100, noNaN: true }),
    minutesPlayed: fc.integer({ min: 0, max: 3420 }),
    news: fc.constant(''),
    chanceOfPlaying: fc.constantFrom(0, 25, 50, 75, 100, null),
    gameweekPoints: fc.constant([]),
  });
}

/**
 * Generate a SquadPlayer with a valid sellingPrice derived from the FPL formula.
 * purchasePrice is generated independently, then sellingPrice is computed as:
 *   purchasePrice + floor((cost - purchasePrice) / 2)
 */
function arbSquadPlayerWithFormula(): fc.Arbitrary<{ squadPlayer: SquadPlayer; purchasePrice: number }> {
  return fc
    .record({
      purchasePrice: fc.integer({ min: 35, max: 200 }),
      cost: fc.integer({ min: 35, max: 200 }),
    })
    .chain(({ purchasePrice, cost }) => {
      const sellingPrice = Math.max(
        purchasePrice + Math.floor((cost - purchasePrice) / 2),
        1,
      );

      return arbPlayer().map((base) => ({
        squadPlayer: {
          ...base,
          cost,
          isCaptain: false,
          isViceCaptain: false,
          isBenched: false,
          benchOrder: 0,
          sellingPrice,
        } as SquadPlayer,
        purchasePrice,
      }));
    });
}

// ── Property Tests ───────────────────────────────────────────────────

describe('Property 37: Selling Price Calculation', () => {
  /**
   * For any SquadPlayer, calculateSellingPrice returns the sellingPrice field,
   * which encodes the FPL formula: purchasePrice + floor((cost - purchasePrice) / 2).
   */
  it('returns the FPL selling price for a SquadPlayer', () => {
    fc.assert(
      fc.property(arbSquadPlayerWithFormula(), ({ squadPlayer, purchasePrice }) => {
        const result = calculateSellingPrice(squadPlayer);
        const expected = Math.max(
          purchasePrice + Math.floor((squadPlayer.cost - purchasePrice) / 2),
          1,
        );
        expect(result).toBe(expected);
      }),
      { numRuns: 200 },
    );
  });

  /**
   * For any plain Player (no sellingPrice field), calculateSellingPrice
   * returns the current cost — equivalent to assuming purchase at current price.
   */
  it('returns cost for a plain Player without sellingPrice', () => {
    fc.assert(
      fc.property(arbPlayer(), (player) => {
        const result = calculateSellingPrice(player);
        expect(result).toBe(player.cost);
      }),
      { numRuns: 200 },
    );
  });

  /**
   * The selling price shall never exceed the current market price.
   * FPL only lets you keep half the profit, so sellingPrice <= cost always holds
   * when purchasePrice <= cost. When purchasePrice > cost (price dropped),
   * sellingPrice = purchasePrice + floor((cost - purchasePrice) / 2) which is
   * between cost and purchasePrice.
   */
  it('selling price is between purchase price and current cost (inclusive)', () => {
    fc.assert(
      fc.property(arbSquadPlayerWithFormula(), ({ squadPlayer, purchasePrice }) => {
        const result = calculateSellingPrice(squadPlayer);
        const low = Math.min(purchasePrice, squadPlayer.cost);
        const high = Math.max(purchasePrice, squadPlayer.cost);
        // The selling price should sit between the lower and upper bound
        expect(result).toBeGreaterThanOrEqual(Math.max(low, 1));
        expect(result).toBeLessThanOrEqual(high);
      }),
      { numRuns: 200 },
    );
  });

  /**
   * When a player's cost equals their purchase price (no profit/loss),
   * the selling price equals the cost.
   */
  it('selling price equals cost when purchase price equals current cost', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 35, max: 200 }),
        (price) => {
          const squadPlayer: SquadPlayer = {
            id: 1,
            name: 'PLAYER',
            teamId: 1,
            position: 'MID',
            totalPoints: 50,
            form: 4.0,
            cost: price,
            ownershipPercentage: 10,
            minutesPlayed: 900,
            news: '',
            chanceOfPlaying: 100,
            gameweekPoints: [],
            isCaptain: false,
            isViceCaptain: false,
            isBenched: false,
            benchOrder: 0,
            sellingPrice: price, // purchasePrice + floor(0/2) = purchasePrice = cost
          };

          expect(calculateSellingPrice(squadPlayer)).toBe(price);
        },
      ),
      { numRuns: 200 },
    );
  });

  /**
   * When a player's cost has risen above purchase price, the manager
   * keeps only half the profit (floored). sellingPrice = purchase + floor(profit / 2).
   */
  it('manager keeps half the profit (floored) when price has risen', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 35, max: 150 }), // purchasePrice
        fc.integer({ min: 1, max: 50 }),    // profit
        (purchasePrice, profit) => {
          const cost = purchasePrice + profit;
          const expectedSelling = purchasePrice + Math.floor(profit / 2);

          const squadPlayer: SquadPlayer = {
            id: 1,
            name: 'PLAYER',
            teamId: 1,
            position: 'FWD',
            totalPoints: 80,
            form: 6.0,
            cost,
            ownershipPercentage: 15,
            minutesPlayed: 1200,
            news: '',
            chanceOfPlaying: 100,
            gameweekPoints: [],
            isCaptain: false,
            isViceCaptain: false,
            isBenched: false,
            benchOrder: 0,
            sellingPrice: expectedSelling,
          };

          expect(calculateSellingPrice(squadPlayer)).toBe(expectedSelling);
        },
      ),
      { numRuns: 200 },
    );
  });
});
