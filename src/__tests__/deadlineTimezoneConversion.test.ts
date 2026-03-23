import fc from 'fast-check';
import { convertToLocalTime } from '../domain/deadlineTimer';

/**
 * For any deadline time in UTC and any IANA timezone identifier,
 * the displayed local time shall equal the correct timezone conversion
 * of the UTC time.
 */

// ── Arbitraries ──────────────────────────────────────────────────────

/** ISO 8601 UTC timestamp arbitrary. */
const utcTimestampArb: fc.Arbitrary<string> = fc
  .integer({ min: 1_700_000_000, max: 1_800_000_000 })
  .map((epoch) => new Date(epoch * 1000).toISOString());

/** A selection of IANA timezones covering various offsets. */
const timezoneArb: fc.Arbitrary<string> = fc.constantFrom(
  'UTC',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Los_Angeles',
  'Asia/Tokyo',
  'Asia/Kolkata',
  'Australia/Sydney',
  'Pacific/Auckland',
);

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Reference implementation: use Intl.DateTimeFormat to get the expected
 * local time string for a given UTC time and timezone.
 */
function referenceConvert(utc: string, tz: string): string {
  const date = new Date(utc);
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? '00';

  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`;
}

// ── Tests ────────────────────────────────────────────────────────────

describe('Property 29: Deadline Timezone Conversion', () => {
  it('matches the reference Intl conversion for any UTC time and timezone', () => {
    fc.assert(
      fc.property(utcTimestampArb, timezoneArb, (utc, tz) => {
        const result = convertToLocalTime(utc, tz);
        const expected = referenceConvert(utc, tz);
        expect(result).toBe(expected);
      }),
      { numRuns: 300 },
    );
  });

  it('returns a valid ISO 8601-style date-time string', () => {
    fc.assert(
      fc.property(utcTimestampArb, timezoneArb, (utc, tz) => {
        const result = convertToLocalTime(utc, tz);
        // Should match YYYY-MM-DDTHH:MM:SS
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
      }),
      { numRuns: 300 },
    );
  });

  it('UTC timezone produces the same date-time components as the input', () => {
    fc.assert(
      fc.property(utcTimestampArb, (utc) => {
        const result = convertToLocalTime(utc, 'UTC');
        const date = new Date(utc);
        const expected = [
          date.getUTCFullYear().toString(),
          String(date.getUTCMonth() + 1).padStart(2, '0'),
          String(date.getUTCDate()).padStart(2, '0'),
          String(date.getUTCHours()).padStart(2, '0'),
          String(date.getUTCMinutes()).padStart(2, '0'),
          String(date.getUTCSeconds()).padStart(2, '0'),
        ].join('-')
          .replace(/^(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})$/,
            '$1-$2-$3T$4:$5:$6');
        expect(result).toBe(expected);
      }),
      { numRuns: 300 },
    );
  });

  it('known conversion: 2025-01-15T12:00:00Z in America/New_York is 07:00:00', () => {
    const result = convertToLocalTime('2025-01-15T12:00:00.000Z', 'America/New_York');
    expect(result).toBe('2025-01-15T07:00:00');
  });

  it('known conversion: 2025-07-15T12:00:00Z in Europe/Berlin is 14:00:00 (DST)', () => {
    const result = convertToLocalTime('2025-07-15T12:00:00.000Z', 'Europe/Berlin');
    expect(result).toBe('2025-07-15T14:00:00');
  });
});
