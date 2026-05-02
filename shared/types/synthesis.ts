/**
 * Synthesis Types for Overview Panel
 *
 * Type definitions for the ratings-focused build overview (SynthesisV3).
 * Used by the Overview panel redesign to display numeric 0-10 ratings
 * instead of the previous strengths/weaknesses format.
 */

import type { PathwayType } from './pathway';

/**
 * Numeric rating on a 0-10 scale
 */
export interface NumericRating {
  /** Score from 0-10, where 10 is optimal */
  score: number;
  /** Optional one-line label providing context (e.g., "Solid foundation") */
  label?: string;
}

/**
 * Per-pathway ratings for Skills, Tree, and Gear
 */
export interface PathwayRatings {
  skills: NumericRating;
  tree: NumericRating;
  gear: NumericRating;
}

/**
 * Category assessment with 0-10 score
 */
export interface CategoryAssessment {
  /** Score from 0-10 */
  score: number;
  /** Optional context label (e.g., "Capped resistances") */
  label?: string;
}

/**
 * Category assessments for Overview panel
 * Hybrid approach: algorithmic base scores adjusted by LLM
 */
export interface CategoryAssessments {
  offensive: CategoryAssessment;
  defensive: CategoryAssessment;
  utility: CategoryAssessment;
  bossKilling: CategoryAssessment;
  mapping: CategoryAssessment;
}

/**
 * Primary damage type of the build (for badge display)
 * Note: Named BuildDamageType to avoid conflict with DamageProfile.DamageType
 */
export type BuildDamageType = 'Physical' | 'Fire' | 'Cold' | 'Lightning' | 'Chaos' | 'Mixed';

/**
 * Defense style of the build
 */
export type DefenseStyle =
  | 'Life'
  | 'ES'
  | 'Hybrid'
  | 'Low-Life'
  | 'CI'
  | 'Armor-Stacking'
  | 'Evasion-Stacking'
  | 'ES-Stacking';

/**
 * Playstyle hint derived from boss/mapping balance
 */
export type Playstyle = 'Boss Killer' | 'Mapper' | 'All-rounder';

/**
 * Archetype tag - how damage is delivered (for badge display)
 * Named ArchetypeTag to avoid conflict with BuildArchetype interface in BuildAnalysis.ts
 */
export type ArchetypeTag =
  | 'melee'      // Close-range weapon attacks (Strike, Slam, Cyclone)
  | 'ranged'     // Bow/projectile attacks from distance
  | 'caster'     // Self-cast spells with cast time or channeling
  | 'minion'     // Summoned creatures deal damage
  | 'dot'        // Damage over time is PRIMARY damage source
  | 'totem'      // Totems/Ballistas cast or attack for you
  | 'trap-mine'  // Pre-placed traps or mines that trigger on enemies
  | 'trigger';   // Automated spell casting (CoC, CwC, Spellslinger)

/**
 * Build complexity - mechanical difficulty
 */
export type Complexity = 'Beginner' | 'Intermediate' | 'Advanced';

/**
 * Build identity for visual badge display
 */
export interface BuildIdentity {
  /** Archetype - how damage is delivered */
  archetype: ArchetypeTag;
  /** Primary damage type */
  damageType: BuildDamageType;
  /** Defense style */
  defenseStyle: DefenseStyle;
  /** Derived playstyle */
  playstyle: Playstyle;
  /** Mechanical complexity */
  complexity: Complexity;
  /** Ascendancy name for icon display */
  ascendancy?: string;
}

/**
 * Cross-pathway notes identifying synergies, conflicts, and bottlenecks
 */
export interface CrossPathwayNotes {
  /** Where pathways reinforce each other (e.g., "Tree crit nodes align with crit support gems") */
  synergies?: string[];
  /** Where pathways contradict (e.g., "RT with crit supports") */
  conflicts?: string[];
  /** Single fixes that would unlock improvements across multiple pathways */
  bottlenecks?: string[];
}

/**
 * Build mechanics explanation for "How This Build Works" section
 */
export interface BuildMechanics {
  /** Prose explanation of how the build works (2-4 sentences) */
  explanation: string;
  /** Key synergies between tree/skills/gear */
  synergies: string[];
  /** Critical misalignments - ONLY if they genuinely exist */
  misalignments?: string[];
  /** Unused potential - significant improvements the build isn't using */
  unusedPotential?: string[];
}

/**
 * Build ratings containing overall and per-pathway scores
 */
export interface BuildRatings {
  overall: NumericRating;
  pathways: PathwayRatings;
  /** Category assessments (offensive, defensive, etc.) */
  categories?: CategoryAssessments;
  /** Build identity for badge display */
  identity?: BuildIdentity;
  /** Build mechanics explanation for "How This Build Works" section */
  buildMechanics?: BuildMechanics;
  /** Cross-pathway analysis notes (synergies, conflicts, bottlenecks) */
  crossPathwayNotes?: CrossPathwayNotes;
}

/**
 * SynthesisV3 - Ratings-focused build overview
 * Replaces V2's strengths/weaknesses with numeric 0-10 ratings
 */
export interface SynthesisV3 {
  formatVersion: 3;
  /** 1-2 sentence build summary */
  buildSummary: string;
  /** Overall build score (0-10) */
  overallRating: NumericRating;
  /** Per-pathway ratings */
  pathwayRatings: PathwayRatings;
  /** Pathway priority order (highest priority first) */
  pathwayPriorities: PathwayType[];
  /** Suggested follow-up questions about this build */
  suggestedQuestions?: string[];
  /** League-specific questions */
  leagueQuestions?: string[];
  /** Category assessments (offensive, defensive, etc.) */
  categoryAssessments?: CategoryAssessments;
  /** Build identity for badge display */
  buildIdentity?: BuildIdentity;
  /** Cross-pathway analysis notes (synergies, conflicts, bottlenecks) */
  crossPathwayNotes?: CrossPathwayNotes;
  /** Build mechanics explanation for "How This Build Works" section */
  buildMechanics?: BuildMechanics;
}
