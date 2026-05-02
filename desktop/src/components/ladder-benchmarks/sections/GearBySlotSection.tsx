/**
 * GearBySlotSection Component
 *
 * Per-slot accordion that merges unique items, rare base types, and rare mods
 * (with source tags) into one cohesive gear view. Replaces the flat "Rare Mods"
 * list and ItemsBySlotSection with a unified per-slot breakdown.
 *
 * Part of the Ladder Benchmarks Modal - "The Armourer's Archive"
 */

import { memo, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ItemUsage, ModUsage } from '../../../../../shared/types/LadderData';

// =============================================================================
// Types
// =============================================================================

interface GearBySlotSectionProps {
  uniqueItems: ItemUsage[];
  rareMods: ModUsage[];
  rareBaseTypes: ItemUsage[];
  /** Total number of builds in the ladder sample */
  buildCount?: number;
  /** Per-slot unique vs rare rarity split */
  slotRarityBreakdown?: Record<string, { unique: number; rare: number; total: number }>;
  /** Animation stagger delay base (ms) */
  staggerBase?: number;
  /** Unique flask usage from ladder */
  uniqueFlasks?: Array<{ name: string; usage: number; count?: number }>;
  /** Flask base type usage from ladder */
  flaskBaseTypes?: Array<{ name: string; slot: string; usage: number; count?: number }>;
  /** Flask mod usage from ladder */
  flaskMods?: ModUsage[];
  /** Flask enchantment usage from ladder */
  flaskEnchants?: ModUsage[];
}

interface SlotData {
  uniques: ItemUsage[];
  baseTypes: ItemUsage[];
  mods: ModUsage[];
}

/** Enriched mod source categories matching the backend's EnrichedModSource */
type EnrichedModSource = 'prefix' | 'suffix' | 'exarch' | 'eater' | 'crafted' | 'enchant' | 'fractured' | 'shaper' | 'elder' | 'crusader' | 'redeemer' | 'hunter';

// =============================================================================
// Constants
// =============================================================================

/** Flask base type → implicit effect text (intrinsic, not craftable) */
const FLASK_BASE_IMPLICITS: Record<string, string> = {
  'Divine Life Flask': 'Recovers 2400 Life over 7 seconds',
  'Eternal Mana Flask': 'Recovers 1800 Mana over 5.6 seconds',
  'Quicksilver Flask': '40% increased Movement Speed',
  'Jade Flask': '+3000 to Evasion Rating',
  'Granite Flask': '+3000 to Armour',
  'Basalt Flask': '15% additional Physical Damage Reduction',
  'Diamond Flask': '100% increased Critical Strike Chance',
  'Ruby Flask': '+50% to Fire Resistance',
  'Sapphire Flask': '+50% to Cold Resistance',
  'Topaz Flask': '+50% to Lightning Resistance',
  'Amethyst Flask': '+35% to Chaos Resistance',
  'Bismuth Flask': '+35% to all Elemental Resistances',
  'Quartz Flask': '10% chance to Dodge Attack and Spell Hits, Phasing',
  'Silver Flask': 'Onslaught',
  'Sulphur Flask': '40% increased Damage, Creates Consecrated Ground on Use',
  'Stibnite Flask': 'Creates a Smoke Cloud on Use',
};

const SLOT_ORDER: Record<string, number> = {
  'Weapon 1': 0,
  'Weapon 2': 1,
  'Helmet': 2,
  'Body Armour': 3,
  'Gloves': 4,
  'Boots': 5,
  'Belt': 6,
  'Amulet': 7,
  'Rings': 8,
  'Trinket': 9,
  'Grafts': 10,
  'Flasks': 11,
};

/** Merge paired slots into a single display slot */
function normalizeSlot(slot: string): string {
  if (slot === 'Ring 1' || slot === 'Ring 2') return 'Rings';
  if (slot === 'BrequelGrafts' || slot === 'BrequelGrafts2') return 'Grafts';
  if (slot === 'Weapon Swap 1' || slot === 'Weapon Swap 2') return 'Weapon Swap';
  if (/^Flask( \d+)?$/.test(slot)) return 'Flasks';
  return slot;
}

/** Display order and styling for enriched mod source categories */
const SOURCE_CATEGORIES: Array<{
  source: EnrichedModSource;
  label: string;
  headerColor: string;
  barGradient: string;
}> = [
  { source: 'prefix', label: 'Prefixes', headerColor: 'text-emerald-400/80', barGradient: 'linear-gradient(90deg, rgba(5, 46, 22, 0.7) 0%, rgba(52, 211, 153, 0.8) 100%)' },
  { source: 'suffix', label: 'Suffixes', headerColor: 'text-violet-400/80', barGradient: 'linear-gradient(90deg, rgba(76, 29, 149, 0.7) 0%, rgba(167, 139, 250, 0.8) 100%)' },
  { source: 'exarch', label: 'Searing Exarch', headerColor: 'text-orange-400/80', barGradient: 'linear-gradient(90deg, rgba(124, 45, 18, 0.7) 0%, rgba(251, 146, 60, 0.8) 100%)' },
  { source: 'eater', label: 'Eater of Worlds', headerColor: 'text-cyan-400/80', barGradient: 'linear-gradient(90deg, rgba(22, 78, 99, 0.7) 0%, rgba(34, 211, 238, 0.8) 100%)' },
  { source: 'crafted', label: 'Crafted', headerColor: 'text-blue-400/70', barGradient: 'linear-gradient(90deg, rgba(30, 58, 138, 0.7) 0%, rgba(96, 165, 250, 0.8) 100%)' },
  { source: 'enchant', label: 'Enchants', headerColor: 'text-amber-400/70', barGradient: 'linear-gradient(90deg, rgba(120, 53, 15, 0.7) 0%, rgba(217, 119, 6, 0.8) 100%)' },
  { source: 'fractured', label: 'Fractured', headerColor: 'text-purple-400/70', barGradient: 'linear-gradient(90deg, rgba(88, 28, 135, 0.7) 0%, rgba(192, 132, 252, 0.8) 100%)' },
  { source: 'shaper', label: 'Shaper', headerColor: 'text-sky-300/80', barGradient: 'linear-gradient(90deg, rgba(7, 89, 133, 0.7) 0%, rgba(125, 211, 252, 0.8) 100%)' },
  { source: 'elder', label: 'Elder', headerColor: 'text-slate-300/80', barGradient: 'linear-gradient(90deg, rgba(51, 65, 85, 0.7) 0%, rgba(203, 213, 225, 0.8) 100%)' },
  { source: 'crusader', label: 'Crusader', headerColor: 'text-yellow-200/80', barGradient: 'linear-gradient(90deg, rgba(113, 63, 18, 0.7) 0%, rgba(254, 240, 138, 0.8) 100%)' },
  { source: 'redeemer', label: 'Redeemer', headerColor: 'text-teal-300/80', barGradient: 'linear-gradient(90deg, rgba(19, 78, 74, 0.7) 0%, rgba(94, 234, 212, 0.8) 100%)' },
  { source: 'hunter', label: 'Hunter', headerColor: 'text-green-300/80', barGradient: 'linear-gradient(90deg, rgba(20, 83, 45, 0.7) 0%, rgba(134, 239, 172, 0.8) 100%)' },
];

const SOURCE_PILL_COLORS: Record<EnrichedModSource, { bg: string; border: string; text: string }> = {
  prefix: { bg: 'rgba(5, 46, 22, 0.2)', border: 'rgba(52, 211, 153, 0.1)', text: 'text-emerald-400/70' },
  suffix: { bg: 'rgba(76, 29, 149, 0.2)', border: 'rgba(167, 139, 250, 0.1)', text: 'text-violet-400/70' },
  exarch: { bg: 'rgba(124, 45, 18, 0.2)', border: 'rgba(251, 146, 60, 0.1)', text: 'text-orange-400/70' },
  eater: { bg: 'rgba(22, 78, 99, 0.2)', border: 'rgba(34, 211, 238, 0.1)', text: 'text-cyan-400/70' },
  crafted: { bg: 'rgba(30, 58, 138, 0.2)', border: 'rgba(96, 165, 250, 0.1)', text: 'text-blue-400/70' },
  enchant: { bg: 'rgba(120, 53, 15, 0.2)', border: 'rgba(217, 119, 6, 0.1)', text: 'text-amber-400/70' },
  fractured: { bg: 'rgba(88, 28, 135, 0.2)', border: 'rgba(192, 132, 252, 0.1)', text: 'text-purple-400/70' },
  shaper: { bg: 'rgba(7, 89, 133, 0.2)', border: 'rgba(125, 211, 252, 0.1)', text: 'text-sky-300/70' },
  elder: { bg: 'rgba(51, 65, 85, 0.2)', border: 'rgba(203, 213, 225, 0.1)', text: 'text-slate-300/70' },
  crusader: { bg: 'rgba(113, 63, 18, 0.2)', border: 'rgba(254, 240, 138, 0.1)', text: 'text-yellow-200/70' },
  redeemer: { bg: 'rgba(19, 78, 74, 0.2)', border: 'rgba(94, 234, 212, 0.1)', text: 'text-teal-300/70' },
  hunter: { bg: 'rgba(20, 83, 45, 0.2)', border: 'rgba(134, 239, 172, 0.1)', text: 'text-green-300/70' },
};

const INITIAL_CATEGORY_COUNT = 5;
const MAX_CATEGORY_COUNT = 20;

// =============================================================================
// Helpers
// =============================================================================

function getSlotOrder(slot: string): number {
  return SLOT_ORDER[slot] ?? 99;
}

function getSlotDisplayName(slot: string): string {
  if (slot === 'Weapon 1') return 'Main Hand';
  if (slot === 'Weapon 2') return 'Off Hand';
  if (slot === 'Weapon Swap') return 'Weapon Swap';
  return slot;
}

function groupModsByEnrichedSource(mods: ModUsage[]): Map<EnrichedModSource, ModUsage[]> {
  const groups = new Map<EnrichedModSource, ModUsage[]>();
  for (const m of mods) {
    // Use enrichedSource (prefix/suffix/exarch/eater/crafted/enchant/fractured)
    // Fall back to raw source → 'prefix' for old data without enrichment
    const src: EnrichedModSource = (m as { enrichedSource?: EnrichedModSource }).enrichedSource
      ?? (m.source === 'crafted' ? 'crafted'
        : m.source === 'enchant' ? 'enchant'
        : m.source === 'fractured' ? 'fractured'
        : 'prefix');
    let arr = groups.get(src);
    if (!arr) {
      arr = [];
      groups.set(src, arr);
    }
    arr.push(m);
  }
  return groups;
}

// =============================================================================
// SlotGroup Sub-Component
// =============================================================================

interface SlotGroupProps {
  slot: string;
  data: SlotData;
  index: number;
  defaultOpen?: boolean;
  /** Total builds for showing absolute counts */
  buildCount?: number;
  /** Rarity split for this specific slot */
  rarityBreakdown?: { unique: number; rare: number; total: number };
}

function SlotGroup({ slot, data, index, defaultOpen, buildCount, rarityBreakdown }: SlotGroupProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen ?? false);
  const [expandedCategories, setExpandedCategories] = useState<Set<EnrichedModSource>>(new Set());

  const topBaseType = data.baseTypes[0];
  const modsBySource = useMemo(() => groupModsByEnrichedSource(data.mods), [data.mods]);

  const toggleCategory = useCallback((source: EnrichedModSource) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(source)) next.delete(source);
      else next.add(source);
      return next;
    });
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="rounded-lg overflow-hidden"
      style={{
        background: 'rgba(20, 16, 10, 0.4)',
        border: '1px solid rgba(251, 191, 36, 0.06)',
      }}
    >
      {/* Slot header - clickable accordion trigger */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 text-left',
          'hover:bg-amber-500/[0.03] transition-colors duration-200'
        )}
      >
        <ChevronDown
          className={cn(
            'w-3.5 h-3.5 text-slate-600 transition-transform duration-200 flex-shrink-0',
            isOpen && 'rotate-180'
          )}
        />

        {/* Left side: slot name + top base type */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-[0.6875rem] font-display font-medium text-slate-300">
            {getSlotDisplayName(slot)}
          </span>
          {topBaseType && !isOpen ? (
            <span className="text-[0.625rem] text-slate-500 truncate">
              {topBaseType.name}
            </span>
          ) : null}
        </div>

        {/* Right side: summary pills */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Rarity split indicator */}
          {rarityBreakdown && rarityBreakdown.total > 0 ? (
            <span className="text-[0.5rem] px-1.5 py-0.5 rounded tabular-nums" style={{
              background: 'rgba(30, 25, 18, 0.5)',
              border: '1px solid rgba(100, 80, 50, 0.1)',
            }}>
              <span className="text-yellow-400/50">
                {Math.round((rarityBreakdown.unique / rarityBreakdown.total) * 100)}% uniq
              </span>
              <span className="text-slate-600"> · </span>
              <span className="text-amber-600/50">
                {Math.round((rarityBreakdown.rare / rarityBreakdown.total) * 100)}% rare
              </span>
            </span>
          ) : null}
          {data.uniques.length > 0 ? (
            <span
              className="text-[0.5625rem] px-1.5 py-0.5 rounded tabular-nums"
              style={{
                color: 'rgba(253, 224, 71, 0.7)',
                background: 'rgba(113, 63, 18, 0.2)',
                border: '1px solid rgba(234, 179, 8, 0.1)',
              }}
            >
              {data.uniques.length} unique{data.uniques.length !== 1 ? 's' : ''}
            </span>
          ) : null}
          {/* Source breakdown pills */}
          {SOURCE_CATEGORIES.map(cat => {
            const mods = modsBySource.get(cat.source);
            if (!mods || mods.length === 0) return null;
            const pill = SOURCE_PILL_COLORS[cat.source];
            return (
              <span
                key={cat.source}
                className={cn('text-[0.5625rem] px-1.5 py-0.5 rounded tabular-nums', pill.text)}
                style={{ background: pill.bg, border: `1px solid ${pill.border}` }}
              >
                {mods.length} {cat.label.toLowerCase()}
              </span>
            );
          })}
        </div>
      </button>

      {/* Expandable content */}
      <AnimatePresence>
        {isOpen ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1 space-y-3">
              {/* Sub-section: UNIQUES */}
              {data.uniques.length > 0 ? (
                <div>
                  <span className="text-[0.5625rem] font-semibold text-yellow-400/70 uppercase tracking-wider">
                    Uniques
                  </span>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {data.uniques.map((item) => (
                      <span
                        key={`${item.name}-${item.slot}`}
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded"
                        style={{
                          background: 'rgba(113, 63, 18, 0.2)',
                          border: '1px solid rgba(161, 98, 7, 0.15)',
                        }}
                      >
                        <span className="text-[0.625rem] text-yellow-300/80">{item.name}</span>
                        <span className="text-[0.5625rem] text-yellow-500/60 tabular-nums">
                          {Math.round(item.usage)}%
                          {item.count != null ? (
                            <span className="text-yellow-600/40"> · {item.count}</span>
                          ) : null}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Sub-section: BASE TYPES */}
              {data.baseTypes.length > 0 ? (
                <div>
                  <span className="text-[0.5625rem] font-semibold text-amber-400/60 uppercase tracking-wider">
                    Base Types
                  </span>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {data.baseTypes.map((item) => (
                      <span
                        key={`${item.name}-${item.slot}`}
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded"
                        style={{
                          background: 'rgba(120, 53, 15, 0.15)',
                          border: '1px solid rgba(146, 64, 14, 0.1)',
                        }}
                      >
                        <span className="text-[0.625rem] text-stone-300">{item.name}</span>
                        <span className="text-[0.5625rem] text-amber-500/50 tabular-nums">
                          {Math.round(item.usage)}%
                          {item.count != null ? (
                            <span className="text-amber-600/35"> · {item.count}</span>
                          ) : null}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Sub-section: IMPLICITS (flask base type effects) */}
              {slot === 'Flasks' && data.baseTypes.length > 0 ? (
                <div>
                  <span className="text-[0.5625rem] font-semibold text-sky-400/60 uppercase tracking-wider">
                    Implicits
                  </span>
                  <div className="space-y-px mt-1">
                    {data.baseTypes
                      .filter(item => FLASK_BASE_IMPLICITS[item.name])
                      .map((item) => (
                        <div
                          key={`implicit-${item.name}`}
                          className="flex items-center justify-between gap-2 py-0.5 px-1.5 rounded"
                          style={{ background: 'rgba(14, 116, 144, 0.08)' }}
                        >
                          <span className="text-[0.6875rem] text-sky-200/70 truncate">
                            {FLASK_BASE_IMPLICITS[item.name]}
                          </span>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className="text-[0.5625rem] text-stone-500">{item.name}</span>
                            <span className="text-[0.625rem] text-sky-500/50 font-mono tabular-nums">
                              {Math.round(item.usage)}%
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ) : null}

              {/* Sub-sections: Mods grouped by source category */}
              {SOURCE_CATEGORIES.map(cat => {
                const catMods = modsBySource.get(cat.source);
                if (!catMods || catMods.length === 0) return null;
                const isExpanded = expandedCategories.has(cat.source);
                const visibleMods = isExpanded
                  ? catMods.slice(0, MAX_CATEGORY_COUNT)
                  : catMods.slice(0, INITIAL_CATEGORY_COUNT);
                const hiddenCount = Math.min(catMods.length, MAX_CATEGORY_COUNT) - INITIAL_CATEGORY_COUNT;

                return (
                  <div key={cat.source}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={cn('text-[0.5625rem] font-semibold uppercase tracking-wider', cat.headerColor)}>
                        {cat.label}
                      </span>
                      <span className="text-[0.5625rem] text-slate-600 tabular-nums">
                        {catMods.length}
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      {visibleMods.map((mod, i) => (
                        <div
                          key={`${mod.mod}-${mod.slot}-${i}`}
                          className="flex items-center gap-1.5"
                        >
                          <span
                            className="text-[10.5px] text-slate-300 flex-1 truncate"
                            title={mod.mod}
                          >
                            {mod.mod}
                          </span>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <div className="w-16 h-[3px] rounded-full bg-slate-800/70 overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(mod.usage, 100)}%` }}
                                transition={{ delay: i * 0.03, duration: 0.4, ease: 'easeOut' }}
                                className="h-full rounded-full"
                                style={{ background: cat.barGradient }}
                              />
                            </div>
                            <span className="text-[0.625rem] text-slate-500 text-right tabular-nums whitespace-nowrap">
                              {Math.round(mod.usage)}%
                              {mod.count != null ? (
                                <span className="text-slate-600/60"> · {mod.count}</span>
                              ) : null}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    {hiddenCount > 0 && !isExpanded ? (
                      <button
                        onClick={() => toggleCategory(cat.source)}
                        className={cn('text-[0.5625rem] hover:brightness-125 cursor-pointer mt-1 transition-colors duration-150', cat.headerColor)}
                      >
                        Show {hiddenCount} more
                      </button>
                    ) : null}
                    {isExpanded && catMods.length > INITIAL_CATEGORY_COUNT ? (
                      <button
                        onClick={() => toggleCategory(cat.source)}
                        className={cn('text-[0.5625rem] hover:brightness-125 cursor-pointer mt-1 transition-colors duration-150', cat.headerColor)}
                      >
                        Show less
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

function GearBySlotSectionRaw({
  uniqueItems,
  rareMods,
  rareBaseTypes,
  buildCount,
  slotRarityBreakdown,
  staggerBase = 0,
  uniqueFlasks,
  flaskBaseTypes,
  flaskMods,
  flaskEnchants,
}: GearBySlotSectionProps) {
  // Merge all three arrays into a Map<slot, SlotData>
  const slotEntries = useMemo(() => {
    const slotMap = new Map<string, SlotData>();

    function ensureSlot(slot: string): SlotData {
      let entry = slotMap.get(slot);
      if (!entry) {
        entry = { uniques: [], baseTypes: [], mods: [] };
        slotMap.set(slot, entry);
      }
      return entry;
    }

    for (const item of uniqueItems ?? []) {
      const slot = normalizeSlot(item.slot || 'Unknown');
      ensureSlot(slot).uniques.push(item);
    }

    for (const item of rareBaseTypes ?? []) {
      const slot = normalizeSlot(item.slot || 'Unknown');
      ensureSlot(slot).baseTypes.push(item);
    }

    for (const mod of rareMods ?? []) {
      const slot = normalizeSlot(mod.slot || 'Unknown');
      ensureSlot(slot).mods.push(mod);
    }

    // Inject flask data into the 'Flasks' slot group
    if (uniqueFlasks?.length || flaskBaseTypes?.length || flaskMods?.length) {
      const flaskGroup = ensureSlot('Flasks');
      for (const f of uniqueFlasks ?? []) {
        flaskGroup.uniques.push({ name: f.name, slot: 'Flask', usage: f.usage, count: f.count });
      }
      for (const b of flaskBaseTypes ?? []) {
        flaskGroup.baseTypes.push(b);
      }
      for (const m of flaskMods ?? []) {
        flaskGroup.mods.push(m);
      }
      for (const e of flaskEnchants ?? []) {
        flaskGroup.mods.push(e);
      }
    }

    // Deduplicate merged slots (e.g., Ring 1+2 may have same unique/base/mod)
    // Keep the highest usage% when duplicates exist
    function dedupeByName<T extends { name: string; usage: number }>(items: T[]): T[] {
      const map = new Map<string, T>();
      for (const item of items) {
        const existing = map.get(item.name);
        if (!existing || item.usage > existing.usage) map.set(item.name, item);
      }
      return Array.from(map.values());
    }
    function dedupeByMod(mods: ModUsage[]): ModUsage[] {
      const map = new Map<string, ModUsage>();
      for (const mod of mods) {
        const key = `${mod.mod}:${(mod as { enrichedSource?: string }).enrichedSource ?? mod.source ?? ''}`;
        const existing = map.get(key);
        if (!existing || mod.usage > existing.usage) map.set(key, mod);
      }
      return Array.from(map.values());
    }

    // Sort within each slot, deduplicate, and filter out empty slots
    return Array.from(slotMap.entries())
      .filter(
        ([, data]) =>
          data.uniques.length > 0 || data.baseTypes.length > 0 || data.mods.length > 0
      )
      .sort(([a], [b]) => getSlotOrder(a) - getSlotOrder(b))
      .map(([slot, data]) => ({
        slot,
        data: {
          uniques: dedupeByName(data.uniques).sort((a, b) => b.usage - a.usage),
          baseTypes: dedupeByName(data.baseTypes).sort((a, b) => b.usage - a.usage),
          mods: dedupeByMod(data.mods).sort((a, b) => b.usage - a.usage),
        },
      }));
  }, [uniqueItems, rareMods, rareBaseTypes, uniqueFlasks, flaskBaseTypes, flaskMods, flaskEnchants]);

  // Look up rarity breakdown for a normalized slot name.
  // Backend keys use raw slot names like "Ring 1", "Ring 2", "Helmet" etc.
  // We try both the normalized name and common raw variants.
  const getRarityBreakdown = useCallback((normalizedSlot: string) => {
    if (!slotRarityBreakdown) return undefined;
    // Direct match first
    const direct = slotRarityBreakdown[normalizedSlot];
    if (direct) return direct;
    // For merged slots, combine raw entries
    if (normalizedSlot === 'Rings') {
      const r1 = slotRarityBreakdown['Ring 1'];
      const r2 = slotRarityBreakdown['Ring 2'];
      if (r1 || r2) {
        return {
          unique: (r1?.unique ?? 0) + (r2?.unique ?? 0),
          rare: (r1?.rare ?? 0) + (r2?.rare ?? 0),
          total: (r1?.total ?? 0) + (r2?.total ?? 0),
        };
      }
    }
    if (normalizedSlot === 'Grafts') {
      const g1 = slotRarityBreakdown['BrequelGrafts'];
      const g2 = slotRarityBreakdown['BrequelGrafts2'];
      if (g1 || g2) {
        return {
          unique: (g1?.unique ?? 0) + (g2?.unique ?? 0),
          rare: (g1?.rare ?? 0) + (g2?.rare ?? 0),
          total: (g1?.total ?? 0) + (g2?.total ?? 0),
        };
      }
    }
    return undefined;
  }, [slotRarityBreakdown]);

  if (slotEntries.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: staggerBase * 0.001, duration: 0.35 }}
    >
      {/* Section header */}
      <div className="flex items-center gap-2 mb-3">
        <Shield className="w-3.5 h-3.5 text-amber-400/70" />
        <span className="text-[0.625rem] font-display font-semibold text-amber-400/80 uppercase tracking-wider">
          Gear by Slot
        </span>
        <span className="text-[0.5625rem] text-slate-600 ml-auto">
          {slotEntries.length} slots
        </span>
      </div>

      {/* Slot groups */}
      <div className="space-y-1.5">
        {slotEntries.map((entry, i) => (
          <SlotGroup
            key={entry.slot}
            slot={entry.slot}
            data={entry.data}
            index={i}
            defaultOpen={false}
            buildCount={buildCount}
            rarityBreakdown={getRarityBreakdown(entry.slot)}
          />
        ))}
      </div>
    </motion.div>
  );
}

export const GearBySlotSection = memo(GearBySlotSectionRaw);
