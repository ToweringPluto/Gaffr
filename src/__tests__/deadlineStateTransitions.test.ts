import fc from 'fast-check';
import {
  calculateCountdown,
  getUrgency,
  type DeadlineUrgency,
} from '../domain/deadlineTimer';

/**
 * For any current time and gameweek deadline:
 * - If time remaining > 24 hours → urgency is 'normal'
 * - If time remaining <= 24 hours and > 0 → urgency is 'warning'
 * - If deadline has passed (time remaining = 0) → urgency is 'locked'
 */

// ── Constants ────────────────────────────────────────────────────────

const MS_24H = 24 * 60 * 60 * 1000;

// ── Arbitraries ──────────────────────────────────────────────────────

const epochArb = fc.integer({ min: 1_700_000_000_000, max: 1_800_000_000_000 });

/** now is more than 24h before deadline → 'normal' */
const normalArb = fc
  .tuple(epochArb, fc.integer({ min: MS_24H + 1_000, max: MS_24H * 30 }))
  .map(([nowMs, delta]) => ({
    now: new Date(nowMs),
    deadline: new Date(nowMs + delta),
    expected: 'normal' as DeadlineUrgency,
  }));

/** now is within 24h of deadline but before it → 'warning' */
const warningArb = fc
  .tuple(epochArb, fc.integer({ min: 1_000, max: MS_24H }))
  .map(([nowMs, delta]) => ({
    now: new Date(nowMs),
    deadline: new Date(nowMs + delta),
    expected: 'warning' as DeadlineUrgency,
  }));

/** now is at or past deadline → 'locked' */
const lockedArb = fc
  .tuple(epochArb, fc.integer({ min: 0, max: MS_24H * 30 }))
  .map(([deadlineMs, delta]) => ({
    now: new Date(deadlineMs + delta),
    deadline: new Date(deadlineMs),
    expected: 'locked' as DeadlineUrgency,
  }));

// ── Tests ────────────────────────────────────────────────────────────

describe('Property 28: Deadline State Transitions', () => {
  it('returns "normal" when more than 24 hours remain', () => {
    fc.assert(
      fc.property(normalArb, ({ now, deadline, expected }) => {
        const countdown = calculateCountdown(now, deadline);
        expect(getUrgency(countdown)).toBe(expected);
      }),
      { numRuns: 300 },
    );
  });

  it('returns "warning" when within 24 hours of deadline', () => {
    fc.assert(
      fc.property(warningArb, ({ now, deadline, expected }) => {
        const countdown = calculateCountdown(now, deadline);
        expect(getUrgency(countdown)).toBe(expected);
      }),
      { numRuns: 300 },
    );
  });

  it('returns "locked" when deadline has passed', () => {
    fc.assert(
      fc.property(lockedArb, ({ now, deadline, expected }) => {
        const countdown = calculateCountdown(now, deadline);
        expect(getUrgency(countdown)).toBe(expected);
      }),
      { numRuns: 300 },
    );
  });

  it('urgency is always one of the three valid states', () => {
    fc.assert(
      fc.property(
        epochArb,
        fc.integer({ min: -MS_24H * 30, max: MS_24H * 30 }),
        (nowMs, delta) => {
          const now = new Date(nowMs);
          const deadline = new Date(nowMs + delta);
          const countdown = calculateCountdown(now, deadline);
          const urgency = getUrgency(countdown);
          expect(['normal', 'warning', 'locked']).toContain(urgency);
        },
      ),
      { numRuns: 300 },
    );
  });
});
