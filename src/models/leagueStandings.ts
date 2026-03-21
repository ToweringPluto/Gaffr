export interface LeagueStandingEntry {
  managerId: number;
  managerName: string;
  teamName: string;
  rank: number;
  lastRank: number;
  totalPoints: number;
  gameweekPoints: number;
}

export interface LeagueStandings {
  leagueId: number;
  leagueName: string;
  entries: LeagueStandingEntry[];
}
