import fc from 'fast-check';
import type { SquadPlayer, Fixture, NewsItem, Position, GameweekPoints } from '../models';
import { checkStarterInjuryRisk } from '../domain/benchOrderChecker';

/**
 * WHEN a starting player carries an injury doubt and their Bench_Order
 * replacement is a Blank_Bench_Player, THE App SHALL escalate the warning
 * to a high-priority alert on the dashboard.
 */

// --- Helpers ---

function teamHasFixture(
  teamId: number,
  fixtures: Fixture[],
  gameweek: number,
): boolean {
  return fixtures.some(
    (f) =>
      f.gameweek === gameweek &&
      (f.homeTeamId === teamId || f.awayTeamId === teamId),
  );
}

function makePlayer(overrides: Partial<SquadPlayer> & { id: number; teamId: number; position: Position; benchOrder: number }): SquadPlayer {
  return {
    name: `PLAYER_${overrides.id}`,
    totalPoints: 50,
    form: 5,
    cost: 60,
    ownershipPercentage: 10,
    minutesPlayed: 900,
    news: '',
    chanceOfPlaying: null,
    gameweekPoints: [] as GameweekPoints[],
    isCaptain: false,
    isViceCaptain: false,
    isBenched: false,
    sellingPrice: 60,
    ...overrides,
  } as SquadPlayer;
}

// --- Arbitraries ---

const gameweekArb = fc.integer({ min: 1, max: 38 });
const outfieldPositionArb: fc.Arbitrary<Position> = fc.constantFrom('DEF', 'MID', 'FWD');

/**
 * Generates a scenario with:
 * - A set of injured outfield starters (chanceOfPlaying < 75)
 * - A bench where the first outfield slot is a blank-team player
 * - Fixtures only for "playing" teams (IDs 1-10), not "blank" teams (IDs 11-20)
 */
const escalationScenarioArb = fc.record({
  gameweek: gameweekArb,
  injuredStarterCount: fc.integer({ min: 1, max: 3 }),
}).chain(({ gameweek, injuredStarterCount }) => {
  const playingTeamId = 1;
  const blankTeamId = 11;

  const fixtures: Fixture[] = [{
    id: 1,
    gameweek,
    homeTeamId: playingTeamId,
    awayTeamId: playingTeamId + 100,
    homeTeamDifficulty: 3,
    awayTeamDifficulty: 3,
    kickoffTime: '2024-01-01T15:00:00Z',
    finished: false,
  }];

  // Injured outfield starters on a playing team
  const startersArb = fc.tuple(
    ...Array.from({ length: injuredStarterCount }, (_, i) =>
      fc.record({
        position: outfieldPositionArb,
        chanceOfPlaying: fc.integer({ min: 0, max: 74 }),
      }).map(({ position, chanceOfPlaying }) =>
        makePlayer({
          id: i + 1,
          teamId: playingTeamId,
          position,
          benchOrder: 0,
          isBenched: false,
          chanceOfPlaying,
        }),
      ),
    ),
  );

  // Bench: first outfield slot is a blank-team player, GKP slot is bench 1
  return startersArb.map((starters) => {
    const bench: SquadPlayer[] = [
      makePlayer({ id: 50, teamId: playingTeamId, position: 'GKP', benchOrder: 1, isBenched: true }),
      makePlayer({ id: 51, teamId: blankTeamId, position: 'DEF', benchOrder: 2, isBenched: true }),
      makePlayer({ id: 52, teamId: playingTeamId, position: 'MID', benchOrder: 3, isBenched: true }),
      makePlayer({ id: 53, teamId: playingTeamId, position: 'FWD', benchOrder: 4, isBenched: true }),
    ];

    return {
      gameweek,
      fixtures,
      starters: starters as SquadPlayer[],
      bench,
      blankTeamId,
    };
  });
});

/**
 * General scenario: random starters with varying chanceOfPlaying,
 * random bench with a mix of playing/blank teams.
 */
const generalScenarioArb = fc.record({
  gameweek: gameweekArb,
  playingTeamIds: fc.uniqueArray(fc.integer({ min: 1, max: 10 }), { minLength: 1, maxLength: 5 }),
  blankTeamIds: fc.uniqueArray(fc.integer({ min: 11, max: 20 }), { minLength: 0, maxLength: 5 }),
}).chain(({ gameweek, playingTeamIds, blankTeamIds }) => {
  const allTeamIds = [...playingTeamIds, ...blankTeamIds];
  if (allTeamIds.length === 0) {
    return fc.constant({
      gameweek,
      fixtures: [] as Fixture[],
      starters: [] as SquadPlayer[],
      bench: [] as SquadPlayer[],
    });
  }

  const fixtures = playingTeamIds.map((teamId, idx) => ({
    id: idx + 1,
    gameweek,
    homeTeamId: teamId,
    awayTeamId: teamId + 100,
    homeTeamDifficulty: 3,
    awayTeamDifficulty: 3,
    kickoffTime: '2024-01-01T15:00:00Z',
    finished: false,
  }) as Fixture);

  // 1-4 starters with random chanceOfPlaying (some injured, some not)
  const starterCountArb = fc.integer({ min: 1, max: 4 });
  const startersArb = starterCountArb.chain((count) =>
    fc.tuple(
      ...Array.from({ length: count }, (_, i) =>
        fc.record({
          teamId: fc.constantFrom(...allTeamIds),
          position: outfieldPositionArb,
          chanceOfPlaying: fc.oneof(
            fc.constant(null as number | null),
            fc.integer({ min: 0, max: 100 }),
          ),
        }).map(({ teamId, position, chanceOfPlaying }) =>
          makePlayer({
            id: i + 1,
            teamId,
            position,
            benchOrder: 0,
            isBenched: false,
            chanceOfPlaying,
          }),
        ),
      ),
    ),
  );

  // 1-4 bench players
  const benchCountArb = fc.integer({ min: 1, max: 4 });
  const benchArb = benchCountArb.chain((count) =>
    fc.tuple(
      ...Array.from({ length: count }, (_, i) =>
        fc.record({
          teamId: fc.constantFrom(...allTeamIds),
          position: i === 0
            ? fc.constant('GKP' as Position)
            : outfieldPositionArb,
        }).map(({ teamId, position }) =>
          makePlayer({
            id: (i + 1) * 100,
            teamId,
            position,
            benchOrder: i + 1,
            isBenched: true,
          }),
        ),
      ),
    ),
  );

  return fc.tuple(startersArb, benchArb).map(([starters, bench]) => ({
    gameweek,
    fixtures,
    starters: starters as SquadPlayer[],
    bench: bench as SquadPlayer[],
  }));
});

describe('Property 32: Bench Order Escalation', () => {
  const emptyNews: NewsItem[] = [];

  /**
   * When an injured outfield starter's first eligible bench replacement
   * is a blank-team player, a high-priority alert must be generated.
   */
  it('generates alert when injured starter first replacement is a blank bench player', () => {
    fc.assert(
      fc.property(escalationScenarioArb, ({ gameweek, fixtures, starters, bench }) => {
        const alerts = checkStarterInjuryRisk(starters, bench, emptyNews, fixtures, gameweek);

        // Every injured outfield starter should produce an alert because
        // bench slot 2 (first outfield) is on the blank team
        expect(alerts.length).toBe(starters.length);

        for (const alert of alerts) {
          // The starter must have injury doubt
          expect(alert.starter.chanceOfPlaying).not.toBeNull();
          expect(alert.starter.chanceOfPlaying!).toBeLessThan(75);

          // The bench replacement must have no fixture
          expect(teamHasFixture(alert.benchReplacement.teamId, fixtures, gameweek)).toBe(false);
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Every alert references a starter with chanceOfPlaying < 75 (injury doubt)
   * and a bench replacement whose team has no fixture.
   */
  it('every alert pairs an injured starter with a blank bench replacement', () => {
    fc.assert(
      fc.property(generalScenarioArb, ({ gameweek, fixtures, starters, bench }) => {
        const alerts = checkStarterInjuryRisk(starters, bench, emptyNews, fixtures, gameweek);

        for (const alert of alerts) {
          // Starter must have injury doubt
          expect(alert.starter.chanceOfPlaying).not.toBeNull();
          expect(alert.starter.chanceOfPlaying!).toBeLessThan(75);

          // Bench replacement must be blank
          expect(teamHasFixture(alert.benchReplacement.teamId, fixtures, gameweek)).toBe(false);

          // Bench replacement must actually be on the bench
          expect(bench.some((b) => b.id === alert.benchReplacement.id)).toBe(true);

          // Starter must actually be in the starters list
          expect(starters.some((s) => s.id === alert.starter.id)).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * No alert is generated for starters without injury doubt
   * (chanceOfPlaying is null or >= 75).
   */
  it('no alert for starters without injury doubt', () => {
    fc.assert(
      fc.property(generalScenarioArb, ({ gameweek, fixtures, starters, bench }) => {
        const alerts = checkStarterInjuryRisk(starters, bench, emptyNews, fixtures, gameweek);

        const healthyStarterIds = new Set(
          starters
            .filter((s) => s.chanceOfPlaying === null || s.chanceOfPlaying >= 75)
            .map((s) => s.id),
        );

        for (const alert of alerts) {
          expect(healthyStarterIds.has(alert.starter.id)).toBe(false);
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * No alert is generated when the first eligible bench replacement
   * has a fixture (is not blank).
   */
  it('no alert when first eligible replacement has a fixture', () => {
    // All bench outfield players are on playing teams
    const allPlayingBenchArb = gameweekArb.map((gameweek) => {
      const playingTeamId = 1;
      const fixtures: Fixture[] = [{
        id: 1,
        gameweek,
        homeTeamId: playingTeamId,
        awayTeamId: playingTeamId + 100,
        homeTeamDifficulty: 3,
        awayTeamDifficulty: 3,
        kickoffTime: '2024-01-01T15:00:00Z',
        finished: false,
      }];

      const starters: SquadPlayer[] = [
        makePlayer({ id: 1, teamId: playingTeamId, position: 'MID', benchOrder: 0, chanceOfPlaying: 25 }),
      ];

      const bench: SquadPlayer[] = [
        makePlayer({ id: 50, teamId: playingTeamId, position: 'GKP', benchOrder: 1, isBenched: true }),
        makePlayer({ id: 51, teamId: playingTeamId, position: 'DEF', benchOrder: 2, isBenched: true }),
        makePlayer({ id: 52, teamId: playingTeamId, position: 'MID', benchOrder: 3, isBenched: true }),
      ];

      return { gameweek, fixtures, starters, bench };
    });

    fc.assert(
      fc.property(allPlayingBenchArb, ({ gameweek, fixtures, starters, bench }) => {
        const alerts = checkStarterInjuryRisk(starters, bench, emptyNews, fixtures, gameweek);
        expect(alerts).toHaveLength(0);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * GKP starters with injury doubt only match GKP bench replacements,
   * not outfield bench players.
   */
  it('GKP starter injury escalation only considers GKP bench replacement', () => {
    const gkpScenarioArb = gameweekArb.map((gameweek) => {
      const playingTeamId = 1;
      const blankTeamId = 11;

      const fixtures: Fixture[] = [{
        id: 1,
        gameweek,
        homeTeamId: playingTeamId,
        awayTeamId: playingTeamId + 100,
        homeTeamDifficulty: 3,
        awayTeamDifficulty: 3,
        kickoffTime: '2024-01-01T15:00:00Z',
        finished: false,
      }];

      // Injured GKP starter
      const starters: SquadPlayer[] = [
        makePlayer({ id: 1, teamId: playingTeamId, position: 'GKP', benchOrder: 0, chanceOfPlaying: 25 }),
      ];

      // Bench GKP is on blank team, outfield bench on playing team
      const bench: SquadPlayer[] = [
        makePlayer({ id: 50, teamId: blankTeamId, position: 'GKP', benchOrder: 1, isBenched: true }),
        makePlayer({ id: 51, teamId: playingTeamId, position: 'DEF', benchOrder: 2, isBenched: true }),
      ];

      return { gameweek, fixtures, starters, bench };
    });

    fc.assert(
      fc.property(gkpScenarioArb, ({ gameweek, fixtures, starters, bench }) => {
        const alerts = checkStarterInjuryRisk(starters, bench, emptyNews, fixtures, gameweek);

        // Should generate alert because GKP replacement is blank
        expect(alerts).toHaveLength(1);
        expect(alerts[0].starter.position).toBe('GKP');
        expect(alerts[0].benchReplacement.position).toBe('GKP');
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Alert reason string contains the starter name and replacement name.
   */
  it('alert reason mentions both starter and replacement player names', () => {
    fc.assert(
      fc.property(escalationScenarioArb, ({ gameweek, fixtures, starters, bench }) => {
        const alerts = checkStarterInjuryRisk(starters, bench, emptyNews, fixtures, gameweek);

        for (const alert of alerts) {
          expect(alert.reason).toContain(alert.starter.name);
          expect(alert.reason).toContain(alert.benchReplacement.name);
        }
      }),
      { numRuns: 100 },
    );
  });
});
