import fc from 'fast-check';
import { rankByForm, filterByPosition } from '../domain/playerFormRanker';
import type { Player, Position, GameweekPoints, RankedPlayer } from '../models/player';

/**
 * For any list of players and any position filter (GKP, DEF, MID, FWD),
 * all players in the filtered result shall match the selected position,
 * and no player matching the position shall be excluded.
 */

// ── Arbitraries ──────────────────────────────────────────────────────

const arbPosition: fc.Arbitrary<Position> = fc.constantFrom('GKP', 'DEF', 'MID', 'FWD');

const arbGameweekPoints: fc.Arbitrary<GameweekPoints> = fc.record({
  gameweek: fc.integer({ min: 1, max: 38 }),
  points: fc.integer({ min: 0, max: 20 }),
  minutes: fc.integer({ min: 0, max: 90 }),
});

const arbPlayer: fc.Arbitrary<Player> = fc.record({
  id: fc.integer({ min: 1, max: 10000 }),
  name: fc.string({ minLength: 1, maxLength: 20 }),
  teamId: fc.integer({ min: 1, max: 20 }),
  position: arbPosition,
  totalPoints: fc.integer({ min: 0, max: 500 }),
  form: fc.double({ min: 0, max: 15, noNaN: true, noDefaultInfinity: true }),
  cost: fc.integer({ min: 30, max: 200 }),
  ownershipPercentage: fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }),
  minutesPlayed: fc.integer({ min: 0, max: 3420 }),
  news: fc.constant(''),
  chanceOfPlaying: fc.oneof(fc.constant(null), fc.constantFrom(0, 25, 50, 75, 100)),
  gameweekPoints: fc.array(arbGameweekPoints, { minLength: 0, maxLength: 10 }),
});

const arbPlayers: fc.Arbitrary<Player[]> = fc.array(arbPlayer, { minLength: 0, maxLength: 20 });

// ── Tests ────────────────────────────────────────────────────────────

describe('Property 7: Position Filter Correctness', () => {
  const GAMEWEEK_WINDOW = 4;

  it('all players in filtered result match the selected position', () => {
    fc.assert(
      fc.property(arbPlayers, arbPosition, (players, position) => {
        const ranked = rankByForm(players, GAMEWEEK_WINDOW);
        const filtered = filterByPosition(ranked, position);

        for (const player of filtered) {
          expect(player.position).toBe(position);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('no player matching the position is excluded from the result', () => {
    fc.assert(
      fc.property(arbPlayers, arbPosition, (players, position) => {
        const ranked = rankByForm(players, GAMEWEEK_WINDOW);
        const filtered = filterByPosition(ranked, position);

        const expectedCount = ranked.filter((p) => p.position === position).length;
        expect(filtered).toHaveLength(expectedCount);
      }),
      { numRuns: 100 },
    );
  });

  it('filtered result is a subset of the ranked input', () => {
    fc.assert(
      fc.property(arbPlayers, arbPosition, (players, position) => {
        const ranked = rankByForm(players, GAMEWEEK_WINDOW);
        const filtered = filterByPosition(ranked, position);

        const rankedIds = new Set(ranked.map((p) => p.id));
        for (const player of filtered) {
          expect(rankedIds.has(player.id)).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });
});
