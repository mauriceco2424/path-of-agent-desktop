/**
 * Desktop Zustand Store
 *
 * Simplified store for the desktop application.
 * Uses sessionStorage for persistence (data survives refresh but clears on tab close).
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  ImprovementCard,
  BuildTracker,
  StatsDelta,
  ConfidenceTier,
  ValidationStatus,
  TreeSimulationResult,
  ActionButtonType,
  ExploreOption,
  ItemPasteState,
  SkillsStatDelta,
} from '../../../shared/types/improvements';
import type { RecipeProgress } from '../../../shared/types/recipe';
import type { BuildRatings } from '../../../shared/types/synthesis';

/**
 * Tree simulation results container.
 * Legacy type preserved for backwards compatibility after usePathwayActions deletion.
 */
export type TreeSimulationResults = TreeSimulationResult;
import type { GearSlotRatings } from '../../../shared/types/GearQuality';
import type { AtlasTreeSummary, AtlasNamedTree } from '../../../shared/types/atlas';
import type { SeerContextData, OptimizationFocus, LLMContextDebugData } from '../../../shared/types/Chat';
import type { CardTradeState } from '../types/flow';
import type { PreviewClusterNode } from './treePackageStore';
import type {
  LadderStatusResponse,
  LadderStatsSummary,
  LadderFetchProgressEvent,
} from '../../../shared/types/LadderData';
import type { VizStepEvent } from '../../../shared/types/VisualizationStream';
import type {
  ChatMode as UIChatMode,
  AnalysisConfig,
  AnalysisFocus,
  PathwayContext,
} from '../types/chat-modes';

// Re-export UI mode types (ChatPage redesign Phase 3a)
export type { ChatMode as UIChatMode, AnalysisConfig, AnalysisFocus, PathwayContext } from '../types/chat-modes';
export { MODE_INFO } from '../types/chat-modes';

// Re-export pathway store
export { usePathwayStore } from './pathwaySlice';
export type { PathwayState, PathwayActions, PathwayStore } from './pathwaySlice';

// Import token store for internal use (setBuild, restoreSession)
import {
  useTokenStore,
  selectTotalCost,
  selectTotalTokens,
  selectRecentEntries,
  selectHasUsage,
} from './tokenSlice';
// Re-export token store (Token Usage Tracking)
export {
  useTokenStore,
  selectTotalCost,
  selectTotalTokens,
  selectRecentEntries,
  selectHasUsage,
};
export type { TokenState, TokenActions, TokenStore } from './tokenSlice';


// ============================================
// Helpers
// ============================================


// ============================================
// Type Definitions
// ============================================

/**
 * Pathway type for the 3 main improvement pathways
 */
export type PathwayType = 'skills' | 'tree' | 'gear';

/**
 * Action item category for pathway improvements
 */
export type ActionCategory = 'offensive' | 'defensive' | 'utility';

/**
 * Action type for improvements (what actions are available)
 */
export type ActionType = 'trade' | 'craft' | 'both' | 'respec';

// ============================================
// Context Inspector Types (dev-only LLM transparency)
// ============================================

/**
 * Re-export shared LLM context debug types for local use.
 * Canonical definitions live in shared/types/Chat.ts.
 */
export type { LLMContextDebugData, LLMContextSection } from '../../../shared/types/Chat';

// ============================================
// Inline Card Actions Types (Spec 038)
// ============================================

/**
 * Expansion states for improvement cards
 * - collapsed: Default state, card shows summary only
 * - trade-config: Equipment pathway - showing budget/stat configuration
 * - trade-results: Equipment pathway - showing search results
 * - craft-config: Equipment pathway - showing crafting configuration
 * - craft-results: Equipment pathway - showing crafting recipe/results
 * - tree-loading: Tree pathway - simulation in progress
 * - tree-results: Tree pathway - showing stat comparison
 * - skills-details: Skills pathway - showing gem change details
 * - completed: Applied successfully, non-expandable
 */
export type CardExpansionType =
  | 'collapsed'
  | 'trade-config'
  | 'trade-results'
  | 'craft-config'
  | 'craft-results'
  | 'tree-loading'
  | 'tree-results'
  | 'skills-details'
  | 'skills-results'   // Showing validated skills change results
  | 'completed'
  | 'explore'          // Showing ExploreOption selection
  | 'analyze-loading'  // Running simulation
  | 'analyze-results'  // Showing before/after stats
  | 'recipe-paths'     // Showing path selection (Spec 040)
  | 'recipe-steps'     // Showing recipe checklist (Spec 040)
  | 'gear-enrichment'; // Showing enriched trade+craft options

/**
 * Tracks the currently expanded card across all pathway tabs
 * Only one card can be expanded at a time
 * @deprecated Use cardStates for multi-card expansion support
 */
export interface ExpandedCardState {
  /** ID of the currently expanded card, or null if all collapsed */
  cardId: string | null;

  /** Current expansion type of the expanded card */
  expansionType: CardExpansionType;

  /** Which pathway tab the expanded card belongs to */
  pathway: 'skills' | 'tree' | 'gear' | null;
}

/**
 * Per-card persisted state for all pathways.
 * Supports multiple expanded cards and persists state across navigation.
 * Replaces both expandedCard (single) and local cardTradeState from ChatPage.
 */
export interface PersistedCardState {
  /** Whether this card is currently expanded in the UI */
  isExpanded: boolean;

  /** Current expansion type of this card */
  expansionType: CardExpansionType;

  /** Which pathway this card belongs to */
  pathway: 'skills' | 'tree' | 'gear';

  /** Equipment pathway state (trade search config, results, craft state) */
  trade?: CardTradeState;

  /** Skills pathway state (apply flow state) */
  skills?: {
    isApplying?: boolean;
    applyError?: string | null;
    appliedDelta?: StatsDelta | null;
    reasoning?: string;
    gemTradeUrl?: string;
    gemTradeNeeded?: boolean;
    statChanges?: {
      dps: { before: number; after: number; change: number; percentChange: number };
      ehp: { before: number; after: number; change: number; percentChange: number };
    };
    isUpgrade?: boolean;
    warningState?: {
      isActive: boolean;
      warningType: 'negative_dps' | 'negative_ehp' | 'negative_both' | null;
      pendingDelta: StatsDelta | null;
      pendingPobCode: string | null;
    };
  };

  /** Tree pathway state (validation state - results stored separately) */
  tree?: {
    validationStatus?: 'idle' | 'validating' | 'success' | 'warning' | 'error';
    warningAcknowledged?: boolean;
    simulation?: {
      nodeIds: number[];
      statChanges: {
        dps: { before: number; after: number; change: number; percentChange: number };
        ehp: { before: number; after: number; change: number; percentChange: number };
        life?: { before: number; after: number; change: number; percentChange: number };
      };
      pointCost: number;
      travelNodeIds?: number[];
      targetNodeIds?: number[];
      isUpgrade: boolean;
      qualitativeBenefits: Array<{ stat: string; reached: string }>;
    };
    reasoning?: string;
    unresolvedNodes?: string[];
    errorMessage?: string;
  };

  /** Timestamp of last update */
  lastUpdated: number;
}

/**
 * Per-card completion state for tracking applied improvements
 */
export interface CompletedCardState {
  /** Whether this card has been completed (improvement applied) */
  isCompleted: boolean;

  /** Timestamp when improvement was applied */
  completedAt?: number;

  /** Stats delta recorded when applied (for history) */
  appliedStatsDelta?: {
    dpsPercent: number;
    ehpPercent: number;
  };
}

/**
 * Structured action item for pathway cards
 * Represents a prioritized improvement action
 */
export interface ActionItem {
  id: string;
  priority: number;
  category: ActionCategory;
  /** All applicable categories (optional for backwards compatibility). */
  categories?: ActionCategory[];
  title: string;
  impact: string;
  /** Equipment slot (for gear pathway) */
  slot?: string;
  /** Skills: target socket group index (1-based) */
  skillGroupIndex?: number;
  /** Skills: label for the socket group */
  skillGroupLabel?: string;
  /** Skills: slot name for the socket group */
  skillGroupSlot?: string;
  /** Skills: true if this is the main skill group */
  skillGroupIsMain?: boolean;
  /** Skills: tag when not tied to a specific group (e.g., "New Slot") */
  skillGroupTag?: string;
  /** What actions are available for this improvement */
  actionType: ActionType;
  /** Evidence from analysis explaining why this improvement matters */
  evidence?: string;
  /** Detailed reasoning explaining WHY this improvement is recommended (2-4 sentences) */
  reasoning?: string;

  // === Confidence Tier Fields ===
  /** Confidence tier: 'verified' (simulated), 'meta-backed' (from stats), 'utility' (QoL) */
  confidenceTier?: ConfidenceTier;
  /** Whether this improvement can be simulated with PoB */
  canSimulate?: boolean;
  /** Note explaining simulation limitations */
  simulationNote?: string;

  // === Tree Pre-Validation Fields ===
  /** Pre-validated simulation results (tree pathway only) */
  simulation?: TreeSimulationResult;
  /** Validation status for this improvement */
  validationStatus?: ValidationStatus;
  /** Whether this improvement has mixed impact (some stats up, some down) */
  hasMixedImpact?: boolean;
  /** Human-readable impact summary */
  impactSummary?: string;
  /** Why simulation was skipped */
  simulationSkipReason?: 'vague_title' | 'unresolved_nodes' | 'manual_only' | 'no_changes';
  /** Human-readable explanation for skip */
  simulationSkipMessage?: string;

  // === Skills Pre-Validation Fields ===
  /** Pre-validated simulation results for skills pathway */
  skillsSimulation?: {
    statChanges: {
      dps?: SkillsStatDelta;
      ehp?: SkillsStatDelta;
    };
    isUpgrade: boolean;
  };

  // === Dynamic Action Fields (Spec 039) ===
  /** LLM-determined action buttons */
  suggestedActions?: ActionButtonType[];
  /** Pre-generated explore options */
  exploreOptions?: ExploreOption[];
}

/**
 * Unified action item that includes pathway information
 * Used for cross-pathway priority list (Top 5)
 */
export interface UnifiedActionItem extends ActionItem {
  /** Which pathway this action belongs to */
  pathway: PathwayType;
  /** Global rank across all pathways (1-5) */
  globalRank: number;
}

/**
 * Tab type for build visualization panel
 */
export type VizTab = 'gear' | 'skills' | 'tree' | 'atlas';

/**
 * Unified tab type for synchronized panel navigation
 * Controls both BuildVisualizationPanel and AnalysisPanel simultaneously
 */
export type UnifiedTab = 'overview' | 'skills' | 'tree' | 'gear' | 'chat';

/**
 * Build visualization response from PoB API
 */
/**
 * Value range for mod tier or unique roll
 */
export interface ModValueRange {
  min: number;
  max: number;
}

/**
 * Structured mod entry with optional tier/roll info
 */
export interface ModEntry {
  text: string;
  affixType: string;
  type: string;
  value?: number;
  /** Tier number for rare item mods (1 = best, up to 10) */
  tier?: number;
  /** Value range for this tier (rare items) */
  tierRange?: ModValueRange;
  /** Roll range for unique item mods (min/max possible roll) */
  rollRange?: ModValueRange;
  /** Source of implicit mods — base item, Searing Exarch, or Eater of Worlds */
  implicitSource?: 'base' | 'searing_exarch' | 'eater_of_worlds';
}

/**
 * Structured mod data for item visualization
 */
export interface StructuredMods {
  implicits: ModEntry[];
  explicits: ModEntry[];
  crafted: ModEntry[];
  enchants: ModEntry[];
}

/**
 * Display information for item header
 */
export interface ItemDisplayInfo {
  itemName: string;
  baseName: string;
  isCorrupted: boolean;
  influences: string[];
  isFractured: boolean;
  baseStats?: BaseDefenseStats;
  /** Weapon stats computed by PoB (damage, crit, APS, DPS) */
  weaponStats?: BaseWeaponStats;
  /** CDN URL for the item icon */
  iconUrl?: string;
  /** Fallback icon URL if primary fails (e.g., base type icon for Replica uniques) */
  fallbackIconUrl?: string;
}

/**
 * Base defense stats extracted from armor/shields/etc
 */
export interface BaseDefenseStats {
  armour?: number;
  evasion?: number;
  energyShield?: number;
  ward?: number;
  block?: number;
}

/**
 * Weapon stats computed by PoB (includes mod effects, quality, etc.)
 */
export interface BaseWeaponStats {
  physicalMin?: number;
  physicalMax?: number;
  physicalDPS?: number;
  elementalDPS?: number;
  chaosDPS?: number;
  totalDPS?: number;
  critChance?: number;
  attackRate?: number;
  range?: number;
  fireMin?: number; fireMax?: number;
  coldMin?: number; coldMax?: number;
  lightningMin?: number; lightningMax?: number;
  chaosMin?: number; chaosMax?: number;
}

/**
 * Cluster jewel node data from PoB API
 *
 * These nodes are dynamically generated by cluster jewels and have
 * positions calculated by PoB's tree rendering engine.
 */
export interface ClusterNodeData {
  /** Node ID (cluster nodes are >= 65536) */
  id: number;
  /** Node display name (from cluster jewel notables or generic "Small Passive") */
  name: string;
  /** Node type classification */
  type: 'Normal' | 'Notable' | 'Socket' | 'Keystone' | 'Mastery';
  /** Stat lines provided by this node */
  stats: string[];
  /** Icon identifier (if applicable) */
  icon?: string;
  /** X position in PoB tree coordinates */
  x: number;
  /** Y position in PoB tree coordinates */
  y: number;
  /** Orbit number (0 = center, 1-4 = outer rings) */
  orbit: number;
  /** Position within the orbit (0-11 typically) */
  orbitIndex: number;
  /** Whether this node is currently allocated */
  isAllocated: boolean;
  /** Parent socket node ID this cluster is attached to (tree socket or nested cluster socket) */
  socketNodeId?: number;
  /** Cluster size for this node's subgraph */
  clusterSize?: 'Large' | 'Medium' | 'Small';
  /** Center X of the cluster subgraph group in tree coordinates */
  groupX?: number;
  /** Center Y of the cluster subgraph group in tree coordinates */
  groupY?: number;
  /** Node IDs directly linked to this node in the real PoB cluster graph */
  links?: number[];
  /** Synthetic subgraph identifier used internally by PoB */
  subgraphId?: number;
}

export interface BuildVisualizationResponse {
  items: Array<{
    slot: string;
    id: number;
    name: string;
    baseName: string;
    type: string;
    rarity: string;
    raw: string;
    active?: boolean;
    /** Jewel radius label from PoB (e.g., Large, Variable) */
    jewelRadiusLabel?: string;
    /** Jewel radius index from PoB data.jewelRadius */
    jewelRadiusIndex?: number;
    /** Structured mod data parsed from raw text */
    mods?: StructuredMods;
    /** Display information (name, base, influences, etc.) */
    displayInfo?: ItemDisplayInfo;
    /** Base defense stats (armour, evasion, ES, ward, block) */
    baseStats?: BaseDefenseStats;
    /** Socket configuration from PoB */
    sockets?: Array<{ color: string; group: number }>;
    /** Maximum number of linked sockets (true link count) */
    maxLinks?: number;
    /** Attribute and level requirements from PoB */
    requirements?: {
      level?: number;
      str?: number;
      dex?: number;
      int?: number;
    };
  }>;
  skills: {
    mainSocketGroup: number;
    groups: Array<{
      index: number;
      label?: string;
      slot?: string;
      /** Source descriptor for item/node-granted groups (undefined for normal socketed groups) */
      source?: string;
      enabled: boolean;
      includeInFullDPS: boolean;
      mainActiveSkill: number;
      skills: string[];
      gemList?: Array<{
        index: number;
        nameSpec?: string;
        level?: number;
        quality?: number;
        qualityId?: string;
        enabled: boolean;
        isSupport: boolean;
        // Gem display fields
        gemColor?: 'red' | 'green' | 'blue' | 'white';
        isVaal?: boolean;
        isAwakened?: boolean;
        qualityType?: 'standard' | 'anomalous' | 'divergent' | 'phantasmal';
        /** Primary skill type from PoB (aura, herald, guard, warcry, movement, etc.) */
        skillType?: string;
        damageType?: string;
        /** Full gem tags from PoB (e.g., { aura: true, spell: true, fire: true }) */
        tags?: Record<string, boolean>;
        /** Human-readable tag string from PoB (e.g., "Spell, AoE, Fire, Duration") */
        tagString?: string;
        /** True if this gem has a secondary support effect (e.g., Autoexertion) */
        hasSecondarySupport?: boolean;
        /** Name of the secondary support effect (e.g., "Autoexertion Support") */
        secondarySupportName?: string;
        /** Icon URL from PoE Wiki */
        iconUrl?: string;
        // Tooltip data from RePoE
        /** Gem description text */
        description?: string | null;
        /** Level-specific stat lines (in-game tooltip text) */
        statText?: string[];
        /** Mana cost at current level */
        manaCost?: number | null;
        /** Mana reservation % (for auras) */
        manaReservation?: number | null;
        /** Life reservation % (for blood magic auras) */
        lifeReservation?: number | null;
        /** Attribute requirements */
        requirements?: {
          level?: number | null;
          str?: number | null;
          dex?: number | null;
          int?: number | null;
        };
        /** Gem tags (Spell, Attack, Fire, etc.) */
        gemTags?: string[];
        /** Cost multiplier % for support gems */
        costMultiplier?: number | null;
        /** Damage effectiveness % */
        damageEffectiveness?: number | null;
      }>;
    }>;
  };
  tree: {
    treeVersion: string;
    classId: number;
    ascendClassId: number;
    nodes: number[];
    /** Map of mastery node ID to selected effect ID */
    masterySelections?: Record<number, number>;
    /** Resolved mastery data with names and stat descriptions */
    resolvedMasteries?: Array<{ name: string; stats: string[] }>;
    keystones: string[];
    keystonesWithStats?: Array<{
      name: string;
      stats: string[];
    }>;
    notables: string[];
    allNotables: string[];  // All notables without 15 limit
    allNotablesWithStats?: Array<{
      name: string;
      stats: string[];
    }>;
    nodeOverrides?: Record<number, {
      name: string;
      stats: string[];
      icon?: string;
      activeEffectImage?: string;
      reminderText?: string[];
    }>;
    /** Per-socket timeless jewel data: which nodes each timeless jewel transforms */
    timelessBySocket?: Record<number, {
      jewelName: string;
      conquerorLine?: string;
      transformedNodes: Array<{
        id: number;
        name: string;
        stats: string[];
        originalName?: string;
      }>;
    }>;
    ascendancyNodesWithStats?: Array<{
      name: string;
      stats: string[];
    }>;
    /** Tree nodes granted via annoints on items */
    anoints?: Array<{
      name: string;
      slot: string;
      stats?: string[];
      nodeId?: number;
    }>;
    metadata: {             // Tree metadata
      className: string;
      ascendancyName: string;
      bloodlineName: string | null;
      totalNodes: number;
      keystoneCount: number;
      notableCount: number;
    };
    treeStats?: {           // Aggregated stats from passive tree
      lifeInc: number;
      esInc: number;
      armourInc: number;
      evasionInc: number;
      blockBase: number;
      spellSuppressBase: number;
      strBase: number;
      dexBase: number;
      intBase: number;
      damageInc: number;
      critChanceInc: number;
      critMultiBase: number;
      dotMultiBase: number;
      attackSpeedInc: number;
      castSpeedInc: number;
    };
    /** Cluster jewel nodes with PoB-calculated positions */
    clusterNodes?: ClusterNodeData[];
    /** Small passive nodes transformed by runecrafts, tattoos, or timeless jewels */
    transformedSmallNodes?: Array<{
      id: number;
      name: string;
      stats: string[];
      transformationType: 'runecraft' | 'tattoo' | 'timeless';
      originalName?: string;
    }>;
  };
  stats: {
    // Offensive stats
    dps: number;
    critChance: number;
    critMultiplier: number;
    speed: number;
    // Offensive - skill details (new)
    activeSkillName: string | null;
    hitDps: number;
    totalDotDps: number;
    // Ailment DPS breakdown
    bleedDps?: number;
    igniteDps?: number;
    poisonDps?: number;
    // Aggregated DPS fields (from backend)
    totalBuildDps: number;
    minionDps: number;
    isMinionBuild: boolean;
    skillDpsBreakdown: Array<{
      name: string;
      combinedDps: number;
      hitDps: number;
      dotDps: number;
      /** Army-DPS decomposition: combinedDps = perMinionDps * armyCount. */
      perMinionDps?: number;
      armyCount?: number;
      armyCapKey?: string;
    }>;
    dpsContext: {
      enemyType: string;
      description: string;
    };
    // Defensive stats
    life: number;
    energyShield: number;
    armour: number;
    evasion: number;
    blockChance: number;
    spellBlockChance: number;
    spellSuppressionChance: number;
    physicalDamageReduction: number;
    // Resistances (capped values from PoB)
    fireResist: number;
    coldResist: number;
    lightningResist: number;
    chaosResist: number;
    // Resistance overcap (amount above max resistance)
    fireResistOverCap: number;
    coldResistOverCap: number;
    lightningResistOverCap: number;
    chaosResistOverCap: number;
    // Effective HP
    ehp: number;
    // Per-element EHP (new)
    ehpFire: number;
    ehpCold: number;
    ehpLightning: number;
    ehpChaos: number;
    // Max Hit Taken (new)
    maxHitPhysical: number;
    maxHitFire: number;
    maxHitCold: number;
    maxHitLightning: number;
    maxHitChaos: number;
    // DPS against different enemy types (for comparison)
    /** DPS vs Normal Enemy (mapping) */
    dpsVsNormal?: number;
    /** DPS vs Pinnacle Boss */
    dpsVsPinnacle?: number;
    /** EHP vs Pinnacle Boss */
    ehpVsPinnacle?: number;
    // Sustain & Recovery
    lifeRegen?: number;
    lifeLeechGainRate?: number;
    totalMana?: number;
    manaUnreserved?: number;
    manaRegen?: number;
    energyShieldRegen?: number;
    energyShieldRechargeRate?: number;
    netLifeRegen?: number;
    netManaRegen?: number;
    // Mitigation extras
    evadeChance?: number;
    movementSpeedMod?: number;
    ward?: number;
    // Suppression effect (% damage prevented)
    spellSuppressionEffect?: number;
    // Recoup
    lifeRecoup?: number;
    energyShieldRecoup?: number;
    manaRecoup?: number;
    // Offense extras
    hitChance?: number;
    critChanceDisplay?: number;
    critMultiplierDisplay?: number;
    speedDisplay?: number;
    // Attributes (total from all sources)
    /** Total Strength */
    strength: number;
    /** Total Dexterity */
    dexterity: number;
    /** Total Intelligence */
    intelligence: number;
    // DPS Archetype Detection
    /** Detected damage archetype (poison, bleed, ignite, hit, etc.) */
    damageArchetype?: string;
    /** Human-readable DPS label (e.g., "Poison DPS", "Combined DPS") */
    dpsLabel?: string;
    /** Short suffix for compact display (e.g., "Poison", "Bleed", "") */
    dpsSuffix?: string;
  };
  /** PoB configuration settings (charges, buffs, conditions) */
  config?: {
    /** Active settings extracted from PoB config (e.g., "usePowerCharges", "enemyIsBoss:Pinnacle") */
    activeSettings: string[];
    /** Enemy level used for calculations */
    enemyLevel?: number;
    /** Bandit choice */
    bandit?: string;
    /** Pantheon selections */
    pantheon?: { major?: string; minor?: string };
  };
  /** Combat config recommendation detected from build profile */
  configRecommendation?: {
    reasoning: Array<{
      setting: string;
      value: boolean | number | string;
      reason: string;
      source: string;
    }>;
    warnings: string[];
    /** Structured ladder config gaps — configs common in meta builds that this build lacks */
    ladderConfigGaps?: Array<{
      label: string;
      key: string;
      usage: number;
      ladderCount: number;
      buildCount: number;
      reason: string;
      category?: string;
      pathway: 'skills' | 'gear' | 'tree';
      sourceSkill: string | null;
      hasSource: boolean;
      status: 'matched' | 'missing' | 'user_only';
    }>;
  };
  /** Config preflight measurement — DPS/EHP impact of each condition */
  configPreflight?: {
    hasSource: Array<{ label: string; category: string; configVar?: string; dpsPercent: number; ehpPercent: number; testValue?: number; sourceDescription?: string; provenance?: 'auto_detected' | 'pob_default' | 'agent_override' }>;
    alreadyActive: Array<{ label: string; category?: string; configVar?: string; sourceDescription?: string; provenance?: 'auto_detected' | 'pob_default' | 'agent_override' }>;
    highImpactAvailable: Array<{ label: string; category: string; dpsPercent: number; ehpPercent: number; testValue?: number; potentialSources?: string[] }>;
    configsTested: number;
    durationMs: number;
  };
  /** Attribute requirement analysis — per-attribute gap data */
  attributeRequirements?: {
    str: {
      current: number;
      required: number;
      surplus: number;
      sources: Array<{ name: string; slot: string; type: 'item' | 'gem'; requirement: number }>;
      gap: number;
      gapItem: string | null;
    };
    dex: {
      current: number;
      required: number;
      surplus: number;
      sources: Array<{ name: string; slot: string; type: 'item' | 'gem'; requirement: number }>;
      gap: number;
      gapItem: string | null;
    };
    int: {
      current: number;
      required: number;
      surplus: number;
      sources: Array<{ name: string; slot: string; type: 'item' | 'gem'; requirement: number }>;
      gap: number;
      gapItem: string | null;
    };
    /** Supreme Ostentation: all attribute requirements are ignored */
    ignoreAttrReq?: boolean;
  } | null;
}

/**
 * Flow step for the card-based improvement flow
 * Simplified to single value - inline card actions replace multi-page navigation (Spec 038)
 */
export type FlowStep = 'pathway-select';

/**
 * Single analysis session entry for history tracking.
 * Stores the analysis content, configuration used, and metadata.
 */
export interface AnalysisEntry {
  /** Unique identifier for this analysis */
  id: string;
  /** When the analysis was created */
  timestamp: number;
  /** Focus areas selected for this analysis (includes 'qa' if customPrompt was used) */
  focus: AnalysisFocus[];
  /** Custom prompt if provided */
  customPrompt: string;
  /** The raw analysis content (markdown) - combined across all pathways */
  content: string;
  /** Per-pathway content extracted from pathway-tagged message parts */
  pathwayContent?: Record<string, string>;
  /** Structured message parts (tool calls, reasoning) for rendering activity steps */
  parts?: import('../../../shared/types/Chat').MessagePart[];
  /** Display label for the tab (e.g., "Skills + Gear", "Full Analysis") */
  label: string;
}

/**
 * Analysis history state for session management.
 * Allows users to switch between multiple analysis sessions.
 */
export interface AnalysisHistoryState {
  /** Array of analysis entries (max 5) */
  entries: AnalysisEntry[];
  /** ID of the currently active/viewing analysis */
  activeEntryId: string | null;
}

/**
 * Parsed pathway card from initial analysis HTML
 * Note: Cards are displayed in fixed order (Gear -> Skills -> Tree) as sent by backend
 *
 * Supports two formats:
 * - Legacy format: strengths/weaknesses as HTML strings
 * - New format: structured actions array with prioritized items
 */
export interface ParsedPathwayCard {
  type: PathwayType;
  pillar: string;
  title: string;
  iconSvg: string;
  // Legacy format - kept for backwards compatibility during migration
  strengths?: string;
  weaknesses?: string;
  // New format: Structured action items
  actions: ActionItem[];
}

/**
 * Category-specific strengths and weaknesses for expanded assessment format
 */
export interface CategoryAssessment {
  strengths: string;
  weaknesses: string;
}

/**
 * Parsed general assessment from initial analysis HTML
 * Displayed before the 3 pathway cards
 *
 * Supports two formats:
 * - Legacy format: single strengths/weaknesses HTML strings
 * - Expanded format: buildOverview + per-category breakdowns
 */
export interface ParsedGeneralAssessment {
  title: string;       // "Build Assessment"
  strengths: string;   // HTML content for strengths (legacy format)
  weaknesses: string;  // HTML content for weaknesses (legacy format)
  // Expanded format fields (optional)
  buildOverview?: string;
  categories?: {
    offensive: CategoryAssessment;
    defensive: CategoryAssessment;
    utility: CategoryAssessment;
  };
}

/**
 * Per-pathway conversation histories
 */
export interface PathwayHistories {
  skills: ChatMessage[];
  tree: ChatMessage[];
  gear: ChatMessage[];
  unified: ChatMessage[];
  synthesis: ChatMessage[];
  progression: ChatMessage[];
}

/**
 * Build summary data from import
 */
export interface BuildSummary {
  buildId: string;
  characterName?: string;
  class: string;
  ascendancy: string;
  level: number;
  importedAt: string;
  pobCode?: string;
  /** Session-scoped consent for data collection, captured at import time. */
  sessionDataConsent?: boolean;
}

/**
 * Chat message
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  toolResults?: Array<{
    tool: string;
    result: Record<string, unknown>;
  }>;
  /** Rich message parts for inline tool call rendering (gear upgrade agent) */
  parts?: import('../../../shared/types/Chat').MessagePart[];
}

/**
 * Connection status for backend and trade API
 */
export interface ConnectionStatus {
  backend: 'connected' | 'disconnected' | 'checking';
  tradeApi: 'connected' | 'disconnected' | 'checking';
  lastChecked: number | null;
}

/**
 * Trade search state for tracking in-progress searches
 */
export type TradeSearchState = 'idle' | 'searching' | 'complete' | 'error';

/**
 * Trade search status for UI display
 */
export interface TradeSearchStatus {
  state: TradeSearchState;
  iteration?: number;
  maxIterations?: number;
  resultCount?: number | null;
  minPrice?: number;
  slot?: string;
  error?: string;
}

/**
 * Store state
 */
export interface DesktopStoreState {
  // UI Mode State (ChatPage redesign - Analysis-First Navigation)
  /** Active mode for the middle panel mode selector */
  activeUIMode: UIChatMode;
  /** Configuration for the Analyze mode */
  analysisConfig: AnalysisConfig;
  /** Optimization focus — biases analysis toward defensive or offensive improvements */
  optimizationFocus: OptimizationFocus;
  /** Context for chat mode when initiated from a pathway (skills/tree optimization) */
  pathwayContext: PathwayContext;
  /** Active pathway tab for multi-pathway analysis views (includes 'qa' for custom prompts) */
  activePathwayTab: AnalysisFocus;
  /** Analysis session history (max 5 entries) */
  analysisHistory: AnalysisHistoryState;

  // Build state
  currentBuild: BuildSummary | null;
  /** True while a restored session is re-importing the build into PoB in the background */
  isPobReimporting: boolean;

  // Atlas tree state
  /** GGG OAuth access token (session-only, not persisted to disk) */
  gggAccessToken: string | null;
  /** Atlas passive tree summary for sidebar display */
  atlasSummary: AtlasTreeSummary | null;
  /** Named atlas tree configurations */
  atlasNamedTrees: AtlasNamedTree[] | null;
  /** Atlas import ID for backend reference */
  atlasId: string | null;
  /** Atlas import error message (ephemeral, not persisted) */
  atlasError: string | null;

  // Pathway state (card-based UI)
  generalAssessment: ParsedGeneralAssessment | null;
  pathwayCards: ParsedPathwayCard[] | null;
  activePathway: PathwayType | 'unified' | 'progression' | null;
  pathwayHistories: PathwayHistories;

  // Connection status
  connectionStatus: ConnectionStatus;

  // UI state
  isInitialAnalysisComplete: boolean;

  // Session context (Two-Tier KB System)
  sessionKBModuleIds: string[];
  sessionStatSubset: string[];

  // Seer Context (LLM transparency data - persisted for Context drawer)
  seerContext: SeerContextData | null;

  // Trade search state
  tradeSearchStatus: TradeSearchStatus;

  // Improvement Flow State (Card-Based UX)
  currentImprovement: ImprovementCard | null;
  completedImprovements: string[];  // Array of improvement IDs (Set not JSON-serializable)

  // Build Tracker State
  buildTracker: BuildTracker | null;
  statsDelta: StatsDelta | null;

  // Flow Navigation
  flowStep: FlowStep;

  // Tree Simulation State (for tree-simulation flow step)
  treeSimulationResults: TreeSimulationResults | null;
  treeSimulationLoading: boolean;
  treeSimulationError: string | null;

  // Inline Card Expansion State (Spec 038)
  /** @deprecated Use cardStates instead for multi-card expansion support */
  expandedCard: ExpandedCardState;
  completedCards: Record<string, CompletedCardState>;

  // Multi-card expansion state with full persistence
  cardStates: Record<string, PersistedCardState>;

  // Recipe Progress State (Spec 040)
  recipeProgress: Record<string, RecipeProgress>;

  // Build Visualization State
  vizData: BuildVisualizationResponse | null;
  activeVizTab: VizTab;
  expandedSlots: string[];        // List of expanded equipment slot names
  expandedSkillSlots: string[];   // List of expanded skill slot names (for SkillsVizTab)

  // Visualization Loading Steps (SSE streaming progress)
  vizLoadingSteps: VizStepEvent[];
  vizStreamError: string | null;

  // Unified Tab State (synchronizes both panels)
  activeUnifiedTab: UnifiedTab;

  // Top Actions State (cross-pathway priority list)
  topActions: UnifiedActionItem[] | null;
  pathwayPriorityOrder: PathwayType[] | null;

  // Build Ratings State (overall + per-pathway scores)
  buildRatings: BuildRatings | null;

  // Gear Slot Ratings State (equipment health display)
  gearSlotRatings: GearSlotRatings | null;

  // Suggested Questions State (personalized from Build Analysis)
  suggestedQuestions: string[] | null;

  // Slot Hover State (for cross-panel highlighting)
  hoveredSlot: string | null;

  // Hover-Expanded Slot State (auto-expand on hover, separate from user-expanded)
  hoverExpandedSlot: string | null;

  // Item Paste State (Spec 043 - Trade Purchase Completion)
  itemPasteState: ItemPasteState;

  // Tree Diff Visualization (highlights added/removed nodes on tree)
  treeDiffNodes: { added: number[]; removed: number[] } | null;

  // Preview cluster subgraph (suggested cluster jewel not yet equipped).
  // Canvas merges this with vizData.tree.clusterNodes so the full cluster
  // "wheel" renders when a user clicks a TR pill for a cluster-jewel test.
  // Cleared on new analysis / session swap alongside treeDiffNodes.
  treePreviewClusterNodes: PreviewClusterNode[] | null;

  // Atlas Diff Visualization (highlights suggested next nodes on atlas tree)
  atlasDiffNodes: number[] | null;

  // Ladder Data State (on-demand ladder fetching)
  ladderStatus: LadderStatusResponse | null;
  ladderFetchProgress: LadderFetchProgressEvent | null;
  ladderStats: LadderStatsSummary | null;
  isLadderFetching: boolean;
  selectedLadderFetchSize: 10 | 20 | 30 | 50 | 100 | null;
  ladderFetchError: string | null;

  // Cross-Pathway Synthesis State
  /** Whether synthesis is unlocked (all 3 core pathways have results) */
  isSynthesisUnlocked: boolean;
  /** Whether synthesis analysis is currently running */
  isSynthesisRunning: boolean;
  /** Set of pathways that have completed analysis */
  completedPathways: PathwayType[];

  // Context Inspector State (dev-only LLM context transparency)
  /** Latest context debug snapshot from the most recent LLM call */
  contextDebugData: LLMContextDebugData | null;
  /** History of context debug snapshots (most recent first, max 20) */
  contextDebugHistory: LLMContextDebugData[];
  /** Per-LLM-call debug messages showing full input for each agent loop round-trip */
  llmCallDebugHistory: Array<{ callIndex: number; messages: Array<{ role: string; content: string }>; timestamp: number }>;
}

/**
 * Store actions
 */
export interface DesktopStoreActions {
  // UI Mode Actions (ChatPage redesign - Analysis-First Navigation)
  /** Set the active UI mode for the middle panel */
  setActiveUIMode: (mode: UIChatMode) => void;
  /** Update the analysis configuration (partial updates supported) */
  setAnalysisConfig: (config: Partial<AnalysisConfig>) => void;
  /** Set the optimization focus preference */
  setOptimizationFocus: (focus: OptimizationFocus) => void;
  /** Set the pathway context for chat mode (skills/tree optimization) */
  setPathwayContext: (context: PathwayContext) => void;
  /** Set the active pathway tab for analysis/improvements views (includes 'qa' for custom prompts) */
  setActivePathwayTab: (tab: AnalysisFocus) => void;

  // Analysis History Actions
  /** Add a new analysis entry to history, returns the new entry ID */
  addAnalysisEntry: (entry: Omit<AnalysisEntry, 'id' | 'timestamp'>) => string;
  /** Set the active analysis entry to view */
  setActiveAnalysisEntry: (id: string) => void;
  /** Remove an analysis entry from history */
  removeAnalysisEntry: (id: string) => void;
  /** Clear all analysis history */
  clearAnalysisHistory: () => void;
  /** Get the currently active analysis entry */
  getActiveAnalysisEntry: () => AnalysisEntry | null;

  // Build actions
  setBuild: (build: BuildSummary) => void;
  setIsPobReimporting: (reimporting: boolean) => void;
  clearBuild: () => void;
  setCurrentBuildPobCode: (pobCode: string | undefined) => void;

  // Atlas actions
  setGggAccessToken: (token: string | null) => void;
  setAtlasData: (data: { atlasId: string; summary: AtlasTreeSummary; namedTrees: AtlasNamedTree[] }) => void;
  setAtlasError: (error: string | null) => void;
  clearAtlasData: () => void;

  // Pathway actions
  setGeneralAssessment: (assessment: ParsedGeneralAssessment | null) => void;
  setPathwayCards: (cards: ParsedPathwayCard[] | null) => void;
  setActivePathway: (pathway: PathwayType | 'unified' | 'progression' | null) => void;
  addPathwayMessage: (pathway: PathwayType | 'synthesis' | 'unified' | 'progression', message: ChatMessage) => void;
  updateLastPathwayMessage: (pathway: PathwayType | 'synthesis' | 'unified' | 'progression', content: string) => void;
  updateLastPathwayMessageParts: (pathway: PathwayType | 'synthesis' | 'unified' | 'progression', parts: import('../../../shared/types/Chat').MessagePart[], content?: string) => void;
  clearPathwayHistories: () => void;
  clearPathwayHistory: (pathway: PathwayType | 'unified' | 'progression') => void;

  // Synthesis actions
  /** Mark a pathway as completed (triggers unlock check) */
  markPathwayCompleted: (pathway: PathwayType) => void;
  /** Set whether synthesis analysis is running */
  setSynthesisRunning: (running: boolean) => void;

  // Connection actions
  setBackendStatus: (status: 'connected' | 'disconnected' | 'checking') => void;
  setTradeApiStatus: (status: 'connected' | 'disconnected' | 'checking') => void;
  updateLastChecked: () => void;

  // UI actions
  setInitialAnalysisComplete: (complete: boolean) => void;

  // Session context actions (Two-Tier KB System)
  setSessionKBModuleIds: (moduleIds: string[]) => void;
  setSessionStatSubset: (stats: string[]) => void;
  setSeerContext: (context: SeerContextData | null) => void;

  // Trade search actions
  setTradeSearchState: (state: TradeSearchState) => void;
  updateTradeSearchStatus: (status: Partial<TradeSearchStatus>) => void;
  resetTradeSearchStatus: () => void;

  // Improvement Flow Actions
  selectImprovement: (improvement: ImprovementCard) => void;
  setCurrentImprovementOnly: (improvement: ImprovementCard | null) => void;
  completeImprovement: (improvementId: string) => void;
  clearCurrentImprovement: () => void;

  // Build Tracker Actions
  setBuildTracker: (tracker: BuildTracker) => void;
  updateStatsDelta: (delta: StatsDelta) => void;

  // Flow Navigation Actions
  setFlowStep: (step: FlowStep) => void;
  returnToPathwaySelect: () => void;

  // Tree Simulation Actions
  setTreeSimulationResults: (results: TreeSimulationResults | null) => void;
  setTreeSimulationLoading: (loading: boolean) => void;
  setTreeSimulationError: (error: string | null) => void;
  clearTreeSimulation: () => void;

  // Inline Card Expansion Actions (Spec 038)
  /** @deprecated Use updateCardState instead for multi-card support */
  setExpandedCard: (cardId: string, expansionType: CardExpansionType, pathway: 'skills' | 'tree' | 'gear') => void;
  /** @deprecated Use collapseCardById instead for multi-card support */
  collapseCard: () => void;
  markCardCompleted: (cardId: string, statsDelta?: { dpsPercent: number; ehpPercent: number }, metadata?: { pathway: 'skills' | 'tree' | 'gear'; title: string }) => void;
  isCardCompleted: (cardId: string) => boolean;
  getCompletedCardDelta: (cardId: string) => { dpsPercent: number; ehpPercent: number } | null;

  // Multi-Card Expansion Actions (replaces single-card model)
  /** Collapse a specific card by ID (only collapses when user explicitly requests) */
  collapseCardById: (cardId: string) => void;
  /** Update the full state for a card */
  updateCardState: (cardId: string, updates: Partial<PersistedCardState>) => void;
  /** Update tree-specific state for a card */
  updateCardTreeState: (cardId: string, updates: Partial<NonNullable<PersistedCardState['tree']>>) => void;
  /** Get the persisted state for a card */
  getCardState: (cardId: string) => PersistedCardState | undefined;
  /** Check if a specific card is expanded */
  isCardExpanded: (cardId: string) => boolean;
  /** Clear state for a specific card (on completion or reset) */
  clearCardState: (cardId: string) => void;
  /** Clear all card states (on build reset) */
  clearAllCardStates: () => void;

  // Recipe Progress Actions (Spec 040)
  setRecipeProgress: (improvementId: string, progress: RecipeProgress) => void;
  completeRecipeStep: (improvementId: string, stepId: string) => void;
  uncompleteRecipeStep: (improvementId: string, stepId: string) => void;
  selectRecipePath: (improvementId: string, pathId: string) => void;
  updateRecipeBudget: (improvementId: string, budget: { amount: number; currency: 'chaos' | 'divine' }) => void;
  clearRecipeProgress: (improvementId: string) => void;
  clearAllRecipeProgress: () => void;

  // Visualization Actions
  setVizData: (data: BuildVisualizationResponse | null) => void;
  setActiveVizTab: (tab: VizTab) => void;
  toggleSlotExpanded: (slot: string) => void;
  toggleSkillSlotExpanded: (slot: string) => void;
  clearVizData: () => void;

  // Visualization Loading Steps Actions
  appendVizStep: (step: VizStepEvent) => void;
  clearVizSteps: () => void;

  // Unified Tab Actions
  setActiveUnifiedTab: (tab: UnifiedTab) => void;

  // Top Actions Actions
  setTopActions: (actions: UnifiedActionItem[] | null) => void;
  setPathwayPriorityOrder: (order: PathwayType[] | null) => void;

  // Build Ratings Actions
  setBuildRatings: (ratings: BuildRatings | null) => void;

  // Gear Slot Ratings Actions
  setGearSlotRatings: (ratings: GearSlotRatings | null) => void;

  // Suggested Questions Actions (personalized from Build Analysis)
  setSuggestedQuestions: (questions: string[] | null) => void;

  // Slot Hover Actions (for cross-panel highlighting)
  setHoveredSlot: (slot: string | null) => void;

  // Hover-Expanded Slot Actions (auto-expand on hover)
  setHoverExpandedSlot: (slot: string | null) => void;

  // Item Paste Actions (Spec 043 - Trade Purchase Completion)
  setItemPasteState: (state: Partial<ItemPasteState>) => void;
  openPasteModal: (targetSlot: string) => void;
  closePasteModal: () => void;

  /** Set tree diff nodes for visualization (added=green, removed=red). Pass null to clear. */
  setTreeDiffNodes: (diff: { added: number[]; removed: number[] } | null) => void;
  setTreePreviewClusterNodes: (nodes: PreviewClusterNode[] | null) => void;

  /** Set atlas diff nodes for visualization (suggested next nodes = green). Pass null to clear. */
  setAtlasDiffNodes: (nodes: number[] | null) => void;

  // Ladder Data Actions (on-demand ladder fetching)
  setLadderStatus: (status: LadderStatusResponse | null) => void;
  setLadderFetchProgress: (progress: LadderFetchProgressEvent | null) => void;
  setLadderStats: (stats: LadderStatsSummary | null) => void;
  setIsLadderFetching: (fetching: boolean) => void;
  setSelectedLadderFetchSize: (size: 10 | 20 | 30 | 50 | 100 | null) => void;
  setLadderFetchError: (error: string | null) => void;
  resetLadderState: () => void;

  // Session Restoration (from analysis history snapshots)
  /** Restore full session state from a persisted analysis snapshot */
  restoreSession: (session: {
    focus: AnalysisFocus[];
    customPrompt: string;
    label: string;
    pathwayContent: Record<string, string>;
    completedPathways: PathwayType[];
    parts?: import('../../../shared/types/Chat').MessagePart[];
    pathwayHistories?: Partial<PathwayHistories>;
    vizData?: BuildVisualizationResponse | null;
    pathwayCards?: ParsedPathwayCard[] | null;
    generalAssessment?: ParsedGeneralAssessment | null;
    buildRatings?: BuildRatings | null;
    gearSlotRatings?: GearSlotRatings | null;
    seerContext?: SeerContextData | null;
    topActions?: UnifiedActionItem[] | null;
    pathwayPriorityOrder?: PathwayType[] | null;
    suggestedQuestions?: string[] | null;
    treeSimulationResults?: TreeSimulationResults | null;
    treeDiffNodes?: { added: number[]; removed: number[] } | null;
    tokenEntries?: import('../../../shared/types/TokenUsage').TokenUsageEntry[];
    tokenTotals?: import('../../../shared/types/TokenUsage').TokenUsageTotals;
    creditsUsed?: number;
  }) => void;

  // Context Inspector Actions (dev-only LLM context transparency)
  /** Set the latest context debug data and push to history */
  setContextDebugData: (data: LLMContextDebugData) => void;
  /** Clear all context debug data */
  clearContextDebugData: () => void;
  /** Append a per-LLM-call debug entry (agent loop round-trip messages) */
  appendLlmCallDebug: (entry: { callIndex: number; messages: Array<{ role: string; content: string }>; timestamp: number }) => void;
  /** Clear per-LLM-call debug history */
  clearLlmCallDebug: () => void;

  // Reset all state
  reset: () => void;
}

export type DesktopStore = DesktopStoreState & DesktopStoreActions;

export function normalizePathwayHistories(
  histories?: Partial<PathwayHistories> | null,
): PathwayHistories {
  return {
    skills: Array.isArray(histories?.skills) ? histories.skills : [],
    tree: Array.isArray(histories?.tree) ? histories.tree : [],
    gear: Array.isArray(histories?.gear) ? histories.gear : [],
    unified: Array.isArray(histories?.unified) ? histories.unified : [],
    synthesis: Array.isArray(histories?.synthesis) ? histories.synthesis : [],
    progression: Array.isArray(histories?.progression) ? histories.progression : [],
  };
}

function getExpandedSkillSlotsFromVizData(
  data: BuildVisualizationResponse | null
): string[] {
  if (!data) return [];
  const slots = new Set<string>();
  for (const group of data.skills.groups) {
    if (!group.enabled) continue;
    const slot = group.slot?.trim() || 'Unslotted';
    slots.add(slot);
  }
  return Array.from(slots);
}

// ============================================
// Initial State
// ============================================

const createInitialPathwayHistories = (): PathwayHistories => normalizePathwayHistories();

const initialAnalysisHistory: AnalysisHistoryState = {
  entries: [],
  activeEntryId: null,
};

const initialState: DesktopStoreState = {
  // UI Mode State (ChatPage redesign - Analysis-First Navigation)
  activeUIMode: 'analyze-config',
  analysisConfig: {
    focus: ['skills', 'gear', 'tree'],
    customPrompt: '',
  },
  optimizationFocus: 'balanced' as OptimizationFocus,
  pathwayContext: null,
  activePathwayTab: 'gear',
  analysisHistory: initialAnalysisHistory,

  currentBuild: null,
  isPobReimporting: false,
  gggAccessToken: null,
  atlasSummary: null,
  atlasNamedTrees: null,
  atlasId: null,
  atlasError: null,
  generalAssessment: null,
  pathwayCards: null,
  activePathway: null,
  pathwayHistories: createInitialPathwayHistories(),
  connectionStatus: {
    backend: 'checking',
    tradeApi: 'checking',
    lastChecked: null,
  },
  isInitialAnalysisComplete: false,
  sessionKBModuleIds: [],
  sessionStatSubset: [],
  seerContext: null,
  tradeSearchStatus: { state: 'idle' },
  // Improvement Flow State
  currentImprovement: null,
  completedImprovements: [],
  // Build Tracker State
  buildTracker: null,
  statsDelta: null,
  // Flow Navigation
  flowStep: 'pathway-select',
  // Tree Simulation State
  treeSimulationResults: null,
  treeSimulationLoading: false,
  treeSimulationError: null,
  // Inline Card Expansion State (Spec 038)
  expandedCard: {
    cardId: null,
    expansionType: 'collapsed',
    pathway: null,
  },
  completedCards: {},
  // Multi-card expansion state (persisted)
  cardStates: {},
  // Recipe Progress State (Spec 040)
  recipeProgress: {},
  // Build Visualization State
  vizData: null,
  activeVizTab: 'gear',
  expandedSlots: [],
  expandedSkillSlots: [],
  // Visualization Loading Steps
  vizLoadingSteps: [],
  vizStreamError: null,
  // Unified Tab State
  activeUnifiedTab: 'overview',
  // Top Actions State
  topActions: null,
  pathwayPriorityOrder: null,
  // Build Ratings State
  buildRatings: null,
  // Gear Slot Ratings State
  gearSlotRatings: null,
  // Suggested Questions State
  suggestedQuestions: null,
  // Slot Hover State
  hoveredSlot: null,
  // Hover-Expanded Slot State
  hoverExpandedSlot: null,
  // Item Paste State (Spec 043 - Trade Purchase Completion)
  itemPasteState: {
    isOpen: false,
    targetSlot: '',
    itemText: null,
    validation: null,
    preview: null,
  },
  // Tree Diff Visualization
  treeDiffNodes: null,
  treePreviewClusterNodes: null,
  // Atlas Diff Visualization
  atlasDiffNodes: null,
  // Ladder Data State
  ladderStatus: null,
  ladderFetchProgress: null,
  ladderStats: null,
  isLadderFetching: false,
  selectedLadderFetchSize: null,
  ladderFetchError: null,

  // Cross-Pathway Synthesis State
  isSynthesisUnlocked: false,
  isSynthesisRunning: false,
  completedPathways: [],

  // Context Inspector State (dev-only)
  contextDebugData: null,
  contextDebugHistory: [],
  llmCallDebugHistory: [],
};

// ============================================
// Store Implementation
// ============================================

/**
 * Desktop Zustand store with sessionStorage persistence
 */
export const useDesktopStore = create<DesktopStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      // UI Mode Actions (ChatPage redesign - Analysis-First Navigation)
      setActiveUIMode: (mode) => {
        set({ activeUIMode: mode });
      },

      setAnalysisConfig: (config) => {
        set((state) => ({
          analysisConfig: {
            ...state.analysisConfig,
            ...config,
          },
        }));
      },

      setOptimizationFocus: (focus) => {
        set({ optimizationFocus: focus });
      },

      setPathwayContext: (context) => {
        set({ pathwayContext: context });
      },

      setActivePathwayTab: (tab) => {
        set({ activePathwayTab: tab });
      },

      // Analysis History Actions
      addAnalysisEntry: (entry) => {
        const id = `analysis-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const newEntry: AnalysisEntry = {
          ...entry,
          id,
          timestamp: Date.now(),
        };

        set((state) => {
          // Limit to 5 entries (remove oldest if at limit)
          const entries = state.analysisHistory.entries.length >= 5
            ? [...state.analysisHistory.entries.slice(1), newEntry]
            : [...state.analysisHistory.entries, newEntry];

          return {
            analysisHistory: {
              entries,
              activeEntryId: id,
            },
          };
        });

        return id;
      },

      setActiveAnalysisEntry: (id) => {
        set((state) => ({
          analysisHistory: {
            ...state.analysisHistory,
            activeEntryId: id,
          },
        }));
      },

      removeAnalysisEntry: (id) => {
        set((state) => {
          const entries = state.analysisHistory.entries.filter((e) => e.id !== id);
          // If removing active entry, select the last remaining entry
          const activeEntryId = state.analysisHistory.activeEntryId === id
            ? (entries.length > 0 ? entries[entries.length - 1].id : null)
            : state.analysisHistory.activeEntryId;

          return {
            analysisHistory: { entries, activeEntryId },
          };
        });
      },

      clearAnalysisHistory: () => {
        set({ analysisHistory: initialAnalysisHistory });
      },

      getActiveAnalysisEntry: () => {
        const state = get();
        if (!state.analysisHistory.activeEntryId) return null;
        return state.analysisHistory.entries.find(
          (e) => e.id === state.analysisHistory.activeEntryId
        ) || null;
      },

      // Build actions
      setBuild: (build) => {
        // Clear token/cost ledger for new build session
        useTokenStore.getState().clearSession();
        set({
          // Reset UI mode to analyze-config for new build (Analysis-First Navigation)
          activeUIMode: 'analyze-config',
          pathwayContext: null,
          currentBuild: build,
          isPobReimporting: false,
          generalAssessment: null,
          pathwayCards: null,
          activePathway: null,
          pathwayHistories: createInitialPathwayHistories(),
          isInitialAnalysisComplete: false,
          // Reset improvement flow state for new build
          currentImprovement: null,
          completedImprovements: [],
          buildTracker: null,
          statsDelta: null,
          flowStep: 'pathway-select',
          // Reset visualization state for new build
          vizData: null,
          activeVizTab: 'gear',
          expandedSlots: [],
          expandedSkillSlots: [],
          // Reset unified tab state
          activeUnifiedTab: 'overview',
          // Reset top actions state
          topActions: null,
          pathwayPriorityOrder: null,
          // Reset build ratings state for new build
          buildRatings: null,
          // Reset gear slot ratings state for new build
          gearSlotRatings: null,
          // Reset suggested questions for new build
          suggestedQuestions: null,
          // Reset inline card expansion state (Spec 038)
          expandedCard: {
            cardId: null,
            expansionType: 'collapsed',
            pathway: null,
          },
          completedCards: {},
          // Reset multi-card expansion state
          cardStates: {},
          // Reset recipe progress state (Spec 040)
          recipeProgress: {},
          // Reset analysis history for new build
          analysisHistory: initialAnalysisHistory,
          // Reset ladder data state
          ladderStatus: null,
          ladderFetchProgress: null,
          ladderStats: null,
          isLadderFetching: false,
          selectedLadderFetchSize: null,
          ladderFetchError: null,
          // Reset synthesis state
          isSynthesisUnlocked: false,
          isSynthesisRunning: false,
          completedPathways: [],
          // Reset session-scoped analysis context for new build
          sessionKBModuleIds: [],
          sessionStatSubset: [],
          seerContext: null,
          // Reset trade search state for new build
          tradeSearchStatus: { state: 'idle' },
          // Reset tree simulation state for new build
          treeSimulationResults: null,
          treeSimulationLoading: false,
          treeSimulationError: null,
          // Reset visualization streaming state for new build
          vizLoadingSteps: [],
          vizStreamError: null,
          // Reset item paste state for new build
          itemPasteState: {
            isOpen: false,
            targetSlot: '',
            itemText: null,
            validation: null,
            preview: null,
          },
          // Reset tree diff visualization for new build
          treeDiffNodes: null,
          treePreviewClusterNodes: null,
          atlasDiffNodes: null,
          // Reset context debug state for new build (dev-only)
          contextDebugData: null,
          contextDebugHistory: [],
          llmCallDebugHistory: [],
        });
      },

      setIsPobReimporting: (reimporting) => {
        set({ isPobReimporting: reimporting });
      },

      clearBuild: () => {
        set({
          currentBuild: null,
          generalAssessment: null,
          pathwayCards: null,
          activePathway: null,
          pathwayHistories: createInitialPathwayHistories(),
          isInitialAnalysisComplete: false,
          // Reset improvement flow state
          currentImprovement: null,
          completedImprovements: [],
          buildTracker: null,
          statsDelta: null,
          flowStep: 'pathway-select',
          // Reset visualization state
          vizData: null,
          activeVizTab: 'gear',
          expandedSlots: [],
          expandedSkillSlots: [],
          // Reset unified tab state
          activeUnifiedTab: 'overview',
          // Reset top actions state
          topActions: null,
          pathwayPriorityOrder: null,
          // Reset build ratings state
          buildRatings: null,
          // Reset gear slot ratings state
          gearSlotRatings: null,
          // Reset suggested questions
          suggestedQuestions: null,
          // Reset inline card expansion state (Spec 038)
          expandedCard: {
            cardId: null,
            expansionType: 'collapsed',
            pathway: null,
          },
          completedCards: {},
          // Reset multi-card expansion state
          cardStates: {},
          // Reset recipe progress state (Spec 040)
          recipeProgress: {},
          // Reset analysis history
          analysisHistory: initialAnalysisHistory,
          // Reset ladder data state
          ladderStatus: null,
          ladderFetchProgress: null,
          ladderStats: null,
          isLadderFetching: false,
          selectedLadderFetchSize: null,
          ladderFetchError: null,
          // Reset synthesis state
          isSynthesisUnlocked: false,
          isSynthesisRunning: false,
          completedPathways: [],
          // Reset session-scoped analysis context
          sessionKBModuleIds: [],
          sessionStatSubset: [],
          seerContext: null,
          // Reset trade search state
          tradeSearchStatus: { state: 'idle' },
          // Reset tree simulation state
          treeSimulationResults: null,
          treeSimulationLoading: false,
          treeSimulationError: null,
          // Reset visualization streaming state
          vizLoadingSteps: [],
          vizStreamError: null,
          // Reset item paste state
          itemPasteState: {
            isOpen: false,
            targetSlot: '',
            itemText: null,
            validation: null,
            preview: null,
          },
          // Reset tree diff visualization
          treeDiffNodes: null,
          // Reset context debug state (dev-only)
          contextDebugData: null,
          contextDebugHistory: [],
          llmCallDebugHistory: [],
        });
      },
      setCurrentBuildPobCode: (pobCode) => {
        set((state) => ({
          currentBuild: state.currentBuild
            ? { ...state.currentBuild, pobCode }
            : null,
        }));
      },

      // Atlas actions
      setGggAccessToken: (token) => {
        set({ gggAccessToken: token });
      },
      setAtlasData: ({ atlasId, summary, namedTrees }) => {
        set({ atlasId, atlasSummary: summary, atlasNamedTrees: namedTrees, atlasError: null });
      },
      setAtlasError: (error) => {
        set({ atlasError: error });
      },
      clearAtlasData: () => {
        set({ atlasId: null, atlasSummary: null, atlasNamedTrees: null, atlasError: null });
      },

      // Pathway actions
      setGeneralAssessment: (assessment) => {
        set({ generalAssessment: assessment });
      },

      setPathwayCards: (cards) => {
        set({ pathwayCards: cards });
      },

      setActivePathway: (pathway) => {
        set({ activePathway: pathway });
      },

      addPathwayMessage: (pathway, message) => {
        const histories = get().pathwayHistories;
        const currentHistory = histories[pathway];
        // Limit to 50 messages per pathway (FIFO)
        const newHistory =
          currentHistory.length >= 50
            ? [...currentHistory.slice(1), message]
            : [...currentHistory, message];
        set({
          pathwayHistories: {
            ...histories,
            [pathway]: newHistory,
          },
        });
      },

      updateLastPathwayMessage: (pathway, content) => {
        const histories = get().pathwayHistories;
        const currentHistory = histories[pathway];
        if (currentHistory.length === 0) return;

        const lastIndex = currentHistory.length - 1;
        const updatedHistory = [...currentHistory];
        updatedHistory[lastIndex] = {
          ...updatedHistory[lastIndex],
          content,
        };
        set({
          pathwayHistories: {
            ...histories,
            [pathway]: updatedHistory,
          },
        });
      },

      updateLastPathwayMessageParts: (pathway, parts, content) => {
        const histories = get().pathwayHistories;
        const currentHistory = histories[pathway];
        if (currentHistory.length === 0) return;

        const lastIndex = currentHistory.length - 1;
        const updatedHistory = [...currentHistory];
        updatedHistory[lastIndex] = {
          ...updatedHistory[lastIndex],
          parts,
          ...(content !== undefined && { content }),
        };
        set({
          pathwayHistories: {
            ...histories,
            [pathway]: updatedHistory,
          },
        });
      },

      clearPathwayHistories: () => {
        set({ pathwayHistories: createInitialPathwayHistories() });
      },

      clearPathwayHistory: (pathway) => {
        const histories = get().pathwayHistories;
        set({
          pathwayHistories: {
            ...histories,
            [pathway]: [],
          },
        });
      },

      // Synthesis actions
      markPathwayCompleted: (pathway) => {
        const current = get().completedPathways;
        if (current.includes(pathway)) return;
        const updated = [...current, pathway];
        const allThree = ['skills', 'gear', 'tree'].every(p => updated.includes(p as PathwayType));
        set({
          completedPathways: updated,
          isSynthesisUnlocked: allThree,
        });
      },
      setSynthesisRunning: (running) => set({ isSynthesisRunning: running }),

      // Connection actions
      setBackendStatus: (status) => {
        set((state) => ({
          connectionStatus: {
            ...state.connectionStatus,
            backend: status,
          },
        }));
      },

      setTradeApiStatus: (status) => {
        set((state) => ({
          connectionStatus: {
            ...state.connectionStatus,
            tradeApi: status,
          },
        }));
      },

      updateLastChecked: () => {
        set((state) => ({
          connectionStatus: {
            ...state.connectionStatus,
            lastChecked: Date.now(),
          },
        }));
      },

      // UI actions
      setInitialAnalysisComplete: (complete) => {
        set({ isInitialAnalysisComplete: complete });
      },

      // Session context actions
      setSessionKBModuleIds: (moduleIds) => {
        set({ sessionKBModuleIds: moduleIds });
      },

      setSessionStatSubset: (stats) => {
        set({ sessionStatSubset: stats });
      },

      setSeerContext: (context) => {
        set({ seerContext: context });
      },

      // Trade search actions
      setTradeSearchState: (state) => {
        set((prev) => ({
          tradeSearchStatus: { ...prev.tradeSearchStatus, state },
        }));
      },

      updateTradeSearchStatus: (status) => {
        set((prev) => ({
          tradeSearchStatus: { ...prev.tradeSearchStatus, ...status },
        }));
      },

      resetTradeSearchStatus: () => {
        set({ tradeSearchStatus: { state: 'idle' } });
      },

      // Improvement Flow Actions
      selectImprovement: (improvement) => {
        // Simplified for inline card actions (Spec 038)
        // No longer changes flowStep - stays on 'pathway-select' with inline expansion
        set({
          currentImprovement: improvement,
        });
      },

      setCurrentImprovementOnly: (improvement) => {
        set({ currentImprovement: improvement });
      },

      completeImprovement: (improvementId) => {
        set((state) => {
          // Add to completed list if not already present
          const newCompleted = state.completedImprovements.includes(improvementId)
            ? state.completedImprovements
            : [...state.completedImprovements, improvementId];
          return {
            completedImprovements: newCompleted,
            currentImprovement: null,
            flowStep: 'pathway-select',
          };
        });
      },

      clearCurrentImprovement: () => {
        set({
          currentImprovement: null,
          flowStep: 'pathway-select',
        });
      },

      // Build Tracker Actions
      setBuildTracker: (tracker) => {
        set({ buildTracker: tracker });
      },

      updateStatsDelta: (delta) => {
        set({ statsDelta: delta });
      },

      // Flow Navigation Actions
      setFlowStep: (step) => {
        set({ flowStep: step });
      },

      returnToPathwaySelect: () => {
        set({
          currentImprovement: null,
          flowStep: 'pathway-select',
        });
      },

      // Tree Simulation Actions
      setTreeSimulationResults: (results) => {
        set({
          treeSimulationResults: results,
          treeSimulationLoading: false,
        });
      },

      setTreeSimulationLoading: (loading) => {
        set({ treeSimulationLoading: loading });
      },

      setTreeSimulationError: (error) => {
        set({
          treeSimulationError: error,
          treeSimulationLoading: false,
        });
      },

      clearTreeSimulation: () => {
        set({
          treeSimulationResults: null,
          treeSimulationLoading: false,
          treeSimulationError: null,
        });
      },

      // Inline Card Expansion Actions (Spec 038)
      setExpandedCard: (cardId, expansionType, pathway) => {
        set({
          expandedCard: {
            cardId,
            expansionType,
            pathway,
          },
        });
      },

      collapseCard: () => {
        set({
          expandedCard: {
            cardId: null,
            expansionType: 'collapsed',
            pathway: null,
          },
        });
      },

      markCardCompleted: (cardId, statsDelta, metadata) => {
        set((state) => {
          const timestamp = Date.now();
          // Remove the card from cardStates when completed
          const { [cardId]: _, ...remainingCardStates } = state.cardStates;
          return {
            completedCards: {
              ...state.completedCards,
              [cardId]: {
                isCompleted: true,
                completedAt: timestamp,
                appliedStatsDelta: statsDelta,
              },
            },
            // Clear the card state when marking complete
            cardStates: remainingCardStates,
            // Also collapse the card when marking complete (legacy)
            expandedCard: {
              cardId: null,
              expansionType: 'collapsed',
              pathway: null,
            },
          };
        });
      },

      isCardCompleted: (cardId) => {
        return get().completedCards[cardId]?.isCompleted ?? false;
      },

      getCompletedCardDelta: (cardId) => {
        return get().completedCards[cardId]?.appliedStatsDelta ?? null;
      },

      // Multi-Card Expansion Actions
      collapseCardById: (cardId) => {
        set((state) => {
          const existing = state.cardStates[cardId];
          if (!existing) return state;
          return {
            cardStates: {
              ...state.cardStates,
              [cardId]: {
                ...existing,
                isExpanded: false,
                lastUpdated: Date.now(),
              },
            },
            // Also update legacy expandedCard if this was the expanded card
            expandedCard: state.expandedCard.cardId === cardId
              ? { cardId: null, expansionType: 'collapsed', pathway: null }
              : state.expandedCard,
          };
        });
      },

      updateCardState: (cardId, updates) => {
        set((state) => {
          const existing = state.cardStates[cardId] ?? {
            isExpanded: false,
            expansionType: 'collapsed' as const,
            pathway: 'gear' as const,
          };
          return {
            cardStates: {
              ...state.cardStates,
              [cardId]: {
                ...existing,
                ...updates,
                lastUpdated: Date.now(),
              } as PersistedCardState,
            },
          };
        });
      },

      updateCardTreeState: (cardId, updates) => {
        set((state) => {
          const existing = state.cardStates[cardId];
          return {
            cardStates: {
              ...state.cardStates,
              [cardId]: {
                ...existing,
                tree: {
                  ...existing?.tree,
                  ...updates,
                },
                lastUpdated: Date.now(),
              } as PersistedCardState,
            },
          };
        });
      },

      getCardState: (cardId) => {
        return get().cardStates[cardId];
      },

      isCardExpanded: (cardId) => {
        return get().cardStates[cardId]?.isExpanded ?? false;
      },

      clearCardState: (cardId) => {
        set((state) => {
          const { [cardId]: _, ...rest } = state.cardStates;
          return {
            cardStates: rest,
            // Also update legacy expandedCard if this was the expanded card
            expandedCard: state.expandedCard.cardId === cardId
              ? { cardId: null, expansionType: 'collapsed', pathway: null }
              : state.expandedCard,
          };
        });
      },

      clearAllCardStates: () => {
        set({
          cardStates: {},
          expandedCard: { cardId: null, expansionType: 'collapsed', pathway: null },
        });
      },

      // Recipe Progress Actions (Spec 040)
      setRecipeProgress: (improvementId, progress) => {
        set((state) => ({
          recipeProgress: {
            ...state.recipeProgress,
            [improvementId]: progress,
          },
        }));
      },

      completeRecipeStep: (improvementId, stepId) => {
        set((state) => {
          const existing = state.recipeProgress[improvementId];
          if (!existing) return state;
          // Use Set to prevent duplicates and ensure idempotent operation
          const stepSet = new Set(existing.completedStepIds);
          if (stepSet.has(stepId)) return state; // Already completed, no-op
          stepSet.add(stepId);
          return {
            recipeProgress: {
              ...state.recipeProgress,
              [improvementId]: {
                ...existing,
                completedStepIds: Array.from(stepSet),
                lastUpdated: Date.now(),
              },
            },
          };
        });
      },

      uncompleteRecipeStep: (improvementId, stepId) => {
        set((state) => {
          const existing = state.recipeProgress[improvementId];
          if (!existing) return state;
          // Use Set for deduplication
          const stepSet = new Set(existing.completedStepIds);
          if (!stepSet.has(stepId)) return state; // Already uncompleted, no-op
          stepSet.delete(stepId);
          return {
            recipeProgress: {
              ...state.recipeProgress,
              [improvementId]: {
                ...existing,
                completedStepIds: Array.from(stepSet),
                lastUpdated: Date.now(),
              },
            },
          };
        });
      },

      selectRecipePath: (improvementId, pathId) => {
        set((state) => {
          return {
            recipeProgress: {
              ...state.recipeProgress,
              [improvementId]: {
                improvementId,
                selectedPathId: pathId,
                completedStepIds: [],  // Reset steps when changing path
                isExpanded: true,
                lastUpdated: Date.now(),
              },
            },
          };
        });
      },

      updateRecipeBudget: (improvementId, budget) => {
        set((state) => {
          const existing = state.recipeProgress[improvementId];
          if (!existing) {
            console.warn(`[Store] updateRecipeBudget called for non-existent improvementId: ${improvementId}, initializing`);
          }
          return {
            recipeProgress: {
              ...state.recipeProgress,
              [improvementId]: {
                ...existing,
                improvementId,
                selectedPathId: existing?.selectedPathId ?? null,
                completedStepIds: existing?.completedStepIds ?? [],
                isExpanded: existing?.isExpanded ?? false,
                budget,
                lastUpdated: Date.now(),
              },
            },
          };
        });
      },

      clearRecipeProgress: (improvementId) => {
        set((state) => {
          const { [improvementId]: _, ...rest } = state.recipeProgress;
          return { recipeProgress: rest };
        });
      },

      clearAllRecipeProgress: () => {
        set({ recipeProgress: {} });
      },

      // Visualization Actions
      setVizData: (data) => {
        set({
          vizData: data,
          expandedSkillSlots: getExpandedSkillSlotsFromVizData(data),
        });
      },

      setActiveVizTab: (tab) => {
        set({ activeVizTab: tab });
      },

      toggleSlotExpanded: (slot) => {
        set((state) => {
          const isExpanded = state.expandedSlots.includes(slot);
          return {
            expandedSlots: isExpanded
              ? state.expandedSlots.filter((s) => s !== slot)
              : [...state.expandedSlots, slot],
          };
        });
      },

      toggleSkillSlotExpanded: (slot) => {
        set((state) => {
          const isExpanded = state.expandedSkillSlots.includes(slot);
          return {
            expandedSkillSlots: isExpanded
              ? state.expandedSkillSlots.filter((s) => s !== slot)
              : [...state.expandedSkillSlots, slot],
          };
        });
      },

      clearVizData: () => {
        set({
          vizData: null,
          activeVizTab: 'gear',
          expandedSlots: [],
          expandedSkillSlots: [],
        });
      },

      // Visualization Loading Steps Actions
      appendVizStep: (step) => {
        set((state) => {
          // Replace any existing event for the same step name, then append new
          const filtered = state.vizLoadingSteps.filter((s) => s.step !== step.step);
          return {
            vizLoadingSteps: [...filtered, step],
            vizStreamError: step.status === 'error' ? (step.error ?? 'Unknown error') : state.vizStreamError,
          };
        });
      },

      clearVizSteps: () => {
        set({ vizLoadingSteps: [], vizStreamError: null });
      },

      // Unified Tab Actions
      setActiveUnifiedTab: (tab) => {
        set({ activeUnifiedTab: tab });
      },

      // Top Actions Actions
      setTopActions: (actions) => {
        set({ topActions: actions });
      },

      setPathwayPriorityOrder: (order) => {
        set({ pathwayPriorityOrder: order });
      },

      // Build Ratings Actions
      setBuildRatings: (ratings) => {
        set({ buildRatings: ratings });
      },

      // Gear Slot Ratings Actions
      setGearSlotRatings: (ratings) => {
        set({ gearSlotRatings: ratings });
      },

      // Suggested Questions Actions
      setSuggestedQuestions: (questions) => {
        set({ suggestedQuestions: questions });
      },

      // Slot Hover Actions
      setHoveredSlot: (slot) => {
        set({ hoveredSlot: slot });
      },

      // Hover-Expanded Slot Actions
      setHoverExpandedSlot: (slot) => {
        set({ hoverExpandedSlot: slot });
      },

      // Item Paste Actions (Spec 043 - Trade Purchase Completion)
      setItemPasteState: (updates) => set((state) => ({
        itemPasteState: { ...state.itemPasteState, ...updates }
      })),

      openPasteModal: (targetSlot) => set({
        itemPasteState: {
          isOpen: true,
          targetSlot,
          itemText: null,
          validation: null,
          preview: null,
        }
      }),

      closePasteModal: () => set((state) => ({
        itemPasteState: {
          ...state.itemPasteState,
          isOpen: false,
          itemText: null,
          validation: null,
          preview: null,
        }
      })),

      // Tree Diff Visualization
      setTreeDiffNodes: (diff) => set({ treeDiffNodes: diff }),
      setTreePreviewClusterNodes: (nodes) => set({ treePreviewClusterNodes: nodes }),

      // Atlas Diff Visualization
      setAtlasDiffNodes: (nodes) => set({ atlasDiffNodes: nodes }),

      // Ladder Data Actions
      setLadderStatus: (status) => set({ ladderStatus: status }),
      setLadderFetchProgress: (progress) => set({ ladderFetchProgress: progress }),
      setLadderStats: (stats) => set({ ladderStats: stats }),
      setIsLadderFetching: (fetching) => set({ isLadderFetching: fetching }),
      setSelectedLadderFetchSize: (size) => set({ selectedLadderFetchSize: size }),
      setLadderFetchError: (error) => set({ ladderFetchError: error }),
      resetLadderState: () => set({
        ladderStatus: null,
        ladderFetchProgress: null,
        ladderStats: null,
        isLadderFetching: false,
        selectedLadderFetchSize: null,
        ladderFetchError: null,
      }),

      // Session Restoration (from analysis history snapshots)
      restoreSession: (session) => {
        // Create an analysis entry in the in-session history
        const entryId = `restored-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const entry: AnalysisEntry = {
          id: entryId,
          timestamp: Date.now(),
          focus: session.focus,
          customPrompt: session.customPrompt,
          content: Object.values(session.pathwayContent).join('\n\n'),
          pathwayContent: session.pathwayContent,
          parts: session.parts,
          label: session.label,
        };

        // Rebuild pathway histories from snapshot
        const restoredHistories = createInitialPathwayHistories();

        if (session.pathwayHistories) {
          // Full chat histories available — use directly
          for (const [pw, messages] of Object.entries(session.pathwayHistories)) {
            if (pw in restoredHistories && Array.isArray(messages)) {
              restoredHistories[pw as keyof PathwayHistories] = messages;
            }
          }
        } else {
          // No chat histories — seed from pathway content (markdown only)
          for (const [pw, content] of Object.entries(session.pathwayContent)) {
            if (pw in restoredHistories && content) {
              restoredHistories[pw as keyof PathwayHistories] = [{
                id: `restored-${pw}-${Date.now()}`,
                role: 'assistant' as const,
                content,
                timestamp: Date.now(),
              }];
            }
          }
        }

        // Determine active tab
        const tabPriority = ['qa', 'unified', 'gear', 'skills', 'tree'] as const;
        const firstTab = tabPriority.find(p => session.focus.includes(p)) ?? 'gear';

        // Determine synthesis unlock
        const allThree = ['skills', 'gear', 'tree'].every(
          p => session.completedPathways.includes(p as PathwayType)
        );

        set({
          // Analysis state
          activeUIMode: 'analyze-results',
          analysisHistory: { entries: [entry], activeEntryId: entryId },
          analysisConfig: {
            focus: session.focus.filter(f => f !== 'qa') as AnalysisFocus[],
            customPrompt: session.customPrompt,
          },
          activePathwayTab: firstTab,
          activePathway: firstTab === 'unified'
            ? 'unified'
            : firstTab !== 'qa'
              ? firstTab as PathwayType
              : null,
          isInitialAnalysisComplete: true,
          completedPathways: session.completedPathways,
          isSynthesisUnlocked: allThree,

          // Pathway content
          pathwayHistories: restoredHistories,

          // Visualization & ratings
          vizData: session.vizData ?? null,
          pathwayCards: session.pathwayCards ?? null,
          generalAssessment: session.generalAssessment ?? null,
          buildRatings: session.buildRatings ?? null,
          gearSlotRatings: session.gearSlotRatings ?? null,
          seerContext: session.seerContext ?? null,
          topActions: session.topActions ?? null,
          pathwayPriorityOrder: session.pathwayPriorityOrder ?? null,

          // Additional session state
          suggestedQuestions: session.suggestedQuestions ?? null,
          treeSimulationResults: session.treeSimulationResults ?? null,
          treeDiffNodes: session.treeDiffNodes ?? null,

          // Reset transient state
          completedImprovements: [],
          cardStates: {},
          completedCards: {},
          recipeProgress: {},
          tradeSearchStatus: { state: 'idle' },
          treeSimulationLoading: false,
          treeSimulationError: null,
          vizLoadingSteps: [],
          vizStreamError: null,
          itemPasteState: {
            isOpen: false,
            targetSlot: '',
            itemText: null,
            validation: null,
            preview: null,
          },
          currentImprovement: null,
          buildTracker: null,
          statsDelta: null,
          flowStep: 'pathway-select',
        });

        // Restore token/credit data into token store so Oracle's Ledger shows session costs
        if (session.tokenEntries && session.tokenEntries.length > 0) {
          const tokenStore = useTokenStore.getState();
          tokenStore.clearSession();
          // Re-add entries via setState which sets totals atomically
          useTokenStore.setState({
            entries: session.tokenEntries,
            totals: session.tokenTotals ?? { inputTokens: 0, outputTokens: 0, cachedTokens: 0, totalTokens: 0, costUsd: 0, savingsUsd: 0 },
            creditsUsedSession: session.creditsUsed ?? 0,
          });
        }
      },


      // Context Inspector Actions (dev-only)
      setContextDebugData: (data) => {
        set((state) => {
          const history = [data, ...state.contextDebugHistory].slice(0, 20);
          return { contextDebugData: data, contextDebugHistory: history };
        });
      },

      clearContextDebugData: () => {
        set({ contextDebugData: null, contextDebugHistory: [], llmCallDebugHistory: [] });
      },

      appendLlmCallDebug: (entry) => {
        set((state) => ({
          llmCallDebugHistory: [...state.llmCallDebugHistory, entry].slice(-50),
        }));
      },

      clearLlmCallDebug: () => {
        set({ llmCallDebugHistory: [] });
      },

      // Reset
      reset: () => {
        set(initialState);
      },
    }),
    {
      name: 'poa-desktop-store',
      version: 7, // v7: Normalize pathway histories for unified-mode persisted state
      storage: createJSONStorage(() => ({
        getItem: (name: string) => sessionStorage.getItem(name),
        setItem: (name: string, value: string) => {
          try {
            sessionStorage.setItem(name, value);
          } catch {
            // QuotaExceededError — prune heavy debug fields and retry
            try {
              const parsed = JSON.parse(value);
              if (parsed?.state) {
                delete parsed.state.contextDebugData;
                delete parsed.state.contextDebugHistory;
                delete parsed.state.llmCallDebugHistory;
                delete parsed.state.seerContext;
              }
              sessionStorage.setItem(name, JSON.stringify(parsed));
            } catch {
              // Still too large — clear and give up gracefully
              sessionStorage.removeItem(name);
            }
          }
        },
        removeItem: (name: string) => sessionStorage.removeItem(name),
      })),

      // Migration function to fix old cached data
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as Partial<DesktopStore>;

        if (version < 2) {
          // v1 -> v2: Add cardStates for multi-card expansion persistence
          state.cardStates = {};
        }

        if (version < 4) {
          // v3 -> v4: Remove optimizationSessions (dead code cleanup)
          // Delete the field from persisted state so it doesn't linger
          delete (state as Record<string, unknown>).optimizationSessions;
        }

        if (version < 5) {
          // v4 -> v5: gearBudget migration (budget feature removed, clean up persisted field)
          delete (state as Record<string, unknown>).gearBudget;
        }

        if (version < 6) {
          // v5 -> v6: Remove depth/personality from analysisConfig (features removed)
          const config = (state as Record<string, unknown>).analysisConfig as Record<string, unknown> | undefined;
          if (config) {
            delete config.depth;
            delete config.personality;
          }
        }

        if (version < 7) {
          state.pathwayHistories = normalizePathwayHistories(state.pathwayHistories);
        }

        return state as DesktopStore;
      },

      merge: (persistedState, currentState) => {
        const state = persistedState as Partial<DesktopStoreState>;
        return {
          ...currentState,
          ...state,
          pathwayHistories: normalizePathwayHistories(state.pathwayHistories),
        };
      },

      partialize: (state) => ({
        // Only persist these fields
        // UI Mode State (ChatPage redesign Phase 3a)
        activeUIMode: state.activeUIMode,
        analysisConfig: state.analysisConfig,
        optimizationFocus: state.optimizationFocus,
        activePathwayTab: state.activePathwayTab,
        analysisHistory: state.analysisHistory,
        currentBuild: state.currentBuild,
        generalAssessment: state.generalAssessment,
        pathwayCards: state.pathwayCards,
        activePathway: state.activePathway,
        pathwayHistories: state.pathwayHistories,
        isInitialAnalysisComplete: state.isInitialAnalysisComplete,
        sessionKBModuleIds: state.sessionKBModuleIds,
        sessionStatSubset: state.sessionStatSubset,
        // Seer Context (persisted for Context drawer to work after refresh)
        seerContext: state.seerContext,
        // Improvement Flow State (persisted for session continuity)
        completedImprovements: state.completedImprovements,
        flowStep: state.flowStep,
        buildTracker: state.buildTracker,
        statsDelta: state.statsDelta,
        // Note: currentImprovement not persisted (transient selection state)
        // Build Visualization State (persisted for session continuity)
        vizData: state.vizData,
        activeVizTab: state.activeVizTab,
        // Unified Tab State (persisted for session continuity)
        activeUnifiedTab: state.activeUnifiedTab,
        // Top Actions State (persisted for session continuity)
        topActions: state.topActions,
        pathwayPriorityOrder: state.pathwayPriorityOrder,
        // Build Ratings State (persisted for session continuity)
        buildRatings: state.buildRatings,
        gearSlotRatings: state.gearSlotRatings,
        // Inline Card Completion State (persisted for session continuity) - Spec 038
        completedCards: state.completedCards,
        // Multi-card expansion state (persisted for session continuity)
        cardStates: state.cardStates,
        // Recipe Progress State (Spec 040 - persisted for session continuity)
        recipeProgress: state.recipeProgress,
        // Ladder Data State (persisted for session continuity)
        ladderStatus: state.ladderStatus,
        ladderStats: state.ladderStats,
        // Note: expandedSlots/expandedSkillSlots/expandedCard not persisted (transient UI state)
        // Note: ladderFetchProgress/isLadderFetching/selectedLadderFetchSize not persisted (transient fetch state)
        // Synthesis state (persisted for session continuity)
        isSynthesisUnlocked: state.isSynthesisUnlocked,
        completedPathways: state.completedPathways,
        // Note: isSynthesisRunning not persisted (transient state)
        // Atlas Tree State (persisted for session continuity)
        // Note: gggAccessToken NOT persisted (session-only OAuth token)
        atlasSummary: state.atlasSummary,
        atlasNamedTrees: state.atlasNamedTrees,
        atlasId: state.atlasId,
        // Context Inspector / Grimoire (persisted for context transparency after restart)
        contextDebugData: state.contextDebugData,
        contextDebugHistory: state.contextDebugHistory,
        llmCallDebugHistory: state.llmCallDebugHistory,
      }),
    }
  )
);

export default useDesktopStore;
