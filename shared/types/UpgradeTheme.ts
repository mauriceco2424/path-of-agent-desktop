import type { UpgradeTheme as BaseUpgradeTheme } from './BuildAnalysis';

export type UpgradeTheme = BaseUpgradeTheme & {
  priority?: number;
  justification?: string;
  targetSlots?: string[];
  targetStats?: string[];
};
