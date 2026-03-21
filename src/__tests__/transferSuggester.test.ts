import type { Player, Position, Fixture, Squad, SquadPlayer } from '../models';
import {
  calculateTransferScore,
  suggestTransfersOut,
  suggestTransfersIn,
  validateTransfer,
  projectPointsGain,
} from '../domain/transferSuggester';

// --- Helpers ---

function makePlayer(overrides: Partial<Player> & Pick<Player, 'id'>): Player {
  return {
    name: `Player ${overrides.id}`,
    teamId: 1,
    position: 'MID' as Position,
    totalPoints: 80,
    form: 5.0,
    cost: 70,
    ownershipPercentage: 20,
    minutesPlayed: 900,
    news: '',
    chanceOfPlaying: 100,
    gameweekPoints: [],
    ...overrides,
  };
}

function makeSquadPlayer(
  overrides: Partial<SquadPlayer> & Pick<SquadPlayer, 'id'>,
): SquadPlayer {
  return {
    ...makePlayer(overrides),
    isCaptain: false,
    isViceCaptain: false,
    isBenched: false,
    benchOrder: 0,
    sellingPrice: overrides.cost ?? 70,
    ...overrides,
  } as SquadPlayer;
}

function makeFixture(
  overrides: Partial<Fixture> & Pick<Fixture, 'id' | 'gameweek' | 'homeTeamId' | 'awayTeamId'>,
): Fixture {
  return {
    homeTeamDifficulty: 3,
    awayTeamDifficulty: 3,
    kickoffTime: '2025-01-01T15:00:00Z',
    finished: false,
    ...overrides,
  };
}

function makeValidSquad(): Squad {
  // 2 GKP, 5 DEF, 5 MID, 3 FWD = 15 players
  // Starters: 1 GKP, 4 DEF, 4 MID, 2 FWD = 11
  // Bench: 1 GKP, 1 DEF, 1 MID, 1 FWD = 4
  const players: SquadPlayer[] = [
    // Starters
    makeSquadPlayer({ id: 1, position: 'GKP', teamId: 1 }),
    makeSquadPlayer({ id: 2, position: 'DEF', teamId: 2 }),
    makeSquadPlayer({ id: 3, position: 'DEF', teamId: 3 }),
    makeSquadPlayer({ id: 4, position: 'DEF', teamId: 4 }),
    makeSquadPlayer({ id: 5, position: 'DEF', teamId: 5 }),
    makeSquadPlayer({ id: 6, position: 'MID', teamId: 6 }),
    makeSquadPlayer({ id: 7, position: 'MID', teamId: 7 }),
    makeSquadPlayer({ id: 8, position: 'MID', teamId: 8 }),
    makeSquadPlayer({ id: 9, position: 'MID', teamId: 9 }),
    makeSquadPlayer({ id: 10, position: 'FWD', teamId: 10 }),
    makeSquadPlayer({ id: 11, position: 'FWD', teamId: 11 }),
    // Bench
    makeSquadPlayer({ id: 12, position: 'GKP', teamId: 12, isBenched: true, benchOrder: 1 }),
    makeSquadPlayer({ id: 13, position: 'DEF', teamId: 13, isBenched: true, benchOrder: 2 }),
    makeSquadPlayer({ id: 14, position: 'MID', teamId: 14, isBenched: true, benchOrder: 3 }),
    makeSquadPlayer({ id: 15, position: 'FWD', teamId: 15, isBenched: true, benchOrder: 4 }),
  ];

  return { players, budget: 50, freeTransfers: 1, activeChip: null };
}

// --- calculateTransferScore ---

describe('calculateTransferScore', () => {
  const fixtures: Fixture[] = [
    makeFixture({ id: 1, gameweek: 30, homeTeamId: 1, awayTeamId: 2, homeTeamDifficulty: 2, awayTeamDifficulty: 4 }),
    makeFixture({ id: 2, gameweek: 31, homeTeamId: 1, awayTeamId: 3, homeTeamDifficulty: 2, awayTeamDifficulty: 3 }),
  ];

  it('returns a positive score for a player with good form and easy fixtures', () => {
    const player = makePlayer({ id: 1, teamId: 1, form: 8.0, totalPoints: 120, cost: 80 });
    const score = calculateTransferScore(player, fixtures);
    expect(score).toBeGreaterThan(0);
  });

  it('returns a higher score for a player with better form', () => {
    const goodForm = makePlayer({ id: 1, teamId: 1, form: 8.0, totalPoints: 100, cost: 80 });
    const badForm = makePlayer({ id: 2, teamId: 1, form: 2.0, totalPoints: 100, cost: 80 });
    expect(calculateTransferScore(goodForm, fixtures)).toBeGreaterThan(
      calculateTransferScore(badForm, fixtures),
    );
  });

  it('returns a higher score for a player with easier fixtures', () => {
    const easyFixtures: Fixture[] = [
      makeFixture({ id: 1, gameweek: 30, homeTeamId: 1, awayTeamId: 2, homeTeamDifficulty: 1, awayTeamDifficulty: 5 }),
    ];
    const hardFixtures: Fixture[] = [
      makeFixture({ id: 1, gameweek: 30, homeTeamId: 1, awayTeamId: 2, homeTeamDifficulty: 5, awayTeamDifficulty: 1 }),
    ];
    const player = makePlayer({ id: 1, teamId: 1, form: 5.0 });
    expect(calculateTransferScore(player, easyFixtures)).toBeGreaterThan(
      calculateTransferScore(player, hardFixtures),
    );
  });

  it('handles player with no upcoming fixtures (neutral FDR)', () => {
    const player = makePlayer({ id: 1, teamId: 99, form: 5.0 });
    const score = calculateTransferScore(player, fixtures);
    expect(score).toBeGreaterThan(0);
  });
});

// --- suggestTransfersOut ---

describe('suggestTransfersOut', () => {
  const fixtures: Fixture[] = [
    makeFixture({ id: 1, gameweek: 30, homeTeamId: 1, awayTeamId: 2, homeTeamDifficulty: 2, awayTeamDifficulty: 4 }),
  ];

  it('returns suggestions for all squad players', () => {
    const squad = makeValidSquad();
    const suggestions = suggestTransfersOut(squad, fixtures);
    expect(suggestions).toHaveLength(squad.players.length);
  });

  it('ranks worst performers first (ascending score)', () => {
    const squad: Squad = {
      players: [
        makeSquadPlayer({ id: 1, teamId: 1, form: 8.0, totalPoints: 120 }),
        makeSquadPlayer({ id: 2, teamId: 2, form: 1.0, totalPoints: 30 }),
        makeSquadPlayer({ id: 3, teamId: 3, form: 4.0, totalPoints: 70 }),
      ],
      budget: 50,
      freeTransfers: 1,
      activeChip: null,
    };
    const suggestions = suggestTransfersOut(squad, fixtures);
    // First suggestion should be the worst performer
    expect(suggestions[0].playerOut!.id).toBe(2);
  });
});

// --- suggestTransfersIn ---

describe('suggestTransfersIn', () => {
  const fixtures: Fixture[] = [
    makeFixture({ id: 1, gameweek: 30, homeTeamId: 1, awayTeamId: 2, homeTeamDifficulty: 2, awayTeamDifficulty: 4 }),
  ];

  const allPlayers: Player[] = [
    makePlayer({ id: 100, position: 'MID', cost: 60, form: 7.0, teamId: 1 }),
    makePlayer({ id: 101, position: 'MID', cost: 80, form: 5.0, teamId: 2 }),
    makePlayer({ id: 102, position: 'DEF', cost: 50, form: 6.0, teamId: 3 }),
    makePlayer({ id: 103, position: 'MID', cost: 120, form: 9.0, teamId: 4 }),
  ];

  it('only returns players matching the requested position', () => {
    const suggestions = suggestTransfersIn('MID', 200, fixtures, allPlayers);
    for (const s of suggestions) {
      expect(s.playerIn.position).toBe('MID');
    }
  });

  it('only returns players within budget', () => {
    const suggestions = suggestTransfersIn('MID', 70, fixtures, allPlayers);
    for (const s of suggestions) {
      expect(s.playerIn.cost).toBeLessThanOrEqual(70);
    }
    // Should only include the 60-cost MID
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].playerIn.id).toBe(100);
  });

  it('ranks suggestions by score descending (best first)', () => {
    const suggestions = suggestTransfersIn('MID', 200, fixtures, allPlayers);
    for (let i = 1; i < suggestions.length; i++) {
      expect(suggestions[i - 1].score).toBeGreaterThanOrEqual(suggestions[i].score);
    }
  });

  it('sets playerOut to null for transfer-in suggestions', () => {
    const suggestions = suggestTransfersIn('MID', 200, fixtures, allPlayers);
    for (const s of suggestions) {
      expect(s.playerOut).toBeNull();
    }
  });

  it('returns empty array when no players match position and budget', () => {
    const suggestions = suggestTransfersIn('GKP', 200, fixtures, allPlayers);
    expect(suggestions).toHaveLength(0);
  });
});

// --- validateTransfer ---

describe('validateTransfer', () => {
  it('returns valid for a legal transfer', () => {
    const squad = makeValidSquad();
    const playerOut = squad.players[6]; // MID, teamId: 7
    const playerIn = makePlayer({ id: 99, position: 'MID', teamId: 16 });
    const result = validateTransfer(squad, playerOut, playerIn);
    expect(result.valid).toBe(true);
  });

  it('rejects transfer that exceeds 3-player team limit', () => {
    const squad = makeValidSquad();
    // Change 3 existing players to teamId 20
    squad.players[0].teamId = 20;
    squad.players[1].teamId = 20;
    squad.players[2].teamId = 20;

    const playerOut = squad.players[3]; // DEF, teamId: 4
    const playerIn = makePlayer({ id: 99, position: 'DEF', teamId: 20 });
    const result = validateTransfer(squad, playerOut, playerIn);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('3-player team limit');
  });

  it('rejects transfer that creates invalid formation (too few DEF)', () => {
    const squad = makeValidSquad();
    // playerOut is a starting DEF, playerIn is a FWD — would drop DEF below 3
    // Squad has 4 starting DEF (ids 2-5). Removing one and adding FWD = 3 DEF still valid.
    // Need to remove 2 DEF to break it. Let's set one DEF to benched first.
    squad.players[4].isBenched = true; // DEF id:5 now benched → 3 starting DEF
    const playerOut = squad.players[1]; // DEF id:2, starter
    const playerIn = makePlayer({ id: 99, position: 'FWD', teamId: 16 });
    // After transfer: 2 starting DEF → invalid
    const result = validateTransfer(squad, playerOut, playerIn);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('DEF');
  });

  it('allows transfer that maintains valid formation', () => {
    const squad = makeValidSquad();
    // Replace a MID starter with another MID
    const playerOut = squad.players[6]; // MID
    const playerIn = makePlayer({ id: 99, position: 'MID', teamId: 16 });
    const result = validateTransfer(squad, playerOut, playerIn);
    expect(result.valid).toBe(true);
  });

  it('allows transfer when incoming player is from a team with fewer than 3 players', () => {
    const squad = makeValidSquad();
    // All players have unique teamIds, so adding one from teamId 1 = 2 total
    const playerOut = squad.players[6]; // MID, teamId: 7
    const playerIn = makePlayer({ id: 99, position: 'MID', teamId: 1 });
    const result = validateTransfer(squad, playerOut, playerIn);
    expect(result.valid).toBe(true);
  });
});

// --- projectPointsGain ---

describe('projectPointsGain', () => {
  it('returns positive gain when incoming player has higher form', () => {
    const playerOut = makePlayer({ id: 1, form: 3.0 });
    const playerIn = makePlayer({ id: 2, form: 7.0 });
    const gain = projectPointsGain(playerOut, playerIn, 4);
    expect(gain).toBe(16); // (7 - 3) * 4
  });

  it('returns negative gain when incoming player has lower form', () => {
    const playerOut = makePlayer({ id: 1, form: 6.0 });
    const playerIn = makePlayer({ id: 2, form: 2.0 });
    const gain = projectPointsGain(playerOut, playerIn, 4);
    expect(gain).toBe(-16); // (2 - 6) * 4
  });

  it('returns zero when both players have equal form', () => {
    const playerOut = makePlayer({ id: 1, form: 5.0 });
    const playerIn = makePlayer({ id: 2, form: 5.0 });
    expect(projectPointsGain(playerOut, playerIn, 4)).toBe(0);
  });

  it('defaults to 4 gameweeks lookahead', () => {
    const playerOut = makePlayer({ id: 1, form: 2.0 });
    const playerIn = makePlayer({ id: 2, form: 4.0 });
    expect(projectPointsGain(playerOut, playerIn)).toBe(8); // (4 - 2) * 4
  });

  it('scales with gameweek count', () => {
    const playerOut = makePlayer({ id: 1, form: 3.0 });
    const playerIn = makePlayer({ id: 2, form: 5.0 });
    expect(projectPointsGain(playerOut, playerIn, 1)).toBe(2);
    expect(projectPointsGain(playerOut, playerIn, 6)).toBe(12);
  });
});
