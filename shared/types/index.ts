/**
 * Shared Types Export Index
 * Central export point for all shared type definitions
 *
 * The system now uses raw PoB API data for builds (chat-centric architecture).
 * These types support the remaining services:
 * - Knowledge Base (KB) system
 * - Chat/LLM system
 * - Item comparison
 * - Price lookup
 */

// Knowledge Base types (Spec 013, 014)
export * from './KnowledgeModule';

// Chat/LLM types (Spec 013)
export * from './Chat.js';
export * from './ConversationSummary';
export * from './LLMContextPacket';
export * from './StructuredBuildData';

// Build analysis types (some vestigial - for backward compatibility)
export * from './BuildAnalysis';
export * from './StatSnapshot';
export * from './UpgradeResponse';
export type { UpgradeRecommendation as UpgradeRecommendationLegacy } from './UpgradeResponse';
export * from './DefensiveStats';
export * from './MainSkill';
export * from './GemInstance';
export * from './ClusterJewel';
export * from './Weakness';
// Upgrade theme: extended type available via direct import; avoid name clash with BuildAnalysis export
export type { UpgradeTheme as UpgradeThemeUI } from './UpgradeTheme';
export type { UpgradeRecommendation as UpgradeRecommendationUI, StatDeltaSet, PackageClassification } from './UpgradeRecommendation';
export type { UpgradePackage as UpgradePackageUI } from './UpgradePackage';
export type { UnifiedUpgradeRecommendation, UnifiedUpgradeResponse, ExecutionMetadata, UpgradeThemeName } from './UnifiedUpgradeRecommendation';

// Item comparison types (Spec 009)
export * from './ItemComparison';

// Trade search types (Spec 021 refinement)
export * from './SearchProfile';

// Price types (used by poe-ninja integration)
export * from './PriceSnapshot';

// Hybrid Trade Search types (Spec 023)
export * from './HybridTradeSearch';

// Affix-First Trade Search types (Spec 027)
export * from './AffixSearch';

// Weighted Trade Search types
export * from './WeightedSearch';

// Trade Search Instruction types (Desktop execution - Spec 037)
export * from './TradeSearchInstruction';

// Build summary types used by frontend UI
export * from './OffensiveStats';

// Pathway types for Guided Pathway UI (Spec 037 - Phase 2)
export * from './pathway';
export * from './build-modification';

// Improvement types for Card-Based Flow UI
export * from './improvements';

// Candidate types for Parallel Improvement Validation
export * from './candidates';

// Synthesis types for Overview Panel (SynthesisV3 ratings)
export * from './synthesis';
export * from './gear-trade';

// Item visualization types for gear display
export * from './ItemVisualization';

// Gear quality rating types for equipment assessment
export * from './GearQuality';

// Tree safety validation types for respec protection
export * from './tree-safety';

// Tree location types for node guidance UX
export * from './tree-location';

// Enhanced crafting types for crafting UX
export * from './crafting';

// Recipe types for Universal Action Recipe System (Spec 040)
export * from './recipe';

// Token usage tracking types for cost transparency
export * from './TokenUsage';

// Suggested action types for inline chat actions
export * from './SuggestedAction';

// Theorycraft types for build optimization (Spec 042)
// Re-export selectively to avoid name collisions with AffixSearch and build-modification
export type {
  OptimizationChangeType,
  OptimizationChange,
  OptimizationOption,
  ValidationResult as TheoryCraftValidationResult,
  BuildStats,
  StatDeltas,
  ChangeVerdict,
  IterationRecord,
  AppliedChange as TheoryCraftAppliedChange,
  IterationState as TheoryCraftIterationState,
  OptimizationConfig,
  OptimizationSummary,
  // Parallel theorycraft types
  ParallelTheorycraftConfig,
  ParallelScoringConfig,
  ParallelAgentResult,
  ParallelComparison,
} from './theorycraft';

export { DEFAULT_PARALLEL_CONFIG } from './theorycraft';

// Trade comparison types for item comparison
// Re-export selectively to avoid StatDelta conflict with improvements.ts
export type {
  CuratedStats,
  CuratedStatDeltas,
  StatChangeEntry,
  ResistanceStatus,
  AttributeRequirementStatus,
  SkillDpsData,
  ComparisonSummary,
  ComparisonVerdict,
  CuratedStatComparison,
  ComparisonMeta,
  TradeComparisonRequest,
  TradeComparisonResult,
  // Rename to avoid conflict with StatDelta from improvements.ts
  StatDelta as TradeStatDelta,
} from './TradeComparison';
// Re-export constants separately
export {
  KEY_STAT_NAMES,
  CURATED_STAT_COUNT,
  DEFAULT_MAX_COMPARISON_ITEMS,
  COMPARISON_TIME_BUDGET_MS,
  RESISTANCE_CAP,
} from './TradeComparison';

// Unique item types for unique item service
export * from './UniqueItem';

// Leveling Assistant types (Campaign progression guide)
export * from './leveling';

// Build Theorycrafting types (Spec 042)
// Re-export selectively to avoid SkillSetup conflict with StructuredBuildData
export type {
  ClassName,
  Ascendancy,
  ContentTag,
  BudgetTier,
  Difficulty,
  BuildLifecycle,
  Archetype,
  ConceptType,
  BuildConcept,
  TheoryCraftedBuild,
  // Rename SkillSetup to avoid conflict with StructuredBuildData.SkillSetup
  SkillSetup as TheoryCraftedSkillSetup,
  TreeConfig,
  GearPlan,
  GearSlot,
  SlotRecommendation,
  BenchmarkStats,
  ProgressionGuide,
  LevelingGuide,
  ActGuide,
  TreeSnapshots,
  TreeSnapshot,
  GearProgression,
  GearTier,
  TierSlotRecommendation,
  ContentMilestone,
  ContentBenchmark,
  AntiPatternRule,
  BuildLibraryIndex,
  BuildIndexEntry,
  BuildFilters,
  FilteredBuildResult,
  WizardStep,
  BuildDesignerState,
  AscendancySelection,
  ValidationResult,
  UserBuildStorage,
  UserSavedBuild,
  // Build Ideas (User Story 4)
  BuildIdea,
  BuildIdeaCategory,
  BuildIdeasResponse,
} from './builds';
export { CONTENT_BENCHMARKS } from './builds';

// Meta reasoning types for pre-generated ladder analysis
export * from './MetaReasoning';

// Atlas passive tree types (atlas strategy feature)
export * from './atlas';
