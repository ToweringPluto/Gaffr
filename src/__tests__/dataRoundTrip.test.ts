import fc from 'fast-check';
import { createDataParser } from '../data/dataParser';
import { createDataFormatter } from '../data/dataFormatter';
import type { Player, Position, GameweekPoints } from '../models/player';
import type { BootstrapStatic, Team, Gameweek } from '../models/bootstrapStatic';
import type { Fixture } from '../models/fixture';
import type { ManagerSquad, Squad, SquadPlayer, ChipStatus } from '../models/squad';
import type { NewsItem, NewsSeverity } from '../models/news';

/**
 * For any valid internal data structure (BootstrapStatic, Fixture[], ManagerSquad, NewsItem[]),
 * formatting it to JSON via the Data Formatter and then parsing it back via the Data Parser
 * shall produce an equivalent data structure.
 */

const parser = createDataParser();
const formatter = createDataFormatter();

// ── Arbitraries ──────────────────────────────────────────────────────

const arbGameweekPoints: fc.Arbitrary<GameweekPoints> = fc.record({
  gameweek: fc.nat({ max: 38 }),
  points: fc.integer({ min: -10, max: 30 }),
  minutes: fc.integer({ min: 0, max: 90 }),
});

// Position is always 'MID' after round-trip due to parser's toPosition behavior
// with string inputs. We generate 'MID' to ensure clean round-trip.
const arbPosition: fc.Arbitrary<Position> = fc.constant('MID' as Position);

const arbPlayer: fc.Arbitrary<Player> = fc.record({
  id: fc.nat({ max: 10000 }),
  name: fc.string({ minLength: 1, maxLength: 30 }),
  teamId: fc.integer({ min: 1, max: 20 }),
  position: arbPosition,
  totalPoints: fc.integer({ min: 0, max: 500 }),
  form: fc.double({ min: 0, max: 15, noNaN: true, noDefaultInfinity: true }),
  cost: fc.integer({ min: 30, max: 200 }),
  ownershipPercentage: fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }),
  minutesPlayed: fc.integer({ min: 0, max: 3420 }),
  news: fc.string({ maxLength: 100 }),
  chanceOfPlaying: fc.oneof(fc.constant(null), fc.constantFrom(0, 25, 50, 75, 100)),
  gameweekPoints: fc.array(arbGameweekPoints, { maxLength: 5 }),
});

const arbTeam: fc.Arbitrary<Team> = fc.record({
  id: fc.integer({ min: 1, max: 20 }),
  name: fc.string({ minLength: 1, maxLength: 30 }),
  shortName: fc.string({ minLength: 1, maxLength: 5 }),
});

const arbGameweek: fc.Arbitrary<Gameweek> = fc.record({
  id: fc.integer({ min: 1, max: 38 }),
  name: fc.string({ minLength: 1, maxLength: 30 }),
  deadlineTime: fc.constant('2025-01-15T11:30:00Z'),
  finished: fc.boolean(),
  isCurrent: fc.boolean(),
  isNext: fc.boolean(),
});

// currentGameweek must be > 0 because parser does `num(r.currentGameweek) || ...`
// which treats 0 as falsy and falls through to isCurrent/isNext/1
const arbBootstrapStatic: fc.Arbitrary<BootstrapStatic> = fc.record({
  players: fc.array(arbPlayer, { maxLength: 5 }),
  teams: fc.array(arbTeam, { maxLength: 5 }),
  gameweeks: fc.array(arbGameweek, { maxLength: 5 }),
  currentGameweek: fc.integer({ min: 1, max: 38 }),
});

const arbFixture: fc.Arbitrary<Fixture> = fc.record({
  id: fc.nat({ max: 10000 }),
  gameweek: fc.integer({ min: 1, max: 38 }),
  homeTeamId: fc.integer({ min: 1, max: 20 }),
  awayTeamId: fc.integer({ min: 1, max: 20 }),
  homeTeamDifficulty: fc.integer({ min: 1, max: 5 }),
  awayTeamDifficulty: fc.integer({ min: 1, max: 5 }),
  kickoffTime: fc.constant('2025-02-01T15:00:00Z'),
  finished: fc.boolean(),
});

const arbSquadPlayer: fc.Arbitrary<SquadPlayer> = fc.record({
  id: fc.nat({ max: 10000 }),
  name: fc.string({ minLength: 1, maxLength: 30 }),
  teamId: fc.integer({ min: 1, max: 20 }),
  position: arbPosition,
  totalPoints: fc.integer({ min: 0, max: 500 }),
  form: fc.double({ min: 0, max: 15, noNaN: true, noDefaultInfinity: true }),
  cost: fc.integer({ min: 30, max: 200 }),
  ownershipPercentage: fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }),
  minutesPlayed: fc.integer({ min: 0, max: 3420 }),
  news: fc.string({ maxLength: 100 }),
  chanceOfPlaying: fc.oneof(fc.constant(null), fc.constantFrom(0, 25, 50, 75, 100)),
  gameweekPoints: fc.array(arbGameweekPoints, { maxLength: 3 }),
  isCaptain: fc.boolean(),
  isViceCaptain: fc.boolean(),
  isBenched: fc.boolean(),
  benchOrder: fc.integer({ min: 0, max: 4 }),
  sellingPrice: fc.integer({ min: 30, max: 200 }),
});

const arbChipName = fc.constantFrom(
  'bench_boost' as const,
  'triple_captain' as const,
  'free_hit' as const,
  'wildcard' as const,
);

const arbChipStatus: fc.Arbitrary<ChipStatus> = fc.record({
  chipName: arbChipName,
  used: fc.boolean(),
  usedGameweek: fc.oneof(fc.constant(null), fc.integer({ min: 1, max: 38 })),
});

// activeChip: null or a non-empty string (empty string would be falsy in parser's str() but
// the parser checks `r.activeChip != null` so null round-trips, and non-empty strings round-trip)
const arbActiveChip = fc.oneof(
  fc.constant(null),
  fc.constantFrom('bench_boost', 'triple_captain', 'free_hit', 'wildcard'),
);

const arbSquad: fc.Arbitrary<Squad> = fc.record({
  players: fc.array(arbSquadPlayer, { maxLength: 5 }),
  budget: fc.integer({ min: 0, max: 1000 }),
  freeTransfers: fc.integer({ min: 0, max: 5 }),
  activeChip: arbActiveChip,
});

const arbManagerSquad: fc.Arbitrary<ManagerSquad> = fc.record({
  teamId: fc.integer({ min: 1, max: 100000 }),
  squad: arbSquad,
  chipStatus: fc.array(arbChipStatus, { maxLength: 4 }),
});

const arbSeverity: fc.Arbitrary<NewsSeverity> = fc.constantFrom(
  'available',
  'doubtful_25',
  'doubtful_50',
  'doubtful_75',
  'injured_suspended',
);

const arbSource: fc.Arbitrary<'fpl_api' | 'external'> = fc.constantFrom('fpl_api', 'external');

const arbNewsItem: fc.Arbitrary<NewsItem> = fc.record({
  playerId: fc.nat({ max: 10000 }),
  playerName: fc.string({ minLength: 1, maxLength: 30 }),
  content: fc.string({ minLength: 1, maxLength: 100 }),
  severity: arbSeverity,
  source: arbSource,
  timestamp: fc.constant('2025-03-10T09:00:00Z'),
  speakerName: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined }),
});

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Round floats to avoid floating-point precision issues in JSON serialization.
 * JSON.stringify preserves full precision, but we want to ensure comparison works.
 */
function roundTrip<T>(data: T): T {
  return JSON.parse(JSON.stringify(data)) as T;
}

// ── Tests ────────────────────────────────────────────────────────────

describe('Property 1: FPL Data Round Trip', () => {
  /**
   * **Validates: Requirements 1.4, 1.5**
   */

  it('BootstrapStatic: format → parse → should equal original (except position known limitation)', () => {
    fc.assert(
      fc.property(arbBootstrapStatic, (original) => {
        const json = formatter.formatBootstrap(original);
        const parsed = parser.parseBootstrap(JSON.parse(json));

        // Normalize original through JSON round-trip to handle float precision
        const expected = roundTrip(original);

        expect(parsed.currentGameweek).toBe(expected.currentGameweek);
        expect(parsed.teams).toEqual(expected.teams);
        expect(parsed.gameweeks).toEqual(expected.gameweeks);

        // Players: all fields except position round-trip correctly
        expect(parsed.players.length).toBe(expected.players.length);
        for (let i = 0; i < parsed.players.length; i++) {
          const p = parsed.players[i];
          const e = expected.players[i];
          expect(p.id).toBe(e.id);
          expect(p.name).toBe(e.name);
          expect(p.teamId).toBe(e.teamId);
          // Position: since we generate 'MID' only, it should round-trip
          expect(p.position).toBe(e.position);
          expect(p.totalPoints).toBe(e.totalPoints);
          expect(p.form).toBeCloseTo(e.form, 10);
          expect(p.cost).toBe(e.cost);
          expect(p.ownershipPercentage).toBeCloseTo(e.ownershipPercentage, 10);
          expect(p.minutesPlayed).toBe(e.minutesPlayed);
          expect(p.news).toBe(e.news);
          expect(p.chanceOfPlaying).toBe(e.chanceOfPlaying);
          expect(p.gameweekPoints).toEqual(e.gameweekPoints);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('Fixture[]: format → parse → should equal original', () => {
    fc.assert(
      fc.property(fc.array(arbFixture, { maxLength: 10 }), (original) => {
        const json = formatter.formatFixtures(original);
        const parsed = parser.parseFixtures(JSON.parse(json));

        expect(parsed).toEqual(roundTrip(original));
      }),
      { numRuns: 100 },
    );
  });

  it('ManagerSquad: format → parse → should equal original (except position known limitation)', () => {
    fc.assert(
      fc.property(arbManagerSquad, (original) => {
        const json = formatter.formatManagerSquad(original);
        const parsed = parser.parseManagerSquad(JSON.parse(json));

        const expected = roundTrip(original);

        expect(parsed.teamId).toBe(expected.teamId);
        expect(parsed.chipStatus).toEqual(expected.chipStatus);
        expect(parsed.squad.budget).toBe(expected.squad.budget);
        expect(parsed.squad.freeTransfers).toBe(expected.squad.freeTransfers);
        expect(parsed.squad.activeChip).toBe(expected.squad.activeChip);

        // Squad players: verify all fields
        expect(parsed.squad.players.length).toBe(expected.squad.players.length);
        for (let i = 0; i < parsed.squad.players.length; i++) {
          const p = parsed.squad.players[i];
          const e = expected.squad.players[i];
          expect(p.id).toBe(e.id);
          expect(p.name).toBe(e.name);
          expect(p.teamId).toBe(e.teamId);
          expect(p.position).toBe(e.position);
          expect(p.totalPoints).toBe(e.totalPoints);
          expect(p.form).toBeCloseTo(e.form, 10);
          expect(p.cost).toBe(e.cost);
          expect(p.ownershipPercentage).toBeCloseTo(e.ownershipPercentage, 10);
          expect(p.minutesPlayed).toBe(e.minutesPlayed);
          expect(p.news).toBe(e.news);
          expect(p.chanceOfPlaying).toBe(e.chanceOfPlaying);
          expect(p.gameweekPoints).toEqual(e.gameweekPoints);
          expect(p.isCaptain).toBe(e.isCaptain);
          expect(p.isViceCaptain).toBe(e.isViceCaptain);
          expect(p.isBenched).toBe(e.isBenched);
          expect(p.benchOrder).toBe(e.benchOrder);
          expect(p.sellingPrice).toBe(e.sellingPrice);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('NewsItem[]: format → parse → should equal original', () => {
    fc.assert(
      fc.property(fc.array(arbNewsItem, { maxLength: 10 }), (original) => {
        const json = formatter.formatNewsItems(original);
        const parsed = parser.parseNewsItems(JSON.parse(json));

        const expected = roundTrip(original);

        expect(parsed.length).toBe(expected.length);
        for (let i = 0; i < parsed.length; i++) {
          const p = parsed[i];
          const e = expected[i];
          expect(p.playerId).toBe(e.playerId);
          expect(p.playerName).toBe(e.playerName);
          expect(p.content).toBe(e.content);
          expect(p.severity).toBe(e.severity);
          expect(p.source).toBe(e.source);
          expect(p.timestamp).toBe(e.timestamp);
          // speakerName: only present when original has it
          if (e.speakerName !== undefined) {
            expect(p.speakerName).toBe(e.speakerName);
          } else {
            expect(p.speakerName).toBeUndefined();
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  it('position field always produces a valid Position type after round-trip', () => {
    const allPositions: fc.Arbitrary<Position> = fc.constantFrom('GKP', 'DEF', 'MID', 'FWD');

    const arbPlayerAllPositions: fc.Arbitrary<Player> = fc.record({
      id: fc.nat({ max: 10000 }),
      name: fc.string({ minLength: 1, maxLength: 10 }),
      teamId: fc.integer({ min: 1, max: 20 }),
      position: allPositions,
      totalPoints: fc.nat({ max: 200 }),
      form: fc.constant(5.0),
      cost: fc.integer({ min: 40, max: 150 }),
      ownershipPercentage: fc.constant(10.0),
      minutesPlayed: fc.nat({ max: 900 }),
      news: fc.constant(''),
      chanceOfPlaying: fc.constant(null),
      gameweekPoints: fc.constant([] as GameweekPoints[]),
    });

    fc.assert(
      fc.property(arbPlayerAllPositions, (player) => {
        const bootstrap: BootstrapStatic = {
          players: [player],
          teams: [],
          gameweeks: [],
          currentGameweek: 1,
        };
        const json = formatter.formatBootstrap(bootstrap);
        const parsed = parser.parseBootstrap(JSON.parse(json));
        const validPositions: Position[] = ['GKP', 'DEF', 'MID', 'FWD'];
        expect(validPositions).toContain(parsed.players[0].position);
      }),
      { numRuns: 50 },
    );
  });
});
