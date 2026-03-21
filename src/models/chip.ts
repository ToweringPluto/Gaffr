export interface ChipRecommendation {
  chipName: string;
  recommendedGameweek: number;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface ChipRoadmap {
  recommendations: ChipRecommendation[];
  lastUpdated: string;
}
