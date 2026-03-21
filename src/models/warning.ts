import type { SquadPlayer } from './squad';

export interface BenchOrderWarning {
  blankPlayer: SquadPlayer;
  blockingPosition: number;
  playingPlayerBehind: SquadPlayer;
}

export interface HighPriorityAlert {
  starter: SquadPlayer;
  benchReplacement: SquadPlayer;
  reason: string;
}

export interface TeamOverlap {
  fixtureId: number;
  gameweek: number;
  teamId: number;
  players: SquadPlayer[];
  maxPotentialLoss: number;
  severity: 'standard' | 'high';
}

export interface RotationRisk {
  player: SquadPlayer;
  teamId: number;
  congestionFixture: string;
  premierLeagueFixture: string;
  hoursBetween: number;
}
