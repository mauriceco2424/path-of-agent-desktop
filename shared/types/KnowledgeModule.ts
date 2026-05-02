/**
 * KnowledgeModule - Metadata and content for Knowledge Base modules
 *
 * This type represents a single module from the Path of Exile Knowledge Base system.
 * KB modules provide curated, authoritative game knowledge that grounds LLM reasoning.
 *
 * The Knowledge Base is organized hierarchically:
 * - /kb/classes/ - Base class knowledge (7 modules)
 * - /kb/ascendancies/ - Ascendancy-specific knowledge (19 modules)
 * - /kb/skills/ - Skill gem mechanics and interactions (20+ modules)
 * - /kb/mechanics/ - Core game mechanics (damage, defense, etc.)
 *
 * @example ID Format Examples:
 * - "class/witch" - Witch class knowledge
 * - "ascendancy/necromancer" - Necromancer ascendancy
 * - "skill/cyclone" - Cyclone skill mechanics
 * - "mechanic/crit-mechanics" - Critical strike mechanics
 *
 * @example Usage:
 * ```typescript
 * const necroModule: KnowledgeModule = {
 *   id: "ascendancy/necromancer",
 *   type: "ascendancy",
 *   content: "# Necromancer\n\nThe Necromancer is a Witch ascendancy...",
 *   tags: ["minion", "corpse", "offering", "aura"]
 * };
 * ```
 *
 * The KnowledgeSelector service dynamically selects relevant modules based on
 * build characteristics (class, ascendancy, main skill, damage type) and provides
 * them to the LLM as grounding context. This ensures the LLM has accurate PoE
 * knowledge without relying on potentially outdated training data.
 *
 * Constitution Compliance:
 * - Principle III: Provides grounding for LLM contextual reasoning
 * - Principle IV: Enables modular, auditable knowledge base system
 */

/**
 * Type categories for Knowledge Base modules
 */
export type KnowledgeModuleType =
  | 'class'
  | 'ascendancy'
  | 'ascendancy-meta'
  | 'skills-ascendancy-meta'   // Skills pathway ascendancy meta
  | 'tree-ascendancy-meta'     // Tree pathway ascendancy meta
  | 'skills-ascendancy-skill'  // Skills pathway ascendancy+skill specific
  | 'tree-ascendancy-skill'    // Tree pathway ascendancy+skill specific
  | 'gear-ascendancy-skill'    // Gear pathway ascendancy+skill specific (per-slot)
  | 'skill'
  | 'skills-meta'
  | 'mechanic'
  | 'reference'
  | 'item'
  | 'affix'
  | 'slot'
  | 'archetype'
  | 'gear'
  | 'gear-skill'
  | 'league'
  | 'bloodline'
  | 'keystone'                 // Individual keystone guides
  | 'cluster'                  // Notable cluster guides
  | 'base'                     // Item base type guides
  | 'crafting'                 // Crafting guides
  | 'fundamentals';            // Game fundamentals (resistances, attributes, etc.)

/**
 * Represents a single Knowledge Base module with its metadata and content
 */
export interface KnowledgeModule {
  /**
   * Unique identifier for the module in hierarchical format
   * Format: "{type}/{name}" (e.g., "ascendancy/necromancer", "skill/cyclone")
   */
  id: string;

  /**
   * Category of knowledge this module represents
   * - "class": Base class knowledge (Witch, Shadow, etc.)
   * - "ascendancy": Ascendancy-specific mechanics and synergies
   * - "skill": Skill gem mechanics, scaling, and interactions
   * - "mechanic": Core game mechanics (damage types, defensive layers, etc.)
   */
  type: KnowledgeModuleType;

  /**
   * Full markdown content of the knowledge module
   * Contains curated, factual game knowledge that the LLM uses for grounded reasoning.
   * Should avoid numerical values unless sourced deterministically (per Principle IV).
   */
  content: string;

  /**
   * Tags for search and filtering
   * Used by KnowledgeSelector to find relevant modules based on build characteristics.
   * Examples: ["minion", "corpse"], ["crit", "lightning"], ["life", "armour"]
   */
  tags: string[];
}
