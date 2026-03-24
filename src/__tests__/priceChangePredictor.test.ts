import {
  predictPriceChange,
  getSellAlerts,
  getBuyUrgency,
  calculateSellingPrice,
} from '../domain/priceChangePredictor';
import type { Player, SquadPlayer, Squad, PricePrediction } from '../models';

// --- Helpers ---

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 1,
    name: 'SALAH',
    teamId: 14,
    position: 'MID',
    totalPoints: 180,
    form: 8.5,
    cost: 130,
    ownershipPercentage: 35.0,
    minutesPlayed: 2700,
    news: '',
    chanceOfPlaying: 100,
    gameweekPoints: [],
    ...overrides,
  };
}

function makeSquadPlayer(overrides: Partial<SquadPlayer> = {}): SquadPlayer {
  return {
    ...makePlayer(),
    isCaptain: false,
    isViceCaptain: false,
    isBenched: false,
    benchOrder: 0,
    sellingPrice: 125,
    ...overrides,
  };
}

function makeSquad(players: SquadPlayer[]): Squad {
  return {
    players,
    budget: 50,
    freeTransfers: 1,
    activeChip: null,
  };
}

// --- predictPriceChange ---

describe('predictPriceChange', () => {
  it('returns "rising" when ownership increases above threshold', () => {
    const player = makePlayer({ ownershipPercentage: 35.5 });
    expect(predictPriceChange(player, 35.0)).toBe('rising');
  });

  it('returns "falling" when ownership decreases below threshold', () => {
    const player = makePlayer({ ownershipPercentage: 34.5 });
    expect(predictPriceChange(player, 35.0)).toBe('falling');
  });

  it('returns "stable" when ownership change is within threshold', () => {
    const player = makePlayer({ ownershipPercentage: 35.1 });
    expect(predictPriceChange(player, 35.0)).toBe('stable');
  });

  it('returns "rising" when delta clearly exceeds threshold', () => {
    const player = makePlayer({ ownershipPercentage: 35.5 });
    expect(predictPriceChange(player, 35.0)).toBe('rising');
  });

  it('returns "stable" when delta is just below threshold', () => {
    const player = makePlayer({ ownershipPercentage: 35.2 });
    expect(predictPriceChange(player, 35.0)).toBe('stable');
  });

  it('returns "stable" when ownership is unchanged', () => {
    const player = makePlayer({ ownershipPercentage: 35.0 });
    expect(predictPriceChange(player, 35.0)).toBe('stable');
  });
});

// --- getSellAlerts ---

describe('getSellAlerts', () => {
  it('returns alerts only for players with falling predictions', () => {
    const p1 = makeSquadPlayer({ id: 1, sellingPrice: 125, cost: 130 });
    const p2 = makeSquadPlayer({ id: 2, sellingPrice: 80, cost: 85 });
    const squad = makeSquad([p1, p2]);

    const predictions: PricePrediction[] = [
      { playerId: 1, direction: 'falling', predictedChange: 1 },
      { playerId: 2, direction: 'rising', predictedChange: 1 },
    ];

    const alerts = getSellAlerts(squad, predictions);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].player.id).toBe(1);
  });

  it('returns empty array when no players are falling', () => {
    const p1 = makeSquadPlayer({ id: 1 });
    const squad = makeSquad([p1]);

    const predictions: PricePrediction[] = [
      { playerId: 1, direction: 'stable', predictedChange: 0 },
    ];

    expect(getSellAlerts(squad, predictions)).toHaveLength(0);
  });

  it('includes current and predicted selling prices in alert', () => {
    // cost=130, sellingPrice=125 → purchasePrice = 2*125 - 130 = 120
    // newCost = 130 - 1 = 129, newSellingPrice = 120 + floor((129-120)/2) = 120 + 4 = 124
    const p1 = makeSquadPlayer({ id: 1, cost: 130, sellingPrice: 125 });
    const squad = makeSquad([p1]);

    const predictions: PricePrediction[] = [
      { playerId: 1, direction: 'falling', predictedChange: 1 },
    ];

    const alerts = getSellAlerts(squad, predictions);
    expect(alerts[0].currentSellingPrice).toBe(125);
    expect(alerts[0].predictedSellingPrice).toBe(124);
    expect(alerts[0].predictedDrop).toBe(1);
  });

  it('ignores players not in predictions', () => {
    const p1 = makeSquadPlayer({ id: 1 });
    const p2 = makeSquadPlayer({ id: 2 });
    const squad = makeSquad([p1, p2]);

    const predictions: PricePrediction[] = [
      { playerId: 1, direction: 'falling', predictedChange: 1 },
    ];

    const alerts = getSellAlerts(squad, predictions);
    expect(alerts).toHaveLength(1);
  });
});

// --- getBuyUrgency ---

describe('getBuyUrgency', () => {
  it('returns high urgency when predictedChange >= 2', () => {
    const player = makePlayer();
    const prediction: PricePrediction = { playerId: 1, direction: 'rising', predictedChange: 2 };
    expect(getBuyUrgency(player, prediction).urgency).toBe('high');
  });

  it('returns high urgency when predictedChange is 3', () => {
    const player = makePlayer();
    const prediction: PricePrediction = { playerId: 1, direction: 'rising', predictedChange: 3 };
    expect(getBuyUrgency(player, prediction).urgency).toBe('high');
  });

  it('returns medium urgency when predictedChange is 1', () => {
    const player = makePlayer();
    const prediction: PricePrediction = { playerId: 1, direction: 'rising', predictedChange: 1 };
    expect(getBuyUrgency(player, prediction).urgency).toBe('medium');
  });

  it('returns low urgency when predictedChange is 0', () => {
    const player = makePlayer();
    const prediction: PricePrediction = { playerId: 1, direction: 'stable', predictedChange: 0 };
    expect(getBuyUrgency(player, prediction).urgency).toBe('low');
  });

  it('includes the player and predictedRise in the result', () => {
    const player = makePlayer({ id: 42 });
    const prediction: PricePrediction = { playerId: 42, direction: 'rising', predictedChange: 2 };
    const result = getBuyUrgency(player, prediction);
    expect(result.player.id).toBe(42);
    expect(result.predictedRise).toBe(2);
  });
});

// --- calculateSellingPrice ---

describe('calculateSellingPrice', () => {
  it('returns sellingPrice for a SquadPlayer', () => {
    const player = makeSquadPlayer({ cost: 130, sellingPrice: 125 });
    expect(calculateSellingPrice(player)).toBe(125);
  });

  it('returns cost for a plain Player (no sellingPrice)', () => {
    const player = makePlayer({ cost: 100 });
    expect(calculateSellingPrice(player)).toBe(100);
  });
});
