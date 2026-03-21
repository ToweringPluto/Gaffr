import fc from 'fast-check';
import { createDataParser } from '../data/dataParser';
import type { Position } from '../models/player';

/**
 * For any valid FPL API player JSON object, parsing it via the Data Parser
 * shall produce a Player with all required fields populated: name, teamId,
 * position, totalPoints, form, cost, ownershipPercentage, and minutesPlayed.
 */

const parser = createDataParser();

// ── Arbitraries ──────────────────────────────────────────────────────

const arbElementType = fc.constantFrom(1, 2, 3, 4);

const ELEMENT_TYPE_TO_POSITION: Record<number, Position> = {
  1: 'GKP',
  2: 'DEF',
  3: 'MID',
  4: 'FWD',
};

const arbFplApiPlayer = fc.record({
  id: fc.integer({ min: 1, max: 10000 }),
  web_name: fc.string({ minLength: 1, maxLength: 30 }),
  team: fc.integer({ min: 1, max: 20 }),
  element_type: arbElementType,
  total_points: fc.integer({ min: -20, max: 500 }),
  form: fc.double({ min: 0, max: 15, noNaN: true, noDefaultInfinity: true }),
  now_cost: fc.integer({ min: 30, max: 200 }),
  selected_by_percent: fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }),
  minutes: fc.integer({ min: 0, max: 3420 }),
  news: fc.string({ maxLength: 100 }),
  chance_of_playing_next_round: fc.oneof(
    fc.constant(null),
    fc.constantFrom(0, 25, 50, 75, 100),
  ),
});

// ── Tests ────────────────────────────────────────────────────────────

describe('Property 2: Player Data Extraction Completeness', () => {
  it('all required fields are populated with correct types and values after parsing FPL API player JSON', () => {
    fc.assert(
      fc.property(arbFplApiPlayer, (fplPlayer) => {
        const bootstrap = {
          elements: [fplPlayer],
          teams: [],
          events: [],
        };

        const parsed = parser.parseBootstrap(bootstrap);
        expect(parsed.players).toHaveLength(1);

        const player = parsed.players[0];

        // name: non-empty string, mapped from web_name
        expect(typeof player.name).toBe('string');
        expect(player.name.length).toBeGreaterThan(0);
        expect(player.name).toBe(fplPlayer.web_name);

        // teamId: number > 0, mapped from team
        expect(typeof player.teamId).toBe('number');
        expect(player.teamId).toBeGreaterThan(0);
        expect(player.teamId).toBe(fplPlayer.team);

        // position: valid Position type, mapped from element_type
        const validPositions: Position[] = ['GKP', 'DEF', 'MID', 'FWD'];
        expect(validPositions).toContain(player.position);
        expect(player.position).toBe(ELEMENT_TYPE_TO_POSITION[fplPlayer.element_type]);

        // totalPoints: number, mapped from total_points
        expect(typeof player.totalPoints).toBe('number');
        expect(player.totalPoints).toBe(fplPlayer.total_points);

        // form: number, mapped from form
        expect(typeof player.form).toBe('number');
        expect(player.form).toBeCloseTo(fplPlayer.form, 10);

        // cost: number > 0, mapped from now_cost
        expect(typeof player.cost).toBe('number');
        expect(player.cost).toBeGreaterThan(0);
        expect(player.cost).toBe(fplPlayer.now_cost);

        // ownershipPercentage: number >= 0, mapped from selected_by_percent
        expect(typeof player.ownershipPercentage).toBe('number');
        expect(player.ownershipPercentage).toBeGreaterThanOrEqual(0);
        expect(player.ownershipPercentage).toBeCloseTo(fplPlayer.selected_by_percent, 10);

        // minutesPlayed: number >= 0, mapped from minutes
        expect(typeof player.minutesPlayed).toBe('number');
        expect(player.minutesPlayed).toBeGreaterThanOrEqual(0);
        expect(player.minutesPlayed).toBe(fplPlayer.minutes);
      }),
      { numRuns: 100 },
    );
  });
});
