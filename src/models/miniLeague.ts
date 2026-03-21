import type { Player } from './player';

export interface MiniLeagueStanding {
  managerId: number;
  managerName: string;
  teamName: string;
  rank: number;
  totalPoints: number;
  gameweekPoints: number;
  captainId: number;
  squad: Player[];
}

export interface TemplatePlayer {
  player: Player;
  ownershipInLeague: number;
}
