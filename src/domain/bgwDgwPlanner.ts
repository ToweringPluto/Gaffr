import type {
  Fixture,
  BlankGameweek,
  DoubleGameweek,
  Squad,
  SquadPlayer,
} from '../models';
import { detectBlankGameweeks, detectDoubleGameweeks } from './fixtureAnalyser';

// --- Result Types ---

export interface BgwSquadImpact {
  gameweek: number;
  affectedPlayers: SquadPlayer[];
  affectedCount: number;
}

export interface DgwSquadImpact {
  gameweek: number;
  benefitingPlayers: SquadPlayer[];
  benefitingCount: number;
}

export interface BgwDgwPlanningView {
  blankGameweeks: BgwSquadImpact[];
  doubleGameweeks: DgwSquadImpact[];
}

// --- Core Functions ---

/**
 * Identify squad players affected by a specific blank gameweek.
 * A player is affected if their teamId is in the BGW's affectedTeamIds.
 */
export function getAffectedSquadPlayersBgw(
  squad: Squad,
  bgw: BlankGameweek,
): BgwSquadImpact {
  const affectedTeamSet = new Set(bgw.affectedTeamIds);
  const affectedPlayers = squad.players.filter((p) =>
    affectedTeamSet.has(p.teamId),
  );

  return {
    gameweek: bgw.gameweek,
    affectedPlayers,
    affectedCount: affectedPlayers.length,
  };
}

/**
 * Identify squad players who benefit from a specific double gameweek.
 * A player benefits if their teamId is in the DGW's affectedTeamIds.
 */
export function getBenefitingSquadPlayersDgw(
  squad: Squad,
  dgw: DoubleGameweek,
): DgwSquadImpact {
  const benefitingTeamSet = new Set(dgw.affectedTeamIds);
  const benefitingPlayers = squad.players.filter((p) =>
    benefitingTeamSet.has(p.teamId),
  );

  return {
    gameweek: dgw.gameweek,
    benefitingPlayers,
    benefitingCount: benefitingPlayers.length,
  };
}

/**
 * Get all BGW squad impacts within the next N gameweeks.
 * Highlights squad players who have no fixture (Req 4.4).
 */
export function getUpcomingBgwImpacts(
  squad: Squad,
  fixtures: Fixture[],
  allTeamIds: number[],
  currentGameweek: number,
  lookAhead: number = 4,
): BgwSquadImpact[] {
  const bgws = detectBlankGameweeks(fixtures, allTeamIds);
  const maxGw = currentGameweek + lookAhead - 1;

  return bgws
    .filter((bgw) => bgw.gameweek >= currentGameweek && bgw.gameweek <= maxGw)
    .map((bgw) => getAffectedSquadPlayersBgw(squad, bgw));
}

/**
 * Get all DGW squad impacts within the next N gameweeks.
 * Highlights squad players who have two fixtures (Req 4.5).
 */
export function getUpcomingDgwImpacts(
  squad: Squad,
  fixtures: Fixture[],
  currentGameweek: number,
  lookAhead: number = 4,
): DgwSquadImpact[] {
  const dgws = detectDoubleGameweeks(fixtures);
  const maxGw = currentGameweek + lookAhead - 1;

  return dgws
    .filter((dgw) => dgw.gameweek >= currentGameweek && dgw.gameweek <= maxGw)
    .map((dgw) => getBenefitingSquadPlayersDgw(squad, dgw));
}

/**
 * Build the full BGW/DGW planning view (Req 4.1).
 * Combines blank and double gameweek impacts for the squad.
 */
export function getBgwDgwPlanningView(
  squad: Squad,
  fixtures: Fixture[],
  allTeamIds: number[],
  currentGameweek: number,
  lookAhead: number = 4,
): BgwDgwPlanningView {
  return {
    blankGameweeks: getUpcomingBgwImpacts(
      squad,
      fixtures,
      allTeamIds,
      currentGameweek,
      lookAhead,
    ),
    doubleGameweeks: getUpcomingDgwImpacts(
      squad,
      fixtures,
      currentGameweek,
      lookAhead,
    ),
  };
}
