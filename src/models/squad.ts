import type { Player } from './player';

export interface Squad {
  players: SquadPlayer[];
  budget: number;
  freeTransfers: number;
  activeChip: string | null;
}

export interface SquadPlayer extends Player {
  isCaptain: boolean;
  isViceCaptain: boolean;
  isBenched: boolean;
  benchOrder: number;
  sellingPrice: number;
}

export interface ManagerSquad {
  teamId: number;
  squad: Squad;
  chipStatus: ChipStatus[];
}

export interface ChipStatus {
  chipName: 'bench_boost' | 'triple_captain' | 'free_hit' | 'wildcard';
  used: boolean;
  usedGameweek: number | null;
}
