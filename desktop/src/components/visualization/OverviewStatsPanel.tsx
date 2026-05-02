/**
 * OverviewStatsPanel Component
 *
 * Displays build statistics organized into Offensive, Defensive, and Resistances sections.
 * Used in the Overview tab to show key build metrics at a glance.
 * Features collapsible breakdowns for EHP by element, and Max Hit Taken.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sword, Shield, Flame, Snowflake, Zap, Skull, ChevronDown, Settings2 } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Per-skill DPS breakdown entry
 */
export interface SkillDpsEntry {
  name: string;
  combinedDps: number;
  hitDps: number;
  dotDps: number;
  /** Army-DPS decomposition: combinedDps = perMinionDps * armyCount. */
  perMinionDps?: number;
  armyCount?: number;
  armyCapKey?: string;
}

/**
 * DPS context information (enemy type)
 */
export interface DpsContext {
  enemyType: string;
  description: string;
}

/**
 * Stats structure for the overview panel
 */
export interface OverviewStats {
  dps: number;
  critChance: number;
  critMultiplier: number;
  speed: number;
  // Offensive - skill details
  activeSkillName: string | null;
  hitDps: number;
  totalDotDps: number;
  // Ailment DPS breakdown
  bleedDps: number;
  igniteDps: number;
  poisonDps: number;
  // Aggregated DPS fields
  totalBuildDps?: number;
  minionDps?: number;
  isMinionBuild?: boolean;
  skillDpsBreakdown?: SkillDpsEntry[];
  dpsContext?: DpsContext;
  // Defensive
  life: number;
  energyShield: number;
  armour: number;
  evasion: number;
  ehp: number;
  // Per-element EHP
  ehpFire: number;
  ehpCold: number;
  ehpLightning: number;
  ehpChaos: number;
  // Max Hit Taken
  maxHitPhysical: number;
  maxHitFire: number;
  maxHitCold: number;
  maxHitLightning: number;
  maxHitChaos: number;
  // Resistances (capped values from PoB)
  fireResist: number;
  coldResist: number;
  lightningResist: number;
  chaosResist: number;
  // Resistance overcap (amount above max resistance)
  fireResistOverCap: number;
  coldResistOverCap: number;
  lightningResistOverCap: number;
  chaosResistOverCap: number;
  // Block
  blockChance: number;
  spellBlockChance: number;
  // DPS against different enemy types
  dpsVsNormal?: number;
  dpsVsPinnacle?: number;
  // DPS Archetype Detection
  /** Detected damage archetype (poison, bleed, ignite, hit, etc.) */
  damageArchetype?: string;
  /** Human-readable DPS label (e.g., "Poison DPS", "Combined DPS") */
  dpsLabel?: string;
  /** Short suffix for compact display (e.g., "Poison", "Bleed", "") */
  dpsSuffix?: string;
}

/**
 * PoB configuration settings
 */
export interface PoBConfig {
  /** Active settings extracted from PoB config (e.g., "usePowerCharges", "enemyIsBoss:Pinnacle") */
  activeSettings: string[];
  /** Enemy level used for calculations */
  enemyLevel?: number;
  /** Bandit choice */
  bandit?: string;
  /** Pantheon selections */
  pantheon?: { major?: string; minor?: string };
}

interface OverviewStatsPanelProps {
  stats?: OverviewStats;
  config?: PoBConfig;
}

/**
 * Format large numbers with K/M suffixes
 */
function formatNumber(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toLocaleString();
}

/**
 * Format percentage values
 */
function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

/**
 * Single stat row component
 */
function StatRow({
  label,
  value,
  color = 'text-slate-300',
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex justify-between items-center py-1">
      <span className="text-slate-400 text-sm">{label}</span>
      <span className={cn('text-sm font-medium', color)}>{value}</span>
    </div>
  );
}

/**
 * Collapsible breakdown section component
 */
function CollapsibleBreakdown({
  title,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-slate-700/50 pt-2 mt-2">
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full text-left py-1 hover:bg-slate-800/30 rounded px-1 -mx-1"
      >
        <span className="text-slate-400 text-sm">{title}</span>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-slate-500 transition-transform',
            expanded && 'rotate-180'
          )}
        />
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pl-3 space-y-1 pt-1">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Section header component
 */
function SectionHeader({
  title,
  icon,
}: {
  title: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 pb-2 border-b border-slate-700/50">
      <span className="text-amber-400">{icon}</span>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-amber-400">
        {title}
      </h3>
    </div>
  );
}

/**
 * Convert config key to user-friendly label
 */
function getConfigLabel(key: string): { label: string; category: 'charges' | 'buffs' | 'conditions' | 'enemy' } {
  // Handle keys with values (e.g., "enemyIsBoss:Pinnacle")
  const [baseKey, value] = key.split(':');

  const labelMap: Record<string, { label: string; category: 'charges' | 'buffs' | 'conditions' | 'enemy' }> = {
    // Charges
    usePowerCharges: { label: 'Power Charges', category: 'charges' },
    useFrenzyCharges: { label: 'Frenzy Charges', category: 'charges' },
    useEnduranceCharges: { label: 'Endurance Charges', category: 'charges' },
    // Buffs
    buffOnslaught: { label: 'Onslaught', category: 'buffs' },
    buffFortification: { label: 'Fortify', category: 'buffs' },
    buffTailwind: { label: 'Tailwind', category: 'buffs' },
    buffAdrenaline: { label: 'Adrenaline', category: 'buffs' },
    buffUnholyMight: { label: 'Unholy Might', category: 'buffs' },
    conditionUsingFlask: { label: 'Using Flask', category: 'buffs' },
    // Combat conditions
    conditionLowLife: { label: 'Low Life', category: 'conditions' },
    conditionFullLife: { label: 'Full Life', category: 'conditions' },
    conditionLowMana: { label: 'Low Mana', category: 'conditions' },
    conditionFullMana: { label: 'Full Mana', category: 'conditions' },
    // Enemy conditions
    enemyIsBoss: { label: value ? `vs ${value} Boss` : 'vs Boss', category: 'enemy' },
    conditionEnemyIntimidated: { label: 'Enemy Intimidated', category: 'enemy' },
    conditionEnemyUnnerved: { label: 'Enemy Unnerved', category: 'enemy' },
    conditionEnemyCoveredInAsh: { label: 'Covered in Ash', category: 'enemy' },
    conditionEnemyCoveredInFrost: { label: 'Covered in Frost', category: 'enemy' },
    enemyIsChilled: { label: 'Enemy Chilled', category: 'enemy' },
    enemyIsShocked: { label: 'Enemy Shocked', category: 'enemy' },
    enemyIsCrushed: { label: 'Enemy Crushed', category: 'enemy' },
    enemyIsBlinded: { label: 'Enemy Blinded', category: 'enemy' },
  };

  return labelMap[baseKey] || { label: key, category: 'conditions' };
}

/**
 * Config badge component
 */
function ConfigBadge({ label, category }: { label: string; category: string }) {
  const colorClasses: Record<string, string> = {
    charges: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    buffs: 'bg-green-500/20 text-green-300 border-green-500/30',
    conditions: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    enemy: 'bg-red-500/20 text-red-300 border-red-500/30',
  };

  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border',
      colorClasses[category] || colorClasses.conditions
    )}>
      {label}
    </span>
  );
}

export function OverviewStatsPanel({ stats, config }: OverviewStatsPanelProps) {
  // State for collapsible sections
  const [ehpExpanded, setEhpExpanded] = useState(true);
  const [maxHitExpanded, setMaxHitExpanded] = useState(true);
  const [dpsExpanded, setDpsExpanded] = useState(true);

  // Loading state
  if (!stats) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-slate-400 text-sm">Loading stats...</div>
      </div>
    );
  }

  // Check if DPS breakdown should be shown (either hit or DoT DPS exists)
  const showDpsBreakdown = (stats.hitDps > 0) || (stats.totalDotDps > 0);

  // Determine primary DPS display: use totalBuildDps if available, else fallback to dps
  const primaryDps = stats.totalBuildDps ?? stats.dps;
  const hasTotalBuildDps = stats.totalBuildDps !== undefined && stats.totalBuildDps > 0;

  // Check for multi-skill builds
  const hasMultipleSkills = stats.skillDpsBreakdown && stats.skillDpsBreakdown.length > 1;

  // Build DPS context string (e.g., "vs Pinnacle Boss")
  const dpsContextString = stats.dpsContext?.description || '';

  // Process config settings for display
  const configSettings = config?.activeSettings?.map(key => {
    const { label, category } = getConfigLabel(key);
    return { key, label, category };
  }) || [];

  // Build compact config summary for inline display
  const configSummaryParts: string[] = [];
  // Add boss type from active settings
  const bossConfig = configSettings.find(c => c.label.includes('Boss'));
  if (bossConfig) {
    configSummaryParts.push(bossConfig.label);
  }
  // Add charges
  const charges = configSettings.filter(c => c.category === 'charges').map(c => c.label.replace(' Charges', ''));
  if (charges.length > 0) {
    configSummaryParts.push(`${charges.join('/')} Charges`);
  }
  // Add key buffs
  const keyBuffs = configSettings.filter(c => c.category === 'buffs').map(c => c.label);
  if (keyBuffs.length > 0) {
    configSummaryParts.push(keyBuffs.slice(0, 2).join(', '));
  }
  const configSummary = configSummaryParts.length > 0 ? configSummaryParts.join(' · ') : 'Default config';

  return (
    <div className="flex flex-col gap-6 p-4 h-full overflow-y-auto">
      {/* Offensive Section */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="p-4 bg-black/20 border border-red-500/30 rounded-xl"
      >
        <SectionHeader title="Offensive" icon={<Sword className="w-4 h-4" />} />
        <div className="mt-3 space-y-1">
          {/* Main Skill Name */}
          <StatRow
            label="Main Skill"
            value={stats.activeSkillName || 'Unknown Skill'}
            color="text-amber-200"
          />

          {/* Total DPS with context */}
          <div className="flex justify-between items-center py-1">
            <span className="text-slate-400 text-sm">
              Total DPS
            </span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-red-300">
                {formatNumber(primaryDps)}
              </span>
              {dpsContextString && (
                <span className="text-xs text-slate-500">
                  {dpsContextString}
                </span>
              )}
            </div>
          </div>

          {/* Minion DPS (if present, show separately in purple) */}
          {stats.minionDps !== undefined && stats.minionDps > 0 && (
            <StatRow
              label="Minion DPS"
              value={formatNumber(stats.minionDps)}
              color="text-purple-300"
            />
          )}

          {/* Collapsible DPS Breakdown */}
          {showDpsBreakdown && (
            <CollapsibleBreakdown
              title="DPS Breakdown"
              expanded={dpsExpanded}
              onToggle={() => setDpsExpanded(!dpsExpanded)}
            >
              {stats.hitDps > 0 && (
                <StatRow
                  label="Hit DPS"
                  value={formatNumber(stats.hitDps)}
                  color="text-orange-300"
                />
              )}
              {stats.totalDotDps > 0 && (
                <StatRow
                  label="DoT DPS"
                  value={formatNumber(stats.totalDotDps)}
                  color="text-green-300"
                />
              )}
              {stats.bleedDps > 0 && (
                <StatRow
                  label="Bleed DPS"
                  value={formatNumber(stats.bleedDps)}
                  color="text-red-400"
                />
              )}
              {stats.igniteDps > 0 && (
                <StatRow
                  label="Ignite DPS"
                  value={formatNumber(stats.igniteDps)}
                  color="text-orange-400"
                />
              )}
              {stats.poisonDps > 0 && (
                <StatRow
                  label="Poison DPS"
                  value={formatNumber(stats.poisonDps)}
                  color="text-emerald-400"
                />
              )}
            </CollapsibleBreakdown>
          )}

          {/* Per-skill breakdown for multi-skill builds */}
          {hasMultipleSkills && (
            <div className="border-t border-slate-700/50 pt-2 mt-2">
              <span className="text-slate-400 text-sm">Skill Breakdown</span>
              <div className="pl-3 space-y-1 pt-1">
                {stats.skillDpsBreakdown!.map((skill) => {
                  const hasArmy = skill.armyCount && skill.armyCount > 1 && skill.perMinionDps && skill.perMinionDps > 0;
                  return (
                    <div key={skill.name}>
                      <StatRow
                        label={skill.name}
                        value={formatNumber(skill.combinedDps)}
                        color="text-amber-300"
                      />
                      {hasArmy && (
                        <div
                          className="pl-2 text-xs text-slate-500 tabular-nums"
                          title="Army DPS = per-minion damage × active minion cap"
                        >
                          {formatNumber(skill.perMinionDps!)} × {skill.armyCount}{' '}
                          {(() => {
                            const mapping: Record<string, string> = {
                              ActiveSpectreLimit: 'spectres',
                              ActiveZombieLimit: 'zombies',
                              ActiveSkeletonLimit: 'skeletons',
                              ActiveGolemLimit: 'golems',
                              ActiveRagingSpiritLimit: 'raging spirits',
                              ActiveWolfLimit: 'wolves',
                              ActiveTigerLimit: 'tigers',
                              ActiveSpiderLimit: 'spiders',
                            };
                            return (skill.armyCapKey && mapping[skill.armyCapKey]) || 'minions';
                          })()}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {stats.critChance >= 5 && (
            <>
              <StatRow
                label="Crit Chance"
                value={formatPercent(stats.critChance)}
                color="text-amber-300"
              />
              <StatRow
                label="Crit Multi"
                value={`${stats.critMultiplier.toFixed(0)}%`}
                color="text-amber-300"
              />
            </>
          )}
          <StatRow
            label="Attack/Cast Speed"
            value={stats.speed.toFixed(2)}
            color="text-slate-300"
          />

          {/* Compact config summary */}
          <div className="border-t border-slate-700/50 pt-2 mt-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Settings2 className="w-3 h-3" />
              <span>{configSummary}</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Defensive Section */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="p-4 bg-black/20 border border-blue-500/30 rounded-xl"
      >
        <SectionHeader title="Defensive" icon={<Shield className="w-4 h-4" />} />
        <div className="mt-3 space-y-2 text-sm">
          {/* Effective HP (at top) */}
          <StatRow
            label="Effective HP"
            value={formatNumber(stats.ehp)}
            color="text-cyan-400"
          />

          {/* Collapsible EHP by Element */}
          <CollapsibleBreakdown
            title="DoT EHP by Element"
            expanded={ehpExpanded}
            onToggle={() => setEhpExpanded(!ehpExpanded)}
          >
            <StatRow
              label="Fire EHP"
              value={formatNumber(stats.ehpFire)}
              color="text-red-400"
            />
            <StatRow
              label="Cold EHP"
              value={formatNumber(stats.ehpCold)}
              color="text-blue-400"
            />
            <StatRow
              label="Lightning EHP"
              value={formatNumber(stats.ehpLightning)}
              color="text-yellow-400"
            />
            <StatRow
              label="Chaos EHP"
              value={formatNumber(stats.ehpChaos)}
              color="text-purple-400"
            />
          </CollapsibleBreakdown>

          {/* Collapsible Max Hit Taken */}
          <CollapsibleBreakdown
            title="Max Hit Taken"
            expanded={maxHitExpanded}
            onToggle={() => setMaxHitExpanded(!maxHitExpanded)}
          >
            <StatRow
              label="Physical"
              value={formatNumber(stats.maxHitPhysical)}
              color="text-slate-300"
            />
            <StatRow
              label="Fire"
              value={formatNumber(stats.maxHitFire)}
              color="text-red-400"
            />
            <StatRow
              label="Cold"
              value={formatNumber(stats.maxHitCold)}
              color="text-blue-400"
            />
            <StatRow
              label="Lightning"
              value={formatNumber(stats.maxHitLightning)}
              color="text-yellow-400"
            />
            <StatRow
              label="Chaos"
              value={formatNumber(stats.maxHitChaos)}
              color="text-purple-400"
            />
          </CollapsibleBreakdown>

          {/* Life & ES row */}
          <div className="flex gap-4 pt-2 border-t border-slate-700/50">
            <div className="flex-1 flex justify-between">
              <span className="text-slate-400">Life</span>
              <span className="text-red-400 font-medium">{formatNumber(stats.life)}</span>
            </div>
            <div className="flex-1 flex justify-between">
              <span className="text-slate-400">ES</span>
              <span className="text-blue-400 font-medium">{formatNumber(stats.energyShield)}</span>
            </div>
          </div>

          {/* Armour & Evasion row */}
          <div className="flex gap-4">
            <div className="flex-1 flex justify-between">
              <span className="text-slate-400">Armour</span>
              <span className="text-amber-400 font-medium">{formatNumber(stats.armour)}</span>
            </div>
            <div className="flex-1 flex justify-between">
              <span className="text-slate-400">Evasion</span>
              <span className="text-green-400 font-medium">{formatNumber(stats.evasion)}</span>
            </div>
          </div>

          {/* Block & Spell Block row */}
          <div className="flex gap-4">
            <div className="flex-1 flex justify-between">
              <span className="text-slate-400">Block</span>
              <span className="text-slate-200 font-medium">{formatPercent(stats.blockChance)}</span>
            </div>
            <div className="flex-1 flex justify-between">
              <span className="text-slate-400">Spell Block</span>
              <span className="text-slate-200 font-medium">{formatPercent(stats.spellBlockChance)}</span>
            </div>
          </div>

          {/* Resistances row with element colors */}
          <div className="pt-2 border-t border-slate-700/50">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Resistances</span>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-0.5 text-red-400">
                  <Flame className="w-3 h-3" />
                  {Math.round(stats.fireResist)}
                  {stats.fireResistOverCap > 0 && <span className="text-[0.625rem] text-slate-500">+{Math.round(stats.fireResistOverCap)}</span>}
                </span>
                <span className="flex items-center gap-0.5 text-blue-400">
                  <Snowflake className="w-3 h-3" />
                  {Math.round(stats.coldResist)}
                  {stats.coldResistOverCap > 0 && <span className="text-[0.625rem] text-slate-500">+{Math.round(stats.coldResistOverCap)}</span>}
                </span>
                <span className="flex items-center gap-0.5 text-yellow-400">
                  <Zap className="w-3 h-3" />
                  {Math.round(stats.lightningResist)}
                  {stats.lightningResistOverCap > 0 && <span className="text-[0.625rem] text-slate-500">+{Math.round(stats.lightningResistOverCap)}</span>}
                </span>
                <span className="flex items-center gap-0.5 text-purple-400">
                  <Skull className="w-3 h-3" />
                  {Math.round(stats.chaosResist)}
                  {stats.chaosResistOverCap > 0 && <span className="text-[0.625rem] text-slate-500">+{Math.round(stats.chaosResistOverCap)}</span>}
                </span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default OverviewStatsPanel;
