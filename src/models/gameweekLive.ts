export interface LivePlayerStats {
  playerId: number;
  points: number;
  minutes: number;
  goalsScored: number;
  assists: number;
  cleanSheets: number;
  bonusPoints: number;
}

export interface GameweekLive {
  gameweek: number;
  players: LivePlayerStats[];
}
