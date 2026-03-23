import fc from 'fast-check';
import type { NewsItem, NewsSeverity } from '../models';
import { sortNewsByPriority } from '../domain/newsProcessor';

/**
 * For any set of news items and squad player IDs, sortNewsByPriority shall:
 * 1. Place all squad injury news (player in squad AND severity !== 'available')
 *    before all non-squad-injury news.
 * 2. Within each group, items are sorted by severity (most urgent first).
 * 3. Within the same severity, items are sorted by timestamp descending
 *    (most recent first).
 */

// ── Arbitraries ──────────────────────────────────────────────────────

const severityArb: fc.Arbitrary<NewsSeverity> = fc.constantFrom(
  'available',
  'doubtful_25',
  'doubtful_50',
  'doubtful_75',
  'injured_suspended',
);

const sourceArb: fc.Arbitrary<'fpl_api' | 'external'> = fc.constantFrom(
  'fpl_api',
  'external',
);

/** ISO 8601 timestamp arbitrary — varying dates for ordering tests. */
const timestampArb: fc.Arbitrary<string> = fc
  .integer({ min: 1_700_000_000, max: 1_710_000_000 })
  .map((epoch) => new Date(epoch * 1000).toISOString());

const newsItemArb: fc.Arbitrary<NewsItem> = fc.record({
  playerId: fc.integer({ min: 1, max: 50 }),
  playerName: fc.string({ minLength: 1, maxLength: 15 }),
  content: fc.string({ minLength: 1, maxLength: 40 }),
  severity: severityArb,
  source: sourceArb,
  timestamp: timestampArb,
});

const newsListArb: fc.Arbitrary<NewsItem[]> = fc.array(newsItemArb, {
  minLength: 0,
  maxLength: 30,
});

/** A set of squad player IDs (subset of the 1–50 range). */
const squadIdsArb: fc.Arbitrary<Set<number>> = fc
  .subarray(Array.from({ length: 50 }, (_, i) => i + 1), {
    minLength: 0,
    maxLength: 20,
  })
  .map((ids) => new Set(ids));


// ── Helpers ──────────────────────────────────────────────────────────

const SEVERITY_PRIORITY: Record<NewsSeverity, number> = {
  injured_suspended: 0,
  doubtful_25: 1,
  doubtful_50: 2,
  doubtful_75: 3,
  available: 4,
};

function isSquadInjury(item: NewsItem, squadIds: Set<number>): boolean {
  return squadIds.has(item.playerId) && item.severity !== 'available';
}

// ── Tests ────────────────────────────────────────────────────────────

describe('Property 26: News Priority Ordering', () => {
  it('squad injury news always appears before non-squad-injury news', () => {
    fc.assert(
      fc.property(newsListArb, squadIdsArb, (items, squadIds) => {
        const sorted = sortNewsByPriority(items, squadIds);

        let seenNonSquadInjury = false;
        for (const item of sorted) {
          if (!isSquadInjury(item, squadIds)) {
            seenNonSquadInjury = true;
          } else {
            // Once we've seen a non-squad-injury item, no squad-injury item
            // should appear after it.
            expect(seenNonSquadInjury).toBe(false);
          }
        }
      }),
      { numRuns: 300 },
    );
  });

  it('within the squad-injury group, items are sorted by severity (most urgent first)', () => {
    fc.assert(
      fc.property(newsListArb, squadIdsArb, (items, squadIds) => {
        const sorted = sortNewsByPriority(items, squadIds);
        const squadInjuryItems = sorted.filter((n) =>
          isSquadInjury(n, squadIds),
        );

        for (let i = 1; i < squadInjuryItems.length; i++) {
          expect(
            SEVERITY_PRIORITY[squadInjuryItems[i - 1].severity],
          ).toBeLessThanOrEqual(
            SEVERITY_PRIORITY[squadInjuryItems[i].severity],
          );
        }
      }),
      { numRuns: 300 },
    );
  });

  it('within the non-squad-injury group, items are sorted by severity (most urgent first)', () => {
    fc.assert(
      fc.property(newsListArb, squadIdsArb, (items, squadIds) => {
        const sorted = sortNewsByPriority(items, squadIds);
        const nonSquadInjuryItems = sorted.filter(
          (n) => !isSquadInjury(n, squadIds),
        );

        for (let i = 1; i < nonSquadInjuryItems.length; i++) {
          expect(
            SEVERITY_PRIORITY[nonSquadInjuryItems[i - 1].severity],
          ).toBeLessThanOrEqual(
            SEVERITY_PRIORITY[nonSquadInjuryItems[i].severity],
          );
        }
      }),
      { numRuns: 300 },
    );
  });

  it('within the same group and severity, items are sorted by timestamp descending', () => {
    fc.assert(
      fc.property(newsListArb, squadIdsArb, (items, squadIds) => {
        const sorted = sortNewsByPriority(items, squadIds);

        for (let i = 1; i < sorted.length; i++) {
          const prev = sorted[i - 1];
          const curr = sorted[i];

          const sameGroup =
            isSquadInjury(prev, squadIds) === isSquadInjury(curr, squadIds);
          const sameSeverity = prev.severity === curr.severity;

          if (sameGroup && sameSeverity) {
            // Timestamp descending: prev >= curr
            expect(prev.timestamp >= curr.timestamp).toBe(true);
          }
        }
      }),
      { numRuns: 300 },
    );
  });

  it('output is a permutation of the input (no items added or lost)', () => {
    fc.assert(
      fc.property(newsListArb, squadIdsArb, (items, squadIds) => {
        const sorted = sortNewsByPriority(items, squadIds);
        expect(sorted).toHaveLength(items.length);

        // Every input item appears in the output
        for (const item of items) {
          expect(sorted).toContain(item);
        }
      }),
      { numRuns: 300 },
    );
  });

  it('empty input produces empty output', () => {
    const sorted = sortNewsByPriority([], new Set());
    expect(sorted).toEqual([]);
  });
});
