import fc from 'fast-check';
import { categoriseSeverity } from '../domain/newsProcessor';
import type { NewsSeverity } from '../models/news';

/**
 * For any player chanceOfPlaying value, categoriseSeverity shall map it to the
 * correct NewsSeverity:
 *   100       → 'available'
 *   75        → 'doubtful_75'
 *   50        → 'doubtful_50'
 *   25        → 'doubtful_25'
 *   0         → 'injured_suspended'
 *   null+flag → 'injured_suspended'
 *   null      → 'available'
 */

// ── Arbitraries ──────────────────────────────────────────────────────

/** The five canonical chanceOfPlaying values from the FPL API. */
const arbCanonicalChance: fc.Arbitrary<number> = fc.constantFrom(0, 25, 50, 75, 100);

/** Arbitrary integer in [0, 100] for boundary testing. */
const arbAnyChance: fc.Arbitrary<number> = fc.integer({ min: 0, max: 100 });

// ── Helpers ──────────────────────────────────────────────────────────

function expectedSeverity(
  chance: number | null,
  hasInjuryFlag: boolean,
): NewsSeverity {
  if (chance === null) {
    return hasInjuryFlag ? 'injured_suspended' : 'available';
  }
  if (chance >= 100) return 'available';
  if (chance >= 75) return 'doubtful_75';
  if (chance >= 50) return 'doubtful_50';
  if (chance >= 25) return 'doubtful_25';
  return 'injured_suspended';
}

// ── Tests ────────────────────────────────────────────────────────────

describe('Property 24: News Severity Categorisation', () => {
  it('maps canonical chanceOfPlaying values to the correct severity', () => {
    fc.assert(
      fc.property(arbCanonicalChance, fc.boolean(), (chance, hasFlag) => {
        const result = categoriseSeverity(chance, hasFlag);
        expect(result).toBe(expectedSeverity(chance, hasFlag));
      }),
      { numRuns: 200 },
    );
  });

  it('maps any integer chanceOfPlaying [0–100] to the correct severity', () => {
    fc.assert(
      fc.property(arbAnyChance, fc.boolean(), (chance, hasFlag) => {
        const result = categoriseSeverity(chance, hasFlag);
        expect(result).toBe(expectedSeverity(chance, hasFlag));
      }),
      { numRuns: 500 },
    );
  });

  it('maps null with injury flag to injured_suspended', () => {
    fc.assert(
      fc.property(fc.constant(null), (chance) => {
        expect(categoriseSeverity(chance, true)).toBe('injured_suspended');
      }),
      { numRuns: 10 },
    );
  });

  it('maps null without injury flag to available', () => {
    fc.assert(
      fc.property(fc.constant(null), (chance) => {
        expect(categoriseSeverity(chance, false)).toBe('available');
      }),
      { numRuns: 10 },
    );
  });

  it('result is always a valid NewsSeverity value', () => {
    const validSeverities: NewsSeverity[] = [
      'available',
      'doubtful_25',
      'doubtful_50',
      'doubtful_75',
      'injured_suspended',
    ];

    fc.assert(
      fc.property(
        fc.oneof(fc.constant(null), fc.integer({ min: 0, max: 100 })),
        fc.boolean(),
        (chance, hasFlag) => {
          const result = categoriseSeverity(chance, hasFlag);
          expect(validSeverities).toContain(result);
        },
      ),
      { numRuns: 300 },
    );
  });

  it('severity worsens monotonically as chanceOfPlaying decreases', () => {
    const severityOrder: NewsSeverity[] = [
      'available',
      'doubtful_75',
      'doubtful_50',
      'doubtful_25',
      'injured_suspended',
    ];

    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        (a, b) => {
          const higher = Math.max(a, b);
          const lower = Math.min(a, b);
          const sevHigh = categoriseSeverity(higher, false);
          const sevLow = categoriseSeverity(lower, false);
          expect(severityOrder.indexOf(sevHigh)).toBeLessThanOrEqual(
            severityOrder.indexOf(sevLow),
          );
        },
      ),
      { numRuns: 300 },
    );
  });
});
