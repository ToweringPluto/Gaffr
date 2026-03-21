export type NewsSeverity = 'available' | 'doubtful_25' | 'doubtful_50' | 'doubtful_75' | 'injured_suspended';

export interface NewsItem {
  playerId: number;
  playerName: string;
  content: string;
  severity: NewsSeverity;
  source: 'fpl_api' | 'external';
  timestamp: string;
  speakerName?: string;
}
