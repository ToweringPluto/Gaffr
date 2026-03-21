export interface Fixture {
  id: number;
  gameweek: number;
  homeTeamId: number;
  awayTeamId: number;
  homeTeamDifficulty: number;
  awayTeamDifficulty: number;
  kickoffTime: string;
  finished: boolean;
}

export interface FixturesByTeam {
  teamId: number;
  teamName: string;
  fixtures: FixtureDetail[];
  cumulativeDifficulty: number;
}

export interface FixtureDetail {
  gameweek: number;
  opponent: string;
  isHome: boolean;
  difficulty: number;
  isBgw: boolean;
  isDgw: boolean;
}

export interface BlankGameweek {
  gameweek: number;
  affectedTeamIds: number[];
}

export interface DoubleGameweek {
  gameweek: number;
  affectedTeamIds: number[];
}

export interface TeamSchedule {
  teamId: number;
  teamName: string;
  fixtures: FixtureDetail[];
}
