import type { Player } from './player';
import type { FixtureDetail } from './fixture';

export interface CaptainCandidate {
  player: Player;
  captaincyScore: number;
  fixture: FixtureDetail;
  fdr: number;
  formValue: number;
  h2hSummary: string;
  isDgw: boolean;
  hasInjuryRisk: boolean;
  hasCongestionRisk: boolean;
}

export interface H2HRecord {
  playerId: number;
  opponentTeamId: number;
  matchesPlayed: number;
  totalPoints: number;
  averagePoints: number;
}
