import type { StatSnapshot } from './StatSnapshot';

export type PackageClassification =
  | 'Safe defense upgrade'
  | 'High DPS package'
  | 'Balanced improvement'
  | 'Glass cannon'
  | 'Economic choice'
  | 'Experimental'
  | string;

export interface StatDeltaSet {
  baseline: StatSnapshot;
  new: StatSnapshot;
  delta: StatSnapshot;
}

export interface UpgradeRecommendation {
  itemName: string;
  itemSlot: string;
  cost: number;
  efficiencyScore: number;
  classification: PackageClassification;
  statDeltas: StatDeltaSet;
  modifiers?: string[];
  reasoning?: string;
  tradeUrl?: string;
  // Legacy fields for compatibility
  combinedStatDeltas?: StatDeltaSet;
  combinedCost?: number;
  packageEfficiencyScore?: number;
  packageClassification?: PackageClassification;
  [key: string]: unknown;
}
