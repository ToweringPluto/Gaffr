import fc from 'fast-check';
import { getSellAlerts, getBuyUrgency } from '../domain/priceChangePredictor';
import type { Player, Position, SquadPlayer, Squad, PricePrediction, PriceDirection } from '../models';

// ── Arbitraries ──────────────────────────────────────────────────────

const arbPosition: fc.Arbitrary<Position> = fc.constantFrom('GKP', 'DEF', 'MID', 'FWD');

const arbDirection: fc.Arbitrary<PriceDirection> = fc.constantFrom('rising', 'falling', 'stable');

function arbSquadPlayer(id: number): fc.Arbitrary<SquadPlayer> {
  return fc.record({
    id: fc.constant(id),
    name: fc.constant(`PLAYER${id}`),
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
    isCaptain: fc.constant(false),
    isViceCaptain: fc.constant(false),
    isBenched: fc.boolean(),
    benchOrder: fc.integer({ min: 0, max: 4 }),
    sellingPrice: fc.integer({ min: 35, max: 200 }),
  });
}

function arbPrediction(playerId: number, direction: PriceDirection): fc.Arbitrary<PricePrediction> {
  return fc.record({
    playerId: fc.constant(playerId),
    direction: fc.constant(direction),
    predictedChange: fc.integer({ min: 0, max: 5 }),
  });
}

// ── Property Tests ───────────────────────────────────────────────────

describe('Property 36: Price Change Alert Generation', () => {
  /**
   * For any squad player with a 'falling' price prediction,
   * a sell alert shall be generated.
   */
  it('generates a sell alert for every squad player with a falling prediction', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }), // number of squad players
        (playerCount) => {
          // Generate squad players with unique IDs
          const players: SquadPlayer[] = [];
          const predictions: PricePrediction[] = [];

          for (let i = 1; i <= playerCount; i++) {
            players.push({
              id: i,
              name: `PLAYER${i}`,
              teamId: (i % 20) + 1,
              position: 'MID',
              totalPoints: 80,
              form: 5.0,
              cost: 100 + i,
              ownershipPercentage: 20,
              minutesPlayed: 900,
              news: '',
              chanceOfPlaying: 100,
              gameweekPoints: [],
              isCaptain: false,
              isViceCaptain: false,
              isBenched: false,
              benchOrder: 0,
              sellingPrice: 95 + i,
            });

            // All players have falling predictions
            predictions.push({
              playerId: i,
              direction: 'falling',
              predictedChange: 1,
            });
          }

          const squad: Squad = {
            players,
            budget: 50,
            freeTransfers: 1,
            activeChip: null,
          };

          const alerts = getSellAlerts(squad, predictions);

          // Every player with a falling prediction must have a sell alert
          const alertedIds = new Set(alerts.map((a) => a.player.id));
          for (const p of players) {
            expect(alertedIds).toContain(p.id);
          }
          expect(alerts).toHaveLength(playerCount);
        },
      ),
      { numRuns: 200 },
    );
  });

  /**
   * No sell alert shall be generated for players with 'rising' or 'stable' predictions.
   */
  it('does not generate sell alerts for non-falling predictions', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        fc.constantFrom<PriceDirection>('rising', 'stable'),
        (playerCount, direction) => {
          const players: SquadPlayer[] = [];
          const predictions: PricePrediction[] = [];

          for (let i = 1; i <= playerCount; i++) {
            players.push({
              id: i,
              name: `PLAYER${i}`,
              teamId: (i % 20) + 1,
              position: 'DEF',
              totalPoints: 60,
              form: 4.0,
              cost: 80 + i,
              ownershipPercentage: 15,
              minutesPlayed: 800,
              news: '',
              chanceOfPlaying: 100,
              gameweekPoints: [],
              isCaptain: false,
              isViceCaptain: false,
              isBenched: false,
              benchOrder: 0,
              sellingPrice: 75 + i,
            });

            predictions.push({
              playerId: i,
              direction,
              predictedChange: direction === 'rising' ? 1 : 0,
            });
          }

          const squad: Squad = {
            players,
            budget: 50,
            freeTransfers: 1,
            activeChip: null,
          };

          const alerts = getSellAlerts(squad, predictions);
          expect(alerts).toHaveLength(0);
        },
      ),
      { numRuns: 200 },
    );
  });

  /**
   * In a mixed squad, sell alerts are generated exactly for falling players.
   */
  it('generates sell alerts only for falling players in a mixed squad', () => {
    fc.assert(
      fc.property(
        fc.array(arbDirection, { minLength: 1, maxLength: 15 }),
        (directions) => {
          const players: SquadPlayer[] = [];
          const predictions: PricePrediction[] = [];

          directions.forEach((dir, i) => {
            const id = i + 1;
            players.push({
              id,
              name: `PLAYER${id}`,
              teamId: (i % 20) + 1,
              position: 'MID',
              totalPoints: 70,
              form: 5.0,
              cost: 90 + i,
              ownershipPercentage: 18,
              minutesPlayed: 900,
              news: '',
              chanceOfPlaying: 100,
              gameweekPoints: [],
              isCaptain: false,
              isViceCaptain: false,
              isBenched: false,
              benchOrder: 0,
              sellingPrice: 85 + i,
            });

            predictions.push({
              playerId: id,
              direction: dir,
              predictedChange: dir === 'stable' ? 0 : 1,
            });
          });

          const squad: Squad = {
            players,
            budget: 50,
            freeTransfers: 1,
            activeChip: null,
          };

          const alerts = getSellAlerts(squad, predictions);
          const alertedIds = new Set(alerts.map((a) => a.player.id));

          const expectedFallingIds = directions
            .map((dir, i) => (dir === 'falling' ? i + 1 : null))
            .filter((id): id is number => id !== null);

          // Exactly the falling players get alerts
          expect(alerts).toHaveLength(expectedFallingIds.length);
          for (const id of expectedFallingIds) {
            expect(alertedIds).toContain(id);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  /**
   * For any transfer target with a 'rising' price prediction,
   * a buy urgency indicator shall be set (urgency !== 'low').
   */
  it('sets buy urgency for any player with a rising prediction', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }), // predictedChange >= 1 means rising
        (predictedChange) => {
          const player: Player = {
            id: 1,
            name: 'TARGET',
            teamId: 5,
            position: 'FWD',
            totalPoints: 100,
            form: 7.0,
            cost: 120,
            ownershipPercentage: 25,
            minutesPlayed: 1800,
            news: '',
            chanceOfPlaying: 100,
            gameweekPoints: [],
          };

          const prediction: PricePrediction = {
            playerId: 1,
            direction: 'rising',
            predictedChange,
          };

          const result = getBuyUrgency(player, prediction);

          // Rising prediction with predictedChange >= 1 must have urgency 'medium' or 'high'
          expect(result.urgency).not.toBe('low');
          expect(result.predictedRise).toBe(predictedChange);
        },
      ),
      { numRuns: 200 },
    );
  });

  /**
   * Buy urgency tiers: high for predictedChange >= 2, medium for 1, low for 0.
   */
  it('assigns correct buy urgency tier based on predicted change magnitude', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10 }),
        (predictedChange) => {
          const player: Player = {
            id: 1,
            name: 'TARGET',
            teamId: 3,
            position: 'MID',
            totalPoints: 90,
            form: 6.0,
            cost: 100,
            ownershipPercentage: 20,
            minutesPlayed: 1500,
            news: '',
            chanceOfPlaying: 100,
            gameweekPoints: [],
          };

          const prediction: PricePrediction = {
            playerId: 1,
            direction: predictedChange > 0 ? 'rising' : 'stable',
            predictedChange,
          };

          const result = getBuyUrgency(player, prediction);

          if (predictedChange >= 2) {
            expect(result.urgency).toBe('high');
          } else if (predictedChange === 1) {
            expect(result.urgency).toBe('medium');
          } else {
            expect(result.urgency).toBe('low');
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});
