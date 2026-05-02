/**
 * Build Modification State Types
 *
 * These types track the progressive modification state of a build during
 * a guided pathway session. Changes are accumulated and can be exported
 * as a single PoB code when the user completes their session.
 *
 * Flow:
 * 1. User imports build -> originalPobCode stored
 * 2. User picks a pathway -> improvement items generated
 * 3. User confirms each item -> change applied to currentPobCode, added to pendingChanges
 * 4. User exports -> final currentPobCode returned
 */

import type { PathwayType } from './pathway';

/**
 * Simplified improvement item for API responses.
 * The LLM reasons freely about improvements without structured parsing.
 */
export interface SimpleImprovementItem {
  id: string;
  pathway: PathwayType;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'applied' | 'skipped' | 'exported';
  title: string;
  subtitle: string;
  action: Record<string, unknown>;
}

// =============================================================================
// Applied Change Tracking
// =============================================================================

/**
 * Represents a single confirmed change that has been applied to the build
 */
export interface AppliedChange {
  /** Unique identifier matching the PathwayImprovementItem.id */
  id: string;
  /** Which pathway this change belongs to */
  pathway: PathwayType;
  /** Human-readable description of what changed */
  description: string;
  /** Timestamp when the change was applied */
  appliedAt: number;
  /** Impact metrics recorded at time of application */
  impact?: {
    /** DPS change (absolute value) */
    dps?: number;
    /** DPS change as percentage */
    dpsPercent?: number;
    /** Life change (absolute value) */
    life?: number;
    /** Life change as percentage */
    lifePercent?: number;
    /** EHP change (absolute value) */
    ehp?: number;
    /** EHP change as percentage */
    ehpPercent?: number;
  };
  /** Raw data used for the modification (for debugging/undo) */
  rawActionData?: unknown;
}

// =============================================================================
// Build Modification State
// =============================================================================

/**
 * Complete state for tracking build modifications during a guided pathway session
 *
 * This state is stored server-side and tracks:
 * - Original build state (snapshot at session start)
 * - Current build state (updated after each confirmation)
 * - Pending changes that have been confirmed but not yet exported
 * - Per-pathway improvement lists
 */
export interface BuildModificationState {
  /** Build ID this state belongs to */
  buildId: string;

  // PoB Code State
  /** Original PoB code - snapshot at session start (never modified) */
  originalPobCode: string;
  /** Current PoB code - updated after each confirmation */
  currentPobCode: string;
  /** Original PoB XML - for PoB API operations */
  originalPobXml: string;
  /** Current PoB XML - updated after each confirmation */
  currentPobXml: string;

  // Change Tracking
  /** Confirmed changes not yet exported */
  pendingChanges: AppliedChange[];
  /** Total number of changes applied (for stats) */
  totalChangesApplied: number;

  // Per-Pathway Improvement Lists (simplified - no structured parsing)
  /** Gear pathway improvement items */
  gearItems: SimpleImprovementItem[];
  /** Skills pathway improvement items */
  skillsItems: SimpleImprovementItem[];
  /** Tree pathway improvement items */
  treeItems: SimpleImprovementItem[];

  // Session Metadata
  /** When this modification session started */
  sessionStartedAt: number;
  /** When the last change was applied */
  lastModifiedAt: number;
  /** Whether the session is active */
  isActive: boolean;
}

// =============================================================================
// Request/Response Types for API Endpoints
// =============================================================================

/**
 * Request body for POST /api/v1/builds/{id}/apply-change
 */
export interface ApplyChangeRequest {
  /** ID of the improvement item being applied */
  itemId: string;
  /** Which pathway this item belongs to */
  pathway: PathwayType;
  /**
   * Action-specific data for applying the change
   * Shape depends on pathway type:
   * - gear: { slot: string, itemText?: string, ... }
   * - skills: { skillGroup: number, removeGem?: string, addGem?: string, ... }
   * - tree: { nodeIds: number[], allocate: boolean }
   */
  actionData: Record<string, unknown>;
}

/**
 * Response from POST /api/v1/builds/{id}/apply-change
 */
export interface ApplyChangeResponse {
  /** Whether the change was successfully applied */
  success: boolean;
  /** Error message if success is false */
  error?: string;
  /** Updated item with new status */
  updatedItem: SimpleImprovementItem;
  /** The applied change record */
  appliedChange?: AppliedChange;
  /** Updated current PoB code (compressed) */
  currentPobCode: string;
  /** Summary of cumulative impact from all changes */
  cumulativeImpact?: {
    dps: { before: number; after: number; changePercent: number };
    life: { before: number; after: number; changePercent: number };
    ehp: { before: number; after: number; changePercent: number };
  };
}

/**
 * Request body for POST /api/v1/builds/{id}/export
 */
export interface ExportBuildRequest {
  /** Optional: Only export changes for specific pathway */
  pathway?: PathwayType;
  /** Optional: Include change log in export metadata */
  includeChangeLog?: boolean;
}

/**
 * Response from POST /api/v1/builds/{id}/export
 */
export interface ExportBuildResponse {
  /** Whether the export was successful */
  success: boolean;
  /** Error message if success is false */
  error?: string;
  /** Final compressed PoB code */
  pobCode: string;
  /** Summary of all changes included in export */
  changeSummary: {
    /** Total changes across all pathways */
    totalChanges: number;
    /** Changes by pathway */
    byPathway: {
      gear: number;
      skills: number;
      tree: number;
    };
    /** Items that were skipped */
    skippedItems: number;
  };
  /** Cumulative impact of all exported changes */
  finalImpact?: {
    dps: { original: number; final: number; changePercent: number };
    life: { original: number; final: number; changePercent: number };
    ehp: { original: number; final: number; changePercent: number };
  };
  /** List of applied changes for reference */
  changeLog?: AppliedChange[];
}

// =============================================================================
// Initialization Types
// =============================================================================

/**
 * Request to initialize a pathway session
 */
export interface InitializePathwayRequest {
  /** Build ID to initialize pathway for */
  buildId: string;
  /** Which pathway to initialize */
  pathway: PathwayType;
}

/**
 * Response from pathway initialization
 */
export interface InitializePathwayResponse {
  /** Whether initialization succeeded */
  success: boolean;
  /** Error message if success is false */
  error?: string;
  /** Improvement items for the requested pathway */
  items: SimpleImprovementItem[];
  /** Summary of the pathway's improvement potential */
  summary: {
    totalItems: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    estimatedTotalImpact?: {
      dps?: { changePercent: number };
      life?: { changePercent: number };
      ehp?: { changePercent: number };
    };
  };
}

// =============================================================================
// Helper Types
// =============================================================================

/**
 * Partial state update for optimistic UI updates
 */
export interface PartialModificationUpdate {
  itemId: string;
  newStatus: SimpleImprovementItem['status'];
  impact?: AppliedChange['impact'];
}

/**
 * Session state summary for UI display
 */
export interface ModificationSessionSummary {
  buildId: string;
  isActive: boolean;
  changesApplied: number;
  changesPending: number;
  pathwayProgress: {
    gear: { total: number; completed: number; skipped: number };
    skills: { total: number; completed: number; skipped: number };
    tree: { total: number; completed: number; skipped: number };
  };
  sessionDurationMs: number;
}
