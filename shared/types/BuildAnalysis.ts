/**
 * Build Analysis Type
 *
 * This type represents the analysis results for a build.
 * NOTE: This is a placeholder for backward compatibility.
 * The actual analysis is now done by the backend LLM and not
 * exposed as a separate frontend entity.
 */

import type { StatSnapshot } from './StatSnapshot';

/**
 * Weakness identified in the build
 */
export interface BuildWeakness {
  category: string;
  severity: 'Critical' | 'Major' | 'Minor';
  description: string;
  field?: string;
  currentValue?: number;
  threshold?: number;
}

/**
 * Upgrade theme suggestion
 */
export interface UpgradeTheme {
  name: string;
  description?: string;
  rationale?: string;
  targetStats?: string[];
}

/**
 * Build archetype detection
 */
export interface BuildArchetype {
  primaryDamageType: string;
  deliveryMethod: string;
  defensiveStrategy: string;
  /** Optional: damage application mode (Hit/DoT/Hybrid) */
  damageApplication?: 'Hit' | 'DoT' | 'Hybrid';
  /** Optional: whether the build is crit-based */
  isCritBased?: boolean;
  /** Optional: extra characteristics for UI badges */
  characteristics?: string[];
}

/**
 * Build analysis results
 *
 * NOTE: This is largely vestigial. The chat-centric architecture
 * moved analysis responsibility to the backend LLM which receives
 * raw PoB data and performs its own analysis.
 */
export interface BuildAnalysis {
  /** Detected build archetype */
  archetype?: BuildArchetype;
  /** Identified weaknesses in the build */
  weaknesses?: BuildWeakness[];
  /** Suggested upgrade themes */
  selectedThemes?: UpgradeTheme[];
  /** Baseline stat snapshot for comparisons */
  baselineSnapshot?: StatSnapshot;
}
