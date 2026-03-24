import fc from 'fast-check';
import { isHitJustified, calculateProjectedGain } from '../domain/transferHitCalculator';
import type { Player } from '../models';

const HIT_COST = 4;

describe('Property 33: Transfer Hit Justification Threshold', () => {
  /**
   * For any projected points gain and a 4-point hit cost, the hit shall
   * be marked as justified if and only if the projected gain exceeds
   * the hit cost.
   */

  it('hit is justified iff projected gain strictly exceeds the hit cost', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -20, max: 40, noNaN: true, noDefaultInfinity: true }),
        (projectedGain) => {
          const result = isHitJustified(projectedGain, HIT_COST);

          if (projectedGain > HIT_COST) {
            expect(result).toBe(true);
          } else {
            expect(result).toBe(false);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it('gain exactly equal to hit cost is NOT justified', () => {
    expect(isHitJustified(HIT_COST, HIT_COST)).toBe(false);
  });

  it('gain just above hit cost IS justified', () => {
    expect(isHitJustified(HIT_COST + 0.01, HIT_COST)).toBe(true);
  });

  it('negative projected gain is never justified', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -100, max: -0.01, noNaN: true, noDefaultInfinity: true }),
        (projectedGain) => {
          expect(isHitJustified(projectedGain, HIT_COST)).toBe(false);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('calculateProjectedGain feeds correctly into isHitJustified', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 15, noNaN: true, noDefaultInfinity: true }), // playerOut form
        fc.double({ min: 0, max: 15, noNaN: true, noDefaultInfinity: true }), // playerIn form
        fc.integer({ min: 1, max: 6 }), // gameweeks
        (formOut, formIn, gameweeks) => {
          const playerOut: Player = {
            id: 1,
            name: 'Out',
            teamId: 1,
            position: 'MID',
            totalPoints: 50,
            form: formOut,
            cost: 80,
            ownershipPercentage: 10,
            minutesPlayed: 900,
            news: '',
            chanceOfPlaying: 100,
            gameweekPoints: [],
          };

          const playerIn: Player = {
            id: 2,
            name: 'In',
            teamId: 2,
            position: 'MID',
            totalPoints: 60,
            form: formIn,
            cost: 80,
            ownershipPercentage: 10,
            minutesPlayed: 900,
            news: '',
            chanceOfPlaying: 100,
            gameweekPoints: [],
          };

          const gain = calculateProjectedGain(playerOut, playerIn, gameweeks);
          const expectedGain = formIn * gameweeks - formOut * gameweeks;

          // Projected gain matches form difference × gameweeks
          expect(gain).toBeCloseTo(expectedGain, 5);

          // Justification follows the threshold rule
          const justified = isHitJustified(gain, HIT_COST);
          if (gain > HIT_COST) {
            expect(justified).toBe(true);
          } else {
            expect(justified).toBe(false);
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});
