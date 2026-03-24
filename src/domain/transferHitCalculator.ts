import type { Player, TransferPair, MultiHitResult } from '../models';

const HIT_COST_PER_TRANSFER = 4;
const DEFAULT_LOOKAHEAD_GWS = 3;

/**
 * Project the points gain of replacing playerOut with playerIn
 * over the next N gameweeks. Uses form as a per-GW estimate.
 */
export function calculateProjectedGain(
  playerOut: Player,
  playerIn: Player,
  gameweeks: number = DEFAULT_LOOKAHEAD_GWS,
): number {
  const projectedIn = playerIn.form * gameweeks;
  const projectedOut = playerOut.form * gameweeks;
  return projectedIn - projectedOut;
}

/**
 * A hit is justified if and only if the projected gain
 * strictly exceeds the hit cost.
 */
export function isHitJustified(
  projectedGain: number,
  hitCost: number = HIT_COST_PER_TRANSFER,
): boolean {
  return projectedGain > hitCost;
}

/**
 * Calculate the combined hit cost, projected gain, net gain,
 * break-even gameweek, and justification for multiple transfers.
 *
 * Total hit = 4 × number of transfers.
 * Net gain  = sum of individual projected gains − total hit.
 */
export function calculateMultiTransferHit(
  transfers: TransferPair[],
  gameweeks: number = DEFAULT_LOOKAHEAD_GWS,
): MultiHitResult {
  const totalHitCost = HIT_COST_PER_TRANSFER * transfers.length;

  const totalProjectedGain = transfers.reduce(
    (sum, t) => sum + calculateProjectedGain(t.playerOut, t.playerIn, gameweeks),
    0,
  );

  const netGain = totalProjectedGain - totalHitCost;

  return {
    totalHitCost,
    totalProjectedGain,
    netGain,
    breakEvenGameweek: getBreakEvenGameweek(totalProjectedGain, totalHitCost),
    isJustified: netGain > 0,
  };
}

/**
 * Return the gameweek number at which cumulative projected gain
 * overtakes the hit cost, or null if it never does.
 *
 * Assumes a constant per-GW gain rate (totalProjectedGain / lookahead).
 * The break-even GW is ceil(hitCost / perGwGain).
 */
export function getBreakEvenGameweek(
  projectedGain: number,
  hitCost: number = HIT_COST_PER_TRANSFER,
): number | null {
  if (projectedGain <= 0) return null;

  // projectedGain is over DEFAULT_LOOKAHEAD_GWS gameweeks
  const perGwGain = projectedGain / DEFAULT_LOOKAHEAD_GWS;
  if (perGwGain <= 0) return null;

  const breakEven = Math.ceil(hitCost / perGwGain);
  return breakEven;
}
