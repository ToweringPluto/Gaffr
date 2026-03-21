import fc from 'fast-check';
import {
  getFdrColour,
  getSpecialGameweekColour,
  BGW_COLOUR,
  DGW_COLOUR,
  type FdrColour,
} from '../domain/fixtureAnalyser';

/**
 * For any Fixture Difficulty Rating value in the range 1–5, the colour mapping
 * function shall return the exact background and border/text hex pair defined in
 * the design system. The mapping shall be deterministic. BGW maps to
 * bg #1a0a0a / text #e84848, DGW maps to bg #0a1a2a / text #39ff14.
 */

const EXPECTED_FDR_COLOURS: Record<number, FdrColour> = {
  1: { background: '#0a2a0a', borderText: '#39ff14' },
  2: { background: '#0f2a0a', borderText: '#88e848' },
  3: { background: '#2a2a00', borderText: '#e8c832' },
  4: { background: '#2a1400', borderText: '#e87832' },
  5: { background: '#2a0a0a', borderText: '#e84848' },
};

describe('Property 3: FDR Colour Mapping', () => {
  it('getFdrColour returns the exact design system hex pair for any FDR 1-5', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 5 }), (fdr) => {
        const result = getFdrColour(fdr);
        const expected = EXPECTED_FDR_COLOURS[fdr];
        expect(result.background).toBe(expected.background);
        expect(result.borderText).toBe(expected.borderText);
      }),
      { numRuns: 100 },
    );
  });

  it('getFdrColour is deterministic — same input always produces same output', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 5 }), (fdr) => {
        const first = getFdrColour(fdr);
        const second = getFdrColour(fdr);
        expect(first).toEqual(second);
      }),
      { numRuns: 100 },
    );
  });

  it('BGW special colour matches design system spec exactly', () => {
    const bgw = getSpecialGameweekColour('bgw');
    expect(bgw).toEqual({ background: '#1a0a0a', borderText: '#e84848' });
    expect(bgw).toEqual(BGW_COLOUR);
  });

  it('DGW special colour matches design system spec exactly', () => {
    const dgw = getSpecialGameweekColour('dgw');
    expect(dgw).toEqual({ background: '#0a1a2a', borderText: '#39ff14' });
    expect(dgw).toEqual(DGW_COLOUR);
  });

  it('out-of-range FDR values default to a valid FdrColour (FDR 3)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -100, max: 100 }).filter((n) => n < 1 || n > 5),
        (fdr) => {
          const result = getFdrColour(fdr);
          expect(result).toEqual(EXPECTED_FDR_COLOURS[3]);
        },
      ),
      { numRuns: 100 },
    );
  });
});
