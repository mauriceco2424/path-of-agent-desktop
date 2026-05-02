import type { StatDeltaSet, PackageClassification, UpgradeRecommendation } from './UpgradeRecommendation';

export interface UpgradePackage {
  name?: string;
  items: UpgradeRecommendation[];
  classification: PackageClassification;
  totalCost: number;
  statDeltas?: StatDeltaSet;
  // Optional fields for legacy UI
  combinedStatDeltas?: StatDeltaSet;
  combinedCost?: number;
  packageEfficiencyScore?: number;
  packageClassification?: PackageClassification;
  reasoning?: string;
  [key: string]: unknown;
}
