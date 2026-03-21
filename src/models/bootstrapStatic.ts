import type { Player } from './player';

export interface Team {
  id: number;
  name: string;
  shortName: string;
}

export interface Gameweek {
  id: number;
  name: string;
  deadlineTime: string;
  finished: boolean;
  isCurrent: boolean;
  isNext: boolean;
}

export interface BootstrapStatic {
  players: Player[];
  teams: Team[];
  gameweeks: Gameweek[];
  currentGameweek: number;
}
