/**
 * Build Library Types
 *
 * Shared types for the build library feature — progression guides derived
 * from hydrated ladder data + real PoB state from ladder reference characters.
 *
 * See `.claude/skills/build-library/SKILL.md` for the living design doc.
 */

import type {
  ProgressionTier,
  ProgressionTierData,
} from './LadderData.js';

// =============================================================================
// Reference build — which actual ladder character we used per tier
// =============================================================================

/**
 * A ladder character we picked as the near-median representative for a tier.
 * Stored so the guide is traceable back to the exact build it was derived from.
 */
export interface ReferenceBuild {
  /** Account name with discriminator (e.g., "pyrexia#5595") */
  accountName: string;
  /** Character name on that account */
  characterName: string;
  /** Character level at the time of snapshot */
  level: number;
  /** Class (Duelist, Witch, etc.) */
  className: string;
  /** Ascendancy class */
  ascendancy: string;
  /** Balanced score (DPS × EHP) used for ranking */
  balancedScore: number;
  /** Raw DPS from the ladder file (poe.ninja precomputed) */
  ladderDps: number;
  /** Raw EHP from the ladder file */
  ladderEhp: number;
  /** poe.ninja time machine label the build was captured at (e.g., "week-2", or null for current) */
  timeMachineLabel: string | null;
}

// =============================================================================
// Tier snapshot — the full captured state for one tier of a build guide
// =============================================================================

/**
 * Gear item in a captured tier snapshot. Minimal shape — the detail
 * page will re-preflight the PoB code to get full ItemDisplayMod data
 * if it needs more than this.
 */
export interface TierSnapshotItem {
  slot: string;
  name: string;
  baseType: string;
  rarity: 'NORMAL' | 'MAGIC' | 'RARE' | 'UNIQUE';
  /** Item level */
  ilvl?: number;
  /** All explicit/implicit mod lines as plain strings */
  mods: string[];
  /** Whether it's a notable unique we want to call out in the guide */
  isCore?: boolean;
}

/** Gem in a socket chain */
export interface TierSnapshotGem {
  name: string;
  level?: number;
  quality?: number;
  /** Whether this gem is the main skill, or a support for it */
  role: 'main' | 'support' | 'aura' | 'herald' | 'curse' | 'guard' | 'movement' | 'warcry' | 'other';
}

/** One socket group (gem link chain) */
export interface TierSnapshotSocketGroup {
  slot: string;
  label?: string;
  gems: TierSnapshotGem[];
}

/** Key tree data for a tier */
export interface TierSnapshotTree {
  /** Total passives allocated (including ascendancy) */
  pointsAllocated: number;
  /** Keystone names (e.g., "Vaal Pact") */
  keystones: string[];
  /** Notable passive names */
  notables: string[];
  /** Ascendancy node names */
  ascNodes: string[];
}

/**
 * Compact-panel combat stats extracted from PoB's `getFullCalcs().mainOutput`
 * plus `getFullConfig()` pantheon selections. All fields optional — missing
 * values fall back to 0 or hidden in the UI.
 *
 * Conventions:
 *   - Resistances are CURRENT values (after penalties); overcap fields are the
 *     raw "above max resistance" amount so the UI can show `75% (+12 over)`.
 *   - Block / spell block / spell suppression are the EFFECTIVE values (after
 *     cap rules), matching how PoB's sidebar displays them.
 *   - Charges are `current = max` for the reference character (PoB reports
 *     the build's maximum, which is what users care about for a guide).
 *   - Movement speed mod is a multiplier (1.2 = 20% faster).
 */
export interface TierDetailedStats {
  // Offense
  critChance?: number;
  critMultiplier?: number;
  /** Attack or cast speed (APS/CPS depending on build) */
  speed?: number;
  hitChance?: number;
  accuracy?: number;
  areaOfEffectMetres?: number;

  // Defense — avoidance
  blockChance?: number;
  spellBlockChance?: number;
  spellSuppressionChance?: number;
  spellSuppressionEffect?: number;
  attackDodgeChance?: number;
  spellDodgeChance?: number;

  // Defense — mitigation / recovery
  physicalDamageReduction?: number;
  lifeRegen?: number;
  energyShieldRegen?: number;
  manaRegen?: number;

  // Resistances — current values
  fireResist?: number;
  coldResist?: number;
  lightningResist?: number;
  chaosResist?: number;
  // Overcap (amount above the effective maximum, 0 if exactly at cap)
  fireResistOverCap?: number;
  coldResistOverCap?: number;
  lightningResistOverCap?: number;
  chaosResistOverCap?: number;

  // Charges (maximums the build is configured for)
  powerCharges?: number;
  frenzyCharges?: number;
  enduranceCharges?: number;

  // Attributes
  strength?: number;
  dexterity?: number;
  intelligence?: number;

  // Movement (1.0 = base, 1.2 = +20%)
  movementSpeedMod?: number;

  // Pantheon — god labels from getFullConfig. Empty string when "None".
  pantheonMajor?: string;
  pantheonMinor?: string;
}

/**
 * Full captured snapshot for one tier of a build guide. Comes from running
 * a reference ladder character through the gear/skill/tree preflights.
 */
export interface TierSnapshot {
  tier: ProgressionTier;
  /** Display label (e.g., "Early Mapping L70–84") */
  display: string;
  /** Level range for this tier */
  levelRange: [number, number];

  /** Median stats across ALL ladder builds in this tier (from progression.json) */
  medianStats: {
    dps: number;
    ehp: number;
    life: number;
    level: number;
  };
  /** How many ladder builds this tier's medians are computed from */
  sampleSize: number;

  /** The reference character we captured PoB state from */
  reference: ReferenceBuild;
  /** The reference character's own measured DPS/EHP/Life (from PoB full calcs) */
  referenceStats: {
    dps: number;
    ehp: number;
    life: number;
    energyShield: number;
    armour: number;
    evasion: number;
  };

  /**
   * Extra combat stats baked at capture time. Populated by `pob-capture.ts`
   * from the same `getFullCalcs` call that produces `referenceStats`, plus a
   * cheap `getFullConfig()` for pantheon selections. Optional so guides
   * generated before this field landed still load.
   */
  detailedStats?: TierDetailedStats;

  /** The PoB export code, base64 compressed, so the frontend can reload it for visualization */
  pobCode: string;

  /** Captured gear (lightweight summary, kept for the simple inline list view) */
  gear: TierSnapshotItem[];
  /** Captured skill groups (lightweight summary) */
  skillGroups: TierSnapshotSocketGroup[];
  /** Captured tree summary (lightweight) */
  tree: TierSnapshotTree;

  /**
   * Full visualization data — same shape as the desktop frontend's
   * `BuildVisualizationResponse`, baked at guide-generation time so the
   * library detail page can feed it directly into `GearVizTab` /
   * `SkillsVizTab` / `TreeVizTab` without needing to re-import the build.
   *
   * Optional for backwards compatibility with guides generated before the
   * baked-vizData approach. Typed as `unknown` here because
   * `BuildVisualizationResponse` lives in `desktop/src/store/index.ts` and
   * shared types must not import from desktop. The frontend casts at the
   * consumption boundary; the runtime shape is guaranteed by the
   * `captureVizDataFromPoB` service which calls the same transform helpers
   * the live `/visualization-stream` route uses.
   */
  vizData?: unknown;

  /**
   * LLM-written holistic explanation of how this build works at this tier.
   * Baked at guide-generation time by `narrative-writer.ts`. Optional for
   * backwards compat with guides generated before the narrative layer landed.
   */
  narrative?: TierBuildNarrative;

  /**
   * 1–3 concrete crafting recipes for the most build-defining rare items
   * at this tier. Generated by `crafting-hint-writer.ts`, which runs the
   * `craft_item` Monte Carlo simulator against the reference character's
   * actual gear. Optional for backwards compat.
   */
  craftingHints?: CraftingHint[];
}

// =============================================================================
// Candidate validation — shortlist preflight before PoB capture
// =============================================================================

/**
 * Lightweight build summary produced by `candidate-preflight.ts` for each
 * shortlist candidate. Cheaper than a full `TierSnapshot` (no vizData bake,
 * no detailed stats, minimal gear/skill shape) but still has enough signal
 * for the LLM validator to spot broken-reference builds: unsocketed slots,
 * zero-DPS main skill, mainActiveSkill pointing at a support, etc.
 */
export interface CandidatePreflightSummary {
  /** Index in the shortlist (0-based) — used by the validator to approve. */
  index: number;
  accountName: string;
  characterName: string;
  level: number;
  className: string;
  ascendancy: string;
  balancedScore: number;
  /** Main active skill name as PoB reports it (e.g., "Elemental Hit"). */
  mainSkill: string;
  /** Number of supports linked to the main skill's socket group. */
  mainLinkSupportCount: number;
  /** Names of supports linked to main skill (in order). */
  mainLinkSupports: string[];
  /** Total passive tree points allocated (including ascendancy). */
  totalPassives: number;
  /** Ascendancy nodes allocated. */
  ascendancyNodes: string[];
  /** Keystones allocated (e.g., "Vaal Pact"). */
  keystones: string[];
  /** Number of socketed gear slots (non-empty) out of 9 possible. */
  gearSlotsSocketed: number;
  /** Measured DPS + EHP from PoB's getFullCalcs. */
  combinedDps: number;
  ehp: number;
  life: number;
  /**
   * Automated warnings for common broken-build signals. Populated
   * deterministically before the LLM validator sees the candidate:
   *
   *   - "No gems socketed in Boots"
   *   - "Main skill socket group has no supports"
   *   - "Zero measured DPS — build may not be loading correctly"
   *   - "Fewer than 80 passives allocated at L95 — likely incomplete"
   */
  warnings: string[];
}

/**
 * Result of the LLM validator picking one of the shortlist candidates.
 */
export interface CandidateValidationResult {
  /** Index of the approved candidate in the shortlist, or null if all rejected. */
  approvedIndex: number | null;
  /**
   * 1–2 sentence rationale for the pick (or the full-rejection reason).
   * Stored for auditability — not shown in the UI.
   */
  reason: string;
  /**
   * When the validator rejected all candidates, it may request a wider
   * shortlist. The orchestrator honors this up to 3 total iterations.
   */
  widerShortlistRequested?: boolean;
  /** Which model + prompt version made the call. */
  generatedBy: {
    model: string;
    promptVersion: string;
    generatedAt: string;
  };
}

// =============================================================================
// Tier narrative — LLM-written "how this build works at this milestone"
// =============================================================================

/**
 * Holistic build narrative written by an LLM after tier capture. Explains
 * how the build works at this milestone — mechanics, defences, playstyle,
 * what's next. Populated by `narrative-writer.ts` sequentially (early →
 * endgame → aspirational) so later tiers can reference earlier ones.
 *
 * Optional on TierSnapshot; guides generated before this field landed
 * still render cleanly.
 */
export interface TierBuildNarrative {
  /** Which tier this narrative describes (matches `TierSnapshot.tier`). */
  tier: ProgressionTier;
  /**
   * Main damage mechanism and how gear/skills/tree support it.
   * ~2–3 paragraphs of prose.
   */
  mechanicsSummary: string;
  /** Defensive layers and how they interact. ~1–2 paragraphs. */
  defensiveLayers: string;
  /** What the build feels like to play at this tier. ~1 paragraph. */
  playstyleFeel: string;
  /**
   * 1–3 concrete hooks for moving to the next tier. Rendered as chips.
   * Empty array at aspirational (there is no next tier).
   */
  progressionHints: string[];
  /**
   * Optional short continuity blurb tying this tier back to the previous
   * one. Absent at early_mapping (no prior tier). When present, renders
   * above `mechanicsSummary` as a 1–2 sentence callout.
   */
  continuityFromPrevTier?: string;
  /** Model + prompt version used — for auditability and regeneration. */
  generatedBy: {
    model: string;
    promptVersion: string;
    generatedAt: string;
  };
}

/**
 * Build-level narrative shown at the top of the guide detail page, above
 * the tier picker. Tier-agnostic and deliberately light on detail — the
 * goal is to hook a reader scanning the library and help them decide
 * whether this build sounds fun for THEM. The dense mechanics/defences
 * prose belongs per-tier (`TierBuildNarrative`), not here.
 *
 * Style reference: Maxroll build guide intros. Hooky second-person
 * pitch ("charge in, swing once, screen erupts in fire"), then a
 * strengths/weaknesses split so the reader can self-select.
 *
 * Authored manually in `backend/data/build-library/_narratives/{slug}.json`
 * under a root-level `buildNarrative` key and stitched into the guide JSON
 * by `merge-narratives.ts`. Optional so guides that haven't been re-merged
 * under the new schema still parse.
 */
export interface BuildNarrative {
  /**
   * Short second-person intro paragraph. What the build does in one
   * evocative sentence, why a player might enjoy it, who should consider
   * it. ~2-3 short paragraphs, no mechanics deep-dive — that lives below
   * in the tier snapshots.
   */
  pitch: string;
  /**
   * 3-5 short bullets answering "what's this build good at". Each bullet
   * is one sentence. Tags allowed (<mechanic>, <stat>) but keep light.
   */
  strengths: string[];
  /**
   * 2-4 short bullets answering "what does this build struggle with".
   * Be honest — reflect / phys map mods / chaos damage / boss single
   * target / cost to scale / respec-heavy / whatever genuinely bites.
   */
  weaknesses: string[];
}

// =============================================================================
// Crafting hints — how to obtain the build-defining items at this tier
// =============================================================================

/**
 * The strategy kind matches the multi-strategy evaluator's outputs.
 * `buy_trade` is a terminal fallback when the simulator returns 0% success
 * (influence-only mods, uncraftable bases) — the UI shows the trade URL.
 */
export type CraftingHintStrategy =
  | 'essence_metacraft'
  | 'fractured_essence'
  | 'fossil_metacraft'
  | 'recombinator'
  | 'alt_regal'
  | 'influence_craft'
  | 'buy_trade';

/**
 * A concrete crafting recipe for one rare item on one tier. Produced by
 * `crafting-hint-writer.ts`, which passes the reference character's actual
 * gear to the LLM, lets the LLM propose 1–3 item specs, and runs the
 * `craft_item` Monte Carlo simulator to get real p50/p90 divine costs.
 *
 * Hints are restricted to the tier's "build-defining" items (typically
 * 1–3 per tier) — not every slot gets a hint.
 */
export interface CraftingHint {
  /** Equipment slot (e.g., "Helmet", "Weapon", "Ring 1"). */
  slot: string;
  /** Item name (or "Rare {baseType}" when the reference item is crafted). */
  itemName: string;
  /** Base type the recipe targets (e.g., "Two-Toned Boots"). */
  baseType: string;
  /**
   * LLM-written one-paragraph summary of why this item matters and how
   * the recipe works. Ends with the cost line the UI renders below.
   */
  summary: string;
  /** Which crafting strategy the recipe uses. */
  strategy: CraftingHintStrategy;
  /**
   * Median total cost in divine (base item + crafting materials). Only
   * present when >= 0.1 div; smaller amounts fall back to chaos display.
   */
  medianCostDivine?: number;
  /** 90th-percentile total cost in divine — user budget guardrail. */
  p90CostDivine?: number;
  /** Median cost in chaos for items under 0.1 div. */
  medianCostChaos?: number;
  /** Trade API URL for buying the base item (or the finished item for `buy_trade`). */
  tradeUrl?: string;
  /**
   * Human-readable step summaries from the craft_item simulator's output.
   * Example: ["Buy Two-Toned Boots (ilvl 85+) via Trade", "Spam Essence of Greed", ...]
   */
  craftingSteps?: string[];
  /**
   * Monte Carlo success rate (0-100). Below ~60 means the recipe is
   * marginal; the UI shows a warning chip. 0 means the simulator
   * determined the item is uncraftable via this strategy and
   * `strategy` was switched to `buy_trade`.
   */
  successRate: number;
  /** Model + prompt version used — for auditability and regeneration. */
  generatedBy: {
    model: string;
    promptVersion: string;
    generatedAt: string;
  };
}

// =============================================================================
// Leveling section — narrative pre-mapping guidance (no PoB capture)
// =============================================================================

/**
 * A gem reference for a leveling socket group. `iconUrl` is baked at
 * guide-generation time via `bake-leveling-icons.ts`.
 */
export interface LevelingGemRef {
  name: string;
  iconUrl?: string;
}

/**
 * One step in the leveling skill progression: the full socket loadout the
 * player should be running at that waypoint. Includes the main link plus
 * auras, heralds, buffs, movement, and optional curse/mark.
 *
 * Acts/levels are loose markers ("Act 1", "Act 3", "L40") rather than precise
 * waypoints — the ladder has no reliable low-level data to derive precision from.
 */
export interface LevelingSkillStep {
  /** Loose marker: act, level, or milestone (e.g., "Act 1", "Act 3", "L40") */
  actOrLevel: string;
  /** Main skill the player should be using at this step */
  mainSkill: string;
  /**
   * PoE wiki icon URL for the main skill gem. Baked at guide-generation time
   * via `getGemIconUrl()` in `bake-leveling-icons.ts` (LEARNING-15 pattern).
   * Optional for backwards compat with guides generated before the bake.
   */
  mainSkillIconUrl?: string;
  /** Optional supports linked to the main skill */
  supports?: string[];
  /**
   * PoE wiki icon URLs for each support gem, same length and order as `supports`.
   * Baked at guide-generation time. Optional for backwards compat.
   */
  supportIconUrls?: string[];
  /** Movement / travel skill (e.g., Flame Dash, Shield Charge). */
  travelSkill?: LevelingGemRef;
  /** Active auras (e.g., Herald of Ash is NOT an aura — use `heralds`). */
  auras?: LevelingGemRef[];
  /** Heralds (e.g., Herald of Ash, Herald of Purity). */
  heralds?: LevelingGemRef[];
  /**
   * Buff / utility skills — self-cast buffs, guards, golems, Cast when Damage
   * Taken setups, offerings, etc. The short description can use gem names
   * like "CwDT + Steelskin" as a single entry.
   */
  buffs?: LevelingGemRef[];
  /** Curse or mark (e.g., Flammability, Sniper's Mark). */
  curseOrMark?: LevelingGemRef;
  /** Optional note: when to swap, what unique to grab, etc. */
  note?: string;
}

/**
 * Optional tree reference for the leveling phase. Either a PoE tree URL or a
 * list of notable names — never a PoB-captured snapshot. Just a sensible
 * "good enough" tree to aim at while leveling.
 *
 * When `allocationOrder` is supplied, the frontend renders a level-aware
 * interactive tree modal where the user scrubs a level slider and sees the
 * points allocated at that level. Without `allocationOrder`, the frontend
 * falls back to the notables chip list + external tree URL link.
 */
export interface LevelingTreeReference {
  /** Optional PoE official tree URL */
  url?: string;
  /** Optional list of notable names to aim for */
  notables?: string[];
  /** Approximate character level this tree targets (e.g., 68) */
  levelTarget: number;
  /**
   * Optional ordered allocation plan: passive tree node IDs in the order the
   * player takes them during leveling. At level N, the first
   * `min(N - 1 + 22, allocationOrder.length, 121)` nodes are treated as
   * allocated; the following 3–5 entries are shown as upcoming picks.
   *
   * Authored by hand per guide — PoB tree exports are unordered sets, so
   * there's no way to auto-derive the correct gameplay order.
   */
  allocationOrder?: number[];
  /**
   * Optional per-step waypoint annotations keyed by index into
   * `allocationOrder`. Example: `{ 18: "After Lab 1 — respec into Brutal Fervour" }`.
   */
  waypoints?: Record<number, string>;
}

/**
 * Authored leveling narrative for a build guide. NOT derived from PoB; written
 * once per build and checked into git as part of the guide JSON. Covers L1–L68
 * before the first PoB-captured tier (early_mapping).
 */
export interface LevelingSection {
  /** 1–3 paragraph overview of the leveling experience for this build */
  overview: string;
  /** Which skill gems to pick up as you progress through acts */
  skillProgression: LevelingSkillStep[];
  /** Gear priorities while leveling (1–2 sentences per slot or theme) */
  gearPriorities: string[];
  /** Weapon progression: what to aim for, when to upgrade */
  weaponProgression: string;
  /** Optional tree reference */
  treeReference?: LevelingTreeReference;
  /** Optional build-specific leveling gotchas */
  gotchas?: string[];
}

// =============================================================================
// Variants — distinct ways of playing the same skill+ascendancy combo
// =============================================================================

/**
 * A "distinguishing feature" that separates one variant from the rest of
 * its tier. Used both for naming the variant and for the UI description.
 *
 * Category prefix lets the frontend style the chip (keystone vs aura vs unique).
 * `value` is the bare feature name with the prefix stripped (e.g., "Elemental
 * Equilibrium", "dualWield", "The Taming").
 */
export interface VariantDistinguishingFeature {
  /** Category: "keystone", "ascNode", "weaponParadigm", "coreUnique", "mainSupport", "notable", "aura" */
  category: string;
  /** Bare feature name with category prefix stripped */
  value: string;
  /** % of variant builds that have this feature */
  variantPct: number;
  /** % of tier builds overall that have this feature */
  tierPct: number;
  /** delta = variantPct − tierPct */
  delta: number;
}

/**
 * One variant of a BuildGuide — a distinct way of playing the same skill+
 * ascendancy combination. Multiple variants share the overview, leveling
 * narrative, transitions, and core foundation — they differ only in which
 * ladder characters represent them and therefore what gear/skills/tree
 * snapshots the detail page renders.
 *
 * A guide always has at least one variant (the Standard variant is always
 * present). When variant detection finds multi-variant structure, additional
 * variant tracks are layered on top, each sharing the Standard's snapshot
 * for tiers where they have no data of their own.
 *
 * **Invariant**: `tiers` always has all three tiers populated (when data
 * allows generation at all). Tiers that the variant couldn't capture from
 * its own member list are borrowed from the Standard variant and listed in
 * `borrowedTiers` so the UI can indicate "this tier is shared with Standard".
 */
export interface BuildVariantGuide {
  /** Stable string ID like "variant-standard" / "variant-1" / "variant-2". */
  id: string;
  /** Short name shown in the selector (e.g., "Ancestral Bond Totems"). */
  name: string;
  /** One-line description of what makes this variant distinctive. */
  description: string;
  /**
   * True for the "Standard" variant — the whole-tier near-median pick that
   * always has all three tiers populated and acts as the fallback source
   * for any multi-variant track with missing tier data.
   */
  isDefault: boolean;
  /** Fraction of tier builds this variant represents (0-1). 1.0 for the default. */
  share: number;
  /** Absolute member count across the source tier(s). */
  buildCount: number;
  /** Top distinguishing features — empty for the default variant. */
  distinguishingFeatures: VariantDistinguishingFeature[];
  /** The tier snapshots shown for this variant. Every tier is populated. */
  tiers: Partial<Record<ProgressionTier, TierSnapshot>>;
  /**
   * Which tiers in `tiers` are borrowed from the Standard variant because
   * this variant had no data of its own for that tier. Never populated for
   * the Standard variant itself. Frontend uses this to render a subtle
   * "Shared with Standard" indicator.
   */
  borrowedTiers: ProgressionTier[];
}

// =============================================================================
// Build guide — the top-level object we write to backend/data/build-library/
// =============================================================================

/**
 * A fully generated build progression guide.
 * One per skill+ascendancy combo. Serialized to `backend/data/build-library/{slug}.json`.
 *
 * Consumed by:
 *  - `GET /api/v1/build-library/:slug` (backend route)
 *  - BuildGuideDetailPage (desktop frontend)
 */
export interface BuildGuide {
  /** File slug, matches `{slug}-progression.json` filename stem */
  slug: string;
  /** Main skill gem name (e.g., "Elemental Hit") */
  skill: string;
  /** Ascendancy class (e.g., "Slayer") */
  ascendancy: string;
  /** League this guide was generated for */
  league: string;
  /** When this guide was generated (ISO 8601) */
  generatedAt: string;
  /**
   * Schema version so we can migrate stored guides later.
   * v1 = original tiers-only layout, v2 = added variants field + default variant.
   */
  schemaVersion: 2;

  /** Popularity metadata from skill-popularity.json (optional — may not exist for all combos) */
  popularity?: {
    rank: number;
    pct: number;
    ascendancyCount: number;
  };

  /** Short blurb shown on the list page card */
  tagline: string;
  /**
   * Authored build-level narrative rendered at the top of the detail page,
   * above the tier picker. Optional — guides that haven't been re-merged
   * under the new schema render cleanly without it. Populated by
   * `merge-narratives.ts` from the root `buildNarrative` key in the
   * authored narrative file.
   */
  buildNarrative?: BuildNarrative;

  /** Authored leveling narrative for L1 → L68 (pre-mapping) */
  leveling: LevelingSection;

  /**
   * Variants of this build — distinct ways of playing the same skill+
   * ascendancy combo. Always length ≥ 1. When variant detection finds
   * no meaningful partition, a single `isDefault: true` variant is emitted.
   * The default-selected variant in the UI is `variants[0]`.
   */
  variants: BuildVariantGuide[];

  /**
   * The primary variant's tier snapshots, duplicated here for backward
   * compat with any consumer that hasn't been updated to read `variants`.
   * Prefer `variants[N].tiers` in new code. Always equal to `variants[0].tiers`.
   *
   * @deprecated Read from `variants[selectedIndex].tiers` instead.
   */
  tiers: Partial<Record<ProgressionTier, TierSnapshot>>;

  /** Raw tier data passed through from progression.json — used for charts and badges */
  tierData: Partial<Record<ProgressionTier, ProgressionTierData>>;
}

// =============================================================================
// List page summary — lightweight entry for `GET /api/v1/build-library`
// =============================================================================

/**
 * Lightweight summary used on the build library list page.
 * Contains just enough info to render a card without loading the full guide JSON.
 */
export interface BuildGuideSummary {
  slug: string;
  skill: string;
  ascendancy: string;
  league: string;
  tagline: string;
  popularityRank?: number;
  popularityPct?: number;
  /** Median DPS from the endgame tier (or aspirational if endgame missing) for card display */
  displayDps: number;
  /** Median EHP from the endgame tier (or aspirational if endgame missing) */
  displayEhp: number;
  generatedAt: string;
}
