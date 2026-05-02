/**
 * Tree Safety Validation Types
 *
 * Type definitions for the tree safety validation service that prevents
 * dangerous tree respec suggestions (orphaning nodes, breaking connectivity,
 * removing critical mechanics enablers).
 *
 * @module shared/types/tree-safety
 */

// =============================================================================
// Criticality Types
// =============================================================================

/**
 * How critical a node is to the build's functionality.
 *
 * - 'essential': Removing would break the build (keystones, ascendancy)
 * - 'important': High stat impact or path connector
 * - 'removable': Can be safely removed with minimal impact
 */
export type CriticalityLevel = 'essential' | 'important' | 'removable';

/**
 * Reasons why a node is considered critical.
 *
 * - 'keystone': Node is a keystone passive
 * - 'ascendancy': Node is an ascendancy passive
 * - 'path_connector': Node connects parts of the tree
 * - 'mechanic_enabler': Node enables a key mechanic (immunity, cap)
 * - 'high_stat_impact': Removing causes >5% DPS or EHP loss
 */
export type CriticalityReason =
  | 'keystone'
  | 'ascendancy'
  | 'path_connector'
  | 'mechanic_enabler'
  | 'high_stat_impact';

// =============================================================================
// Connectivity Validation Types
// =============================================================================

/**
 * Result of validating tree connectivity after a proposed removal.
 *
 * Tree connectivity is checked using BFS from the class start node.
 * Any nodes that become unreachable after removal are orphaned.
 */
export interface ConnectivityValidationResult {
  /**
   * Whether the tree remains fully connected after the removal.
   * True if all remaining nodes are still reachable from the class start.
   */
  isConnected: boolean;

  /**
   * Node IDs that would become orphaned (unreachable) after removal.
   * Empty array if tree stays connected.
   */
  orphanedNodes: number[];

  /**
   * Human-readable names of orphaned nodes for display.
   */
  orphanedNodeNames: string[];

  /**
   * Warning message if connectivity is broken.
   * @example "Removing this node would orphan 5 nodes including Brutal Fervour"
   */
  warning?: string;
}

// =============================================================================
// Node Criticality Types
// =============================================================================

/**
 * Assessment of how critical a node is to the build.
 *
 * Used to warn users before removing important nodes.
 */
export interface NodeCriticalityResult {
  /** The node being assessed */
  nodeId: number;

  /** Human-readable node name */
  nodeName: string;

  /**
   * Overall criticality level.
   * Determined by the highest priority reason.
   */
  criticalityLevel: CriticalityLevel;

  /**
   * All reasons contributing to the criticality assessment.
   * Sorted by severity (most critical first).
   */
  reasons: CriticalityReason[];

  /**
   * Node IDs that depend on this node for connectivity.
   * If this node is removed, these would become orphaned.
   */
  dependentNodes: number[];

  /**
   * Mechanics that would be affected by removing this node.
   * @example ["Stun Immunity", "Freeze Immunity"]
   */
  mechanicImpact?: string[];
}

// =============================================================================
// Respec Safety Types
// =============================================================================

/**
 * Recommendation for proceeding with a node removal.
 *
 * - 'proceed': Safe to remove, no significant concerns
 * - 'caution': Removable but has notable impact, warn user
 * - 'blocked': Should not be removed, would break build
 */
export type SafetyRecommendation = 'proceed' | 'caution' | 'blocked';

/**
 * Complete safety assessment for removing a node.
 *
 * Combines connectivity validation and criticality assessment
 * to provide a comprehensive safety evaluation.
 */
export interface RespecSafetyResult {
  /** The node being evaluated for removal */
  nodeId: number;

  /** Human-readable node name */
  nodeName: string;

  /**
   * Whether it's safe to remove this node.
   * False if removal would break connectivity or remove essential mechanics.
   */
  isSafe: boolean;

  /** Detailed criticality assessment */
  criticality: NodeCriticalityResult;

  /** Connectivity validation results */
  connectivity: ConnectivityValidationResult;

  /**
   * All warning messages about this removal.
   * Empty array if removal is completely safe.
   */
  warnings: string[];

  /**
   * Overall recommendation for the user.
   * Based on combined criticality and connectivity analysis.
   */
  recommendation: SafetyRecommendation;
}

// =============================================================================
// Batch Safety Types
// =============================================================================

/**
 * Safety results for removing multiple nodes.
 *
 * When multiple nodes are being removed, we need to consider
 * their combined effect on connectivity and stats.
 */
export interface BatchRespecSafetyResult {
  /** Whether all removals are safe together */
  allSafe: boolean;

  /** Individual safety results for each node */
  nodeResults: RespecSafetyResult[];

  /**
   * Total orphaned nodes from all removals combined.
   * May differ from sum of individual orphaned nodes
   * due to interaction effects.
   */
  totalOrphanedNodes: number[];

  /**
   * Combined warnings from all removal assessments.
   */
  combinedWarnings: string[];

  /** Overall recommendation considering all nodes */
  recommendation: SafetyRecommendation;
}

// =============================================================================
// Mechanic Impact Types
// =============================================================================

/**
 * Impact on a specific mechanic from a tree change.
 *
 * Used to detect when important mechanics like immunities
 * or caps would be lost.
 */
export interface MechanicImpact {
  /** Name of the affected mechanic */
  mechanicName: string;

  /** Value before the change (e.g., 100 for freeze immunity) */
  before: number;

  /** Value after the change */
  after: number;

  /** Threshold for the mechanic (e.g., 100 for immunities) */
  threshold: number;

  /**
   * Whether this is a critical loss.
   * True if was at/above threshold before, below after.
   */
  isCriticalLoss: boolean;

  /**
   * Human-readable description of the impact.
   * @example "Loses Freeze Immunity (100% -> 76%)"
   */
  description: string;
}

// =============================================================================
// Service Configuration Types
// =============================================================================

/**
 * Configuration options for tree safety validation.
 */
export interface TreeSafetyConfig {
  /**
   * DPS loss threshold (%) to consider "high stat impact".
   * @default 5
   */
  dpsLossThreshold?: number;

  /**
   * EHP loss threshold (%) to consider "high stat impact".
   * @default 5
   */
  ehpLossThreshold?: number;

  /**
   * Whether to run stat simulations for criticality assessment.
   * Disable for faster (but less accurate) checks.
   * @default true
   */
  enableStatSimulation?: boolean;

  /**
   * Maximum number of nodes to check for connectivity.
   * Performance optimization for very large trees.
   * @default 200
   */
  maxConnectivityCheck?: number;
}

/**
 * Default configuration for tree safety validation.
 */
export const DEFAULT_TREE_SAFETY_CONFIG: Required<TreeSafetyConfig> = {
  dpsLossThreshold: 5,
  ehpLossThreshold: 5,
  enableStatSimulation: true,
  maxConnectivityCheck: 200,
};
