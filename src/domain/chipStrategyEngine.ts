import type {
  Squad,
  Fixture,
  ChipStatus,
  ChipRecommendation,
  ChipRoadmap,
  BlankGameweek,
  DoubleGameweek,
  SquadPlayer,
} from '../models';
import type { ManagerHistory } from '../models';
import { detectBlankGameweeks, detectDoubleGameweeks } from './fixtureAnalyser';

// --- Chip Names ---

const CHIP_NAMES = ['bench_boost', 'triple_captain', 'free_hit', 'wildcard'] as const;

// --- Core Functions ---

/**
 * Get the status of each chip from the manager's history.
 * Returns a ChipStatus for each of the 4 chips.
 */
export function getChipStatus(managerHistory: ManagerHistory): ChipStatus[] {
  const usedChips = new Map(
    managerHistory.chips.map((c) => [c.name, c.gameweek]),
  );

  return CHIP_NAMES.map((chipName) => {
    const usedGameweek = usedChips.get(chipName) ?? null;
    return {
      chipName,
      used: usedGameweek !== null,
      usedGameweek,
    };
  });
}

/**
 * Recommend the best gameweek for Bench Boost.
 * Targets a DGW where the squad has the most players with double fixtures
 * and favourable cumulative FDR across the full 15-man squad.
 */
export function recommendBenchBoost(
  squad: Squad,
  fixtures: Fixture[],
  dgws: DoubleGameweek[],
): ChipRecommendation | null {
  if (dgws.length === 0) return null;

  let bestGw = dgws[0].gameweek;
  let bestScore = -Infinity;

  for (const dgw of dgws) {
    const dgwTeamSet = new Set(dgw.affectedTeamIds);
    const dgwPlayerCount = squad.players.filter((p) =>
      dgwTeamSet.has(p.teamId),
    ).length;

    // Score: number of squad players with DGW fixtures, weighted by
    // inverse average FDR for those players' fixtures in that GW.
    const avgFdr = getAverageSquadFdr(squad.players, fixtures, dgw.gameweek);
    // Lower FDR is better, so invert: score = dgwPlayerCount * (6 - avgFdr)
    const score = dgwPlayerCount * (6 - avgFdr);

    if (score > bestScore) {
      bestScore = score;
      bestGw = dgw.gameweek;
    }
  }

  const bestDgw = dgws.find((d) => d.gameweek === bestGw)!;
  const dgwTeamSet = new Set(bestDgw.affectedTeamIds);
  const dgwCount = squad.players.filter((p) => dgwTeamSet.has(p.teamId)).length;

  return {
    chipName: 'bench_boost',
    recommendedGameweek: bestGw,
    reason: `DGW${bestGw}: ${dgwCount} squad players with double fixtures`,
    confidence: dgwCount >= 10 ? 'high' : dgwCount >= 6 ? 'medium' : 'low',
  };
}

/**
 * Recommend the best gameweek for Triple Captain.
 * Targets the DGW that produces the highest captaincy-style score
 * among squad players (form * inverse FDR, boosted for DGW).
 */
export function recommendTripleCaptain(
  squad: Squad,
  fixtures: Fixture[],
  dgws: DoubleGameweek[],
): ChipRecommendation | null {
  if (dgws.length === 0) return null;

  let bestGw = dgws[0].gameweek;
  let bestCaptainScore = -Infinity;
  let bestPlayerName = '';

  for (const dgw of dgws) {
    const dgwTeamSet = new Set(dgw.affectedTeamIds);
    // Only consider starters with DGW fixtures
    const starters = squad.players.filter(
      (p) => !p.isBenched && dgwTeamSet.has(p.teamId),
    );

    for (const player of starters) {
      const fdr = getPlayerFdrForGameweek(player, fixtures, dgw.gameweek);
      // Simple captaincy proxy: form * (6 - fdr) * DGW multiplier
      const score = player.form * (6 - fdr) * 1.5;

      if (score > bestCaptainScore) {
        bestCaptainScore = score;
        bestGw = dgw.gameweek;
        bestPlayerName = player.name;
      }
    }
  }

  return {
    chipName: 'triple_captain',
    recommendedGameweek: bestGw,
    reason: `DGW${bestGw}: Best captain candidate ${bestPlayerName}`,
    confidence: bestCaptainScore > 15 ? 'high' : bestCaptainScore > 8 ? 'medium' : 'low',
  };
}

/**
 * Recommend the best gameweek for Free Hit.
 * Targets the BGW where the squad has the most players without fixtures.
 */
export function recommendFreeHit(
  squad: Squad,
  fixtures: Fixture[],
  bgws: BlankGameweek[],
): ChipRecommendation | null {
  if (bgws.length === 0) return null;

  let worstGw = bgws[0].gameweek;
  let worstAffectedCount = -1;

  for (const bgw of bgws) {
    const bgwTeamSet = new Set(bgw.affectedTeamIds);
    const affectedCount = squad.players.filter((p) =>
      bgwTeamSet.has(p.teamId),
    ).length;

    if (affectedCount > worstAffectedCount) {
      worstAffectedCount = affectedCount;
      worstGw = bgw.gameweek;
    }
  }

  return {
    chipName: 'free_hit',
    recommendedGameweek: worstGw,
    reason: `BGW${worstGw}: ${worstAffectedCount} squad players without fixtures`,
    confidence: worstAffectedCount >= 6 ? 'high' : worstAffectedCount >= 3 ? 'medium' : 'low',
  };
}

/**
 * Generate a chip roadmap showing the recommended sequence and target
 * gameweek for each remaining chip across the rest of the season.
 */
export function generateChipRoadmap(
  chipStatus: ChipStatus[],
  bgws: BlankGameweek[],
  dgws: DoubleGameweek[],
  squad: Squad,
  fixtures: Fixture[],
): ChipRoadmap {
  const recommendations: ChipRecommendation[] = [];

  for (const chip of chipStatus) {
    if (chip.used) continue;

    let rec: ChipRecommendation | null = null;

    switch (chip.chipName) {
      case 'bench_boost':
        rec = recommendBenchBoost(squad, fixtures, dgws);
        break;
      case 'triple_captain':
        rec = recommendTripleCaptain(squad, fixtures, dgws);
        break;
      case 'free_hit':
        rec = recommendFreeHit(squad, fixtures, bgws);
        break;
      case 'wildcard':
        rec = recommendWildcard(bgws, dgws);
        break;
    }

    if (rec) {
      recommendations.push(rec);
    }
  }

  // Sort by recommended gameweek ascending
  recommendations.sort((a, b) => a.recommendedGameweek - b.recommendedGameweek);

  return {
    recommendations,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Activate a chip: transitions its status from available to used.
 * Returns a new ChipStatus array with the activated chip updated.
 */
export function activateChip(
  chipStatus: ChipStatus[],
  chipName: string,
  currentGameweek: number,
): ChipStatus[] {
  return chipStatus.map((chip) => {
    if (chip.chipName === chipName && !chip.used) {
      return {
        ...chip,
        used: true,
        usedGameweek: currentGameweek,
      };
    }
    return chip;
  });
}

// --- Internal Helpers ---

/**
 * Get the average FDR for all squad players in a given gameweek.
 * Players without a fixture in that GW are assigned FDR 5 (worst).
 */
function getAverageSquadFdr(
  players: SquadPlayer[],
  fixtures: Fixture[],
  gameweek: number,
): number {
  if (players.length === 0) return 3;

  const gwFixtures = fixtures.filter((f) => f.gameweek === gameweek);
  let totalFdr = 0;

  for (const player of players) {
    const playerFixtures = gwFixtures.filter(
      (f) => f.homeTeamId === player.teamId || f.awayTeamId === player.teamId,
    );

    if (playerFixtures.length === 0) {
      totalFdr += 5; // No fixture = worst difficulty
    } else {
      // Average FDR across fixtures (handles DGW)
      const fdrSum = playerFixtures.reduce((sum, f) => {
        const fdr =
          f.homeTeamId === player.teamId
            ? f.homeTeamDifficulty
            : f.awayTeamDifficulty;
        return sum + fdr;
      }, 0);
      totalFdr += fdrSum / playerFixtures.length;
    }
  }

  return totalFdr / players.length;
}

/**
 * Get a player's FDR for a specific gameweek.
 * Returns 3 (neutral) if no fixture found.
 */
function getPlayerFdrForGameweek(
  player: SquadPlayer,
  fixtures: Fixture[],
  gameweek: number,
): number {
  const gwFixtures = fixtures.filter(
    (f) =>
      f.gameweek === gameweek &&
      (f.homeTeamId === player.teamId || f.awayTeamId === player.teamId),
  );

  if (gwFixtures.length === 0) return 3;

  // Average FDR across fixtures in that GW
  const total = gwFixtures.reduce((sum, f) => {
    return (
      sum +
      (f.homeTeamId === player.teamId
        ? f.homeTeamDifficulty
        : f.awayTeamDifficulty)
    );
  }, 0);

  return total / gwFixtures.length;
}

/**
 * Recommend wildcard timing.
 * Targets the gameweek just before the largest cluster of BGW/DGW activity,
 * giving the manager time to restructure their squad.
 */
function recommendWildcard(
  bgws: BlankGameweek[],
  dgws: DoubleGameweek[],
): ChipRecommendation | null {
  // Combine all special gameweeks and find the one with the most affected teams
  const gwActivity = new Map<number, number>();

  for (const bgw of bgws) {
    const current = gwActivity.get(bgw.gameweek) ?? 0;
    gwActivity.set(bgw.gameweek, current + bgw.affectedTeamIds.length);
  }
  for (const dgw of dgws) {
    const current = gwActivity.get(dgw.gameweek) ?? 0;
    gwActivity.set(dgw.gameweek, current + dgw.affectedTeamIds.length);
  }

  if (gwActivity.size === 0) return null;

  // Find the GW with the most activity
  let peakGw = 0;
  let peakActivity = 0;
  for (const [gw, activity] of gwActivity) {
    if (activity > peakActivity) {
      peakActivity = activity;
      peakGw = gw;
    }
  }

  // Recommend wildcard 1 GW before the peak
  const recommendedGw = Math.max(1, peakGw - 1);

  return {
    chipName: 'wildcard',
    recommendedGameweek: recommendedGw,
    reason: `Use before GW${peakGw} (${peakActivity} teams with BGW/DGW activity)`,
    confidence: peakActivity >= 10 ? 'high' : peakActivity >= 5 ? 'medium' : 'low',
  };
}
