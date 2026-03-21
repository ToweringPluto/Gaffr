import type { Player } from './player';
import type { PriceDirection } from './priceChange';

export interface TransferSuggestion {
  playerOut: Player | null;
  playerIn: Player;
  score: number;
  projectedPointsGain: number;
  priceChange: PriceDirection;
}

export interface TransferValidation {
  valid: boolean;
  reason?: string;
}

export interface TransferPair {
  playerOut: Player;
  playerIn: Player;
}

export interface MultiHitResult {
  totalHitCost: number;
  totalProjectedGain: number;
  netGain: number;
  breakEvenGameweek: number | null;
  isJustified: boolean;
}
