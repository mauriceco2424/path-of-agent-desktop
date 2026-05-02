/**
 * Build Theorycrafting Types
 *
 * Core type definitions for the build theorycrafting system.
 * Supports both curated builds (stored as JSON) and user-created builds (stored in browser storage).
 *
 * @module shared/types/builds
 */

// =============================================================================
// Ascendancy & Class
// =============================================================================

export type ClassName =
  | 'Marauder'
  | 'Ranger'
  | 'Witch'
  | 'Duelist'
  | 'Templar'
  | 'Shadow'
  | 'Scion';

export type Ascendancy =
  // Marauder
  | 'Juggernaut'
  | 'Berserker'
  | 'Chieftain'
  // Ranger
  | 'Deadeye'
  | 'Warden'
  | 'Pathfinder'
  // Witch
  | 'Necromancer'
  | 'Elementalist'
  | 'Occultist'
  // Duelist
  | 'Slayer'
  | 'Gladiator'
  | 'Champion'
  // Templar
  | 'Inquisitor'
  | 'Hierophant'
  | 'Guardian'
  // Shadow
  | 'Assassin'
  | 'Trickster'
  | 'Saboteur'
  // Scion
  | 'Ascendant'
  | 'Reliquarian';

// =============================================================================
// Build Tags & Categories
// =============================================================================

export type ContentTag =
  | 'league-starter' // Viable with minimal gear
  | 'boss-killer' // Optimized for single-target
  | 'mapper' // Optimized for clear speed
  | 'all-rounder' // Balanced approach
  | 'budget' // Low investment required
  | 'endgame' // High investment, pinnacle content
  | 'experimental'; // Novel/unproven

export type BudgetTier =
  | 'starter' // 0c (acts 1-10, self-found)
  | 'entry-maps' // 10-50c
  | 'mapping' // 50c-2 Divine
  | 'investment' // 2-10 Divine
  | 'endgame'; // 10+ Divine

export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

export type BuildLifecycle = 'draft' | 'validated' | 'published';

// =============================================================================
// Archetype (from existing types)
// =============================================================================

export type Archetype =
  | 'attack-crit'
  | 'attack-bleed'
  | 'attack-impale'
  | 'attack-poison'
  | 'spell-crit'
  | 'spell-ignite'
  | 'spell-dot'
  | 'minion'
  | 'totem'
  | 'trap-mine'
  | 'aura-support'
  | 'rf-dot'
  | 'es-ci'
  | 'lowlife';

// =============================================================================
// User Input Concept
// =============================================================================

/**
 * User's starting point for build creation.
 * LLM parses free-form input to identify the concept type.
 */
export type ConceptType =
  | 'skill-first' // "I want to play Spark"
  | 'ascendancy-first' // "Assassin looks cool"
  | 'mechanic-first' // "I want poison DoT"
  | 'unique-first' // "Build around Mageblood"
  | 'budget-first' // "Cheap league starter"
  | 'content-first'; // "Farm Uber bosses"

export interface BuildConcept {
  /** Raw user input */
  rawInput: string;

  /** Detected concept type */
  type: ConceptType;

  /** Extracted key concept (e.g., "Spark", "Assassin", "poison") */
  primaryConcept: string;

  /** Additional constraints mentioned */
  constraints: {
    budget?: BudgetTier;
    content?: ContentTag[];
    difficulty?: Difficulty;
    avoidMechanics?: string[];
  };

  /** LLM's interpretation summary */
  interpretation: string;
}

// =============================================================================
// TheoryCraftedBuild - Main Entity
// =============================================================================

/**
 * Complete theorycrafted build with all components.
 * Used for both curated library builds and user-created builds.
 */
export interface TheoryCraftedBuild {
  // ===================
  // Identity
  // ===================

  /** Unique identifier */
  id: string;

  /** Display name (e.g., "Spark Assassin League Starter") */
  name: string;

  /** Build concept summary */
  concept: string;

  /** Class */
  className: ClassName;

  /** Ascendancy */
  ascendancy: Ascendancy;

  /** Main damage skill */
  mainSkill: string;

  /** Detected archetype */
  archetype: Archetype;

  // ===================
  // Tags & Metadata
  // ===================

  /** Content suitability tags */
  tags: ContentTag[];

  /** Target budget tier */
  budgetTier: BudgetTier;

  /** Recommended player experience level */
  difficulty: Difficulty;

  /** Lifecycle state (for curated builds) */
  lifecycle: BuildLifecycle;

  /** League version when created */
  leagueVersion: string;

  /** Creation timestamp */
  createdAt: number;

  /** Last validation timestamp */
  validatedAt: number;

  // ===================
  // Core Build Data
  // ===================

  /** Valid Path of Building import code */
  pobCode: string;

  /** Skill gem configuration */
  skillSetup: SkillSetup;

  /** Passive tree summary */
  treeConfig: TreeConfig;

  /** Gear recommendations */
  gearPlan: GearPlan;

  /** Validated benchmark stats */
  benchmarkStats: BenchmarkStats;

  // ===================
  // Progression Data
  // ===================

  /** Complete progression guide */
  progression: ProgressionGuide;
}

// =============================================================================
// Skill Setup
// =============================================================================

export interface SkillSetup {
  /** Main 6-link skill */
  mainSkill: {
    name: string;
    supports: string[]; // Ordered by priority
    slot: string;
  };

  /** Auras and reservations */
  auras: Array<{
    name: string;
    reservationType: 'life' | 'mana';
    reservationPercent: number;
  }>;

  /** Movement skill */
  movement: string;

  /** Movement skill setup with linked gems */
  movementSetup?: {
    gems: string[];
    notes?: string;
  };

  /** Guard skill */
  guard: string;

  /** Guard skill setup with linked gems (e.g., CWDT + Steelskin) */
  guardSetup?: {
    gems: string[];
    notes?: string;
  };

  /** Curses */
  curses: Array<{
    name: string;
    applicationMethod: 'self-cast' | 'trigger' | 'aura' | 'on-hit';
  }>;

  /** Other utility skills */
  utility: string[];
}

// =============================================================================
// Tree Configuration
// =============================================================================

export interface TreeConfig {
  /** Total points allocated at level 90 */
  totalPoints: number;

  /** Keystones taken */
  keystones: string[];

  /** Notable clusters (for summary) */
  notableClusters: string[];

  /** Life/ES allocation summary */
  defensiveAllocation: {
    lifePercent: number;
    esPercent: number;
    armourPercent: number;
    evasionPercent: number;
  };

  /** Ascendancy nodes taken (4) */
  ascendancyNodes: string[];

  /** Bandit choice */
  bandit: 'Alira' | 'Oak' | 'Kraityn' | 'Kill All';
}

// =============================================================================
// Gear Plan
// =============================================================================

export interface GearPlan {
  /** Per-slot gear recommendations */
  slots: Record<GearSlot, SlotRecommendation>;

  /** Required unique items */
  requiredUniques: string[];

  /** Recommended unique alternatives */
  optionalUniques: string[];
}

export type GearSlot =
  | 'weapon1'
  | 'weapon2'
  | 'helmet'
  | 'body'
  | 'gloves'
  | 'boots'
  | 'amulet'
  | 'ring1'
  | 'ring2'
  | 'belt'
  | 'flask1'
  | 'flask2'
  | 'flask3'
  | 'flask4'
  | 'flask5';

export interface SlotRecommendation {
  /** Slot name */
  slot: GearSlot;

  /** Priority mods to look for */
  priorityMods: string[];

  /** Estimated budget per tier */
  budgetEstimates: Record<BudgetTier, string>;

  /** Unique item alternative (if any) */
  uniqueAlternative?: string;
}

// =============================================================================
// Benchmark Stats
// =============================================================================

export interface BenchmarkStats {
  /** From PoB get_full_calcs */
  dps: number;
  totalEhp: number;
  life: number;
  energyShield: number;

  /** Resistances */
  resistances: {
    fire: number;
    cold: number;
    lightning: number;
    chaos: number;
  };

  /** Content viability flags */
  contentViability: {
    whiteMaps: boolean; // 100k DPS, 15k EHP
    yellowMaps: boolean; // 500k DPS, 25k EHP
    redMaps: boolean; // 1M DPS, 40k EHP
    pinnacle: boolean; // 5M DPS, 60k EHP
    uber: boolean; // 20M DPS, 100k EHP
  };

  /** Anti-pattern warnings */
  warnings: string[];
}

// =============================================================================
// Progression Guide
// =============================================================================

export interface ProgressionGuide {
  /** Leveling guide (acts 1-10) */
  levelingGuide: LevelingGuide;

  /** Passive tree at level milestones */
  treeSnapshots: TreeSnapshots;

  /** Gear recommendations per budget tier */
  gearProgression: GearProgression;

  /** Content milestones with expected stats */
  milestones: ContentMilestone[];

  /** PoB-validated milestones with SSF/Trade gear (optional) */
  validatedMilestones?: BuildMilestones;
}

// =============================================================================
// Leveling Guide
// =============================================================================

export interface LevelingGuide {
  acts: ActGuide[];
  /** Skill gem progression at key level milestones */
  skillProgression?: LevelSkillSetup[];
}

export interface ActGuide {
  act: number;
  levelRange: string; // e.g., "1-12"

  /** Skill to use during this act */
  activeSkill: string;

  /** When to switch skills (if applicable) */
  skillTransition?: {
    atLevel: number;
    fromSkill: string;
    toSkill: string;
    reason: string;
  };

  /** Support gem priority order */
  supportPriority: string[];

  /** Lab info (if applicable) */
  lab?: {
    difficulty: 'Normal' | 'Cruel' | 'Merciless' | 'Eternal';
    ascendancyNode: string;
  };

  /** Key gear milestones */
  gearMilestones: string[];

  /** Tips for this act */
  tips: string[];

  // === Maxroll-quality additions ===

  /** Socket requirements for this act (e.g., "3B-1G" for 3 blue 1 green) */
  socketRequirements?: SocketRequirement;

  /** Gems that become available in this act */
  gemAcquisitions?: GemAcquisition[];

  /** Vendor regex for searching good leveling items */
  vendorRegex?: string;
}

/**
 * Socket requirement specification for a link setup
 */
export interface SocketRequirement {
  /** Main hand setup (e.g., "3B" for 3 blue) */
  mainHand?: string;
  /** Body armor setup (e.g., "4B-1G-1R") */
  body?: string;
  /** Secondary setup (gloves/boots/helmet) */
  secondary?: string;
  /** Notes about socket coloring */
  notes?: string;
}

/**
 * Information about when a gem becomes available
 */
export interface GemAcquisition {
  /** Gem name */
  gem: string;
  /** How to get it: quest reward, vendor, or drop */
  source: 'quest' | 'vendor' | 'drop' | 'library';
  /** Quest or location name */
  questOrLocation: string;
  /** Required level to use */
  requiredLevel: number;
  /** Whether this is a key gem for the build */
  isKeyGem: boolean;
}

// =============================================================================
// Skill Gem Progression (Level-based skill setup timeline)
// =============================================================================

/**
 * A single skill group at a specific level milestone.
 * Represents a set of linked gems (main skill + supports).
 */
export interface SkillGroupAtLevel {
  /** Main/active skill gem name */
  mainSkill: string;
  /** Support gems linked to the main skill */
  supports: string[];
  /** Socket colors as a string (e.g., "B-B-B-G" for 3 blue, 1 green linked) */
  socketColors: string;
  /** True if this is the primary damage setup */
  isMainSetup: boolean;
  /** Gem color of the main skill (for visual display) */
  mainSkillColor?: 'red' | 'green' | 'blue' | 'white';
}

/**
 * Complete skill setup at a specific character level.
 */
export interface LevelSkillSetup {
  /** Character level for this snapshot */
  level: number;
  /** All skill groups the player should have at this level */
  skillGroups: SkillGroupAtLevel[];
  /** Optional note about what changed at this level */
  transitionNote?: string;
}

// =============================================================================
// Tree Snapshots
// =============================================================================

export interface TreeSnapshots {
  /** PoB-encoded tree at level 16 (first notables reachable) */
  level16?: TreeSnapshot;

  /** PoB-encoded tree at level 20 (early leveling, Act 2) */
  level20?: TreeSnapshot;

  /** PoB-encoded tree at level 33 (Normal Lab ready) */
  level33?: TreeSnapshot;

  /** PoB-encoded tree at level 35 (Normal Lab ready, alternate) */
  level35?: TreeSnapshot;

  /** PoB-encoded tree at level 40 (end of Act 4) */
  level40: TreeSnapshot;

  /** PoB-encoded tree at level 55 (Cruel Lab ready) */
  level55?: TreeSnapshot;

  /** PoB-encoded tree at level 60 (end of campaign) */
  level60: TreeSnapshot;

  /** PoB-encoded tree at level 68 (Merc Lab ready) */
  level68?: TreeSnapshot;

  /** PoB-encoded tree at level 70 (early maps) */
  level70?: TreeSnapshot;

  /** PoB-encoded tree at level 75 (Uber Lab / early mapping) */
  level75: TreeSnapshot;

  /** PoB-encoded tree at level 85 (mapping) */
  level85?: TreeSnapshot;

  /** PoB-encoded tree at level 90 (target endgame) */
  level90: TreeSnapshot;

  /** Tree variants for different playstyles */
  variants?: TreeVariants;
}

/**
 * Alternative tree paths for different playstyles
 */
export interface TreeVariants {
  /** Speed-focused variant prioritizing damage and clear */
  speed?: TreeVariant;
  /** Defense-focused variant for safer progression */
  safe?: TreeVariant;
  /** Boss-focused variant for single target */
  bossing?: TreeVariant;
}

/**
 * A tree variant with its own snapshots and notes
 */
export interface TreeVariant {
  /** Name of this variant */
  name: string;
  /** Description of when to use this variant */
  description: string;
  /** Key differences from the main tree */
  keyDifferences: string[];
  /** Tree snapshot at level 90 for this variant */
  level90: TreeSnapshot;
}

export interface TreeSnapshot {
  level: number;
  pointsAllocated: number;
  encodedTree: string; // PoB format or pathofexile.com URL

  /** Key nodes gained since last snapshot */
  keyNodesGained: string[];

  /** Expected stats at this level from PoB validation */
  expectedStats: {
    life: number;
    energyShield: number;
    evasion: number;
    armour: number;
    dps: number;
    /** Optional additional stats */
    critChance?: number;
    critMulti?: number;
    powerCharges?: number;
  };

  /** Ascendancy points allocated at this level (0, 2, 4, 6, 8) */
  ascendancyPoints?: number;

  /** Ascendancy nodes allocated at this level */
  ascendancyNodes?: string[];

  /** Notes about this tree milestone */
  notes?: string;
}

// =============================================================================
// Gear Progression
// =============================================================================

export interface GearProgression {
  tiers: Record<BudgetTier, GearTier>;
}

export interface GearTier {
  tier: BudgetTier;
  totalBudget: string; // e.g., "50c-2 Divine"

  /** Per-slot recommendations at this tier */
  slots: Record<GearSlot, TierSlotRecommendation>;

  /** Expected stats at this tier */
  expectedStats: {
    dps: number;
    life: number;
    ehp: number;
  };
}

export interface TierSlotRecommendation {
  slot: GearSlot;
  itemType: string;
  priorityMods: string[];
  estimatedCost: string;
  tradeSearchUrl?: string;
}

// =============================================================================
// Content Milestones
// =============================================================================

export interface ContentMilestone {
  name: string; // e.g., "Kitava Kill", "White Maps", "Pinnacle Bosses"
  levelRange: string;

  /** Expected stats at this milestone */
  expectedStats: {
    life: number;
    dps: number;
    ehp: number;
  };

  /** What to check if struggling */
  troubleshootingTips: string[];

  /** Next goal after this milestone */
  nextGoal: string;
}

// =============================================================================
// Content Benchmarks
// =============================================================================

export interface ContentBenchmark {
  contentTier: 'white-maps' | 'yellow-maps' | 'red-maps' | 'pinnacle' | 'uber';
  minDps: number;
  minEhp: number;
  minLife: number;
  requiredResistCap: number; // Usually 75
  notes: string;
}

export const CONTENT_BENCHMARKS: ContentBenchmark[] = [
  {
    contentTier: 'white-maps',
    minDps: 100000,
    minEhp: 15000,
    minLife: 3000,
    requiredResistCap: 75,
    notes: 'Comfortable mapping start',
  },
  {
    contentTier: 'yellow-maps',
    minDps: 500000,
    minEhp: 25000,
    minLife: 4000,
    requiredResistCap: 75,
    notes: 'T6-10 viable',
  },
  {
    contentTier: 'red-maps',
    minDps: 1000000,
    minEhp: 40000,
    minLife: 5000,
    requiredResistCap: 75,
    notes: 'T11-16 viable',
  },
  {
    contentTier: 'pinnacle',
    minDps: 5000000,
    minEhp: 60000,
    minLife: 5500,
    requiredResistCap: 75,
    notes: 'Maven, Sirus, etc.',
  },
  {
    contentTier: 'uber',
    minDps: 20000000,
    minEhp: 100000,
    minLife: 6000,
    requiredResistCap: 75,
    notes: 'Uber versions',
  },
];

// =============================================================================
// Anti-Pattern Rules
// =============================================================================

/**
 * Anti-pattern rule definition.
 * Note: The check function is not included here as it's not serializable.
 * Implement validation logic separately in validation services.
 */
export interface AntiPatternRule {
  id: string;
  name: string;
  description: string;
  severity: 'error' | 'warning';
}

// =============================================================================
// Build Library Index
// =============================================================================

export interface BuildLibraryIndex {
  version: string;
  generatedAt: number;
  buildCount: number;
  builds: BuildIndexEntry[];
}

export interface BuildIndexEntry {
  id: string;
  name: string;
  ascendancy: Ascendancy;
  mainSkill: string;
  tags: ContentTag[];
  budgetTier: BudgetTier;
  difficulty: Difficulty;
  dps: number;
  ehp: number;
  lifecycle: BuildLifecycle;
}

// =============================================================================
// Filter Types
// =============================================================================

export interface BuildFilters {
  ascendancy?: Ascendancy[];
  budgetTier?: BudgetTier[];
  tags?: ContentTag[];
  difficulty?: Difficulty[];
  mainSkill?: string;
  searchQuery?: string;
  minDps?: number;
  minEhp?: number;
}

export interface FilteredBuildResult {
  builds: BuildIndexEntry[];
  totalCount: number;
  appliedFilters: BuildFilters;
}

// =============================================================================
// Build Designer State
// =============================================================================

export type WizardStep = 1 | 2 | 3 | 4 | 5 | 6;

export interface BuildDesignerState {
  // Current step
  currentStep: WizardStep;

  // Step data
  concept: BuildConcept | null;
  ascendancySelection: AscendancySelection | null;
  skillSetup: SkillSetup | null;
  treeConfig: TreeConfig | null;
  gearPlan: GearPlan | null;
  validationResult: ValidationResult | null;

  // PoB integration
  pobCode: string | null;
  currentStats: BenchmarkStats | null;
  isValidating: boolean;

  // Auto-save
  lastSavedAt: number | null;
}

export interface AscendancySelection {
  selected: Ascendancy;
  recommendations: Array<{
    ascendancy: Ascendancy;
    score: number;
    pros: string[];
    cons: string[];
  }>;
}

export interface ValidationResult {
  isValid: boolean;
  benchmarks: BenchmarkStats;
  antiPatternWarnings: string[];
  suggestions: string[];
}

// =============================================================================
// User Build Storage (Browser)
// =============================================================================

export interface UserBuildStorage {
  version: string;
  builds: UserSavedBuild[];
  lastUpdated: number;
}

export interface UserSavedBuild {
  id: string;
  name: string;
  pobCode: string;
  createdAt: number;
  updatedAt: number;

  // Summary for list view
  ascendancy: Ascendancy;
  mainSkill: string;
  dps: number;
  ehp: number;

  // Optional full data (may be trimmed if storage is full)
  fullBuild?: TheoryCraftedBuild;
}

// =============================================================================
// Build Ideas (User Story 4 - Idea Browser)
// =============================================================================

/**
 * A single build idea for inspiring users during build creation.
 * Ideas represent concepts that can be explored (skills, classes, mechanics, etc.)
 */
export interface BuildIdea {
  /** Unique identifier for this idea */
  id: string;

  /** Display title (e.g., "Spark Build", "Assassin") */
  title: string;

  /** Short description of the idea */
  description: string;

  /** IDs of example curated builds that implement this idea */
  exampleBuilds: string[];
}

/**
 * Category of build ideas for organized browsing.
 */
export interface BuildIdeaCategory {
  /** Category identifier (skill, ascendancy, mechanic, budget, content) */
  name: 'skill' | 'ascendancy' | 'mechanic' | 'budget' | 'content';

  /** Display name for the category tab */
  displayName: string;

  /** Ideas within this category */
  ideas: BuildIdea[];
}

/**
 * Response structure for the build ideas endpoint.
 */
export interface BuildIdeasResponse {
  categories: BuildIdeaCategory[];
}

// =============================================================================
// Milestone System (PoB-Validated Progression)
// =============================================================================

/**
 * Gear item at a specific milestone level
 */
export interface LevelingGearItem {
  /** Equipment slot */
  slot: GearSlot;
  /** PoB-compatible item text */
  itemText: string;
  /** Base type name */
  baseType: string;
  /** Item rarity */
  rarity: 'normal' | 'magic' | 'rare' | 'unique';
  /** Level requirement to equip */
  levelRequirement: number;
  /** Mods on the item */
  mods: string[];
  /** Socket configuration (e.g., "B-B-B-B") */
  sockets?: string;
  /** Whether this is a leveling unique */
  isLevelingUnique?: boolean;
}

/**
 * Complete validated stats from PoB calculations
 */
export interface ValidatedStats {
  life: number;
  energyShield: number;
  combinedDps: number;
  ehp: number;
  resistances: {
    fire: number;
    cold: number;
    lightning: number;
    chaos: number;
  };
  attributes: {
    strength: number;
    dexterity: number;
    intelligence: number;
  };
}

/**
 * Skills at a milestone level
 */
export interface MilestoneSkills {
  /** Main damage skill name */
  mainSkill: string;
  /** Support gems for main skill */
  mainSupports: string[];
  /** Active auras */
  auras: string[];
  /** Movement skill */
  movement: string;
  /** Guard skill (if any) */
  guard?: string;
  /** Utility skills */
  utility: string[];
  /** Full gem link details */
  groups: SkillGroupAtLevel[];
}

/**
 * Gear set for a specific mode (SSF or Trade)
 */
export interface MilestoneGearSet {
  /** Gear mode */
  mode: 'ssf' | 'trade';
  /** Gear for each slot */
  gear: Record<GearSlot, LevelingGearItem>;
  /** PoB-validated stats */
  validatedStats: ValidatedStats;
  /** Importable PoB code */
  pobCode: string;
}

/**
 * Complete milestone with tree, skills, and gear for both modes
 */
export interface Milestone {
  /** Character level */
  level: number;

  /** Tree data (same for both gear modes) */
  tree: {
    /** Number of passive points allocated */
    pointsAllocated: number;
    /** Encoded tree URL (pathofexile.com format) */
    encodedTree: string;
    /** Key nodes gained at this milestone */
    keyNodesGained: string[];
    /** Ascendancy points allocated (0, 2, 4, 6, 8) */
    ascendancyPoints: number;
    /** Ascendancy nodes allocated */
    ascendancyNodes: string[];
  };

  /** Skills (same for both gear modes) */
  skills: MilestoneSkills;

  /** Gear varies by mode */
  gearSets: {
    ssf: MilestoneGearSet;
    trade: MilestoneGearSet;
  };

  /** Transition note explaining changes from previous milestone */
  transitionNote: string;
}

/**
 * All milestones for a build
 * - L12-L55: Leveling milestones
 * - L68-L90: Early-to-mid endgame progression
 * - L95: Accessible endgame (~50-100 div budget)
 * - L100: Fully maxed, ladder-aligned (unlimited budget)
 */
export interface BuildMilestones {
  level12: Milestone;
  level28: Milestone;
  level38: Milestone;
  level55: Milestone;
  level68: Milestone;
  level75: Milestone;
  level90: Milestone;
  level95: Milestone;
  level100: Milestone;
}

// =============================================================================
// Build Alternatives (Alternative Gear/Build Variations)
// =============================================================================

/**
 * A single gear/build change in an alternative
 */
export interface AlternativeChange {
  slot: string;
  fromItem: string;
  toItem: string;
}

/**
 * Trade-off summary for an alternative
 */
export interface AlternativeTradeOff {
  dpsDelta: number; // percentage change
  ehpDelta: number; // percentage change
  costDelta: string; // e.g., "-50c" or "+2 Divine"
}

/**
 * Detailed stat comparison for an alternative
 */
export interface AlternativeStatComparison {
  metric: string;
  current: number;
  alternative: number;
  assessment: 'better' | 'worse' | 'neutral';
  importance: 'critical' | 'important' | 'minor';
}

/**
 * A build alternative with trade-off reasoning
 */
export interface BuildAlternative {
  label: 'recommended' | 'budget' | 'defensive' | 'offensive';
  displayName: string;
  changes: AlternativeChange[];
  tradeOff: AlternativeTradeOff;
  statComparison: AlternativeStatComparison[];
  reasoning: string; // LLM-generated explanation
  useCase: string; // e.g., "Better for bossing", "Budget-friendly"
}

/**
 * Extended milestone data with alternatives
 */
export interface MilestoneWithAlternatives {
  level: number;
  alternatives?: BuildAlternative[];
}

// =============================================================================
// Guide Generation Types (from optimization pipeline)
// =============================================================================

/** Synergy between build components identified during optimization */
export interface GuideSynergy {
  items: string[];
  explanation: string;
  dpsImpact?: string;
  ehpImpact?: string;
}

/** Key decision made during build optimization */
export interface GuideDecision {
  decision: string;
  chosen: string;
  reasoning: string;
  ladderUsage?: number;
  alternative?: string;
}

/** Trade-off evaluated between two options */
export interface GuideTradeOff {
  slot: string;
  optionA: { name: string; dps: number; ehp: number };
  optionB: { name: string; dps: number; ehp: number };
  recommendation: string;
  reasoning: string;
}

/** Result from testing an exotic mechanic */
export interface ExoticTestResult {
  mechanic: string;
  adopted: boolean;
  dpsImpact: number;
  ehpImpact: number;
  reason: string;
}

/** How the build compares to the ladder meta */
export interface LadderContext {
  totalBuilds: number;
  ourDpsPercentile: number;
  ourEhpPercentile: number;
  adoptedPatterns: string[];
  rejectedPatterns: Array<{ pattern: string; reason: string }>;
}
