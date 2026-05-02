/**
 * MetaReasoning Types
 *
 * Pre-generated ladder meta analysis data served alongside build detail pages.
 * These are static JSON files generated during build optimization, not fetched live.
 *
 * @module shared/types/MetaReasoning
 */

export interface MetaReasoning {
  skill: string;
  ascendancy: string;
  level?: number;
  levelRange?: { min: number; max: number };
  sampleSize: number;
  league: string;
  generatedAt: string;
  benchmarks: {
    dps: { p25: number; median: number; p75: number };
    life: { p25: number; median: number; p75: number };
    ehp: { p25: number; median: number; p75: number };
    armour?: { median: number };
    lifeRegen?: { median: number };
  };
  archetypeDefensePriorities: Array<{ stat: string; why: string }>;
  additionalDefenseMetrics: string[];
  reasoning_context: string[];
  uniqueItems: Array<{
    name: string;
    slot: string;
    usage: number;
    actualMods?: string[];
    why: string;
  }>;
  rareModsBySlot: Record<string, Array<{
    mod: string;
    usage: number;
    why: string;
  }>>;
  keystones: Array<{ name: string; usage: number; actualEffect?: string; why: string }>;
  supports: Array<{ name: string; usage: number; why: string }>;
  auras: Array<{ name: string; usage: number; why: string }>;
}
