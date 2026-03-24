import type {
  Player,
  SquadPlayer,
  Squad,
  PriceDirection,
  PricePrediction,
  SellAlert,
  BuyUrgency,
} from '../models';

// --- Thresholds ---

/** Ownership delta (percentage points) above which a player is predicted to rise. */
const RISING_THRESHOLD = 0.3;

/** Ownership delta (percentage points) below which a player is predicted to fall. */
const FALLING_THRESHOLD = -0.3;

// --- Public API ---

/**
 * Predict whether a player's price will rise, fall, or remain stable
 * based on net transfer activity derived from ownership percentage changes.
 *
 * Compares the player's current ownershipPercentage with a previously
 * recorded value. If the delta exceeds the rising threshold the price is
 * predicted to rise; if it falls below the falling threshold the price is
 * predicted to fall; otherwise it is stable.
 */
export function predictPriceChange(
  player: Player,
  previousOwnership: number,
): PriceDirection {
  const delta = player.ownershipPercentage - previousOwnership;

  if (delta >= RISING_THRESHOLD) {
    return 'rising';
  }
  if (delta <= FALLING_THRESHOLD) {
    return 'falling';
  }
  return 'stable';
}

/**
 * Generate sell alerts for squad players whose price is predicted to fall.
 *
 * Filters the squad to players with a 'falling' prediction and returns
 * SellAlert objects containing the current and predicted selling prices.
 */
export function getSellAlerts(
  squad: Squad,
  predictions: PricePrediction[],
): SellAlert[] {
  const predictionMap = new Map<number, PricePrediction>();
  for (const p of predictions) {
    predictionMap.set(p.playerId, p);
  }

  const alerts: SellAlert[] = [];

  for (const player of squad.players) {
    const prediction = predictionMap.get(player.id);
    if (prediction && prediction.direction === 'falling') {
      const currentSellingPrice = player.sellingPrice;
      const predictedSellingPrice = calculatePredictedSellingPrice(
        player,
        prediction.predictedChange,
      );

      alerts.push({
        player,
        predictedDrop: prediction.predictedChange,
        currentSellingPrice,
        predictedSellingPrice,
      });
    }
  }

  return alerts;
}

/**
 * Determine buy urgency for a transfer target based on predicted price rise.
 *
 * Urgency levels:
 * - high:   predictedChange >= 2 (£0.2m)
 * - medium: predictedChange === 1 (£0.1m)
 * - low:    otherwise
 */
export function getBuyUrgency(
  player: Player,
  prediction: PricePrediction,
): BuyUrgency {
  let urgency: 'high' | 'medium' | 'low';

  if (prediction.predictedChange >= 2) {
    urgency = 'high';
  } else if (prediction.predictedChange === 1) {
    urgency = 'medium';
  } else {
    urgency = 'low';
  }

  return {
    player,
    predictedRise: prediction.predictedChange,
    urgency,
  };
}

/**
 * Calculate the selling price for a player.
 *
 * FPL selling price rule: sellingPrice = purchasePrice + floor((currentPrice - purchasePrice) / 2).
 * Since we don't track purchase price directly, we use the sellingPrice field
 * from SquadPlayer when available. For a plain Player (no sellingPrice field),
 * we approximate by returning the current cost (assumes purchase at current price).
 */
export function calculateSellingPrice(player: Player): number {
  if (isSquadPlayer(player)) {
    return player.sellingPrice;
  }
  return player.cost;
}

// --- Helpers ---

/**
 * Type guard to check if a Player is actually a SquadPlayer (has sellingPrice).
 */
function isSquadPlayer(player: Player): player is SquadPlayer {
  return 'sellingPrice' in player && typeof (player as SquadPlayer).sellingPrice === 'number';
}

/**
 * Calculate the predicted selling price after a price drop.
 *
 * When a player's cost drops, the selling price is recalculated using FPL's
 * 50% profit/loss rule. We derive the purchase price from the current
 * sellingPrice and cost, then apply the predicted change.
 *
 * purchasePrice = 2 * sellingPrice - cost  (derived from the FPL formula)
 * newCost = cost - predictedDrop
 * newSellingPrice = purchasePrice + floor((newCost - purchasePrice) / 2)
 */
function calculatePredictedSellingPrice(
  player: SquadPlayer,
  predictedDrop: number,
): number {
  const purchasePrice = 2 * player.sellingPrice - player.cost;
  const newCost = player.cost - predictedDrop;
  const newSellingPrice = purchasePrice + Math.floor((newCost - purchasePrice) / 2);
  return Math.max(newSellingPrice, 1);
}
