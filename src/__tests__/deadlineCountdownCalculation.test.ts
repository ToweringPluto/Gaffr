import fc from 'fast-check';
import { calculateCountdown, type DeadlineCountdown } from '../domain/deadlineTimer';

/**
 * For any current time and gameweek deadline, the countdown timer shall
 * display the correct time remaining (days, hours, minutes, seconds)
 * until the deadline. If the deadline has passed, all values shall be 0.
 */

// ── Constants ────────────────────────────────────────────────────────

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

// ── Arbitraries ──────────────────────────────────────────────────────

/** Epoch in milliseconds within a realistic range. */
const epochArb = fc.integer({ min: 1_700_000_000_000, max: 1_800_000_000_000 });

/** Positive delta representing time before deadline (1s to ~60 days). */
const positiveDeltaArb = fc.integer({ min: 1_000, max: MS_PER_DAY * 60 });

/** Delta where deadline is in the past (0 to ~30 days ago). */
const pastDeltaArb = fc.integer({ min: 0, max: MS_PER_DAY * 30 });

// ── Tests ────────────────────────────────────────────────────────────

describe('Property 27: Deadline Countdown Calculation', () => {
  it('totalMs equals the difference between deadline and now when deadline is in the future', () => {
    fc.assert(
      fc.property(epochArb, positiveDeltaArb, (nowMs, delta) => {
        const now = new Date(nowMs);
        const deadline = new Date(nowMs + delta);
        const countdown = calculateCountdown(now, deadline);
        expect(countdown.totalMs).toBe(delta);
      }),
      { numRuns: 500 },
    );
  });

  it('days/hours/minutes/seconds decompose totalMs correctly', () => {
    fc.assert(
      fc.property(epochArb, positiveDeltaArb, (nowMs, delta) => {
        const now = new Date(nowMs);
        const deadline = new Date(nowMs + delta);
        const countdown = calculateCountdown(now, deadline);

        const reconstructedMs =
          countdown.days * MS_PER_DAY +
          countdown.hours * MS_PER_HOUR +
          countdown.minutes * MS_PER_MINUTE +
          countdown.seconds * MS_PER_SECOND;

        // Reconstructed should match totalMs floored to the nearest second
        const totalMsFloored = Math.floor(countdown.totalMs / MS_PER_SECOND) * MS_PER_SECOND;
        expect(reconstructedMs).toBe(totalMsFloored);
      }),
      { numRuns: 500 },
    );
  });

  it('each component stays within its valid range', () => {
    fc.assert(
      fc.property(epochArb, positiveDeltaArb, (nowMs, delta) => {
        const now = new Date(nowMs);
        const deadline = new Date(nowMs + delta);
        const countdown = calculateCountdown(now, deadline);

        expect(countdown.days).toBeGreaterThanOrEqual(0);
        expect(countdown.hours).toBeGreaterThanOrEqual(0);
        expect(countdown.hours).toBeLessThan(24);
        expect(countdown.minutes).toBeGreaterThanOrEqual(0);
        expect(countdown.minutes).toBeLessThan(60);
        expect(countdown.seconds).toBeGreaterThanOrEqual(0);
        expect(countdown.seconds).toBeLessThan(60);
      }),
      { numRuns: 500 },
    );
  });

  it('returns all zeros when the deadline has passed', () => {
    fc.assert(
      fc.property(epochArb, pastDeltaArb, (deadlineMs, delta) => {
        const now = new Date(deadlineMs + delta);
        const deadline = new Date(deadlineMs);
        const countdown = calculateCountdown(now, deadline);

        expect(countdown.days).toBe(0);
        expect(countdown.hours).toBe(0);
        expect(countdown.minutes).toBe(0);
        expect(countdown.seconds).toBe(0);
        expect(countdown.totalMs).toBe(0);
      }),
      { numRuns: 500 },
    );
  });

  it('returns all zeros when now equals the deadline exactly', () => {
    fc.assert(
      fc.property(epochArb, (nowMs) => {
        const t = new Date(nowMs);
        const countdown = calculateCountdown(t, t);

        expect(countdown.totalMs).toBe(0);
        expect(countdown.days).toBe(0);
        expect(countdown.hours).toBe(0);
        expect(countdown.minutes).toBe(0);
        expect(countdown.seconds).toBe(0);
      }),
      { numRuns: 300 },
    );
  });

  it('totalMs is always non-negative regardless of input ordering', () => {
    fc.assert(
      fc.property(epochArb, epochArb, (aMs, bMs) => {
        const countdown = calculateCountdown(new Date(aMs), new Date(bMs));
        expect(countdown.totalMs).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 500 },
    );
  });
});
