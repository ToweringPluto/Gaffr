import fc from 'fast-check';
import type { Squad, SquadPlayer, Fixture, Position, GameweekPoints } from '../models';
import { detectOverlaps, calculateMaxLoss, getSeverity } from '../domain/teamOverlapDetector';

const positionArb: fc.Arbitrary<Position> = fc.constantFrom('GKP', 'DEF', 'MID', 'FWD');

const squadPlayerArb = (teamId: number, id: number): fc.Arbitrary<SquadPlayer> =>
  fc
    .record({
      name: fc.string({ minLength: 1, maxLength: 20 }),
      position: positionArb,
      totalPoints: fc.integer({ min: 0, max: 300 }),
      form: fc.float({ min: 0, max: 15, noNaN: true }),
      cost: fc.integer({ min: 40, max: 150 }),
      ownershipPercentage: fc.float({ min: 0, max: 100, noNaN: true }),
      minutesPlayed: fc.integer({ min: 0, max: 3420 }),
      chanceOfPlaying: fc.oneof(fc.constant(null), fc.constantFrom(0, 25, 50, 75, 100)),
      isCaptain: fc.boolean(),
      isViceCaptain: fc.boolean(),
      isBenched: fc.boolean(),
      benchOrder: fc.integer({ min: 0, max: 4 }),
      sellingPrice: fc.integer({ min: 40, max: 150 }),
    })
    .map((r) => ({
      ...r,
      id,
      teamId,
      news: '',
      gameweekPoints: [] as GameweekPoints[],
    }) as SquadPlayer);

const fixtureArb = (gameweek: number): fc.Arbitrary<Fixture> =>
  fc
    .record({
      id: fc.integer({ min: 1, max: 10000 }),
      homeTeamId: fc.integer({ min: 1, max: 20 }),
      awayTeamId: fc.integer({ min: 1, max: 20 }),
      homeTeamDifficulty: fc.integer({ min: 1, max: 5 }),
      awayTeamDifficulty: fc.integer({ min: 1, max: 5 }),
      finished: fc.boolean(),
    })
    .filter((f) => f.homeTeamId !== f.awayTeamId)
    .map((f) => ({
      ...f,
      gameweek,
      kickoffTime: '2025-01-01T15:00:00Z',
    }) as Fixture);

describe('Property 35: Team Overlap Detection and Classification', () => {
  it('detects overlaps when 2+ squad players share the same team in a fixture', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 38 }),
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 2, max: 3 }),
        fc.integer({ min: 1, max: 10000 }),
        fc.integer({ min: 1, max: 20 }),
        (gameweek, sharedTeamId, playerCount, fixtureId, opponentId) => {
          // Ensure opponent differs from shared team
          const opponent = opponentId === sharedTeamId ? ((sharedTeamId % 20) + 1) : opponentId;

          // Build players sharing the same team
          const players: SquadPlayer[] = [];
          for (let i = 0; i < playerCount; i++) {
            players.push({
              id: i + 1,
              name: `PLAYER${i}`,
              teamId: sharedTeamId,
              position: 'MID',
              totalPoints: 50,
              form: 5.0,
              cost: 80,
              ownershipPercentage: 10,
              minutesPlayed: 900,
              news: '',
              chanceOfPlaying: null,
              gameweekPoints: [],
              isCaptain: false,
              isViceCaptain: false,
              isBenched: false,
              benchOrder: 0,
              sellingPrice: 80,
            });
          }

          const squad: Squad = {
            players,
            budget: 100,
            freeTransfers: 1,
            activeChip: null,
          };

          const fixtures: Fixture[] = [
            {
              id: fixtureId,
              gameweek,
              homeTeamId: sharedTeamId,
              awayTeamId: opponent,
              homeTeamDifficulty: 3,
              awayTeamDifficulty: 3,
              kickoffTime: '2025-01-01T15:00:00Z',
              finished: false,
            },
          ];

          const overlaps = detectOverlaps(squad, fixtures, gameweek);

          // Should detect exactly one overlap
          expect(overlaps.length).toBe(1);
          expect(overlaps[0].players.length).toBe(playerCount);
          expect(overlaps[0].teamId).toBe(sharedTeamId);
          expect(overlaps[0].gameweek).toBe(gameweek);
          expect(overlaps[0].fixtureId).toBe(fixtureId);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('does not detect overlap when only 1 player from a team', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 38 }),
        fixtureArb(1).chain((f) =>
          fc.constant(f).map((fix) => ({ ...fix, gameweek: 1 })),
        ),
        (gameweek, fixture) => {
          const fixWithGw = { ...fixture, gameweek };

          // One player from home team, one from away team
          const squad: Squad = {
            players: [
              {
                id: 1, name: 'A', teamId: fixWithGw.homeTeamId, position: 'MID',
                totalPoints: 50, form: 5, cost: 80, ownershipPercentage: 10,
                minutesPlayed: 900, news: '', chanceOfPlaying: null, gameweekPoints: [],
                isCaptain: false, isViceCaptain: false, isBenched: false,
                benchOrder: 0, sellingPrice: 80,
              },
              {
                id: 2, name: 'B', teamId: fixWithGw.awayTeamId, position: 'DEF',
                totalPoints: 40, form: 4, cost: 60, ownershipPercentage: 5,
                minutesPlayed: 800, news: '', chanceOfPlaying: null, gameweekPoints: [],
                isCaptain: false, isViceCaptain: false, isBenched: false,
                benchOrder: 0, sellingPrice: 60,
              },
            ],
            budget: 100,
            freeTransfers: 1,
            activeChip: null,
          };

          const overlaps = detectOverlaps(squad, [fixWithGw], gameweek);
          expect(overlaps.length).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('severity is "high" for 3+ players and "standard" for exactly 2', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 5 }),
        (playerCount) => {
          const players: SquadPlayer[] = Array.from({ length: playerCount }, (_, i) => ({
            id: i + 1, name: `P${i}`, teamId: 1, position: 'MID' as Position,
            totalPoints: 50, form: 5, cost: 80, ownershipPercentage: 10,
            minutesPlayed: 900, news: '', chanceOfPlaying: null, gameweekPoints: [],
            isCaptain: false, isViceCaptain: false, isBenched: false,
            benchOrder: 0, sellingPrice: 80,
          }));

          const overlap = {
            fixtureId: 1, gameweek: 1, teamId: 1, players,
            maxPotentialLoss: 0, severity: 'standard' as const,
          };

          const severity = getSeverity(overlap);
          if (playerCount >= 3) {
            expect(severity).toBe('high');
          } else {
            expect(severity).toBe('standard');
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('maxPotentialLoss equals sum of player form values', () => {
    fc.assert(
      fc.property(
        fc.array(fc.float({ min: 0, max: 15, noNaN: true }), { minLength: 2, maxLength: 5 }),
        (forms) => {
          const players: SquadPlayer[] = forms.map((form, i) => ({
            id: i + 1, name: `P${i}`, teamId: 1, position: 'MID' as Position,
            totalPoints: 50, form, cost: 80, ownershipPercentage: 10,
            minutesPlayed: 900, news: '', chanceOfPlaying: null, gameweekPoints: [],
            isCaptain: false, isViceCaptain: false, isBenched: false,
            benchOrder: 0, sellingPrice: 80,
          }));

          const overlap = {
            fixtureId: 1, gameweek: 1, teamId: 1, players,
            maxPotentialLoss: 0, severity: 'standard' as const,
          };

          const loss = calculateMaxLoss(overlap);
          const expectedLoss = forms.reduce((sum, f) => sum + f, 0);

          expect(Math.abs(loss - expectedLoss)).toBeLessThan(0.001);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('overlaps are grouped per fixture when a team has multiple fixtures (DGW)', () => {
    const squad: Squad = {
      players: [
        {
          id: 1, name: 'A', teamId: 5, position: 'MID',
          totalPoints: 50, form: 5, cost: 80, ownershipPercentage: 10,
          minutesPlayed: 900, news: '', chanceOfPlaying: null, gameweekPoints: [],
          isCaptain: false, isViceCaptain: false, isBenched: false,
          benchOrder: 0, sellingPrice: 80,
        },
        {
          id: 2, name: 'B', teamId: 5, position: 'DEF',
          totalPoints: 40, form: 4, cost: 60, ownershipPercentage: 5,
          minutesPlayed: 800, news: '', chanceOfPlaying: null, gameweekPoints: [],
          isCaptain: false, isViceCaptain: false, isBenched: false,
          benchOrder: 0, sellingPrice: 60,
        },
      ],
      budget: 100,
      freeTransfers: 1,
      activeChip: null,
    };

    const fixtures: Fixture[] = [
      { id: 100, gameweek: 10, homeTeamId: 5, awayTeamId: 8, homeTeamDifficulty: 3, awayTeamDifficulty: 3, kickoffTime: '2025-01-01T15:00:00Z', finished: false },
      { id: 101, gameweek: 10, homeTeamId: 12, awayTeamId: 5, homeTeamDifficulty: 2, awayTeamDifficulty: 4, kickoffTime: '2025-01-03T15:00:00Z', finished: false },
    ];

    const overlaps = detectOverlaps(squad, fixtures, 10);

    // Two fixtures for team 5 in GW10 → two overlap entries
    expect(overlaps.length).toBe(2);
    expect(overlaps[0].fixtureId).toBe(100);
    expect(overlaps[1].fixtureId).toBe(101);
    for (const o of overlaps) {
      expect(o.players.length).toBe(2);
      expect(o.teamId).toBe(5);
    }
  });
});
