/**
 * CompactStatsSidebar Component
 *
 * Ledger-inspired stat panel matching the Oracle's Ledger and Ladder Benchmark aesthetic:
 * - Gradient cards with thin borders for hero stats
 * - Cinzel section headers with colored left-bar accents
 * - 2-column grid for secondary stat pairs
 * - Strategic glow on key numbers
 * - Bandit quest selector for post-import config
 * - Pantheon god selector for post-import config
 */

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, Flame, Zap, Heart, Sparkles, Settings2, ChevronRight, Scroll, AlertTriangle, Shield, Sun, Moon, Skull, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { formatDps, formatNumber, formatPercent } from '../../utils/format';

const DEFAULT_RESISTANCES = { fire: 0, cold: 0, lightning: 0, chaos: 0, fireOverCap: 0, coldOverCap: 0, lightningOverCap: 0, chaosOverCap: 0 } as const;
const INLINE_CONFIG_LIMIT = 5;

export type BanditChoice = 'None' | 'Alira' | 'Oak' | 'Kraityn';

const BANDIT_OPTIONS: Array<{
  value: BanditChoice;
  label: string;
  bonus: string;
  activeColor: string;
  iconClass: string;
}> = [
  { value: 'None', label: 'Kill All', bonus: '+1 Passive', activeColor: 'text-slate-200', iconClass: 'text-slate-400' },
  { value: 'Alira', label: 'Alira', bonus: '+15% Ele Res', activeColor: 'text-amber-300', iconClass: 'text-amber-400' },
  { value: 'Oak', label: 'Oak', bonus: '+40 Life', activeColor: 'text-red-300', iconClass: 'text-red-400' },
  { value: 'Kraityn', label: 'Kraityn', bonus: '+8% Speed', activeColor: 'text-green-300', iconClass: 'text-green-400' },
];

// ============================================
// Pantheon types & data
// ============================================

export type MajorGod = 'None' | 'TheBrineKing' | 'Lunaris' | 'Solaris' | 'Arakaali';
export type MinorGod = 'None' | 'Gruthkul' | 'Yugul' | 'Abberath' | 'Tukohama' | 'Garukhan' | 'Ralakesh' | 'Ryslatha' | 'Shakari';

const MAJOR_GOD_OPTIONS: Array<{
  value: MajorGod;
  label: string;
  bonus: string;
}> = [
  { value: 'None', label: 'None', bonus: 'No major god' },
  { value: 'TheBrineKing', label: 'The Brine King', bonus: 'Stun/freeze recovery' },
  { value: 'Lunaris', label: 'Lunaris', bonus: 'Phys reduction, dodge' },
  { value: 'Solaris', label: 'Solaris', bonus: 'Crit damage reduction' },
  { value: 'Arakaali', label: 'Arakaali', bonus: 'DoT recovery, chaos res' },
];

const MINOR_GOD_OPTIONS: Array<{
  value: MinorGod;
  label: string;
  bonus: string;
}> = [
  { value: 'None', label: 'None', bonus: 'No minor god' },
  { value: 'Gruthkul', label: 'Gruthkul', bonus: 'Phys reduction when hit' },
  { value: 'Yugul', label: 'Yugul', bonus: 'Cold/reflect reduction' },
  { value: 'Abberath', label: 'Abberath', bonus: 'Burning ground immunity' },
  { value: 'Tukohama', label: 'Tukohama', bonus: 'Phys reduction stationary' },
  { value: 'Garukhan', label: 'Garukhan', bonus: 'Movement speed, evade' },
  { value: 'Ralakesh', label: 'Ralakesh', bonus: 'Blind/maim immunity' },
  { value: 'Ryslatha', label: 'Ryslatha', bonus: 'Life flask recovery' },
  { value: 'Shakari', label: 'Shakari', bonus: 'Chaos reduction, poison' },
];

export interface CompactStats {
  dps?: {
    total: number;
    breakdown?: { hit?: number; dot?: number; ignite?: number; bleed?: number; poison?: number };
    suffix?: string;
  };
  mainSkill?: string;
  /** Total build DPS across all skills (for Damage Sources header) */
  totalBuildDps?: number;
  /** Per-skill DPS breakdown sorted by combined DPS descending */
  skillDpsBreakdown?: Array<{
    name: string;
    combinedDps: number;
    hitDps: number;
    dotDps: number;
    igniteDps?: number;
    bleedDps?: number;
    poisonDps?: number;
    /** Army-DPS decomposition: combinedDps = perMinionDps * armyCount. */
    perMinionDps?: number;
    armyCount?: number;
    armyCapKey?: string;
  }>;
  life?: number;
  energyShield?: number;
  effectiveHp?: number;
  armour?: number;
  evasion?: number;
  spellSuppression?: number;
  spellSuppressionEffect?: number;
  blockChance?: number;
  spellBlockChance?: number;
  physicalDamageReduction?: number;
  maxHitPhysical?: number;
  maxHitFire?: number;
  maxHitCold?: number;
  maxHitLightning?: number;
  maxHitChaos?: number;
  lifeRegen?: number;
  lifeLeechGainRate?: number;
  totalMana?: number;
  manaUnreserved?: number;
  manaRegen?: number;
  energyShieldRegen?: number;
  energyShieldRechargeRate?: number;
  netLifeRegen?: number;
  netManaRegen?: number;
  lifeRecoup?: number;
  energyShieldRecoup?: number;
  manaRecoup?: number;
  evadeChance?: number;
  movementSpeedMod?: number;
  ward?: number;
  hitChance?: number;
  critChance?: number;
  critMultiplier?: number;
  attackSpeed?: number;
  resistances?: {
    fire: number; cold: number; lightning: number; chaos: number;
    fireOverCap: number; coldOverCap: number; lightningOverCap: number; chaosOverCap: number;
  };
  attributes?: { strength: number; dexterity: number; intelligence: number };
  treeAttributes?: { strength: number; dexterity: number; intelligence: number };
  configAssumptions?: Array<{
    label: string; source: string; dpsPercent?: number; ehpPercent?: number;
    category?: string; status?: 'active';
    provenance?: 'auto_detected' | 'pob_default' | 'agent_override';
    sourceKind?: 'detected' | 'baseline' | 'pob_on' | 'ai_adjusted';
    configKey?: string;
  }>;
  configOpportunities?: Array<{
    label: string; category: string; dpsPercent: number; ehpPercent: number;
    potentialSources?: string[]; sourceKind?: 'no_source' | 'possible_source';
  }>;
  ladderConfigGaps?: Array<{
    label: string; key: string; usage: number; ladderCount: number; buildCount: number;
    reason: string; category?: string; pathway: 'skills' | 'gear' | 'tree';
    sourceSkill: string | null; hasSource: boolean; status: 'matched' | 'missing' | 'user_only';
  }>;
}

export interface CompactStatsSidebarProps {
  stats: CompactStats;
  className?: string;
  onOpenConfigPanel?: () => void;
  onOpenAttributePanel?: () => void;
  bandit?: BanditChoice;
  onBanditChange?: (bandit: BanditChoice) => void;
  isBanditLoading?: boolean;
  showBanditHint?: boolean;
  pantheonMajor?: MajorGod;
  pantheonMinor?: MinorGod;
  onPantheonChange?: (major?: MajorGod, minor?: MinorGod) => void;
  isPantheonLoading?: boolean;
  hideBanditPantheon?: boolean;
}

// ============================================
// Building blocks
// ============================================

/**
 * Convert a PoB active-minion-cap field name to the singular/plural noun
 * used in the UI (e.g. `ActiveSpectreLimit` → `spectres`). Falls back to
 * `minions` for unknown keys so we never show the raw field name.
 */
function armyCountLabel(armyCapKey: string | undefined, count: number): string {
  const mapping: Record<string, [string, string]> = {
    ActiveSpectreLimit: ['spectre', 'spectres'],
    ActiveZombieLimit: ['zombie', 'zombies'],
    ActiveSkeletonLimit: ['skeleton', 'skeletons'],
    ActiveGolemLimit: ['golem', 'golems'],
    ActiveRagingSpiritLimit: ['raging spirit', 'raging spirits'],
    ActiveWolfLimit: ['wolf', 'wolves'],
    ActiveTigerLimit: ['tiger', 'tigers'],
    ActiveSpiderLimit: ['spider', 'spiders'],
  };
  const pair = (armyCapKey && mapping[armyCapKey]) || ['minion', 'minions'];
  return count === 1 ? pair[0] : pair[1];
}

/** Section header — colored left bar + Cinzel label (matches Ledger/Ladder style) */
function SectionLabel({ label, color = 'from-amber-400 to-amber-600', action }: {
  label: string;
  color?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 mb-2 mt-2">
      <div className={cn('w-1 h-4 rounded-full bg-gradient-to-b', color)} />
      <span className="text-[0.6875rem] font-display font-semibold uppercase tracking-wider text-slate-300/90">
        {label}
      </span>
      {action && <span className="ml-auto">{action}</span>}
    </div>
  );
}

/** Mini stat cell — used in 2-column grids for secondary stats */
function MiniStat({ label, value, unit, labelColor, valueColor, tint, glow }: {
  label: string;
  value: string | number;
  unit?: string;
  labelColor?: string;
  /** Tailwind class for value color — defaults to brighter version of label */
  valueColor?: string;
  /** RGB color string for subtle card tint, e.g. '248, 113, 113' */
  tint?: string;
  /** Whether to add a glow effect to the value (for capped/maxed stats) */
  glow?: boolean;
}) {
  const t = tint || '71, 85, 105';
  return (
    <div
      className="rounded-md px-2 py-1.5"
      style={{
        background: `linear-gradient(135deg, rgba(${t}, 0.07) 0%, rgba(0, 0, 0, 0.35) 100%)`,
        border: `1px solid rgba(${t}, 0.22)`,
        boxShadow: glow
          ? `inset 0 1px 0 rgba(${t}, 0.08), inset 0 -1px 2px rgba(0, 0, 0, 0.3), 0 3px 6px rgba(0, 0, 0, 0.25), 0 0 10px rgba(${t}, 0.15)`
          : `inset 0 1px 0 rgba(${t}, 0.05), inset 0 -1px 2px rgba(0, 0, 0, 0.3), 0 3px 6px rgba(0, 0, 0, 0.25)`,
      }}
    >
      <div className={cn('text-[0.5625rem] uppercase tracking-wider mb-0.5 font-medium', labelColor || 'text-slate-400/70')}>
        {label}
      </div>
      <div className="flex items-baseline gap-0.5">
        <span
          className={cn('text-[0.8125rem] font-bold tabular-nums', valueColor || 'text-slate-200')}
          style={glow ? { textShadow: `0 0 8px rgba(${t}, 0.4)` } : undefined}
        >
          {value}
        </span>
        {unit && <span className="text-[0.5625rem] text-slate-500">{unit}</span>}
      </div>
    </div>
  );
}

/** Resistance row with glowing bar */
function ResRow({ label, value, overcap, labelColor, barTint }: {
  label: string; value: number; overcap: number; labelColor: string;
  /** RGB for bar color, e.g. '248, 113, 113' */
  barTint: string;
}) {
  const capped = value >= 75;
  const barWidth = Math.min(Math.max(value, 0), 75);
  const oc = Math.round(overcap);
  return (
    <div className="py-1">
      <div className="flex items-baseline justify-between mb-1">
        <span className={cn('text-[0.6875rem] font-medium', labelColor)}>{label}</span>
        <div className="flex items-baseline gap-1">
          <span className={cn('text-[0.8125rem] font-bold tabular-nums', capped ? 'text-slate-100' : 'text-orange-400')}>
            {Math.round(value)}%
          </span>
          {capped && oc > 0 && (
            <span className="text-[0.625rem] text-slate-400 tabular-nums">+{oc}</span>
          )}
        </div>
      </div>
      <div className="h-[3px] rounded-full overflow-hidden" style={{
        background: 'rgba(0, 0, 0, 0.4)',
        boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.5)',
      }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${(barWidth / 75) * 100}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{
            background: `linear-gradient(90deg, rgba(${barTint}, ${capped ? 0.9 : 0.4}) 0%, rgba(${barTint}, ${capped ? 0.7 : 0.25}) 100%)`,
            boxShadow: capped ? `0 0 6px rgba(${barTint}, 0.5), 0 0 2px rgba(${barTint}, 0.8)` : 'none',
          }}
        />
      </div>
    </div>
  );
}

/** Config cell — matches MiniStat depth, shows label + check mark */
function ConfigCell({ label, source }: {
  label: string; source: string;
}) {
  return (
    <div
      className="rounded-md px-2 py-1.5 overflow-hidden"
      title={`Source: ${source}`}
      style={{
        background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.06) 0%, rgba(0, 0, 0, 0.35) 100%)',
        border: '1px solid rgba(251, 191, 36, 0.2)',
        boxShadow: 'inset 0 1px 0 rgba(251, 191, 36, 0.05), inset 0 -1px 2px rgba(0, 0, 0, 0.3), 0 3px 6px rgba(0, 0, 0, 0.25)',
      }}
    >
      <div className="flex items-start gap-1 min-w-0">
        <Check className="w-2.5 h-2.5 text-green-500/60 flex-shrink-0 mt-0.5" />
        <span className="text-[0.5625rem] text-slate-300/80 font-medium leading-tight break-all">{label}</span>
      </div>
    </div>
  );
}

// ============================================
// Bandit Selector (2x2 grid)
// ============================================

function BanditIcon({ bandit, className }: { bandit: BanditChoice; className?: string }) {
  switch (bandit) {
    case 'Alira': return <Flame className={className} />;
    case 'Oak': return <Heart className={className} />;
    case 'Kraityn': return <Zap className={className} />;
    default: return <Sparkles className={className} />;
  }
}

function BanditSelector({ value, onChange, isLoading }: {
  value: BanditChoice; onChange?: (b: BanditChoice) => void;
  isLoading?: boolean;
}) {
  return (
    <div className="px-3 pb-3">
      <SectionLabel label="Bandit Quest" color="from-amber-400 to-amber-600" />
      <div className={cn('grid grid-cols-2 gap-1', isLoading && 'opacity-60 pointer-events-none')}>
        {BANDIT_OPTIONS.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              onClick={() => { if (!active) onChange?.(opt.value); }}
              className={cn(
                'relative flex flex-col items-center gap-0.5 px-1.5 py-1.5 rounded-lg transition-all duration-200 cursor-pointer',
                active ? 'border border-amber-500/25' : 'border border-transparent hover:border-slate-600/30',
              )}
              style={active ? {
                background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.08) 0%, transparent 100%)',
              } : {
                background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.4) 0%, rgba(15, 23, 42, 0.2) 100%)',
              }}
            >
              {active && <div className="absolute top-0.5 right-0.5"><Check className="w-2.5 h-2.5 text-amber-400/70" /></div>}
              <BanditIcon bandit={opt.value} className={cn('w-3 h-3', active ? opt.iconClass : 'text-slate-600', active && 'icon-glow')} />
              <span className={cn('text-[0.5625rem] font-medium leading-none', active ? opt.activeColor : 'text-slate-500')}>{opt.label}</span>
              <span className={cn('text-[0.5rem] leading-none', active ? 'text-slate-400' : 'text-slate-600')}>{opt.bonus}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// Pantheon Dropdown
// ============================================

function PantheonDropdown<T extends string>({ options, value, onChange, disabled }: {
  options: Array<{ value: T; label: string; bonus: string }>;
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  const selected = options.find((o) => o.value === value) ?? options[0];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { if (!disabled) setIsOpen(!isOpen); }}
        disabled={disabled}
        className={cn(
          'w-full flex items-center justify-between gap-1 px-2 py-1.5 rounded-lg transition-all duration-200 text-left',
          'border',
          value !== 'None'
            ? 'border-teal-500/20 hover:border-teal-500/35'
            : 'border-slate-700/40 hover:border-teal-500/30',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
        style={{
          background: value !== 'None'
            ? 'linear-gradient(135deg, rgba(20, 184, 166, 0.06) 0%, rgba(15, 23, 42, 0.6) 100%)'
            : 'linear-gradient(135deg, rgba(30, 41, 59, 0.5) 0%, rgba(15, 23, 42, 0.3) 100%)',
        }}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <div className={cn(
            'w-1 h-1 rounded-full flex-shrink-0',
            value !== 'None' ? 'bg-teal-400/80' : 'bg-slate-600',
          )} />
          <div className="flex flex-col min-w-0">
            <span className={cn(
              'text-[0.5625rem] font-medium truncate',
              value !== 'None' ? 'text-teal-200' : 'text-slate-400',
            )}>{selected.label}</span>
            <span className={cn(
              'text-[0.5rem] truncate',
              value !== 'None' ? 'text-teal-400/50' : 'text-slate-600',
            )}>{selected.bonus}</span>
          </div>
        </div>
        <ChevronDown className={cn(
          'w-2.5 h-2.5 flex-shrink-0 transition-transform duration-200',
          'text-teal-500/40',
          isOpen && 'rotate-180',
        )} />
      </button>

      {isOpen && (
        <div
          className="absolute z-50 w-full mt-0.5 rounded-lg border border-slate-700/60 shadow-xl shadow-black/50 max-h-[200px] overflow-y-auto scrollbar-fantasy"
          style={{
            background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.98) 0%, rgba(10, 15, 30, 0.98) 100%)',
            backdropFilter: 'blur(8px)',
          }}
        >
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <button
                key={opt.value}
                onClick={() => { onChange(opt.value); setIsOpen(false); }}
                className={cn(
                  'w-full flex items-center gap-1.5 px-2 py-1.5 text-left transition-all duration-150',
                  active
                    ? 'bg-teal-500/10 border-l-2 border-teal-400/50'
                    : 'border-l-2 border-transparent hover:bg-slate-800/60',
                )}
              >
                <div className={cn(
                  'w-1 h-1 rounded-full flex-shrink-0',
                  active ? 'bg-teal-400' : 'bg-slate-700',
                )} />
                <div className="flex flex-col min-w-0 flex-1">
                  <span className={cn('text-[0.5625rem] font-medium', active ? 'text-teal-300' : 'text-slate-300')}>{opt.label}</span>
                  <span className={cn('text-[0.5rem]', active ? 'text-teal-400/50' : 'text-slate-600')}>{opt.bonus}</span>
                </div>
                {active && <Check className="w-2 h-2 text-teal-400/60 flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PantheonSelector({ major, minor, onChange, isLoading }: {
  major: MajorGod;
  minor: MinorGod;
  onChange?: (major?: MajorGod, minor?: MinorGod) => void;
  isLoading?: boolean;
}) {
  return (
    <div className={cn('px-3 pb-2', isLoading && 'opacity-60 pointer-events-none')}>
      <SectionLabel label="Pantheon" color="from-teal-400 to-teal-600" />
      <div className="space-y-1.5">
        <div>
          <span className="text-[0.5rem] uppercase tracking-wider text-slate-500 font-medium">Major God</span>
          <PantheonDropdown
            options={MAJOR_GOD_OPTIONS}
            value={major}
            onChange={(v) => onChange?.(v, undefined)}
            disabled={isLoading}
          />
        </div>
        <div>
          <span className="text-[0.5rem] uppercase tracking-wider text-slate-500 font-medium">Minor God</span>
          <PantheonDropdown
            options={MINOR_GOD_OPTIONS}
            value={minor}
            onChange={(v) => onChange?.(undefined, v)}
            disabled={isLoading}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export function CompactStatsSidebar({
  stats, className, onOpenConfigPanel, onOpenAttributePanel,
  bandit = 'None', onBanditChange, isBanditLoading, showBanditHint,
  pantheonMajor = 'None', pantheonMinor = 'None', onPantheonChange, isPantheonLoading,
  hideBanditPantheon,
}: CompactStatsSidebarProps) {
  const {
    dps, mainSkill,
    life = 0, energyShield = 0, effectiveHp = 0,
    armour = 0, evasion = 0, spellSuppression = 0,
    blockChance = 0, spellBlockChance = 0, physicalDamageReduction = 0,
    resistances = DEFAULT_RESISTANCES, attributes, treeAttributes,
  } = stats;

  const totalDps = dps?.total ?? 0;
  const hasES = energyShield > 0;

  const sortedConfigs = stats.configAssumptions
    ? [...stats.configAssumptions].sort((a, b) =>
        Math.max(Math.abs(b.dpsPercent ?? 0), Math.abs(b.ehpPercent ?? 0))
        - Math.max(Math.abs(a.dpsPercent ?? 0), Math.abs(a.ehpPercent ?? 0)))
    : [];
  const inlineConfigs = sortedConfigs.slice(0, INLINE_CONFIG_LIMIT);
  const hasOverflow = sortedConfigs.length > INLINE_CONFIG_LIMIT;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      className={cn('h-full flex flex-col overflow-y-auto scrollbar-fantasy', className)}
      style={{ width: 'clamp(160px, 15vw, 210px)' }}
    >
      {/* ═══ DPS Hero Card ═══ */}
      <div className="px-3 pt-3 pb-2">
        <div
          className="relative rounded-xl p-3 overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.1) 0%, rgba(180, 83, 9, 0.04) 100%)',
            border: '1px solid rgba(251, 191, 36, 0.22)',
            boxShadow: 'inset 0 1px 0 rgba(251, 191, 36, 0.06), 0 4px 12px rgba(0, 0, 0, 0.3)',
          }}
        >
          {/* Ambient glow */}
          <div className="absolute top-0 right-0 w-24 h-24 -translate-y-1/2 translate-x-1/2 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(251, 191, 36, 0.12) 0%, transparent 70%)' }}
          />

          <div className="relative">
            <div className="text-[0.5rem] text-slate-500 uppercase tracking-wider mb-0.5">Main Skill</div>
            <h3 className="font-display text-[0.75rem] text-amber-200/90 leading-tight mb-2" title={mainSkill}>
              {mainSkill || 'No Skill'}
            </h3>

            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-display font-bold text-amber-300 tabular-nums"
                style={{ textShadow: '0 0 14px rgba(251, 191, 36, 0.45)' }}>
                {formatDps(totalDps)}
              </span>
              <span className="text-[0.5rem] text-amber-500/50 font-display uppercase">
                DPS
              </span>
            </div>

            {/* Army-DPS decomposition ONLY for minion builds. Looks up the main skill in
                the per-skill breakdown; renders `56.0K × 10 spectres` under the big DPS number.
                Non-minion builds: breakdown[0] has no armyCount, so this block is null. */}
            {(() => {
              const breakdown = stats.skillDpsBreakdown;
              if (!breakdown || breakdown.length === 0) return null;
              const normalizedMain = (mainSkill ?? '').toLowerCase().trim();
              const mainEntry =
                breakdown.find(s => s.name.toLowerCase().trim() === normalizedMain) ??
                breakdown[0];
              if (!mainEntry.armyCount || mainEntry.armyCount <= 1) return null;
              if (!mainEntry.perMinionDps || mainEntry.perMinionDps <= 0) return null;
              return (
                <div
                  className="mt-1 text-[0.5625rem] text-amber-200/55 tabular-nums"
                  title="Army DPS = per-minion damage × active minion cap"
                >
                  {formatDps(mainEntry.perMinionDps)}
                  <span className="text-amber-200/35 mx-1">×</span>
                  {mainEntry.armyCount}{' '}
                  <span className="text-amber-200/35">
                    {armyCountLabel(mainEntry.armyCapKey, mainEntry.armyCount)}
                  </span>
                </div>
              );
            })()}
            {/* Player hit/DoT decomposition (non-minion builds). Guard coerced to boolean
                to prevent React from rendering a stray `0` when both values are zero. */}
            {Boolean(dps?.breakdown && ((dps.breakdown.hit ?? 0) > 0 || (dps.breakdown.dot ?? 0) > 0)) && (() => {
              const { hit, dot, ignite, bleed, poison } = dps!.breakdown!;
              // Show specific ailment labels instead of generic "dot"
              const specificDot = (ignite || 0) + (bleed || 0) + (poison || 0);
              const remainingDot = (dot || 0) - specificDot;
              const parts: { label: string; value: number; color: string }[] = [];
              if (hit != null && hit > 0) parts.push({ label: 'hit', value: hit, color: 'text-orange-400/60' });
              if (ignite != null && ignite > 0) parts.push({ label: 'ignite', value: ignite, color: 'text-red-400/60' });
              if (bleed != null && bleed > 0) parts.push({ label: 'bleed', value: bleed, color: 'text-red-500/60' });
              if (poison != null && poison > 0) parts.push({ label: 'poison', value: poison, color: 'text-emerald-400/60' });
              if (remainingDot > 0) parts.push({ label: 'dot', value: remainingDot, color: 'text-green-400/60' });
              if (parts.length === 0) return null;
              return (
                <div className="flex gap-2 mt-1 text-[0.5625rem] flex-wrap">
                  {parts.map(p => (
                    <span key={p.label} className={p.color}>{formatDps(p.value)} {p.label}</span>
                  ))}
                </div>
              );
            })()}
            <div className="text-[0.5rem] text-slate-600 mt-0.5">vs Pinnacle Boss</div>
          </div>
        </div>
      </div>

      {/* ═══ Damage Sources ═══ */}
      {stats.skillDpsBreakdown && stats.skillDpsBreakdown.length > 1 && (() => {
        const skills = stats.skillDpsBreakdown.filter(s => s.combinedDps > 0);
        const sumDps = skills.reduce((sum, s) => sum + s.combinedDps, 0) || 1;
        const topDps = skills[0]?.combinedDps || 1;
        return (
          <div className="px-3 pb-2">
            <SectionLabel label="Damage Sources" color="from-orange-400 to-red-500" action={
              stats.totalBuildDps && stats.totalBuildDps > 0 ? (
                <span className="text-[0.5625rem] font-bold tabular-nums text-slate-300/70">
                  {formatDps(stats.totalBuildDps)} <span className="text-slate-500 font-normal">total</span>
                </span>
              ) : undefined
            } />
            <div className="space-y-1">
              {skills.slice(0, 5).map((skill, i) => {
                const pct = (skill.combinedDps / sumDps) * 100;
                const barWidth = (skill.combinedDps / topDps) * 100;
                const isMain = i === 0;
                const hasHit = skill.hitDps > 0;
                const hasDot = skill.dotDps > 0;
                return (
                  <div key={skill.name} className="group">
                    <div className="flex items-baseline justify-between mb-0.5">
                      <span className={cn(
                        'text-[0.5625rem] font-medium leading-tight truncate mr-1',
                        isMain ? 'text-amber-200/90' : 'text-slate-300/80',
                      )} title={skill.name}>
                        {skill.name}
                      </span>
                      <div className="flex items-baseline gap-1 flex-shrink-0">
                        <span className={cn(
                          'text-[0.6875rem] font-bold tabular-nums',
                          isMain ? 'text-amber-300' : 'text-slate-200',
                        )}>
                          {formatDps(skill.combinedDps)}
                        </span>
                        <span className="text-[0.5rem] text-slate-500 tabular-nums">{pct.toFixed(0)}%</span>
                      </div>
                    </div>
                    {/* Proportional bar */}
                    <div className="h-[3px] rounded-full overflow-hidden mb-0.5" style={{
                      background: 'rgba(0, 0, 0, 0.4)',
                      boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.5)',
                    }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${barWidth}%` }}
                        transition={{ duration: 0.6, ease: 'easeOut', delay: i * 0.08 }}
                        className="h-full rounded-full"
                        style={{
                          background: isMain
                            ? 'linear-gradient(90deg, rgba(251, 191, 36, 0.9) 0%, rgba(251, 146, 60, 0.7) 100%)'
                            : 'linear-gradient(90deg, rgba(148, 163, 184, 0.5) 0%, rgba(100, 116, 139, 0.3) 100%)',
                          boxShadow: isMain ? '0 0 6px rgba(251, 191, 36, 0.4)' : 'none',
                        }}
                      />
                    </div>
                    {/* Army-DPS decomposition for minion skills: `perMinion × N spectres = total`
                        Takes precedence over the hit/DoT split because minion builds usually have
                        dotDps = 0, and the hit/DoT breakdown would incorrectly relabel army damage
                        as "hit". */}
                    {skill.armyCount && skill.armyCount > 1 && skill.perMinionDps && skill.perMinionDps > 0 ? (
                      <div className="flex gap-1 text-[0.5rem] text-slate-500/70" title="Army DPS = per-minion damage × active minion cap">
                        <span className="tabular-nums text-slate-400/90">{formatDps(skill.perMinionDps)}</span>
                        <span>×</span>
                        <span className="tabular-nums text-slate-400/90">{skill.armyCount}</span>
                        <span>{armyCountLabel(skill.armyCapKey, skill.armyCount)}</span>
                      </div>
                    ) : hasHit && hasDot ? (() => {
                      const subParts: { label: string; value: number }[] = [];
                      subParts.push({ label: 'hit', value: skill.hitDps });
                      const ignite = skill.igniteDps || 0;
                      const bleed = skill.bleedDps || 0;
                      const poison = skill.poisonDps || 0;
                      const specific = ignite + bleed + poison;
                      if (ignite > 0) subParts.push({ label: 'ignite', value: ignite });
                      if (bleed > 0) subParts.push({ label: 'bleed', value: bleed });
                      if (poison > 0) subParts.push({ label: 'poison', value: poison });
                      const remaining = skill.dotDps - specific;
                      if (remaining > 0) subParts.push({ label: 'dot', value: remaining });
                      return (
                        <div className="flex gap-2 text-[0.5rem] text-slate-500/70">
                          {subParts.map(p => (
                            <span key={p.label}>{formatDps(p.value)} {p.label}</span>
                          ))}
                        </div>
                      );
                    })() : null}
                  </div>
                );
              })}
              {skills.length > 5 && (
                <div className="text-[0.5rem] text-slate-500/50 text-center">
                  +{skills.length - 5} more
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ═══ Config ═══ */}
      {sortedConfigs.length > 0 && (
        <div className="px-3 pb-2">
          <SectionLabel label="Config" action={onOpenConfigPanel && (
            <button onClick={onOpenConfigPanel} className="flex items-center gap-1 px-2 py-0.5 rounded text-[0.625rem] font-medium text-amber-400/70 hover:text-amber-300 transition-all cursor-pointer border border-amber-500/20 hover:border-amber-500/40 hover:shadow-[0_0_8px_rgba(251,191,36,0.15)] bg-amber-500/5">
              <span>Details</span><ChevronRight className="w-2.5 h-2.5" />
            </button>
          )} />
          <div className="grid grid-cols-2 gap-1">
            {inlineConfigs.map((a) => <ConfigCell key={a.label} label={a.label} source={a.source} />)}
            {hasOverflow && (
              <div className="rounded-md px-2 py-1.5 flex items-center justify-center" style={{
                background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.2) 0%, rgba(15, 23, 42, 0.25) 100%)',
                border: '1px solid rgba(71, 85, 105, 0.2)',
              }}>
                <span className="text-[0.5625rem] text-slate-500">+{sortedConfigs.length - INLINE_CONFIG_LIMIT} more</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ Attributes ═══ */}
      {attributes && (attributes.strength > 0 || attributes.dexterity > 0 || attributes.intelligence > 0) && (
        <div className="px-3 pb-2">
          <SectionLabel label="Attributes" color="from-slate-400 to-slate-600" action={onOpenAttributePanel && (
            <button onClick={onOpenAttributePanel} className="flex items-center gap-1 px-2 py-0.5 rounded text-[0.625rem] font-medium text-amber-400/70 hover:text-amber-300 transition-all cursor-pointer border border-amber-500/20 hover:border-amber-500/40 hover:shadow-[0_0_8px_rgba(251,191,36,0.15)] bg-amber-500/5">
              <span>Details</span><ChevronRight className="w-2.5 h-2.5" />
            </button>
          )} />
          <div className="grid grid-cols-3 gap-1">
            {attributes.strength > 0 && (
              <div className="rounded-lg px-2 py-1.5 text-center" style={{
                background: 'linear-gradient(135deg, rgba(248, 113, 113, 0.05) 0%, transparent 100%)',
                border: '1px solid rgba(248, 113, 113, 0.1)',
              }}>
                <div className="text-[0.5rem] text-red-400/50 uppercase">Str</div>
                <div className="text-[0.75rem] font-bold text-red-300/90 tabular-nums">{attributes.strength}</div>
                {treeAttributes?.strength ? <div className="text-[0.5rem] text-slate-600">{treeAttributes.strength} tree</div> : null}
              </div>
            )}
            {attributes.dexterity > 0 && (
              <div className="rounded-lg px-2 py-1.5 text-center" style={{
                background: 'linear-gradient(135deg, rgba(52, 211, 153, 0.05) 0%, transparent 100%)',
                border: '1px solid rgba(52, 211, 153, 0.1)',
              }}>
                <div className="text-[0.5rem] text-emerald-400/50 uppercase">Dex</div>
                <div className="text-[0.75rem] font-bold text-emerald-300/90 tabular-nums">{attributes.dexterity}</div>
                {treeAttributes?.dexterity ? <div className="text-[0.5rem] text-slate-600">{treeAttributes.dexterity} tree</div> : null}
              </div>
            )}
            {attributes.intelligence > 0 && (
              <div className="rounded-lg px-2 py-1.5 text-center" style={{
                background: 'linear-gradient(135deg, rgba(96, 165, 250, 0.05) 0%, transparent 100%)',
                border: '1px solid rgba(96, 165, 250, 0.1)',
              }}>
                <div className="text-[0.5rem] text-blue-400/50 uppercase">Int</div>
                <div className="text-[0.75rem] font-bold text-blue-300/90 tabular-nums">{attributes.intelligence}</div>
                {treeAttributes?.intelligence ? <div className="text-[0.5rem] text-slate-600">{treeAttributes.intelligence} tree</div> : null}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ Resistances ═══ */}
      <div className="px-3 pb-2">
        <SectionLabel label="Resistances" color="from-orange-400 to-orange-600" />
        <div
          className="rounded-lg px-2.5 py-2"
          style={{
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.5) 0%, rgba(15, 23, 42, 0.3) 100%)',
            border: '1px solid rgba(100, 116, 139, 0.12)',
          }}
        >
          <ResRow label="Fire" value={resistances.fire} overcap={resistances.fireOverCap} labelColor="text-red-400" barTint="239, 68, 68" />
          <ResRow label="Cold" value={resistances.cold} overcap={resistances.coldOverCap} labelColor="text-blue-400" barTint="96, 165, 250" />
          <ResRow label="Lightning" value={resistances.lightning} overcap={resistances.lightningOverCap} labelColor="text-yellow-400" barTint="250, 204, 21" />
          <ResRow label="Chaos" value={resistances.chaos} overcap={resistances.chaosOverCap} labelColor="text-purple-400" barTint="192, 132, 252" />
        </div>

        {resistances.fire >= 75 && resistances.cold >= 75 && resistances.lightning >= 75 && (
          <div className="mt-1 text-center">
            <span className="text-[0.5rem] uppercase tracking-wider text-green-400/50 font-medium">Elemental Capped</span>
          </div>
        )}
        <p className="text-[0.6875rem] text-slate-300/80 mt-2 text-center">
          Res off by 15%? Set <span className="text-amber-400 font-semibold">Alira</span> in Bandit Quest below
        </p>
      </div>

      {/* ═══ Pantheon & Bandit (not detected by import) — hidden during ladder fetch ═══ */}
      {!hideBanditPantheon && (
      <div>
        <BanditSelector value={bandit} onChange={onBanditChange} isLoading={isBanditLoading} />
        <PantheonSelector major={pantheonMajor} minor={pantheonMinor} onChange={onPantheonChange} isLoading={isPantheonLoading} />
        <p className="text-[0.6875rem] text-amber-400/50 pb-2 text-center font-medium tracking-wide">Not detected by import</p>
      </div>
      )}

      {/* ═══ Offense (compact 2-col) ═══ */}
      {(stats.critChance || stats.attackSpeed) && (
        <div className="px-3 pb-2">
          <SectionLabel label="Offense" color="from-orange-400 to-red-500" />
          <div className="grid grid-cols-2 gap-1">
            {stats.critChance != null && stats.critChance > 0 && (
              <MiniStat label="Crit" value={`${stats.critChance.toFixed(1)}%`} labelColor="text-orange-400/60" valueColor="text-orange-300" tint="251, 146, 60" glow={stats.critChance >= 50} />
            )}
            {stats.critMultiplier != null && stats.critMultiplier > 0 && (
              <MiniStat label="Crit Multi" value={`${Math.round(stats.critMultiplier)}%`} labelColor="text-orange-400/60" valueColor="text-orange-300" tint="251, 146, 60" />
            )}
            {stats.hitChance != null && stats.hitChance > 0 && stats.hitChance < 100 && (
              <MiniStat label="Hit Chance" value={`${stats.hitChance.toFixed(0)}%`} labelColor="text-amber-400/60" valueColor="text-amber-300" tint="251, 191, 36" />
            )}
            {stats.attackSpeed != null && stats.attackSpeed > 0 && (
              <MiniStat label="Speed" value={stats.attackSpeed.toFixed(2)} unit="/s" labelColor="text-yellow-400/60" valueColor="text-yellow-200" tint="250, 204, 21" />
            )}
          </div>
        </div>
      )}

      {/* ═══ Defenses — hero cards for Life/ES/EHP ═══ */}
      <div className="px-3 pb-2">
        <SectionLabel label="Defenses" color="from-cyan-400 to-cyan-600" />

        {/* Life + ES side by side */}
        <div className={cn('grid gap-1.5 mb-1.5', hasES ? 'grid-cols-2' : 'grid-cols-1')}>
          <div className="rounded-lg p-2" style={{
            background: 'linear-gradient(135deg, rgba(248, 113, 113, 0.1) 0%, rgba(0, 0, 0, 0.2) 100%)',
            border: '1px solid rgba(248, 113, 113, 0.2)',
            boxShadow: 'inset 0 1px 0 rgba(248, 113, 113, 0.05), 0 3px 8px rgba(0, 0, 0, 0.25)',
          }}>
            <div className="text-[0.5625rem] text-red-400/70 uppercase tracking-wider mb-0.5 font-medium">Life</div>
            <span className="text-[0.9375rem] font-bold text-red-300 tabular-nums"
              style={{ textShadow: '0 0 10px rgba(248, 113, 113, 0.35)' }}>
              {formatNumber(life)}
            </span>
          </div>
          {hasES && (
            <div className="rounded-lg p-2" style={{
              background: 'linear-gradient(135deg, rgba(96, 165, 250, 0.1) 0%, rgba(0, 0, 0, 0.2) 100%)',
              border: '1px solid rgba(96, 165, 250, 0.2)',
              boxShadow: 'inset 0 1px 0 rgba(96, 165, 250, 0.05), 0 3px 8px rgba(0, 0, 0, 0.25)',
            }}>
              <div className="text-[0.5625rem] text-blue-400/70 uppercase tracking-wider mb-0.5 font-medium">ES</div>
              <span className="text-[0.9375rem] font-bold text-blue-300 tabular-nums"
                style={{ textShadow: '0 0 10px rgba(96, 165, 250, 0.35)' }}>
                {formatNumber(energyShield)}
              </span>
            </div>
          )}
        </div>

        {/* EHP — full width accent card */}
        {effectiveHp > 0 && (
          <div className="rounded-lg p-2 mb-1.5" style={{
            background: 'linear-gradient(135deg, rgba(103, 232, 249, 0.08) 0%, rgba(0, 0, 0, 0.2) 100%)',
            border: '1px solid rgba(103, 232, 249, 0.15)',
            boxShadow: 'inset 0 1px 0 rgba(103, 232, 249, 0.04), 0 3px 8px rgba(0, 0, 0, 0.25)',
          }}>
            <div className="flex items-baseline justify-between">
              <span className="text-[0.5625rem] text-cyan-400/70 uppercase tracking-wider font-medium">Effective HP</span>
              <span className="text-[0.9375rem] font-bold text-cyan-200 tabular-nums"
                style={{ textShadow: '0 0 10px rgba(103, 232, 249, 0.25)' }}>
                {formatNumber(effectiveHp)}
              </span>
            </div>
          </div>
        )}

        {/* Max Hit Taken — right below EHP, PoB-style grouping */}
        {((stats.maxHitPhysical ?? 0) > 0 || (stats.maxHitChaos ?? 0) > 0) && (() => {
          const phys = stats.maxHitPhysical ?? 0;
          const fire = stats.maxHitFire ?? 0;
          const cold = stats.maxHitCold ?? 0;
          const light = stats.maxHitLightning ?? 0;
          const chaos = stats.maxHitChaos ?? 0;
          const eleValues = [fire, cold, light].filter(v => v > 0);
          const minEle = eleValues.length > 0 ? Math.min(...eleValues) : 0;
          const maxEle = eleValues.length > 0 ? Math.max(...eleValues) : 0;
          const groupEle = eleValues.length === 3 && maxEle > 0 && (maxEle - minEle) / maxEle <= 0.1;
          return (
            <div className="grid grid-cols-2 gap-1 mb-1.5">
              {phys > 0 && <MiniStat label="Phys Max Hit" value={formatNumber(phys)} labelColor="text-slate-400/60" valueColor="text-slate-200" tint="148, 163, 184" />}
              {groupEle ? (
                <MiniStat label="Ele Max Hit" value={formatNumber(minEle)} labelColor="text-orange-400/60" valueColor="text-orange-200" tint="251, 146, 60" />
              ) : (
                <>
                  {fire > 0 && <MiniStat label="Fire Max Hit" value={formatNumber(fire)} labelColor="text-red-400/60" valueColor="text-red-200" tint="248, 113, 113" />}
                  {cold > 0 && <MiniStat label="Cold Max Hit" value={formatNumber(cold)} labelColor="text-blue-400/60" valueColor="text-blue-200" tint="96, 165, 250" />}
                  {light > 0 && <MiniStat label="Ltn Max Hit" value={formatNumber(light)} labelColor="text-yellow-400/60" valueColor="text-yellow-200" tint="250, 204, 21" />}
                </>
              )}
              {chaos > 0 && <MiniStat label="Chaos Max Hit" value={formatNumber(chaos)} labelColor="text-purple-400/60" valueColor="text-purple-200" tint="192, 132, 252" />}
            </div>
          );
        })()}

        {/* Secondary defenses — compact 2-col grid */}
        <div className="grid grid-cols-2 gap-1">
          {armour > 0 && <MiniStat label="Armour" value={formatNumber(armour)} labelColor="text-amber-400/60" valueColor="text-amber-200" tint="251, 191, 36" />}
          {evasion > 0 && <MiniStat label="Evasion" value={formatNumber(evasion)} labelColor="text-green-400/60" valueColor="text-green-200" tint="74, 222, 128" />}
          {(stats.evadeChance ?? 0) > 0 && <MiniStat label="Evade" value={`${Math.round(stats.evadeChance!)}%`} labelColor="text-green-400/60" valueColor="text-green-200" tint="74, 222, 128" />}
          {spellSuppression > 0 && <MiniStat label="Suppress" value={`${formatPercent(spellSuppression, 0)}${(stats.spellSuppressionEffect ?? 0) > 0 ? ` (${stats.spellSuppressionEffect}%)` : ''}`} labelColor="text-violet-400/60" valueColor="text-violet-200" tint="167, 139, 250" glow={spellSuppression >= 100} />}
          {blockChance >= 2 && <MiniStat label="Block" value={formatPercent(blockChance, 0)} labelColor="text-sky-400/60" valueColor="text-sky-200" tint="56, 189, 248" glow={blockChance >= 75} />}
          {spellBlockChance >= 2 && <MiniStat label="Sp. Block" value={formatPercent(spellBlockChance, 0)} labelColor="text-sky-400/60" valueColor="text-sky-200" tint="56, 189, 248" />}
          {physicalDamageReduction > 0 && <MiniStat label="Phys DR" value={formatPercent(physicalDamageReduction, 0)} labelColor="text-amber-500/60" valueColor="text-amber-200" tint="245, 158, 11" />}
          {(stats.movementSpeedMod ?? 0) !== 0 && stats.movementSpeedMod != null && (
            <MiniStat label="Move Spd" value={`${stats.movementSpeedMod >= 1 ? '+' : ''}${Math.round((stats.movementSpeedMod - 1) * 100)}%`} labelColor="text-emerald-400/60" valueColor="text-emerald-200" tint="52, 211, 153" />
          )}
          {(stats.ward ?? 0) > 0 && <MiniStat label="Ward" value={formatNumber(stats.ward!)} labelColor="text-indigo-400/60" valueColor="text-indigo-200" tint="129, 140, 248" />}
        </div>

      </div>

      {/* ═══ Sustain ═══ */}
      {((stats.lifeRegen ?? 0) > 0 || (stats.lifeLeechGainRate ?? 0) > 0 || (stats.totalMana ?? 0) > 0 || (stats.energyShieldRechargeRate ?? 0) > 0 || (stats.lifeRecoup ?? 0) > 0) && (
        <div className="px-3 pb-2">
          <SectionLabel label="Sustain" color="from-emerald-400 to-emerald-600" />
          <div className="grid grid-cols-2 gap-1">
            {(stats.lifeRegen ?? 0) > 0 && <MiniStat label="Life Regen" value={stats.lifeRegen!.toFixed(1)} unit="/s" labelColor="text-red-400/60" valueColor="text-red-200" tint="248, 113, 113" />}
            {(stats.lifeLeechGainRate ?? 0) > 0 && <MiniStat label="Leech Rate" value={stats.lifeLeechGainRate!.toFixed(1)} unit="/s" labelColor="text-red-400/60" valueColor="text-red-200" tint="248, 113, 113" />}
            {stats.netLifeRegen != null && stats.netLifeRegen !== 0 && (
              <MiniStat label="Net Life" value={`${stats.netLifeRegen >= 0 ? '+' : ''}${stats.netLifeRegen.toFixed(1)}`}
                labelColor={stats.netLifeRegen < 0 ? 'text-red-400/60' : 'text-emerald-400/60'}
                valueColor={stats.netLifeRegen < 0 ? 'text-red-300' : 'text-emerald-300'}
                tint={stats.netLifeRegen < 0 ? '248, 113, 113' : '52, 211, 153'} glow />
            )}
            {(stats.totalMana ?? 0) > 0 && <MiniStat label="Mana" value={formatNumber(stats.totalMana!)} labelColor="text-blue-400/50" valueColor="text-blue-200" tint="96, 165, 250" />}
            {(stats.manaUnreserved ?? 0) > 0 && stats.manaUnreserved !== stats.totalMana && (
              <MiniStat label="Free Mana" value={formatNumber(stats.manaUnreserved!)} labelColor="text-blue-400/50" valueColor="text-blue-200" tint="96, 165, 250" />
            )}
            {(stats.manaRegen ?? 0) > 0 && <MiniStat label="Mana Regen" value={stats.manaRegen!.toFixed(1)} unit="/s" labelColor="text-blue-400/50" valueColor="text-blue-200" tint="96, 165, 250" />}
            {hasES && (stats.energyShieldRegen ?? 0) > 0 && (
              <MiniStat label="ES Regen" value={stats.energyShieldRegen!.toFixed(1)} unit="/s" labelColor="text-blue-400/50" valueColor="text-blue-200" tint="96, 165, 250" />
            )}
            {hasES && (stats.energyShieldRechargeRate ?? 0) > 0 && (
              <MiniStat label="ES Recharge" value={formatNumber(stats.energyShieldRechargeRate!)} unit="/s" labelColor="text-blue-400/50" valueColor="text-blue-200" tint="96, 165, 250" />
            )}
            {(stats.lifeRecoup ?? 0) > 0 && <MiniStat label="Life Recoup" value={`${stats.lifeRecoup}%`} labelColor="text-red-400/60" valueColor="text-red-200" tint="248, 113, 113" />}
            {(stats.energyShieldRecoup ?? 0) > 0 && <MiniStat label="ES Recoup" value={`${stats.energyShieldRecoup}%`} labelColor="text-blue-400/50" valueColor="text-blue-200" tint="96, 165, 250" />}
            {(stats.manaRecoup ?? 0) > 0 && <MiniStat label="Mana Recoup" value={`${stats.manaRecoup}%`} labelColor="text-blue-400/50" valueColor="text-blue-200" tint="96, 165, 250" />}
          </div>
        </div>
      )}

    </motion.div>
  );
}

export default CompactStatsSidebar;
