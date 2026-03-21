export interface ManagerHistoryGameweek {
  gameweek: number;
  points: number;
  totalPoints: number;
  rank: number;
  overallRank: number;
  bankValue: number;
  teamValue: number;
  pointsOnBench: number;
}

export interface ManagerHistory {
  currentSeason: ManagerHistoryGameweek[];
  chips: { name: string; gameweek: number }[];
}
