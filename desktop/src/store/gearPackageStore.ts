/**
 * Gear Package Tooltip Store
 *
 * Lightweight Zustand store that maps package refs (GR1, GR2...) to their
 * item tooltip data. Populated by ToolStepCard when gear results render,
 * consumed by PackagePill for hover tooltips.
 */

import { create } from 'zustand';
import type { StructuredMods, ModEntry, ModValueRange } from './index';

export interface GearPackageItem {
  slot: string;
  name: string;
  baseName: string;
  rarity: string;
  mods?: StructuredMods;
  raw?: string;
  /** Base defense stats from base_items.json (armour, evasion, ES) */
  baseStats?: { armour?: number; evasion?: number; energyShield?: number; block?: number };
  /** Base weapon stats from base_items.json */
  weaponStats?: { physicalMin?: number; physicalMax?: number; critChance?: number; attackRate?: number };
  /** Item requirements from base_items.json */
  requirements?: { level?: number; str?: number; dex?: number; int?: number };
}

export interface GearPackageData {
  ref: string;
  label: string;
  items: GearPackageItem[];
  dps?: { pct?: string };
  ehp?: { pct?: string };
  source?: {
    pathway: 'gear' | 'skills' | 'tree';
    toolName?: string;
    callNumber?: number;
  };
}

interface GearPackageStore {
  packages: Map<string, GearPackageData>;
  registerPackage: (data: GearPackageData) => void;
  clearPackages: () => void;
}

export const useGearPackageStore = create<GearPackageStore>((set) => ({
  packages: new Map(),

  registerPackage: (data) =>
    set((state) => {
      const next = new Map(state.packages);
      next.set(data.ref.toLowerCase(), data);
      return { packages: next };
    }),

  clearPackages: () => set({ packages: new Map() }),
}));

/** Selector hook for a single package by ref */
export function useGearPackage(ref: string): GearPackageData | undefined {
  return useGearPackageStore((s) => s.packages.get(ref.toLowerCase()));
}

// =============================================================================
// SSE-time hydration — called when tool_result arrives, not at component mount
// =============================================================================

interface DisplayMod {
  text: string;
  type: string;
  affixType?: string;
  tier?: string;
  tierRange?: string;
  rollRange?: string;
}

interface ItemDisplay {
  name: string;
  baseName: string;
  rarity: string;
  mods: DisplayMod[];
  baseStats?: { armour?: number; evasion?: number; energyShield?: number; block?: number };
  weaponStats?: { physicalMin?: number; physicalMax?: number; critChance?: number; attackRate?: number };
  requirements?: { level?: number; str?: number; dex?: number; int?: number };
}

interface ItemDetail {
  slot?: string;
  display?: ItemDisplay;
  itemText?: string;
}

interface GearResult {
  ref?: string;
  label?: string;
  dps?: { pct?: string };
  ehp?: { pct?: string };
  itemDetails?: ItemDetail[];
}

/** Parse a string like "10-15" or "10 - 15" into a ModValueRange, or undefined. */
function parseRange(raw: string | number | undefined): ModValueRange | undefined {
  if (raw == null) return undefined;
  const str = String(raw);
  const match = str.match(/(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)/);
  if (!match) return undefined;
  return { min: Number(match[1]), max: Number(match[2]) };
}

/** Parse a string tier value into a number, or undefined. */
function parseTier(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

/** Convert a DisplayMod to a ModEntry with proper numeric types. */
function toModEntry(m: DisplayMod, defaults: { affixType: string; type: string }): ModEntry {
  return {
    text: m.text,
    affixType: m.affixType ?? defaults.affixType,
    type: defaults.type,
    tier: parseTier(m.tier),
    tierRange: parseRange(m.tierRange),
    rollRange: parseRange(m.rollRange),
  };
}

function convertDisplayToPackageItem(detail: ItemDetail): GearPackageItem | null {
  const d = detail.display;
  if (d) {
    return {
      slot: detail.slot ?? 'Unknown',
      name: d.name,
      baseName: d.baseName,
      rarity: d.rarity.toUpperCase(),
      mods: {
        implicits: d.mods.filter(m => m.type === 'implicit').map(m =>
          toModEntry(m, { affixType: 'unknown', type: 'implicit' }),
        ),
        explicits: d.mods.filter(m => m.type === 'explicit').map(m =>
          toModEntry(m, { affixType: 'unknown', type: 'explicit' }),
        ),
        crafted: d.mods.filter(m => m.type === 'crafted').map(m =>
          toModEntry(m, { affixType: 'unknown', type: 'crafted' }),
        ),
        enchants: d.mods.filter(m => m.type === 'enchant').map(m =>
          toModEntry(m, { affixType: 'unknown', type: 'enchant' }),
        ),
      },
      baseStats: d.baseStats,
      weaponStats: d.weaponStats,
      requirements: d.requirements,
    };
  }
  if (detail.itemText) {
    return {
      slot: detail.slot ?? 'Unknown',
      name: '',
      baseName: '',
      rarity: 'RARE',
      raw: detail.itemText,
    };
  }
  return null;
}

/**
 * Hydrate gear package store from a test_gear_setups tool_result SSE event.
 * Called at SSE receive time so packages are available before any component mounts.
 */
export function hydrateGearPackagesFromToolResult(data: Record<string, unknown>): void {
  const results = (data.results ?? []) as GearResult[];
  const packageCatalog = (data.packageCatalog ?? []) as GearResult[];
  const callNumber = data.callNumber as number | undefined;

  const { registerPackage } = useGearPackageStore.getState();
  const seenRefs = new Set<string>();

  for (const result of [...results, ...packageCatalog]) {
    const ref = result.ref;
    if (!ref || seenRefs.has(ref)) continue;
    seenRefs.add(ref);

    const details = result.itemDetails ?? [];
    const items = details
      .map(convertDisplayToPackageItem)
      .filter((item): item is GearPackageItem => item !== null);

    registerPackage({
      ref,
      label: result.label ?? '',
      items,
      dps: result.dps,
      ehp: result.ehp,
      source: {
        pathway: 'gear',
        toolName: 'test_gear_setups',
        callNumber,
      },
    });
  }
}
