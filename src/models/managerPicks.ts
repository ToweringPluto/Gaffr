export interface ManagerPick {
  playerId: number;
  position: number;
  multiplier: number;
  isCaptain: boolean;
  isViceCaptain: boolean;
}

export interface ManagerPicks {
  gameweek: number;
  picks: ManagerPick[];
  activeChip: string | null;
}
