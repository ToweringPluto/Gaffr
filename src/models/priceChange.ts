import type { Player } from './player';
import type { SquadPlayer } from './squad';

export type PriceDirection = 'rising' | 'falling' | 'stable';

export interface PricePrediction {
  playerId: number;
  direction: PriceDirection;
  predictedChange: number;
}

export interface SellAlert {
  player: SquadPlayer;
  predictedDrop: number;
  currentSellingPrice: number;
  predictedSellingPrice: number;
}

export interface BuyUrgency {
  player: Player;
  predictedRise: number;
  urgency: 'high' | 'medium' | 'low';
}
