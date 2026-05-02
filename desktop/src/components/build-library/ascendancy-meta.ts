/**
 * Ascendancy metadata for the build library overview page.
 *
 * Maps every PoE 1 ascendancy to:
 * - its base class (for grouping / accent colour)
 * - a sprite-sheet key (`Classes<Name>`) that exists in the tree data's
 *   `ascendancy` sprite config (see backend/src/data/passive-tree/tree-latest.json)
 * - a thematic accent colour used for the group header + card left bar
 *
 * The canonical internal name for the former Raider is **Warden**. The sprite
 * sheet still ships the legacy `ClassesRaider` coord — the `spriteKey` field
 * handles the remap so the UI can keep using `Warden` everywhere.
 */

export type BaseClass =
  | 'Marauder'
  | 'Duelist'
  | 'Ranger'
  | 'Shadow'
  | 'Witch'
  | 'Templar'
  | 'Scion';

export interface BaseClassMeta {
  /** Accent colour used for group headers + card left bars */
  accent: string;
  /** Soft rgba tint used for card backgrounds and borders */
  glow: string;
  /** Display order in the grouped list (top → bottom) */
  order: number;
}

export const BASE_CLASS_META: Record<BaseClass, BaseClassMeta> = {
  Marauder: { accent: '#ef4444', glow: 'rgba(239, 68, 68, 0.18)', order: 1 },
  Duelist:  { accent: '#f59e0b', glow: 'rgba(245, 158, 11, 0.18)', order: 2 },
  Ranger:   { accent: '#10b981', glow: 'rgba(16, 185, 129, 0.18)', order: 3 },
  Shadow:   { accent: '#06b6d4', glow: 'rgba(6, 182, 212, 0.18)',  order: 4 },
  Witch:    { accent: '#3b82f6', glow: 'rgba(59, 130, 246, 0.18)', order: 5 },
  Templar:  { accent: '#a855f7', glow: 'rgba(168, 85, 247, 0.18)', order: 6 },
  Scion:    { accent: '#ec4899', glow: 'rgba(236, 72, 153, 0.18)', order: 7 },
};

interface AscendancyMeta {
  baseClass: BaseClass;
  /** Key into tree-latest.json → sprites.ascendancy.<zoom>.coords */
  spriteKey: string;
}

/**
 * Every PoE 1 ascendancy. `Warden` resolves to `ClassesRaider` because the
 * sprite sheet still carries the legacy name.
 */
export const ASCENDANCY_META: Record<string, AscendancyMeta> = {
  // Marauder
  Juggernaut:   { baseClass: 'Marauder', spriteKey: 'ClassesJuggernaut' },
  Berserker:    { baseClass: 'Marauder', spriteKey: 'ClassesBerserker' },
  Chieftain:    { baseClass: 'Marauder', spriteKey: 'ClassesChieftain' },
  // Duelist
  Slayer:       { baseClass: 'Duelist',  spriteKey: 'ClassesSlayer' },
  Gladiator:    { baseClass: 'Duelist',  spriteKey: 'ClassesGladiator' },
  Champion:     { baseClass: 'Duelist',  spriteKey: 'ClassesChampion' },
  // Ranger
  Deadeye:      { baseClass: 'Ranger',   spriteKey: 'ClassesDeadeye' },
  Warden:       { baseClass: 'Ranger',   spriteKey: 'ClassesRaider' },
  Raider:       { baseClass: 'Ranger',   spriteKey: 'ClassesRaider' },
  Pathfinder:   { baseClass: 'Ranger',   spriteKey: 'ClassesPathfinder' },
  // Shadow
  Assassin:     { baseClass: 'Shadow',   spriteKey: 'ClassesAssassin' },
  Saboteur:     { baseClass: 'Shadow',   spriteKey: 'ClassesSaboteur' },
  Trickster:    { baseClass: 'Shadow',   spriteKey: 'ClassesTrickster' },
  // Witch
  Necromancer:  { baseClass: 'Witch',    spriteKey: 'ClassesNecromancer' },
  Occultist:    { baseClass: 'Witch',    spriteKey: 'ClassesOccultist' },
  Elementalist: { baseClass: 'Witch',    spriteKey: 'ClassesElementalist' },
  // Templar
  Inquisitor:   { baseClass: 'Templar',  spriteKey: 'ClassesInquisitor' },
  Hierophant:   { baseClass: 'Templar',  spriteKey: 'ClassesHierophant' },
  Guardian:     { baseClass: 'Templar',  spriteKey: 'ClassesGuardian' },
  // Scion
  Ascendant:    { baseClass: 'Scion',    spriteKey: 'ClassesAscendant' },
  Reliquarian:  { baseClass: 'Scion',    spriteKey: 'ClassesReliquarian' },
};

/** Resolve an ascendancy name to its base class, falling back to Scion for unknowns. */
export function getBaseClass(ascendancy: string): BaseClass {
  return ASCENDANCY_META[ascendancy]?.baseClass ?? 'Scion';
}

/** Resolve an ascendancy name to its sprite-sheet coord key, or null if unknown. */
export function getSpriteKey(ascendancy: string): string | null {
  return ASCENDANCY_META[ascendancy]?.spriteKey ?? null;
}

/** Accent colour for an ascendancy, via its base class. */
export function getAccent(ascendancy: string): BaseClassMeta {
  return BASE_CLASS_META[getBaseClass(ascendancy)];
}
