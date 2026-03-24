import fc from 'fast-check';
import { calculateMultiTransferHit, calculateProjectedGain } from '../domain/transferHitCalculator';
import type { Player, TransferPair } from '../models';

const HIT_COST_PER_TRANSFER = 4;

function arbPlayer(overrides: Partial<Player> = {}): fc.Arbitrary<Player> {
  return fc
    .record({
      id: fc.integer({ min: 1, max: 9999 }),
      form: fc.double({ min: 0, max: 15, noNaN: true, noDefaultInfinity: true }),
      teamId: fc.integer({ min: 1, max: 20 }),
    })
    .map(({ id, form, teamId }) => ({
      id,
      name: `P${id}`,
      teamId,
      position: 'MID' as const,
      totalPoints: 50,
      form,
      cost: 80,
      ownershipPercentage: 10,
      minutesPlayed: 900,
      news: '',
      chanceOfPlaying: 100,
      gameweekPoints: [],
      ...overrides,
    }));
}

function arbTransferPair(): fc.Arbitrary<TransferPair> {
  return fc.record({
    playerOut: arbPlayer(),
    playerIn: arbPlayer(),
  });
}

describe('Property 34: Multi-Transfer Hit Calculation', () => {
  it('totalHitCost equals 4 × number of transfers', () => {
    fc.assert(
      fc.property(
        fc.array(arbTransferPair(), { minLength: 1, maxLength: 6 }),
        fc.integer({ min: 1, max: 6 }),
        (transfers, gameweeks) => {
          const result = calculateMultiTransferHit(transfers, gameweeks);
          expect(result.totalHitCost).toBe(HIT_COST_PER_TRANSFER * transfers.length);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('totalProjectedGain equals sum of individual projected gains', () => {
    fc.assert(
      fc.property(
        fc.array(arbTransferPair(), { minLength: 1, maxLength: 6 }),
        fc.integer({ min: 1, max: 6 }),
        (transfers, gameweeks) => {
          const result = calculateMultiTransferHit(transfers, gameweeks);
          const expectedGain = transfers.reduce(
            (sum, t) => sum + calculateProjectedGain(t.playerOut, t.playerIn, gameweeks),
            0,
          );
          expect(result.totalProjectedGain).toBeCloseTo(expectedGain, 5);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('netGain equals totalProjectedGain minus totalHitCost', () => {
    fc.assert(
      fc.property(
        fc.array(arbTransferPair(), { minLength: 1, maxLength: 6 }),
        fc.integer({ min: 1, max: 6 }),
        (transfers, gameweeks) => {
          const result = calculateMultiTransferHit(transfers, gameweeks);
          expect(result.netGain).toBeCloseTo(
            result.totalProjectedGain - result.totalHitCost,
            5,
          );
        },
      ),
      { numRuns: 200 },
    );
  });

  it('isJustified iff netGain is strictly positive', () => {
    fc.assert(
      fc.property(
        fc.array(arbTransferPair(), { minLength: 1, maxLength: 6 }),
        fc.integer({ min: 1, max: 6 }),
        (transfers, gameweeks) => {
          const result = calculateMultiTransferHit(transfers, gameweeks);
          if (result.netGain > 0) {
            expect(result.isJustified).toBe(true);
          } else {
            expect(result.isJustified).toBe(false);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it('breakEvenGameweek is null when totalProjectedGain <= 0', () => {
    fc.assert(
      fc.property(
        fc.array(arbTransferPair(), { minLength: 1, maxLength: 4 }),
        (transfers) => {
          // Force playerIn form <= playerOut form so gain is non-positive
          const negativeTransfers: TransferPair[] = transfers.map((t) => ({
            playerOut: { ...t.playerOut, form: 10 },
            playerIn: { ...t.playerIn, form: 0 },
          }));
          const result = calculateMultiTransferHit(negativeTransfers, 3);
          expect(result.breakEvenGameweek).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('breakEvenGameweek is a positive integer when totalProjectedGain > 0', () => {
    fc.assert(
      fc.property(
        fc.array(arbTransferPair(), { minLength: 1, maxLength: 4 }),
        (transfers) => {
          // Force playerIn form > playerOut form so gain is positive
          const positiveTransfers: TransferPair[] = transfers.map((t) => ({
            playerOut: { ...t.playerOut, form: 1 },
            playerIn: { ...t.playerIn, form: 10 },
          }));
          const result = calculateMultiTransferHit(positiveTransfers, 3);
          expect(result.breakEvenGameweek).not.toBeNull();
          expect(result.breakEvenGameweek).toBeGreaterThanOrEqual(1);
          expect(Number.isInteger(result.breakEvenGameweek)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('two-transfer hit costs -8 points', () => {
    const result = calculateMultiTransferHit(
      [
        {
          playerOut: { id: 1, name: 'A', teamId: 1, position: 'MID', totalPoints: 50, form: 3, cost: 80, ownershipPercentage: 10, minutesPlayed: 900, news: '', chanceOfPlaying: 100, gameweekPoints: [] },
          playerIn: { id: 2, name: 'B', teamId: 2, position: 'MID', totalPoints: 60, form: 6, cost: 80, ownershipPercentage: 10, minutesPlayed: 900, news: '', chanceOfPlaying: 100, gameweekPoints: [] },
        },
        {
          playerOut: { id: 3, name: 'C', teamId: 3, position: 'FWD', totalPoints: 40, form: 2, cost: 70, ownershipPercentage: 5, minutesPlayed: 800, news: '', chanceOfPlaying: 100, gameweekPoints: [] },
          playerIn: { id: 4, name: 'D', teamId: 4, position: 'FWD', totalPoints: 70, form: 7, cost: 70, ownershipPercentage: 15, minutesPlayed: 900, news: '', chanceOfPlaying: 100, gameweekPoints: [] },
        },
      ],
      3,
    );
    expect(result.totalHitCost).toBe(8);
    // gain = (6-3)*3 + (7-2)*3 = 9 + 15 = 24, net = 24 - 8 = 16
    expect(result.totalProjectedGain).toBeCloseTo(24, 5);
    expect(result.netGain).toBeCloseTo(16, 5);
    expect(result.isJustified).toBe(true);
  });
});
