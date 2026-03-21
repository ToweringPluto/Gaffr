export type Position = 'GKP' | 'DEF' | 'MID' | 'FWD';

export type FormTrend = 'rising' | 'stable' | 'falling';

export interface GameweekPoints {
  gameweek: number;
  points: number;
  minutes: number;
}

export interface Player {
  id: number;
  name: string;
  teamId: number;
  position: Position;
  totalPoints: number;
  form: number;
  cost: number;
  ownershipPercentage: number;
  minutesPlayed: number;
  news: string;
  chanceOfPlaying: number | null;
  gameweekPoints: GameweekPoints[];
}

export interface RankedPlayer extends Player {
  rank: number;
  formTrend: FormTrend;
}
