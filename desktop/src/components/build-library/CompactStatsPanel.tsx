/**
 * CompactStatsPanel — the full combat stats for a tier snapshot.
 *
 * Replaces the old 6-chip `StatChip` grid in `TierSnapshotView`. Keeps the
 * three headline chips (DPS / EHP / Life) on top as the "hero row", then
 * adds a dense categorized readout of everything a player actually wants
 * to see on a reference build: crit, speed, resistances (with overcap),
 * charges, block, spell suppression, attributes, move speed, pantheon.
 *
 * Data comes from `snapshot.referenceStats` (the original 6 fields) plus
 * `snapshot.detailedStats` (baked at capture time by `pob-capture.ts`'s
 * `extractDetailedStats`). Every field is optional — missing values are
 * silently hidden so guides generated before the `detailedStats` bake
 * still render the hero row.
 *
 * Pantheon selections come from PoB's `getFullConfig()` — they're the
 * player's actual bound gods on the reference character, not a default.
 *
 * @module desktop/src/components/build-library/CompactStatsPanel
 */

import {
  Sword,
  Shield,
  Heart,
  Zap,
  Activity,
  Crosshair,
  Flame,
  Snowflake,
  Bolt,
  Skull,
  Battery,
  Wind,
  Gauge,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type { TierSnapshot, TierDetailedStats } from '@shared/types/build-library';

// =============================================================================
// Helpers
// =============================================================================

function formatBig(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function formatPct(n: number | undefined, digits = 0): string | null {
  if (n === undefined || n === null || Number.isNaN(n)) return null;
  return `${n.toFixed(digits)}%`;
}

function formatMultiplier(n: number | undefined): string | null {
  if (n === undefined || n === null || Number.isNaN(n)) return null;
  // PoB reports speed as a number (attacks/sec or casts/sec)
  return n.toFixed(2);
}

function formatMoveSpeed(n: number | undefined): string | null {
  if (n === undefined || n === null || Number.isNaN(n)) return null;
  // 1.0 = base, 1.2 = +20%
  const pct = Math.round((n - 1) * 100);
  if (pct === 0) return 'base';
  return `${pct > 0 ? '+' : ''}${pct}%`;
}

function hasValue(n: number | undefined): n is number {
  return n !== undefined && n !== null && !Number.isNaN(n);
}

// =============================================================================
// Stat cell — one labelled number
// =============================================================================

interface StatCellProps {
  label: string;
  value: string;
  Icon?: typeof Sword;
  color: string;
  /** Optional sub-value, e.g. overcap amount for resists */
  sub?: string | null;
  /** Optional hover title for tooltip */
  title?: string;
}

function StatCell({ label, value, Icon, color, sub, title }: StatCellProps) {
  return (
    <div
      className="flex items-center gap-2 min-w-0 px-2 py-1.5 rounded-md"
      style={{
        background: `linear-gradient(145deg, ${color}0c 0%, rgba(2,6,23,0.45) 100%)`,
        border: `1px solid ${color}22`,
      }}
      title={title}
    >
      {Icon && (
        <Icon
          className="w-3 h-3 flex-shrink-0"
          style={{ color: `${color}dd` }}
        />
      )}
      <span className="text-[0.5625rem] font-display uppercase tracking-wider text-slate-500 flex-shrink-0">
        {label}
      </span>
      <span
        className="ml-auto text-[0.75rem] font-mono font-semibold tabular-nums"
        style={{ color: `${color}ee` }}
      >
        {value}
      </span>
      {sub && (
        <span
          className="text-[0.5rem] font-mono tabular-nums"
          style={{ color: `${color}aa` }}
        >
          {sub}
        </span>
      )}
    </div>
  );
}

// =============================================================================
// Category header — small labeled bar above a group of cells
// =============================================================================

interface CategoryHeaderProps {
  label: string;
  color: string;
  Icon: typeof Sword;
}

function CategoryHeader({ label, color, Icon }: CategoryHeaderProps) {
  return (
    <div className="flex items-center gap-1.5 mb-1.5">
      <Icon className="w-3 h-3" style={{ color: `${color}dd` }} />
      <span
        className="text-[0.5625rem] font-display font-semibold uppercase tracking-[0.18em]"
        style={{ color: `${color}dd` }}
      >
        {label}
      </span>
      <div
        className="flex-1 h-px"
        style={{ background: `linear-gradient(90deg, ${color}22 0%, transparent 100%)` }}
      />
    </div>
  );
}

// =============================================================================
// Resistance cell — specialised because res overcap formatting is different
// =============================================================================

interface ResistCellProps {
  label: string;
  value: number | undefined;
  overCap: number | undefined;
  Icon: typeof Sword;
  color: string;
  chaos?: boolean;
}

function ResistCell({ label, value, overCap, Icon, color, chaos }: ResistCellProps) {
  if (!hasValue(value)) return null;
  // Resistances above cap show a small "+N" overcap tag.
  const overCapTag = hasValue(overCap) && overCap > 0 ? `+${overCap}` : null;
  // Under cap is a red warning. For chaos, the cap is often negative so we
  // just don't warn unless it's well below -60.
  const belowCap = chaos ? value < -60 : value < 75;
  const valueColor = belowCap ? '#fca5a5' : `${color}ee`;

  return (
    <div
      className="flex items-center gap-2 min-w-0 px-2 py-1.5 rounded-md"
      style={{
        background: `linear-gradient(145deg, ${color}0c 0%, rgba(2,6,23,0.45) 100%)`,
        border: `1px solid ${color}22`,
      }}
      title={
        overCapTag
          ? `${label}: ${value}% (${overCapTag} overcap)`
          : `${label}: ${value}%`
      }
    >
      <Icon className="w-3 h-3 flex-shrink-0" style={{ color: `${color}dd` }} />
      <span className="text-[0.5625rem] font-display uppercase tracking-wider text-slate-500 flex-shrink-0">
        {label}
      </span>
      <span
        className="ml-auto text-[0.75rem] font-mono font-semibold tabular-nums"
        style={{ color: valueColor }}
      >
        {value}%
      </span>
      {overCapTag && (
        <span className="text-[0.5rem] font-mono tabular-nums text-emerald-400/70">
          {overCapTag}
        </span>
      )}
    </div>
  );
}

// =============================================================================
// Hero row — the 3 big chips on top (DPS / EHP / Life)
// =============================================================================

interface HeroChipProps {
  label: string;
  refValue: number;
  medianValue: number;
  Icon: typeof Sword;
  color: string;
}

function HeroChip({ label, refValue, medianValue, Icon, color }: HeroChipProps) {
  return (
    <div
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg min-w-0"
      style={{
        background: `linear-gradient(145deg, ${color}10 0%, rgba(2,6,23,0.55) 100%)`,
        border: `1px solid ${color}25`,
      }}
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{
          background: `radial-gradient(circle at 30% 30%, ${color}30 0%, ${color}10 60%, transparent 100%)`,
          border: `1px solid ${color}40`,
        }}
      >
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[0.5625rem] font-display font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-base font-mono font-semibold text-slate-100">
            {formatBig(refValue)}
          </span>
          {medianValue > 0 && (
            <span className="text-[0.625rem] text-slate-500">
              median {formatBig(medianValue)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Pantheon strip
// =============================================================================

interface PantheonStripProps {
  major?: string;
  minor?: string;
}

function PantheonStrip({ major, minor }: PantheonStripProps) {
  if (!major && !minor) return null;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <CategoryHeader label="Pantheon" color="#c084fc" Icon={Sparkles} />
      <div className="flex items-center gap-2 flex-wrap">
        {major && (
          <span
            className="inline-flex items-center gap-1.5 text-[0.6875rem] px-2 py-1 rounded-md"
            style={{
              background: 'linear-gradient(145deg, rgba(192,132,252,0.08) 0%, rgba(2,6,23,0.5) 100%)',
              border: '1px solid rgba(192,132,252,0.3)',
              color: '#e9d5ff',
            }}
            title="Major pantheon god"
          >
            <span className="text-[0.5625rem] font-display uppercase tracking-wider text-purple-300/70">
              Major
            </span>
            <span className="font-medium">{major.replace(/^Soul of /, '')}</span>
          </span>
        )}
        {minor && (
          <span
            className="inline-flex items-center gap-1.5 text-[0.6875rem] px-2 py-1 rounded-md"
            style={{
              background: 'linear-gradient(145deg, rgba(192,132,252,0.06) 0%, rgba(2,6,23,0.5) 100%)',
              border: '1px solid rgba(192,132,252,0.22)',
              color: '#e9d5ff',
            }}
            title="Minor pantheon god"
          >
            <span className="text-[0.5625rem] font-display uppercase tracking-wider text-purple-300/70">
              Minor
            </span>
            <span className="font-medium">{minor.replace(/^Soul of /, '')}</span>
          </span>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Main component
// =============================================================================

export interface CompactStatsPanelProps {
  referenceStats: TierSnapshot['referenceStats'];
  medianStats: TierSnapshot['medianStats'];
  detailedStats?: TierDetailedStats;
}

export function CompactStatsPanel({
  referenceStats,
  medianStats,
  detailedStats,
}: CompactStatsPanelProps) {
  const d = detailedStats ?? {};

  // Build sub-section visibility flags so empty categories collapse cleanly.
  const hasOffense =
    hasValue(d.critChance) ||
    hasValue(d.critMultiplier) ||
    hasValue(d.speed) ||
    hasValue(d.hitChance) ||
    hasValue(d.accuracy) ||
    hasValue(d.areaOfEffectMetres);

  const hasDefense =
    hasValue(referenceStats.energyShield) ||
    hasValue(referenceStats.armour) ||
    hasValue(referenceStats.evasion) ||
    hasValue(d.physicalDamageReduction);

  const hasAvoidance =
    hasValue(d.blockChance) ||
    hasValue(d.spellBlockChance) ||
    hasValue(d.spellSuppressionChance) ||
    hasValue(d.attackDodgeChance) ||
    hasValue(d.spellDodgeChance);

  const hasResists =
    hasValue(d.fireResist) ||
    hasValue(d.coldResist) ||
    hasValue(d.lightningResist) ||
    hasValue(d.chaosResist);

  const hasCharges =
    (hasValue(d.powerCharges) && d.powerCharges > 0) ||
    (hasValue(d.frenzyCharges) && d.frenzyCharges > 0) ||
    (hasValue(d.enduranceCharges) && d.enduranceCharges > 0);

  const hasAttributes =
    hasValue(d.strength) || hasValue(d.dexterity) || hasValue(d.intelligence);

  return (
    <div className="space-y-4">
      {/* ─── Hero row: DPS / EHP / Life ──────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <HeroChip
          label="DPS"
          refValue={referenceStats.dps}
          medianValue={medianStats.dps}
          Icon={Sword}
          color="#ef4444"
        />
        <HeroChip
          label="EHP"
          refValue={referenceStats.ehp}
          medianValue={medianStats.ehp}
          Icon={Shield}
          color="#14b8a6"
        />
        <HeroChip
          label="Life"
          refValue={referenceStats.life}
          medianValue={medianStats.life}
          Icon={Heart}
          color="#f87171"
        />
      </div>

      {/* ─── Detail grid: offense / defense / avoidance / resists ─────────── */}
      {detailedStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {/* Offense */}
          {hasOffense && (
            <div>
              <CategoryHeader label="Offense" color="#fca5a5" Icon={Crosshair} />
              <div className="space-y-1">
                {hasValue(d.critChance) && (
                  <StatCell
                    label="Crit"
                    value={formatPct(d.critChance, 1) ?? '—'}
                    Icon={Sparkles}
                    color="#fcd34d"
                  />
                )}
                {hasValue(d.critMultiplier) && (
                  <StatCell
                    label="Multi"
                    value={`${Math.round(d.critMultiplier)}%`}
                    Icon={Sparkles}
                    color="#fb923c"
                  />
                )}
                {hasValue(d.speed) && (
                  <StatCell
                    label="Speed"
                    value={formatMultiplier(d.speed) ?? '—'}
                    Icon={Gauge}
                    color="#fb923c"
                    title="Attack / cast rate (actions per second)"
                  />
                )}
                {hasValue(d.hitChance) && d.hitChance < 100 && (
                  <StatCell
                    label="Hit"
                    value={formatPct(d.hitChance) ?? '—'}
                    color="#fb923c"
                  />
                )}
                {hasValue(d.areaOfEffectMetres) && (
                  <StatCell
                    label="AoE"
                    value={`${d.areaOfEffectMetres.toFixed(1)}m`}
                    color="#fb923c"
                  />
                )}
              </div>
            </div>
          )}

          {/* Defense (non-resist) */}
          {hasDefense && (
            <div>
              <CategoryHeader label="Defense" color="#5eead4" Icon={Shield} />
              <div className="space-y-1">
                {hasValue(referenceStats.energyShield) && referenceStats.energyShield > 0 && (
                  <StatCell
                    label="ES"
                    value={formatBig(referenceStats.energyShield)}
                    Icon={Zap}
                    color="#60a5fa"
                  />
                )}
                {hasValue(referenceStats.armour) && referenceStats.armour > 0 && (
                  <StatCell
                    label="Armour"
                    value={formatBig(referenceStats.armour)}
                    Icon={Shield}
                    color="#94a3b8"
                  />
                )}
                {hasValue(referenceStats.evasion) && referenceStats.evasion > 0 && (
                  <StatCell
                    label="Evasion"
                    value={formatBig(referenceStats.evasion)}
                    Icon={Wind}
                    color="#a3e635"
                  />
                )}
                {hasValue(d.physicalDamageReduction) && (
                  <StatCell
                    label="Phys Red"
                    value={formatPct(d.physicalDamageReduction) ?? '—'}
                    Icon={ShieldCheck}
                    color="#94a3b8"
                    title="Physical damage reduction (from armour + mods, against 100k hit)"
                  />
                )}
                {hasValue(d.lifeRegen) && d.lifeRegen > 0 && (
                  <StatCell
                    label="Regen"
                    value={`${formatBig(d.lifeRegen)}/s`}
                    Icon={Heart}
                    color="#f87171"
                  />
                )}
              </div>
            </div>
          )}

          {/* Avoidance */}
          {hasAvoidance && (
            <div>
              <CategoryHeader label="Avoidance" color="#a3e635" Icon={Activity} />
              <div className="space-y-1">
                {hasValue(d.blockChance) && d.blockChance > 0 && (
                  <StatCell
                    label="Block"
                    value={`${d.blockChance}%`}
                    color="#a3e635"
                  />
                )}
                {hasValue(d.spellBlockChance) && d.spellBlockChance > 0 && (
                  <StatCell
                    label="Spell Blk"
                    value={`${d.spellBlockChance}%`}
                    color="#a3e635"
                  />
                )}
                {hasValue(d.spellSuppressionChance) && d.spellSuppressionChance > 0 && (
                  <StatCell
                    label="Spell Sup"
                    value={`${d.spellSuppressionChance}%`}
                    color="#c4b5fd"
                    sub={
                      hasValue(d.spellSuppressionEffect) && d.spellSuppressionEffect !== 50
                        ? `×${d.spellSuppressionEffect}%`
                        : null
                    }
                    title={`Spell suppression ${d.spellSuppressionChance}% (prevents ${
                      d.spellSuppressionEffect ?? 50
                    }% of suppressed damage)`}
                  />
                )}
                {hasValue(d.attackDodgeChance) && d.attackDodgeChance > 0 && (
                  <StatCell
                    label="Atk Dge"
                    value={`${d.attackDodgeChance}%`}
                    color="#a3e635"
                  />
                )}
                {hasValue(d.spellDodgeChance) && d.spellDodgeChance > 0 && (
                  <StatCell
                    label="Spell Dge"
                    value={`${d.spellDodgeChance}%`}
                    color="#a3e635"
                  />
                )}
              </div>
            </div>
          )}

          {/* Resistances */}
          {hasResists && (
            <div>
              <CategoryHeader label="Resists" color="#f87171" Icon={Shield} />
              <div className="space-y-1">
                <ResistCell
                  label="Fire"
                  value={d.fireResist}
                  overCap={d.fireResistOverCap}
                  Icon={Flame}
                  color="#ef4444"
                />
                <ResistCell
                  label="Cold"
                  value={d.coldResist}
                  overCap={d.coldResistOverCap}
                  Icon={Snowflake}
                  color="#60a5fa"
                />
                <ResistCell
                  label="Light"
                  value={d.lightningResist}
                  overCap={d.lightningResistOverCap}
                  Icon={Bolt}
                  color="#fcd34d"
                />
                <ResistCell
                  label="Chaos"
                  value={d.chaosResist}
                  overCap={d.chaosResistOverCap}
                  Icon={Skull}
                  color="#a78bfa"
                  chaos
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Charges + Attributes + Move speed + Pantheon ─────────────────── */}
      {detailedStats && (hasCharges || hasAttributes || hasValue(d.movementSpeedMod) || d.pantheonMajor || d.pantheonMinor) && (
        <div className="flex flex-wrap gap-x-5 gap-y-3">
          {hasCharges && (
            <div className="flex items-center gap-2">
              <CategoryHeader label="Charges" color="#fbbf24" Icon={Battery} />
              <div className="flex gap-1">
                {hasValue(d.powerCharges) && d.powerCharges > 0 && (
                  <span
                    className="inline-flex items-center gap-1 text-[0.6875rem] px-2 py-1 rounded-md font-mono"
                    style={{
                      background: 'linear-gradient(145deg, rgba(96,165,250,0.1) 0%, rgba(2,6,23,0.5) 100%)',
                      border: '1px solid rgba(96,165,250,0.3)',
                      color: '#93c5fd',
                    }}
                    title="Power charges"
                  >
                    <span className="text-[0.5rem] font-display uppercase tracking-wider text-blue-300/60">P</span>
                    {d.powerCharges}
                  </span>
                )}
                {hasValue(d.frenzyCharges) && d.frenzyCharges > 0 && (
                  <span
                    className="inline-flex items-center gap-1 text-[0.6875rem] px-2 py-1 rounded-md font-mono"
                    style={{
                      background: 'linear-gradient(145deg, rgba(34,197,94,0.1) 0%, rgba(2,6,23,0.5) 100%)',
                      border: '1px solid rgba(34,197,94,0.3)',
                      color: '#86efac',
                    }}
                    title="Frenzy charges"
                  >
                    <span className="text-[0.5rem] font-display uppercase tracking-wider text-green-300/60">F</span>
                    {d.frenzyCharges}
                  </span>
                )}
                {hasValue(d.enduranceCharges) && d.enduranceCharges > 0 && (
                  <span
                    className="inline-flex items-center gap-1 text-[0.6875rem] px-2 py-1 rounded-md font-mono"
                    style={{
                      background: 'linear-gradient(145deg, rgba(239,68,68,0.1) 0%, rgba(2,6,23,0.5) 100%)',
                      border: '1px solid rgba(239,68,68,0.3)',
                      color: '#fca5a5',
                    }}
                    title="Endurance charges"
                  >
                    <span className="text-[0.5rem] font-display uppercase tracking-wider text-red-300/60">E</span>
                    {d.enduranceCharges}
                  </span>
                )}
              </div>
            </div>
          )}

          {hasAttributes && (
            <div className="flex items-center gap-2">
              <CategoryHeader label="Attrib" color="#94a3b8" Icon={Heart} />
              <div className="flex gap-1 font-mono text-[0.6875rem]">
                {hasValue(d.strength) && (
                  <span
                    className="px-1.5 py-0.5 rounded border border-red-500/25 text-red-300/90 bg-red-950/20"
                    title={`Strength ${d.strength}`}
                  >
                    <span className="text-[0.5rem] font-display uppercase tracking-wider text-red-300/60 mr-0.5">Str</span>
                    {d.strength}
                  </span>
                )}
                {hasValue(d.dexterity) && (
                  <span
                    className="px-1.5 py-0.5 rounded border border-emerald-500/25 text-emerald-300/90 bg-emerald-950/20"
                    title={`Dexterity ${d.dexterity}`}
                  >
                    <span className="text-[0.5rem] font-display uppercase tracking-wider text-emerald-300/60 mr-0.5">Dex</span>
                    {d.dexterity}
                  </span>
                )}
                {hasValue(d.intelligence) && (
                  <span
                    className="px-1.5 py-0.5 rounded border border-blue-500/25 text-blue-300/90 bg-blue-950/20"
                    title={`Intelligence ${d.intelligence}`}
                  >
                    <span className="text-[0.5rem] font-display uppercase tracking-wider text-blue-300/60 mr-0.5">Int</span>
                    {d.intelligence}
                  </span>
                )}
              </div>
            </div>
          )}

          {hasValue(d.movementSpeedMod) && (
            <div className="flex items-center gap-2">
              <CategoryHeader label="Move" color="#fde68a" Icon={Wind} />
              <span
                className={cn(
                  'text-[0.75rem] font-mono tabular-nums px-2 py-1 rounded-md',
                  'bg-amber-950/20 border border-amber-500/25 text-amber-200',
                )}
              >
                {formatMoveSpeed(d.movementSpeedMod)}
              </span>
            </div>
          )}

          <PantheonStrip major={d.pantheonMajor} minor={d.pantheonMinor} />
        </div>
      )}
    </div>
  );
}

export default CompactStatsPanel;
