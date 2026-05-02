/**
 * Pathway Types
 *
 * Type definitions for the pathway analysis system.
 */

/**
 * The three improvement pathways in the build analysis system
 */
export type PathwayType = 'skills' | 'tree' | 'gear';

/**
 * Priority levels for improvement items
 */
export type ImprovementPriority = 'critical' | 'high' | 'medium' | 'low';

/**
 * Status of an improvement item in the guided UI
 */
export type ImprovementStatus = 'pending' | 'in_progress' | 'applied' | 'exported' | 'skipped';

// =============================================================================
// Action Types - Pathway-specific action data
// =============================================================================

/**
 * Action for gear pathway improvements
 */
export interface GearAction {
  type: 'trade' | 'craft' | 'divine' | 'corrupt' | 'quality';
  slot: string;
  currentItem?: string;
  tierAssessment?: 'CRITICAL' | 'POOR' | 'AVERAGE' | 'GOOD';
  tradeScore?: number;
  craftScore?: number;
  targetMods?: string[];
  quickWin?: boolean;
  budgetEstimate?: number;
}

/**
 * Action for skills pathway improvements
 */
export interface SkillsAction {
  type: 'gem_swap' | 'gem_level' | 'gem_quality' | 'link_change' | 'aura_change';
  socketGroup?: string;
  removeGem?: string;
  addGem?: string;
  targetLevel?: number;
  targetQuality?: number;
  antiSynergy?: boolean;
  metaUsage?: number;
}

/**
 * Action for tree pathway improvements
 */
export interface TreeAction {
  type: 'allocate' | 'deallocate' | 'respec' | 'keystone' | 'ascendancy';
  allocateNodes?: number[];
  deallocateNodes?: number[];
  nodeNames?: string[];
  pointCost?: number;
  keystone?: string;
  metaUsage?: number;
}

// =============================================================================
// Impact Types
// =============================================================================

/**
 * Estimated impact of an improvement on build stats
 */
export interface ImprovementImpact {
  dps?: number;
  life?: number;
  energyShield?: number;
  ehp?: number;
  resistances?: {
    fire?: number;
    cold?: number;
    lightning?: number;
    chaos?: number;
  };
  description?: string;
}

// =============================================================================
// Main Item Type
// =============================================================================

/**
 * A single improvement item extracted from pathway analysis
 */
export interface PathwayImprovementItem {
  id: string;
  pathway: PathwayType;
  priority: ImprovementPriority;
  status: ImprovementStatus;
  title: string;
  subtitle: string;
  impact?: ImprovementImpact;
  action: GearAction | SkillsAction | TreeAction;
  rawText?: string;
  sourceSection?: string;
  createdAt?: number;
  updatedAt?: number;
  appliedAt?: number;
}
