import fc from 'fast-check';
import type { ChipStatus } from '../models';
import { activateChip } from '../domain/chipStrategyEngine';

/**
 * For any chip that is currently available, activating it shall change its
 * status to used and set the usedGameweek to the current gameweek.
 */

const chipNameArb: fc.Arbitrary<ChipStatus['chipName']> = fc.constantFrom(
  'bench_boost',
  'triple_captain',
  'free_hit',
  'wildcard',
);

const availableChipArb: fc.Arbitrary<ChipStatus> = chipNameArb.map((name) => ({
  chipName: name,
  used: false,
  usedGameweek: null,
}));

const usedChipArb: fc.Arbitrary<ChipStatus> = fc
  .tuple(chipNameArb, fc.integer({ min: 1, max: 38 }))
  .map(([name, gw]) => ({
    chipName: name,
    used: true,
    usedGameweek: gw,
  }));

/**
 * Generate a chip status array with all 4 chip types, each randomly available or used,
 * guaranteeing at least one available chip.
 */
const chipStatusArrayArb: fc.Arbitrary<ChipStatus[]> = fc
  .tuple(
    fc.boolean(),
    fc.boolean(),
    fc.boolean(),
    fc.boolean(),
    fc.integer({ min: 1, max: 38 }),
    fc.integer({ min: 1, max: 38 }),
    fc.integer({ min: 1, max: 38 }),
    fc.integer({ min: 1, max: 38 }),
  )
  .map(([bb, tc, fh, wc, gw1, gw2, gw3, gw4]) => {
    const names: ChipStatus['chipName'][] = ['bench_boost', 'triple_captain', 'free_hit', 'wildcard'];
    const usedFlags = [bb, tc, fh, wc];
    const gws = [gw1, gw2, gw3, gw4];
    return names.map((name, i) => ({
      chipName: name,
      used: usedFlags[i],
      usedGameweek: usedFlags[i] ? gws[i] : null,
    }));
  });

describe('Property 23: Chip Activation State Transition', () => {
  it('activating an available chip sets used=true and usedGameweek to current gameweek', () => {
    fc.assert(
      fc.property(
        availableChipArb,
        fc.integer({ min: 1, max: 38 }),
        (chip, currentGameweek) => {
          const chipStatus: ChipStatus[] = [chip];
          const result = activateChip(chipStatus, chip.chipName, currentGameweek);

          expect(result).toHaveLength(1);
          expect(result[0].chipName).toBe(chip.chipName);
          expect(result[0].used).toBe(true);
          expect(result[0].usedGameweek).toBe(currentGameweek);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('activating a chip does not mutate the original array', () => {
    fc.assert(
      fc.property(
        availableChipArb,
        fc.integer({ min: 1, max: 38 }),
        (chip, currentGameweek) => {
          const chipStatus: ChipStatus[] = [{ ...chip }];
          const originalUsed = chipStatus[0].used;
          const originalGw = chipStatus[0].usedGameweek;

          activateChip(chipStatus, chip.chipName, currentGameweek);

          expect(chipStatus[0].used).toBe(originalUsed);
          expect(chipStatus[0].usedGameweek).toBe(originalGw);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('activating an already-used chip leaves it unchanged', () => {
    fc.assert(
      fc.property(
        usedChipArb,
        fc.integer({ min: 1, max: 38 }),
        (chip, currentGameweek) => {
          const chipStatus: ChipStatus[] = [chip];
          const result = activateChip(chipStatus, chip.chipName, currentGameweek);

          expect(result).toHaveLength(1);
          expect(result[0].used).toBe(true);
          expect(result[0].usedGameweek).toBe(chip.usedGameweek);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('only the targeted chip is affected; all other chips remain unchanged', () => {
    fc.assert(
      fc.property(
        chipStatusArrayArb,
        chipNameArb,
        fc.integer({ min: 1, max: 38 }),
        (chipStatus, targetChip, currentGameweek) => {
          const result = activateChip(chipStatus, targetChip, currentGameweek);

          expect(result).toHaveLength(chipStatus.length);

          for (let i = 0; i < chipStatus.length; i++) {
            if (chipStatus[i].chipName !== targetChip) {
              // Non-targeted chips must be identical
              expect(result[i].chipName).toBe(chipStatus[i].chipName);
              expect(result[i].used).toBe(chipStatus[i].used);
              expect(result[i].usedGameweek).toBe(chipStatus[i].usedGameweek);
            }
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it('activating a chip not in the array leaves all chips unchanged', () => {
    fc.assert(
      fc.property(
        fc.tuple(availableChipArb, availableChipArb).filter(
          ([a, b]) => a.chipName !== b.chipName,
        ),
        fc.integer({ min: 1, max: 38 }),
        ([chipInArray, chipNotInArray], currentGameweek) => {
          const chipStatus: ChipStatus[] = [chipInArray];
          const result = activateChip(chipStatus, chipNotInArray.chipName, currentGameweek);

          expect(result).toHaveLength(1);
          expect(result[0].used).toBe(false);
          expect(result[0].usedGameweek).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });
});
