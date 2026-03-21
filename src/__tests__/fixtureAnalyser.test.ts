import type { Fixture } from '../models';
import type { Team } from '../models';
import {
  getFdrColour,
  getSpecialGameweekColour,
  BGW_COLOUR,
  DGW_COLOUR,
  getUpcomingFixtures,
  getTeamFixtureSchedule,
  sortTeamsByDifficulty,
  detectBlankGameweeks,
  detectDoubleGameweeks,
} from '../domain/fixtureAnalyser';

// --- Test Data ---

const teams: Team[] = [
  { id: 1, name: 'Arsenal', shortName: 'ARS' },
  { id: 2, name: 'Chelsea', shortName: 'CHE' },
  { id: 3, name: 'Liverpool', shortName: 'LIV' },
  { id: 4, name: 'Man City', shortName: 'MCI' },
];

function makeFixture(overrides: Partial<Fixture> & Pick<Fixture, 'id' | 'gameweek' | 'homeTeamId' | 'awayTeamId'>): Fixture {
  return {
    homeTeamDifficulty: 3,
    awayTeamDifficulty: 3,
    kickoffTime: '2025-01-01T15:00:00Z',
    finished: false,
    ...overrides,
  };
}

// --- FDR Colour Mapping ---

describe('getFdrColour', () => {
  it('returns neon green for FDR 1', () => {
    expect(getFdrColour(1)).toEqual({ background: '#0a2a0a', borderText: '#39ff14' });
  });

  it('returns muted green for FDR 2', () => {
    expect(getFdrColour(2)).toEqual({ background: '#0f2a0a', borderText: '#88e848' });
  });

  it('returns gold for FDR 3', () => {
    expect(getFdrColour(3)).toEqual({ background: '#2a2a00', borderText: '#e8c832' });
  });

  it('returns orange for FDR 4', () => {
    expect(getFdrColour(4)).toEqual({ background: '#2a1400', borderText: '#e87832' });
  });

  it('returns red for FDR 5', () => {
    expect(getFdrColour(5)).toEqual({ background: '#2a0a0a', borderText: '#e84848' });
  });

  it('returns FDR 3 default for out-of-range value', () => {
    expect(getFdrColour(0)).toEqual({ background: '#2a2a00', borderText: '#e8c832' });
    expect(getFdrColour(6)).toEqual({ background: '#2a2a00', borderText: '#e8c832' });
  });
});

describe('getSpecialGameweekColour', () => {
  it('returns BGW colour for bgw type', () => {
    expect(getSpecialGameweekColour('bgw')).toEqual(BGW_COLOUR);
  });

  it('returns DGW colour for dgw type', () => {
    expect(getSpecialGameweekColour('dgw')).toEqual(DGW_COLOUR);
  });
});

// --- getUpcomingFixtures ---

describe('getUpcomingFixtures', () => {
  const fixtures: Fixture[] = [
    makeFixture({ id: 1, gameweek: 30, homeTeamId: 1, awayTeamId: 2, homeTeamDifficulty: 2, awayTeamDifficulty: 4 }),
    makeFixture({ id: 2, gameweek: 31, homeTeamId: 3, awayTeamId: 1, homeTeamDifficulty: 3, awayTeamDifficulty: 3 }),
    makeFixture({ id: 3, gameweek: 31, homeTeamId: 2, awayTeamId: 4, homeTeamDifficulty: 2, awayTeamDifficulty: 4 }),
  ];

  it('groups fixtures by team for the specified gameweek range', () => {
    const result = getUpcomingFixtures(fixtures, teams, 30, 2);
    expect(result).toHaveLength(4);

    const arsenal = result.find((r) => r.teamId === 1)!;
    expect(arsenal.teamName).toBe('Arsenal');
    // GW30: vs CHE (H, diff 2), GW31: vs LIV (A, diff 3)
    expect(arsenal.fixtures.filter((f) => !f.isBgw)).toHaveLength(2);
  });

  it('calculates cumulative difficulty correctly', () => {
    const result = getUpcomingFixtures(fixtures, teams, 30, 2);
    const arsenal = result.find((r) => r.teamId === 1)!;
    // GW30 home diff 2 + GW31 away diff 3 = 5
    expect(arsenal.cumulativeDifficulty).toBe(5);
  });

  it('marks BGW for teams with no fixtures in a gameweek', () => {
    const result = getUpcomingFixtures(fixtures, teams, 30, 2);
    const liverpool = result.find((r) => r.teamId === 3)!;
    // Liverpool has no GW30 fixture
    const bgwFixture = liverpool.fixtures.find((f) => f.gameweek === 30);
    expect(bgwFixture?.isBgw).toBe(true);
  });

  it('returns empty fixtures for teams outside the range', () => {
    const result = getUpcomingFixtures(fixtures, teams, 35, 2);
    for (const team of result) {
      // No actual fixtures, only BGW markers
      expect(team.fixtures.filter((f) => !f.isBgw)).toHaveLength(0);
    }
  });
});

// --- getTeamFixtureSchedule ---

describe('getTeamFixtureSchedule', () => {
  const fixtures: Fixture[] = [
    makeFixture({ id: 1, gameweek: 30, homeTeamId: 1, awayTeamId: 2, homeTeamDifficulty: 2, awayTeamDifficulty: 4 }),
    makeFixture({ id: 2, gameweek: 31, homeTeamId: 3, awayTeamId: 1, homeTeamDifficulty: 3, awayTeamDifficulty: 5 }),
  ];

  it('returns schedule for a specific team', () => {
    const schedule = getTeamFixtureSchedule(1, fixtures, teams);
    expect(schedule.teamId).toBe(1);
    expect(schedule.teamName).toBe('Arsenal');
    expect(schedule.fixtures).toHaveLength(2);
  });

  it('correctly identifies home/away and opponent', () => {
    const schedule = getTeamFixtureSchedule(1, fixtures, teams);
    const gw30 = schedule.fixtures.find((f) => f.gameweek === 30)!;
    expect(gw30.isHome).toBe(true);
    expect(gw30.opponent).toBe('CHE');
    expect(gw30.difficulty).toBe(2);

    const gw31 = schedule.fixtures.find((f) => f.gameweek === 31)!;
    expect(gw31.isHome).toBe(false);
    expect(gw31.opponent).toBe('LIV');
    expect(gw31.difficulty).toBe(5);
  });

  it('handles unknown team ID gracefully', () => {
    const schedule = getTeamFixtureSchedule(99, fixtures, teams);
    expect(schedule.teamName).toBe('Team 99');
    expect(schedule.fixtures).toHaveLength(0);
  });
});

// --- sortTeamsByDifficulty ---

describe('sortTeamsByDifficulty', () => {
  it('sorts teams by cumulative difficulty ascending (easiest first)', () => {
    const input = [
      { teamId: 1, teamName: 'A', fixtures: [], cumulativeDifficulty: 15 },
      { teamId: 2, teamName: 'B', fixtures: [], cumulativeDifficulty: 8 },
      { teamId: 3, teamName: 'C', fixtures: [], cumulativeDifficulty: 12 },
    ];
    const sorted = sortTeamsByDifficulty(input);
    expect(sorted.map((t) => t.cumulativeDifficulty)).toEqual([8, 12, 15]);
  });

  it('does not mutate the original array', () => {
    const input = [
      { teamId: 1, teamName: 'A', fixtures: [], cumulativeDifficulty: 10 },
      { teamId: 2, teamName: 'B', fixtures: [], cumulativeDifficulty: 5 },
    ];
    sortTeamsByDifficulty(input);
    expect(input[0].cumulativeDifficulty).toBe(10);
  });

  it('handles empty array', () => {
    expect(sortTeamsByDifficulty([])).toEqual([]);
  });
});

// --- detectBlankGameweeks ---

describe('detectBlankGameweeks', () => {
  it('detects teams with no fixtures in a gameweek', () => {
    const fixtures: Fixture[] = [
      makeFixture({ id: 1, gameweek: 30, homeTeamId: 1, awayTeamId: 2 }),
    ];
    const allTeamIds = [1, 2, 3, 4];
    const bgws = detectBlankGameweeks(fixtures, allTeamIds);

    expect(bgws).toHaveLength(1);
    expect(bgws[0].gameweek).toBe(30);
    expect(bgws[0].affectedTeamIds).toContain(3);
    expect(bgws[0].affectedTeamIds).toContain(4);
    expect(bgws[0].affectedTeamIds).not.toContain(1);
    expect(bgws[0].affectedTeamIds).not.toContain(2);
  });

  it('returns empty when all teams have fixtures', () => {
    const fixtures: Fixture[] = [
      makeFixture({ id: 1, gameweek: 30, homeTeamId: 1, awayTeamId: 2 }),
      makeFixture({ id: 2, gameweek: 30, homeTeamId: 3, awayTeamId: 4 }),
    ];
    const bgws = detectBlankGameweeks(fixtures, [1, 2, 3, 4]);
    expect(bgws).toHaveLength(0);
  });

  it('returns sorted by gameweek', () => {
    const fixtures: Fixture[] = [
      makeFixture({ id: 1, gameweek: 32, homeTeamId: 1, awayTeamId: 2 }),
      makeFixture({ id: 2, gameweek: 30, homeTeamId: 1, awayTeamId: 2 }),
    ];
    const bgws = detectBlankGameweeks(fixtures, [1, 2, 3]);
    expect(bgws[0].gameweek).toBeLessThanOrEqual(bgws[1].gameweek);
  });
});

// --- detectDoubleGameweeks ---

describe('detectDoubleGameweeks', () => {
  it('detects teams with 2+ fixtures in a gameweek', () => {
    const fixtures: Fixture[] = [
      makeFixture({ id: 1, gameweek: 30, homeTeamId: 1, awayTeamId: 2 }),
      makeFixture({ id: 2, gameweek: 30, homeTeamId: 1, awayTeamId: 3 }),
    ];
    const dgws = detectDoubleGameweeks(fixtures);

    expect(dgws).toHaveLength(1);
    expect(dgws[0].gameweek).toBe(30);
    expect(dgws[0].affectedTeamIds).toContain(1);
  });

  it('returns empty when no team has 2+ fixtures', () => {
    const fixtures: Fixture[] = [
      makeFixture({ id: 1, gameweek: 30, homeTeamId: 1, awayTeamId: 2 }),
      makeFixture({ id: 2, gameweek: 30, homeTeamId: 3, awayTeamId: 4 }),
    ];
    const dgws = detectDoubleGameweeks(fixtures);
    expect(dgws).toHaveLength(0);
  });

  it('returns sorted by gameweek', () => {
    const fixtures: Fixture[] = [
      makeFixture({ id: 1, gameweek: 32, homeTeamId: 1, awayTeamId: 2 }),
      makeFixture({ id: 2, gameweek: 32, homeTeamId: 1, awayTeamId: 3 }),
      makeFixture({ id: 3, gameweek: 30, homeTeamId: 4, awayTeamId: 2 }),
      makeFixture({ id: 4, gameweek: 30, homeTeamId: 4, awayTeamId: 3 }),
    ];
    const dgws = detectDoubleGameweeks(fixtures);
    expect(dgws).toHaveLength(2);
    expect(dgws[0].gameweek).toBeLessThanOrEqual(dgws[1].gameweek);
  });
});
