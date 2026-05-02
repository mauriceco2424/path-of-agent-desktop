/**
 * Upgrade Response Types
 *
 * Types for upgrade recommendation responses.
 * NOTE: This is a placeholder for backward compatibility with existing frontend code.
 */

import type { BuildAnalysis } from './BuildAnalysis';
import type { StatSnapshot } from './StatSnapshot';

/**
 * Score breakdown for a recommendation
 */
export interface ScoreBreakdown {
  dpsGainPercent: number;
  ehpGainPercent: number;
  resistanceSafetyScore: number;
  efficiencyScore: number;
}

/**
 * Candidate item for upgrade
 */
export interface CandidateItem {
  id: string;
  slot: string;
  itemName: string;
  itemText: string;
  cost: number;
  modifiers: string[];
  tradeSearchUrl?: string;
}

/**
 * A single upgrade recommendation
 */
export interface UpgradeRecommendation {
  candidateItem: CandidateItem;
  baselineStats: StatSnapshot;
  modifiedStats: StatSnapshot;
  statDeltas: StatSnapshot;
  score: number;
  scoreBreakdown: ScoreBreakdown;
  package: string;
  recommendation: string;
}

/**
 * Full upgrade response from the backend
 */
export interface UpgradeResponse {
  buildAnalysis: BuildAnalysis;
  recommendations: UpgradeRecommendation[];
}
