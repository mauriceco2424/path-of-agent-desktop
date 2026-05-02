/**
 * ItemTooltip Component
 *
 * PoE-style item tooltip showing item name, base type, stats, and mods.
 * Used as hover content for the equipment icon grid.
 */

import type React from 'react';
import { cn } from '../../lib/utils';
import type { StructuredMods, ItemDisplayInfo, BaseDefenseStats, ModEntry } from '../../store';
import { FLASK_BASE_EFFECTS } from './flask-constants';

interface ItemTooltipProps {
  name: string;
  baseName: string;
  rarity: string;
  mods?: StructuredMods;
  displayInfo?: ItemDisplayInfo;
  baseStats?: BaseDefenseStats;
  /** Raw item text from PoB for parsing requirements */
  raw?: string;
  /** Structured attribute requirements from PoB (preferred over raw text parsing) */
  requirements?: { level?: number; str?: number; dex?: number; int?: number };
  /** Compact mode for side-by-side display in strategy batches (200px vs 320px) */
  compact?: boolean;
  /** Active skill/aura names in the build — used to filter irrelevant Searing Exarch mods */
  activeSkillNames?: Set<string>;
  /** Cluster notable stats lookup — maps notable name → stat lines for PoB-style breakdown */
  clusterNotableStats?: Record<string, string[]>;
}

// PoB-style rarity header colors - darker background with colored text
const rarityHeaderColors: Record<string, { border: string; text: string }> = {
  NORMAL: { border: 'border-[#3a3a3a]', text: 'text-[#c8c8c8]' },
  MAGIC: { border: 'border-[#4a4aff]', text: 'text-[#8888ff]' },
  RARE: { border: 'border-[#ffff77]', text: 'text-[#ffff77]' },
  UNIQUE: { border: 'border-[#af6025]', text: 'text-[#af6025]' },
};

// Mod colors - PoB-matched colors
const modColors = {
  implicit: 'text-[#8888FF]',    // PoB implicit blue
  explicit: 'text-[#8888FF]',    // PoB explicit blue
  prefix: 'text-[#8888FF]',     // Blue
  suffix: 'text-[#8888FF]',     // Blue
  crafted: 'text-[#B4B4FF]',     // Light blue for crafted mods
  fractured: 'text-[#A38D6D]',   // Gold/brown for fractured mods
  enchant: 'text-[#C8C8C8]',     // White — PoB enchant color
  unknown: 'text-[#8888FF]',     // Blue
} as const;

// Cluster jewel specific colors — matches tree tooltip PoB style
const clusterColors = {
  enchant: 'text-[#C8C8C8]',     // White for structural/enchant lines
  explicit: 'text-[#8888FF]',    // Blue for rolled affixes
  notable: 'text-[#DAA520]',     // Gold for notable names
  notableStat: 'text-[#C8C8C8]', // White for notable stat descriptions
} as const;

/** Detect cluster jewels from base name */
function isClusterJewelBase(baseName: string | undefined): boolean {
  return !!baseName && /cluster jewel/i.test(baseName);
}

/**
 * Extract cluster jewel notables from explicit mods.
 * Returns notables with their stats parsed from adjacent mod lines.
 * Mods like "1 Added Passive Skill is X" indicate notables.
 */
interface ClusterNotable {
  name: string;
  /** Index in the explicit mods array where the notable was declared */
  modIndex: number;
}

function extractClusterNotablesFromMods(explicits: ModEntry[]): ClusterNotable[] {
  const notables: ClusterNotable[] = [];
  const nonNotables = new Set(['jewel socket', 'jewel sockets', 'a jewel socket']);

  for (let i = 0; i < explicits.length; i++) {
    const text = (explicits[i].text || '').trim();
    const match = text.match(/(?:\d+\s+)?Added Passive Skill is (.+)/i);
    if (match && match[1]) {
      const name = match[1].trim();
      if (!nonNotables.has(name.toLowerCase())) {
        notables.push({ name, modIndex: i });
      }
    }
  }
  return notables;
}

// Influence badge colors
const influenceColors: Record<string, string> = {
  shaper: 'bg-blue-600/60 text-blue-200',
  elder: 'bg-gray-600/60 text-gray-200',
  crusader: 'bg-yellow-600/60 text-yellow-200',
  hunter: 'bg-green-600/60 text-green-200',
  redeemer: 'bg-cyan-600/60 text-cyan-200',
  warlord: 'bg-red-600/60 text-red-200',
};

/**
 * Format tier/roll info for display (matches EquipmentSlotItem)
 */
interface TierRollDisplay {
  affixBadge?: { label: string; colorClass: string };
  tierRange?: string;
  /** Tier number for color-coding (1 = best) */
  tierNum?: number;
}

/** Color class for tier label based on tier number */
function getTierColorClass(tier: number): string {
  if (tier === 1) return 'text-amber-400';
  if (tier === 2) return 'text-stone-300';
  return 'text-stone-500';
}

function formatTierRollInfo(mod: ModEntry): TierRollDisplay | null {
  const result: TierRollDisplay = {};

  // Helper to add P/S badge based on affixType
  const addAffixBadge = () => {
    if (mod.affixType === 'prefix') {
      result.affixBadge = { label: 'P', colorClass: 'text-sky-400' };
    } else if (mod.affixType === 'suffix') {
      result.affixBadge = { label: 'S', colorClass: 'text-orange-400' };
    }
  };

  // Tier info for rare items (with P/S badge)
  if (mod.tier && mod.tierRange) {
    result.tierRange = `T${mod.tier} [${mod.tierRange.min}-${mod.tierRange.max}]`;
    result.tierNum = mod.tier;
    addAffixBadge();
  }
  // Tier without range (e.g. constructed items from gear tools)
  else if (mod.tier) {
    result.tierRange = `T${mod.tier}`;
    result.tierNum = mod.tier;
    addAffixBadge();
  }
  // Roll range for unique items - also show P/S badge if we know the affix type
  else if (mod.rollRange) {
    result.tierRange = `[${mod.rollRange.min}-${mod.rollRange.max}]`;
    addAffixBadge();
  }
  // No tier or roll range, but still show P/S badge if we have affix type
  else if (mod.affixType === 'prefix' || mod.affixType === 'suffix') {
    addAffixBadge();
  }

  // Return null if nothing to display
  if (!result.affixBadge && !result.tierRange) {
    return null;
  }

  return result;
}

function getModColor(affixType: string | undefined, isFractured?: boolean, isCrafted?: boolean): string {
  if (isFractured) return modColors.fractured;
  if (isCrafted) return modColors.crafted;
  // Blue for all regular explicits
  return modColors.explicit;
}

/**
 * Extract item requirements from raw item text.
 * Parses PoB format (LevelReq:) and in-game format (Requires Level X, Y Str, Z Dex)
 */
interface ItemRequirements {
  level?: number;
  str?: number;
  dex?: number;
  int?: number;
}

function extractRequirements(raw: string | undefined): ItemRequirements | null {
  if (!raw) return null;

  const reqs: ItemRequirements = {};

  // Format 1: LevelReq: 65 (PoB modern format)
  const levelReqMatch = raw.match(/LevelReq:\s*(\d+)/i);
  if (levelReqMatch) {
    reqs.level = parseInt(levelReqMatch[1], 10);
  }

  // Format 2: Level: 68 (under Requirements section)
  const levelMatch = raw.match(/\bLevel:\s*(\d+)/m);
  if (levelMatch && !reqs.level) {
    reqs.level = parseInt(levelMatch[1], 10);
  }

  // Simpler patterns for Str/Dex/Int - use word boundary
  const strMatch = raw.match(/\bStr:\s*(\d+)/m);
  const dexMatch = raw.match(/\bDex:\s*(\d+)/m);
  const intMatch = raw.match(/\bInt:\s*(\d+)/m);

  if (strMatch) reqs.str = parseInt(strMatch[1], 10);
  if (dexMatch) reqs.dex = parseInt(dexMatch[1], 10);
  if (intMatch) reqs.int = parseInt(intMatch[1], 10);

  return Object.keys(reqs).length > 0 ? reqs : null;
}

/**
 * Extract item quality from raw text
 */
function extractQuality(raw: string | undefined): number | null {
  if (!raw) return null;
  const match = raw.match(/Quality:\s*\+?(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Extract socket string from raw text
 */
function extractSockets(raw: string | undefined): string | null {
  if (!raw) return null;
  const match = raw.match(/Sockets:\s*([RGBWDA\-\s]+)/i);
  return match ? match[1].trim() : null;
}

function extractBaseStatsFromRaw(raw: string | undefined): BaseDefenseStats | null {
  if (!raw) return null;

  const stats: BaseDefenseStats = {};
  const armourMatch = raw.match(/^Armour:\s*(\d+)$/im);
  const evasionMatch = raw.match(/^Evasion(?:\s+Rating)?:\s*(\d+)$/im);
  const energyShieldMatch = raw.match(/^Energy Shield:\s*(\d+)$/im);
  const wardMatch = raw.match(/^Ward:\s*(\d+)$/im);
  const blockMatch = raw.match(/^(?:Chance to )?Block:\s*(\d+)%$/im);

  if (armourMatch) stats.armour = parseInt(armourMatch[1], 10);
  if (evasionMatch) stats.evasion = parseInt(evasionMatch[1], 10);
  if (energyShieldMatch) stats.energyShield = parseInt(energyShieldMatch[1], 10);
  if (wardMatch) stats.ward = parseInt(wardMatch[1], 10);
  if (blockMatch) stats.block = parseInt(blockMatch[1], 10);

  return Object.keys(stats).length > 0 ? stats : null;
}

function extractWeaponStatsFromRaw(raw: string | undefined): ItemDisplayInfo['weaponStats'] | null {
  if (!raw) return null;

  const weaponStats: NonNullable<ItemDisplayInfo['weaponStats']> = {};
  const physicalMatch = raw.match(/^Physical Damage:\s*(\d+)-(\d+)$/im);
  const elementalMatch = raw.match(/^Elemental Damage:\s*(.+)$/im);
  const chaosMatch = raw.match(/^Chaos Damage:\s*(\d+)-(\d+)$/im);
  const critMatch = raw.match(/^Critical Strike Chance:\s*([\d.]+)%$/im);
  const attackRateMatch = raw.match(/^Attacks per Second:\s*([\d.]+)$/im);

  if (physicalMatch) {
    weaponStats.physicalMin = parseInt(physicalMatch[1], 10);
    weaponStats.physicalMax = parseInt(physicalMatch[2], 10);
  }

  if (elementalMatch) {
    const ranges = elementalMatch[1]
      .split(',')
      .map((part) => part.trim().match(/(\d+)-(\d+)/))
      .filter((match): match is RegExpMatchArray => match != null);

    if (ranges[0]) {
      weaponStats.fireMin = parseInt(ranges[0][1], 10);
      weaponStats.fireMax = parseInt(ranges[0][2], 10);
    }
    if (ranges[1]) {
      weaponStats.coldMin = parseInt(ranges[1][1], 10);
      weaponStats.coldMax = parseInt(ranges[1][2], 10);
    }
    if (ranges[2]) {
      weaponStats.lightningMin = parseInt(ranges[2][1], 10);
      weaponStats.lightningMax = parseInt(ranges[2][2], 10);
    }
  }

  if (chaosMatch) {
    weaponStats.chaosMin = parseInt(chaosMatch[1], 10);
    weaponStats.chaosMax = parseInt(chaosMatch[2], 10);
  }

  if (critMatch) {
    weaponStats.critChance = parseFloat(critMatch[1]);
  }

  if (attackRateMatch) {
    weaponStats.attackRate = parseFloat(attackRateMatch[1]);
  }

  return Object.keys(weaponStats).length > 0 ? weaponStats : null;
}


// Socket color mapping for display
const SOCKET_COLORS: Record<string, string> = {
  R: 'text-red-400',
  G: 'text-green-400',
  B: 'text-blue-400',
  W: 'text-slate-100',
  A: 'text-slate-100', // Abyssal
  D: 'text-slate-100', // Delve
};

/**
 * Check if a Searing Exarch implicit mod references a specific skill/aura
 * that the build doesn't use. Returns true if the mod should be shown.
 */
function shouldShowExarchMod(modText: string, activeSkillNames?: Set<string>): boolean {
  if (!activeSkillNames) return true;

  // Extract skill name from patterns like "Determination has (28-30)% increased Aura Effect"
  // or "Melee Hits have (12-13)% chance to Fortify"
  const match = modText.match(/^(.+?)\s+(?:has|have)\s/i);
  if (!match) return true; // No skill name pattern — generic mod, always show

  const extractedName = match[1].trim();

  // Check if ANY active skill name matches (case-insensitive)
  const lowerName = extractedName.toLowerCase();
  for (const skillName of activeSkillNames) {
    if (skillName.toLowerCase() === lowerName) return true;
  }

  // Extracted name didn't match any active skill — hide this mod
  return false;
}

export function ItemTooltip({
  name,
  baseName,
  rarity,
  mods,
  displayInfo,
  baseStats,
  raw,
  requirements: structuredReqs,
  compact = false,
  activeSkillNames,
  clusterNotableStats,
}: ItemTooltipProps) {
  const rarityUpper = rarity?.toUpperCase() || 'NORMAL';
  const headerStyle = rarityHeaderColors[rarityUpper] || rarityHeaderColors.NORMAL;

  const displayName = displayInfo?.itemName || name || '';
  const displayBaseName = displayInfo?.baseName || baseName || '';
  const isCorrupted = displayInfo?.isCorrupted || false;
  const influences = displayInfo?.influences || [];
  const isFractured = displayInfo?.isFractured || false;
  const rawBaseStats = extractBaseStatsFromRaw(raw);
  const stats = rawBaseStats || displayInfo?.baseStats || baseStats;
  // Prefer structured requirements from PoB, fall back to raw text parsing
  const requirements = structuredReqs || extractRequirements(raw);
  const quality = extractQuality(raw);
  const sockets = extractSockets(raw);
  const rawWeaponStats = extractWeaponStatsFromRaw(raw);
  const weaponStats = rawWeaponStats || displayInfo?.weaponStats;

  // Flask base effect lookup (e.g., Jade Flask -> "+3000 to Evasion Rating during Effect")
  const flaskBaseEffect = FLASK_BASE_EFFECTS[displayBaseName] || FLASK_BASE_EFFECTS[baseName] || null;

  // Cluster jewel detection — enables PoB-matched color scheme
  const isCluster = isClusterJewelBase(displayBaseName) || isClusterJewelBase(baseName);
  const clusterNotables = isCluster && mods?.explicits
    ? extractClusterNotablesFromMods(mods.explicits)
    : [];
  // Set of explicit mod indices that are notable declarations (rendered separately)
  const clusterNotableIndices = new Set(clusterNotables.map(n => n.modIndex));

  // Count mods
  const hasImplicits = mods?.implicits && mods.implicits.some(m => {
    if (!m.text?.trim()) return false;
    const isExarchMod = m.text.includes('{tags:exarch_mod}');
    if (isExarchMod) {
      const cleanText = m.text.replace(/\{tags:[^}]+\}/g, '').trim();
      return shouldShowExarchMod(cleanText, activeSkillNames);
    }
    return true;
  });
  const hasExplicits = mods?.explicits && mods.explicits.some(m => m.text?.trim());
  const hasCrafted = mods?.crafted && mods.crafted.some(m => m.text?.trim());
  const hasEnchants = mods?.enchants && mods.enchants.some(m => m.text?.trim());
  const hasAnyMods = hasImplicits || hasExplicits || hasCrafted || hasEnchants;

  // Get combined tier/badge info for a mod (single call to formatTierRollInfo)
  const getModTierInfo = (mod: ModEntry): TierRollDisplay | null => formatTierRollInfo(mod);

  return (
    <div className={cn(
      'bg-[#0c0c0e] rounded-sm shadow-2xl relative overflow-hidden',
      compact ? 'w-[200px] border text-xs' : 'w-80 border-2 text-sm',
      headerStyle.border
    )}>
      {/* Subtle inner glow for depth */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#1a1510]/20 to-transparent pointer-events-none" />

      {/* Content wrapper */}
      <div className="relative z-10">
        {/* Header - Item name with rarity color */}
        <div className={cn(
          'border-b border-[#3a3530]/60 text-center',
          compact ? 'px-2 py-1.5' : 'px-4 py-2.5'
        )}>
          <div className={cn(
            'font-pob font-semibold',
            compact ? 'text-[0.6875rem]' : 'text-base',
            headerStyle.text
          )}>
            {displayName}
          </div>
          {displayBaseName && displayBaseName !== displayName && (
            <div className={cn(
              'text-[#7f7f7f] mt-0.5 font-pob',
              compact ? 'text-[0.5625rem]' : 'text-xs'
            )}>
              {displayBaseName}
            </div>
          )}
        </div>

        {/* Content */}
        <div className={cn(
          compact ? 'px-2 py-1.5 space-y-1' : 'px-4 py-3 space-y-1.5'
        )}>
          {/* Quality - centered (hidden in compact) */}
          {!compact && quality !== null && quality > 0 && (
            <div className="text-xs text-[#8888ff] font-pob text-center">
              Quality: +{quality}%
            </div>
          )}

          {/* Flask base effect (utility flasks have intrinsic effects) */}
          {flaskBaseEffect && (
            <div className={cn(
              'text-amber-300/90 italic text-center font-pob',
              compact ? 'text-[0.625rem]' : 'text-xs'
            )}>
              {flaskBaseEffect}
            </div>
          )}

          {/* Weapon stats - centered, PoB tooltip style */}
          {weaponStats && (
            <div className={cn(
              'font-pob space-y-0.5 text-center',
              compact ? 'text-[0.5625rem]' : 'text-xs'
            )}>
              {weaponStats.physicalDPS != null && weaponStats.physicalMin != null && weaponStats.physicalMax != null && (
                <div className="text-[#7f7f7f]">
                  Physical Damage: <span className="text-[#8888ff]">{Math.round(weaponStats.physicalMin)}-{Math.round(weaponStats.physicalMax)}</span>
                </div>
              )}
              {weaponStats.elementalDPS != null && (
                <div className="text-[#7f7f7f]">
                  Elemental Damage:{' '}
                  {[
                    weaponStats.fireMin != null && weaponStats.fireMax != null && (
                      <span key="fire" className="text-red-400">{Math.round(weaponStats.fireMin)}-{Math.round(weaponStats.fireMax)}</span>
                    ),
                    weaponStats.coldMin != null && weaponStats.coldMax != null && (
                      <span key="cold" className="text-blue-300">{Math.round(weaponStats.coldMin)}-{Math.round(weaponStats.coldMax)}</span>
                    ),
                    weaponStats.lightningMin != null && weaponStats.lightningMax != null && (
                      <span key="lightning" className="text-yellow-300">{Math.round(weaponStats.lightningMin)}-{Math.round(weaponStats.lightningMax)}</span>
                    ),
                  ].filter(Boolean).reduce<React.ReactNode[]>((acc, el, i) => {
                    if (i > 0) acc.push(<span key={`sep-${i}`} className="text-[#7f7f7f]">, </span>);
                    acc.push(el);
                    return acc;
                  }, [])}
                </div>
              )}
              {weaponStats.chaosDPS != null && weaponStats.chaosMin != null && weaponStats.chaosMax != null && (
                <div className="text-[#7f7f7f]">
                  Chaos Damage: <span className="text-[#d02090]">{Math.round(weaponStats.chaosMin)}-{Math.round(weaponStats.chaosMax)}</span>
                </div>
              )}
              {weaponStats.critChance != null && (
                <div className="text-[#7f7f7f]">
                  Critical Strike Chance: <span className="text-[#8888ff]">{weaponStats.critChance.toFixed(2)}%</span>
                </div>
              )}
              {weaponStats.attackRate != null && (
                <div className="text-[#7f7f7f]">
                  Attacks per Second: <span className="text-[#8888ff]">{weaponStats.attackRate.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}

          {/* Defense stats - centered */}
          {stats && (
            <div className={cn(
              'text-[#8888ff] font-pob space-x-3 text-center',
              compact ? 'text-[0.5625rem]' : 'text-xs'
            )}>
              {stats.armour !== undefined && stats.armour > 0 && (
                <span>Armour: {stats.armour.toLocaleString()}</span>
              )}
              {stats.evasion !== undefined && stats.evasion > 0 && (
                <span>Evasion: {stats.evasion.toLocaleString()}</span>
              )}
              {stats.energyShield !== undefined && stats.energyShield > 0 && (
                <span>ES: {stats.energyShield.toLocaleString()}</span>
              )}
              {stats.ward !== undefined && stats.ward > 0 && (
                <span>Ward: {stats.ward.toLocaleString()}</span>
              )}
              {stats.block !== undefined && stats.block > 0 && (
                <span>Block: {stats.block}%</span>
              )}
            </div>
          )}

          {/* Sockets - colored display, centered (hidden in compact) */}
          {!compact && sockets && (
            <div className="text-xs text-[#7f7f7f] font-pob text-center">
              Sockets:{' '}
              <span className="font-mono">
                {sockets.split('').map((char, idx) => {
                  if (char === '-' || char === ' ') {
                    return <span key={idx} className="text-[#5a5a5a]">{char}</span>;
                  }
                  const colorClass = SOCKET_COLORS[char.toUpperCase()] || 'text-[#c8c8c8]';
                  return <span key={idx} className={colorClass}>{char}</span>;
                })}
              </span>
            </div>
          )}

          {/* Requirements - centered (hidden in compact) */}
          {!compact && requirements && (
            <div className="text-xs text-[#7f7f7f] font-pob text-center">
              Requires{' '}
              {(() => {
                const parts: string[] = [];
                if (requirements.level) parts.push(`Level ${requirements.level}`);
                if (requirements.str) parts.push(`${requirements.str} Str`);
                if (requirements.dex) parts.push(`${requirements.dex} Dex`);
                if (requirements.int) parts.push(`${requirements.int} Int`);
                return parts.join(', ');
              })()}
            </div>
          )}

          {/* Status badges - centered */}
          {(isCorrupted || influences.length > 0) && (
            <div className="flex flex-wrap gap-1 justify-center">
              {isCorrupted && (
                <span className={cn(
                  'rounded bg-red-900/60 text-red-400 font-medium',
                  compact ? 'text-[0.5rem] px-1 py-0.5' : 'text-xs px-1.5 py-0.5'
                )}>
                  Corrupted
                </span>
              )}
              {influences.map((influence) => (
                <span
                  key={influence}
                  className={cn(
                    'rounded font-medium capitalize',
                    compact ? 'text-[0.5rem] px-1 py-0.5' : 'text-xs px-1.5 py-0.5',
                    influenceColors[influence.toLowerCase()] || 'bg-slate-700/60 text-slate-300'
                  )}
                >
                  {influence}
                </span>
              ))}
            </div>
          )}

          {/* Separator before mods */}
          {hasAnyMods && (stats || weaponStats || isCorrupted || influences.length > 0 || (!compact && (quality || sockets || requirements))) && (
            <div className={cn('border-t border-[#3a3530]/50', compact ? 'my-1' : 'my-2')} />
          )}

          {/* Enchants - left-aligned with right info */}
          {hasEnchants && (
            <div className="space-y-0.5">
              {mods!.enchants.filter(m => m.text?.trim()).map((mod, idx) => {
                const info = getModTierInfo(mod);
                return (
                  <div key={`enchant-${idx}`} className={cn('flex justify-between items-baseline', compact ? 'gap-2' : 'gap-4')}>
                    <span className={cn('font-pob', compact ? 'text-[0.625rem]' : 'text-xs', modColors.enchant)}>
                      {mod.text || ''}
                    </span>
                    {info && (info.tierRange || info.affixBadge) && (
                      <span className={cn('flex items-center gap-1.5 whitespace-nowrap', compact ? 'text-[0.5rem]' : 'text-xs')}>
                        {info.tierRange && (
                          <span className={info.tierNum ? getTierColorClass(info.tierNum) : 'text-slate-500'}>
                            {info.tierRange}
                          </span>
                        )}
                        {info.affixBadge && <span className={cn('font-semibold', info.affixBadge.colorClass)}>{info.affixBadge.label}</span>}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Separator between enchants and implicits/explicits */}
          {hasEnchants && (hasImplicits || hasExplicits || hasCrafted) && (
            <div className={cn('border-t border-[#3a3530]/30', compact ? 'my-1' : 'my-2')} />
          )}

          {/* Implicits - left-aligned with right info */}
          {hasImplicits && (
            <div className="space-y-0.5">
              {mods!.implicits.filter(m => {
                if (!m.text?.trim()) return false;
                // Filter Searing Exarch mods that reference skills/auras the build doesn't use
                if (m.implicitSource === 'searing_exarch') {
                  return shouldShowExarchMod(m.text, activeSkillNames);
                }
                // Legacy: check for tags still in text (shouldn't happen after parser update, but safe)
                const isExarchMod = m.text.includes('{tags:exarch_mod}');
                if (isExarchMod) {
                  const cleanText = m.text.replace(/\{tags:[^}]+\}/g, '').trim();
                  return shouldShowExarchMod(cleanText, activeSkillNames);
                }
                return true;
              }).map((mod, idx) => {
                const info = getModTierInfo(mod);
                // Source badge for implicits: EX (Searing Exarch), EW (Eater of Worlds), or nothing for base
                const sourceBadge = mod.implicitSource === 'searing_exarch'
                  ? { label: 'SE', colorClass: 'text-red-400' }
                  : mod.implicitSource === 'eater_of_worlds'
                    ? { label: 'EW', colorClass: 'text-blue-400' }
                    : null;
                const hasTierOrSource = info?.tierRange || sourceBadge;
                return (
                  <div key={`implicit-${idx}`} className={cn('flex justify-between items-baseline', compact ? 'gap-2' : 'gap-4')}>
                    <span className={cn('font-pob', compact ? 'text-[0.625rem]' : 'text-xs', isCluster ? clusterColors.enchant : modColors.implicit)}>
                      {(mod.text || '').replace(/\{tags:[^}]+\}/g, '').trim()}
                    </span>
                    {hasTierOrSource && (
                      <span className={cn('flex items-center gap-1.5 whitespace-nowrap', compact ? 'text-[0.5rem]' : 'text-xs')}>
                        {info?.tierRange && (
                          <span className={info.tierNum ? getTierColorClass(info.tierNum) : 'text-slate-500'}>
                            {info.tierRange}
                          </span>
                        )}
                        {sourceBadge && <span className={cn('font-semibold', sourceBadge.colorClass)}>{sourceBadge.label}</span>}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Separator between implicits and explicits */}
          {hasImplicits && (hasExplicits || hasCrafted) && (
            <div className={cn('border-t border-[#3a3530]/30', compact ? 'my-1' : 'my-2')} />
          )}

          {/* Explicits - left-aligned with right info */}
          {hasExplicits && (
            <div className="space-y-0.5">
              {mods!.explicits.filter((m, idx) => {
                if (!m.text?.trim()) return false;
                // For cluster jewels, skip notable declaration lines (rendered in breakdown below)
                if (isCluster && clusterNotableIndices.has(idx)) return false;
                return true;
              }).map((mod, idx) => {
                const info = getModTierInfo(mod);
                return (
                  <div key={`explicit-${idx}`} className={cn('flex justify-between items-baseline', compact ? 'gap-2' : 'gap-4')}>
                    <span className={cn('font-pob', compact ? 'text-[0.625rem]' : 'text-xs', isCluster ? clusterColors.explicit : getModColor(mod.affixType, mod.type === 'fractured', false))}>
                      {mod.text || ''}
                    </span>
                    {info && (info.tierRange || info.affixBadge) && (
                      <span className={cn('flex items-center gap-1.5 whitespace-nowrap', compact ? 'text-[0.5rem]' : 'text-xs')}>
                        {info.tierRange && (
                          <span className={info.tierNum ? getTierColorClass(info.tierNum) : 'text-slate-500'}>
                            {info.tierRange}
                          </span>
                        )}
                        {info.affixBadge && <span className={cn('font-semibold', info.affixBadge.colorClass)}>{info.affixBadge.label}</span>}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Cluster jewel notable breakdown — gold headers + white stats (matches tree tooltip) */}
          {isCluster && clusterNotables.length > 0 && (
            <>
              <div className={cn('border-t border-[#3a3530]/50', compact ? 'my-1' : 'my-2')} />
              <div className={compact ? 'space-y-1' : 'space-y-2'}>
                {clusterNotables.map((notable, i) => {
                  const stats = clusterNotableStats?.[notable.name] ?? [];
                  return (
                    <div key={i} className="space-y-0.5">
                      <div className={cn('font-pob font-semibold', compact ? 'text-[0.625rem]' : 'text-xs', clusterColors.notable)}>
                        {notable.name}
                      </div>
                      {stats.map((stat, j) => (
                        <div key={j} className={cn('font-pob leading-relaxed pl-1', compact ? 'text-[0.5625rem]' : 'text-[0.6875rem]', clusterColors.notableStat)}>
                          {stat}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Crafted mods - left-aligned with right info */}
          {hasCrafted && (
            <div className="space-y-0.5">
              {mods!.crafted.filter(m => m.text?.trim()).map((mod, idx) => {
                const info = getModTierInfo(mod);
                return (
                  <div key={`crafted-${idx}`} className={cn('flex justify-between items-baseline', compact ? 'gap-2' : 'gap-4')}>
                    <span className={cn('font-pob', compact ? 'text-[0.625rem]' : 'text-xs', modColors.crafted)}>
                      {mod.text || ''}
                    </span>
                    {info && (info.tierRange || info.affixBadge) && (
                      <span className={cn('flex items-center gap-1.5 whitespace-nowrap', compact ? 'text-[0.5rem]' : 'text-xs')}>
                        {info.tierRange && (
                          <span className={info.tierNum ? getTierColorClass(info.tierNum) : 'text-slate-500'}>
                            {info.tierRange}
                          </span>
                        )}
                        {info.affixBadge && <span className={cn('font-semibold', info.affixBadge.colorClass)}>{info.affixBadge.label}</span>}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* No mods state */}
          {!hasAnyMods && (
            <div className="text-xs text-[#5a5a5a] italic font-pob">No modifiers</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ItemTooltip;
