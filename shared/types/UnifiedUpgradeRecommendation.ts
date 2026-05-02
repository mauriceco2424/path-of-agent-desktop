export interface ExecutionMetadata {
  requestId?: string;
  elapsedMs?: number;
}

export type UpgradeThemeName = 'Increase Boss DPS' | 'Increase Effective HP' | 'Reach Resistance Caps' | string;
export type UpgradeDomain = string;
export type UpgradeRoadmap = string;

export interface UnifiedUpgradeRecommendation {
  id?: string;
  itemName?: string;
  slot?: string;
  reason?: string;
  theme?: UpgradeThemeName | null;
  cost?: number;
  efficiencyScore?: number;
  tradeUrl?: string;
}

export interface UnifiedUpgradeResponse {
  success: boolean;
  recommendations: UnifiedUpgradeRecommendation[];
  metadata?: ExecutionMetadata;
}
