import type { Player, MiniLeagueStanding } from '../models';
import {
  getStandings,
  identifyTemplatePlayers,
  flagDifferential,
  getTemplateCaptain,
} from '../domain/miniLeagueAnalyser';

// --- Helpers ---

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 1,
    name: 'HAALAND',
    teamId: 1,
    position: 'FWD',
    totalPoints: 200,
    form: 8.0,
    cost: 140,
    ownershipPercentage: 60,
    minutesPlayed: 2700,
    news: '',
    chanceOfPlaying: 100,
    gameweekPoints: [],
    ...overrides,
  };
}

function makeStanding(overrides: Partial<MiniLeagueStanding> = {}): MiniLeagueStanding {
  return {
    managerId: 1,
    managerName: 'Manager 1',
    teamName: 'Team 1',
    rank: 1,
    totalPoints: 1500,
    gameweekPoints: 60,
    captainId: 1,
    squad: [],
    ...overrides,
  };
}

// --- getStandings ---

describe('getStandings', () => {
  it('returns standings sorted by rank ascending', () => {
    const standings = [
      makeStanding({ managerId: 3, rank: 3 }),
      makeStanding({ managerId: 1, rank: 1 }),
      makeStanding({ managerId: 2, rank: 2 }),
    ];

    const result = getStandings(standings);

    expect(result.map((s) => s.rank)).toEqual([1, 2, 3]);
  });

  it('does not mutate the original array', () => {
    const standings = [
      makeStanding({ rank: 3 }),
      makeStanding({ rank: 1 }),
    ];
    const original = [...standings];

    getStandings(standings);

    expect(standings).toEqual(original);
  });

  it('returns empty array for empty input', () => {
    expect(getStandings([])).toEqual([]);
  });
});

// --- identifyTemplatePlayers ---

describe('identifyTemplatePlayers', () => {
  const haaland = makePlayer({ id: 10, name: 'HAALAND' });
  const salah = makePlayer({ id: 20, name: 'SALAH' });
  const saka = makePlayer({ id: 30, name: 'SAKA' });

  it('flags players owned by >50% of rivals as template', () => {
    const rivals = [
      makeStanding({ squad: [haaland, salah] }),
      makeStanding({ squad: [haaland, saka] }),
      makeStanding({ squad: [haaland, salah] }),
    ];

    const result = identifyTemplatePlayers(rivals);

    // Haaland owned by 3/3 = 100%, Salah by 2/3 = 66.7% — both template
    // Saka by 1/3 = 33.3% — not template
    expect(result.length).toBe(2);
    expect(result.map((t) => t.player.id)).toContain(10);
    expect(result.map((t) => t.player.id)).toContain(20);
    expect(result.map((t) => t.player.id)).not.toContain(30);
  });

  it('does not flag players owned by exactly 50%', () => {
    const rivals = [
      makeStanding({ squad: [haaland] }),
      makeStanding({ squad: [salah] }),
    ];

    const result = identifyTemplatePlayers(rivals);

    // Each player owned by 1/2 = 50%, not >50%
    expect(result.length).toBe(0);
  });

  it('calculates correct ownership percentage', () => {
    const rivals = [
      makeStanding({ squad: [haaland] }),
      makeStanding({ squad: [haaland] }),
      makeStanding({ squad: [haaland] }),
      makeStanding({ squad: [salah] }),
    ];

    const result = identifyTemplatePlayers(rivals);

    const haalandEntry = result.find((t) => t.player.id === 10);
    expect(haalandEntry).toBeDefined();
    expect(haalandEntry!.ownershipInLeague).toBe(75); // 3/4 * 100
  });

  it('returns empty array for empty rivals', () => {
    expect(identifyTemplatePlayers([])).toEqual([]);
  });
});

// --- flagDifferential ---

describe('flagDifferential', () => {
  const player = makePlayer({ id: 50 });

  it('flags player as differential when owned by <20% of rivals', () => {
    const rivals = [
      makeStanding({ squad: [makePlayer({ id: 1 })] }),
      makeStanding({ squad: [makePlayer({ id: 2 })] }),
      makeStanding({ squad: [makePlayer({ id: 3 })] }),
      makeStanding({ squad: [makePlayer({ id: 4 })] }),
      makeStanding({ squad: [makePlayer({ id: 5 })] }),
    ];

    // Player 50 owned by 0/5 = 0%
    expect(flagDifferential(player, rivals, 20)).toBe(true);
  });

  it('does not flag player owned by exactly 20%', () => {
    const rivals = [
      makeStanding({ squad: [player] }),
      makeStanding({ squad: [] }),
      makeStanding({ squad: [] }),
      makeStanding({ squad: [] }),
      makeStanding({ squad: [] }),
    ];

    // Player owned by 1/5 = 20%, not <20%
    expect(flagDifferential(player, rivals, 20)).toBe(false);
  });

  it('does not flag player owned by >20%', () => {
    const rivals = [
      makeStanding({ squad: [player] }),
      makeStanding({ squad: [player] }),
      makeStanding({ squad: [] }),
      makeStanding({ squad: [] }),
      makeStanding({ squad: [] }),
    ];

    // Player owned by 2/5 = 40%
    expect(flagDifferential(player, rivals, 20)).toBe(false);
  });

  it('returns false for empty rivals', () => {
    expect(flagDifferential(player, [], 20)).toBe(false);
  });

  it('respects custom threshold', () => {
    const rivals = [
      makeStanding({ squad: [player] }),
      makeStanding({ squad: [] }),
      makeStanding({ squad: [] }),
      makeStanding({ squad: [] }),
    ];

    // Player owned by 1/4 = 25%
    expect(flagDifferential(player, rivals, 30)).toBe(true);  // 25 < 30
    expect(flagDifferential(player, rivals, 25)).toBe(false);  // 25 is not < 25
  });
});

// --- getTemplateCaptain ---

describe('getTemplateCaptain', () => {
  const haaland = makePlayer({ id: 10, name: 'HAALAND' });
  const salah = makePlayer({ id: 20, name: 'SALAH' });

  it('returns the player captained by majority of rivals', () => {
    const rivals = [
      makeStanding({ captainId: 10, squad: [haaland, salah] }),
      makeStanding({ captainId: 10, squad: [haaland, salah] }),
      makeStanding({ captainId: 20, squad: [haaland, salah] }),
    ];

    const result = getTemplateCaptain(rivals);

    // Haaland captained by 2/3 = 66.7% > 50%
    expect(result).not.toBeNull();
    expect(result!.id).toBe(10);
  });

  it('returns null when no captain has majority', () => {
    const saka = makePlayer({ id: 30, name: 'SAKA' });
    const rivals = [
      makeStanding({ captainId: 10, squad: [haaland] }),
      makeStanding({ captainId: 20, squad: [salah] }),
      makeStanding({ captainId: 30, squad: [saka] }),
    ];

    // Each captained by 1/3 = 33.3%, none >50%
    expect(getTemplateCaptain(rivals)).toBeNull();
  });

  it('returns null when captainId not found in squad', () => {
    const rivals = [
      makeStanding({ captainId: 999, squad: [haaland] }),
      makeStanding({ captainId: 999, squad: [salah] }),
    ];

    expect(getTemplateCaptain(rivals)).toBeNull();
  });

  it('returns null for empty rivals', () => {
    expect(getTemplateCaptain([])).toBeNull();
  });

  it('returns null when captain is exactly 50%', () => {
    const rivals = [
      makeStanding({ captainId: 10, squad: [haaland] }),
      makeStanding({ captainId: 20, squad: [salah] }),
    ];

    // Haaland captained by 1/2 = 50%, not >50%
    expect(getTemplateCaptain(rivals)).toBeNull();
  });
});
