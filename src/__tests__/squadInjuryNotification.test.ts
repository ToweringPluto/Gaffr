import fc from 'fast-check';
import type { SquadPlayer, Position, GameweekPoints } from '../models';
import {
  generateSquadInjuryNotifications,
  categoriseSeverity,
} from '../domain/newsProcessor';

/**
 * For any set of squad players, generateSquadInjuryNotifications shall return
 * a notification for every player whose chanceOfPlaying is non-null AND < 75,
 * and shall NOT return a notification for any player whose chanceOfPlaying is
 * null or >= 75.
 */

// ── Arbitraries ──────────────────────────────────────────────────────

const positionArb: fc.Arbitrary<Position> = fc.constantFrom(
  'GKP',
  'DEF',
  'MID',
  'FWD',
);

const squadPlayerArb: fc.Arbitrary<SquadPlayer> = fc
  .record({
    id: fc.integer({ min: 1, max: 1000 }),
    name: fc.string({ minLength: 1, maxLength: 20 }),
    teamId: fc.integer({ min: 1, max: 20 }),
    position: positionArb,
    totalPoints: fc.integer({ min: 0, max: 300 }),
    form: fc.float({ min: 0, max: 15, noNaN: true }),
    cost: fc.integer({ min: 40, max: 150 }),
    ownershipPercentage: fc.float({ min: 0, max: 100, noNaN: true }),
    minutesPlayed: fc.integer({ min: 0, max: 3420 }),
    news: fc.constant(''),
    chanceOfPlaying: fc.oneof(
      fc.constant(null),
      fc.constantFrom(0, 25, 50, 75, 100),
    ),
    gameweekPoints: fc.constant([] as GameweekPoints[]),
    isCaptain: fc.boolean(),
    isViceCaptain: fc.boolean(),
    isBenched: fc.boolean(),
    benchOrder: fc.integer({ min: 0, max: 4 }),
    sellingPrice: fc.integer({ min: 40, max: 150 }),
  })
  .map((r) => r as SquadPlayer);

/** Squad with unique player IDs. */
const squadPlayersArb: fc.Arbitrary<SquadPlayer[]> = fc
  .array(squadPlayerArb, { minLength: 1, maxLength: 15 })
  .map((players) => {
    const seen = new Set<number>();
    let nextId = 1;
    for (const p of players) {
      while (seen.has(nextId)) nextId++;
      p.id = nextId;
      seen.add(nextId);
      nextId++;
    }
    return players;
  });

// ── Tests ────────────────────────────────────────────────────────────

describe('Property 25: Squad Injury Notification', () => {
  it('returns a notification for every player with non-null chanceOfPlaying < 75', () => {
    fc.assert(
      fc.property(squadPlayersArb, (players) => {
        const result = generateSquadInjuryNotifications(players);
        const resultIds = new Set(result.map((n) => n.player.id));

        const expected = players.filter(
          (p) => p.chanceOfPlaying !== null && p.chanceOfPlaying < 75,
        );

        for (const p of expected) {
          expect(resultIds.has(p.id)).toBe(true);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('does NOT return a notification for players with null or >= 75 chanceOfPlaying', () => {
    fc.assert(
      fc.property(squadPlayersArb, (players) => {
        const result = generateSquadInjuryNotifications(players);
        const resultIds = new Set(result.map((n) => n.player.id));

        const excluded = players.filter(
          (p) => p.chanceOfPlaying === null || p.chanceOfPlaying >= 75,
        );

        for (const p of excluded) {
          expect(resultIds.has(p.id)).toBe(false);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('notification count equals the number of players with chanceOfPlaying non-null and < 75', () => {
    fc.assert(
      fc.property(squadPlayersArb, (players) => {
        const result = generateSquadInjuryNotifications(players);
        const expectedCount = players.filter(
          (p) => p.chanceOfPlaying !== null && p.chanceOfPlaying < 75,
        ).length;

        expect(result).toHaveLength(expectedCount);
      }),
      { numRuns: 200 },
    );
  });

  it('each notification severity matches categoriseSeverity for that player', () => {
    fc.assert(
      fc.property(squadPlayersArb, (players) => {
        const result = generateSquadInjuryNotifications(players);

        for (const notification of result) {
          const expectedSeverity = categoriseSeverity(
            notification.player.chanceOfPlaying,
            true,
          );
          expect(notification.severity).toBe(expectedSeverity);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('notifications are sorted by severity (most urgent first)', () => {
    const severityOrder: Record<string, number> = {
      injured_suspended: 0,
      doubtful_25: 1,
      doubtful_50: 2,
      doubtful_75: 3,
      available: 4,
    };

    fc.assert(
      fc.property(squadPlayersArb, (players) => {
        const result = generateSquadInjuryNotifications(players);

        for (let i = 1; i < result.length; i++) {
          expect(severityOrder[result[i - 1].severity]).toBeLessThanOrEqual(
            severityOrder[result[i].severity],
          );
        }
      }),
      { numRuns: 200 },
    );
  });

  it('each notification chanceOfPlaying matches the source player value', () => {
    fc.assert(
      fc.property(squadPlayersArb, (players) => {
        const result = generateSquadInjuryNotifications(players);

        for (const notification of result) {
          expect(notification.chanceOfPlaying).toBe(
            notification.player.chanceOfPlaying,
          );
        }
      }),
      { numRuns: 200 },
    );
  });
});
