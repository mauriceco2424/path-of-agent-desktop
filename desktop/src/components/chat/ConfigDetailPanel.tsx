/**
 * ConfigDetailPanel Component
 *
 * Slide-in panel from the LEFT edge showing combat config assumptions,
 * why each was enabled, and untapped opportunities.
 *
 * Design: "The Strategist's Grimoire" — PoE item-frame inspired rows
 * with left accent borders, atmospheric glows, and refined typography.
 *
 * @module desktop/src/components/chat/ConfigDetailPanel
 */

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Settings2, Shield, Info, TrendingUp, Check } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { CompactStats } from './CompactStatsSidebar';

interface ConfigDetailPanelProps {
  isOpen: boolean;
  onClose: () => void;
  configs: CompactStats['configAssumptions'];
  opportunities?: CompactStats['configOpportunities'];
}

type ConfigItem = NonNullable<CompactStats['configAssumptions']>[number];
type OpportunityItem = NonNullable<CompactStats['configOpportunities']>[number];

const CATEGORY_LABELS: Record<string, string> = {
  charge: 'Charge',
  buff: 'Buff',
  player_condition: 'Player',
  enemy_condition: 'Enemy',
  enemy_ailment: 'Ailment',
  exposure: 'Exposure',
  alt_ailment: 'Ailment',
  debuff: 'Debuff',
  multiplier: 'Stacks',
  recently: 'Recently',
  combat_state: 'Combat',
};

const SOURCE_KIND_LABELS: Record<string, string> = {
  detected: 'Detected',
  baseline: 'Baseline',
  pob_on: 'PoB On',
  ai_adjusted: 'Agent Adjusted',
};

const OPPORTUNITY_SOURCE_LABELS: Record<string, string> = {
  no_source: 'No Source',
  possible_source: 'Possible Source',
};

function categoryLabel(category?: string): string | undefined {
  if (!category) return undefined;
  return CATEGORY_LABELS[category] ?? category.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
}

// ── Section themes ───────────────────────────────────────────────────

type SectionTheme = {
  accent: string;       // Left border color (rgb)
  accentGlow: string;   // Glow for high-impact items
  pillBorder: string;
  pillText: string;
  pillBg: string;
  headerColor: string;
  iconColor: string;
  rowBorder: string;
  rowBg: string;
};

const THEMES: Record<string, SectionTheme> = {
  active: {
    accent: '52, 211, 153',         // emerald
    accentGlow: 'rgba(52, 211, 153, 0.15)',
    pillBorder: 'border-emerald-500/25',
    pillText: 'text-emerald-400',
    pillBg: 'bg-emerald-500/8',
    headerColor: 'text-emerald-300',
    iconColor: 'text-emerald-400',
    rowBorder: 'rgba(52, 211, 153, 0.3)',
    rowBg: 'rgba(52, 211, 153, 0.03)',
  },
  baseline: {
    accent: '251, 191, 36',         // amber
    accentGlow: 'rgba(251, 191, 36, 0.1)',
    pillBorder: 'border-amber-500/20',
    pillText: 'text-amber-400/70',
    pillBg: 'bg-amber-500/6',
    headerColor: 'text-amber-300/80',
    iconColor: 'text-amber-500/60',
    rowBorder: 'rgba(251, 191, 36, 0.15)',
    rowBg: 'rgba(251, 191, 36, 0.02)',
  },
  opportunity: {
    accent: '56, 189, 248',         // sky
    accentGlow: 'rgba(56, 189, 248, 0.12)',
    pillBorder: 'border-sky-500/20',
    pillText: 'text-sky-400/80',
    pillBg: 'bg-sky-500/6',
    headerColor: 'text-sky-300/90',
    iconColor: 'text-sky-400/70',
    rowBorder: 'rgba(56, 189, 248, 0.2)',
    rowBg: 'rgba(56, 189, 248, 0.02)',
  },
};

// ── Animation variants ─────────────────────────────────────────────────

const drawerVariants = {
  hidden: { x: '-100%', opacity: 0.8 },
  visible: {
    x: 0,
    opacity: 1,
    transition: { type: 'spring', stiffness: 280, damping: 28 },
  },
  exit: {
    x: '-100%',
    opacity: 0.8,
    transition: { duration: 0.25, ease: 'easeIn' },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.04, duration: 0.3, ease: 'easeOut' },
  }),
};

function isReasoningText(source?: string): boolean {
  if (!source) return false;
  if (source === 'baseline' || source === 'build') return false;
  return source.includes(' ');
}

// ── Shared sub-components ──────────────────────────────────────────────

function CategoryPill({ label, theme }: { label: string; theme: SectionTheme }) {
  return (
    <span className={cn(
      'text-[0.5625rem] px-2 py-[1px] rounded border uppercase tracking-widest font-semibold flex-shrink-0',
      theme.pillBg, theme.pillText, theme.pillBorder,
    )}>
      {label}
    </span>
  );
}

function SourceTag({
  label,
  theme,
}: {
  label?: string;
  theme: SectionTheme;
}) {
  if (!label) return null;
  return (
    <span
      className={cn(
        'inline-flex mt-1 text-[0.5625rem] px-1.5 py-[1px] rounded border tracking-wide font-medium',
        theme.pillBg,
        theme.pillText,
        theme.pillBorder,
      )}
    >
      {label}
    </span>
  );
}


function SectionHeader({
  label,
  count,
  theme,
  icon,
}: {
  label: string;
  count: number;
  theme: SectionTheme;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 mb-3 mt-1">
      <span className={cn('opacity-60', theme.iconColor)}>{icon}</span>
      <span className={cn('text-[0.6875rem] font-display font-bold uppercase tracking-[0.15em]', theme.headerColor)}>
        {label}
      </span>
      <div className="flex-1 h-px ml-1" style={{ background: `linear-gradient(90deg, rgba(${theme.accent}, 0.15) 0%, transparent 100%)` }} />
      {count > 0 && <span className="text-[0.625rem] text-slate-600 tabular-nums">{count}</span>}
    </div>
  );
}

// ── Row components ─────────────────────────────────────────────────────

function ConfigRow({
  config,
  index,
}: {
  config: ConfigItem;
  index: number;
}) {
  const reasoning = isReasoningText(config.source) ? config.source : undefined;
  const catLabel = categoryLabel(config.category);
  const theme = THEMES.active;
  const sourceTagLabel = config.sourceKind ? SOURCE_KIND_LABELS[config.sourceKind] : undefined;

  return (
    <motion.div
      custom={index}
      variants={itemVariants}
      initial="hidden"
      animate="visible"
      className="relative rounded-md transition-all duration-200 group"
      style={{
        background: theme.rowBg,
        borderLeft: `2px solid rgba(${theme.accent}, 0.35)`,
      }}
    >
      <div className="py-2.5 px-3.5">
        <div className="flex items-center gap-2">
          <span className="text-[0.75rem] font-semibold text-slate-200 leading-tight">{config.label}</span>
          {catLabel && <CategoryPill label={catLabel} theme={theme} />}
        </div>
        {reasoning && (
          <p className="text-[0.625rem] mt-1 leading-snug text-slate-500">{reasoning}</p>
        )}
        <SourceTag label={sourceTagLabel} theme={theme} />
      </div>
    </motion.div>
  );
}

function OpportunityRow({ item, index }: { item: OpportunityItem; index: number }) {
  const catLabel = categoryLabel(item.category);
  const theme = THEMES.opportunity;
  const sourceTagLabel = item.sourceKind ? OPPORTUNITY_SOURCE_LABELS[item.sourceKind] : undefined;

  return (
    <motion.div
      custom={index}
      variants={itemVariants}
      initial="hidden"
      animate="visible"
      className="relative rounded-md transition-all duration-200 group"
      style={{
        background: theme.rowBg,
        borderLeft: `2px solid rgba(${theme.accent}, 0.25)`,
      }}
    >
      <div className="py-2.5 px-3.5">
        <div className="flex items-center gap-2">
          <span className="text-[0.75rem] font-semibold text-slate-300 leading-tight">{item.label}</span>
          {catLabel && <CategoryPill label={catLabel} theme={theme} />}
        </div>
        <p className="text-[0.625rem] mt-1 leading-snug text-slate-600 italic">
          {item.potentialSources?.length
            ? `Could add: ${item.potentialSources.join(', ')}`
            : 'No source detected in build'}
        </p>
        <SourceTag label={sourceTagLabel} theme={theme} />
      </div>
    </motion.div>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────

export function ConfigDetailPanel({ isOpen, onClose, configs, opportunities }: ConfigDetailPanelProps) {
  const activeConfigs = useMemo(() => {
    if (!configs?.length) return [];

    return [...configs].sort((a, b) =>
      Math.max(Math.abs(b.dpsPercent ?? 0), Math.abs(b.ehpPercent ?? 0)) -
      Math.max(Math.abs(a.dpsPercent ?? 0), Math.abs(a.ehpPercent ?? 0)));
  }, [configs]);

  const sortedOpportunities = useMemo(() => {
    if (!opportunities?.length) return [];
    return [...opportunities].sort((a, b) =>
      Math.max(Math.abs(b.dpsPercent), Math.abs(b.ehpPercent)) -
      Math.max(Math.abs(a.dpsPercent), Math.abs(a.ehpPercent)));
  }, [opportunities]);

  const total = (configs?.length) ?? 0;
  const hasAnyContent = total > 0 || sortedOpportunities.length > 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40"
            style={{
              background: 'radial-gradient(ellipse at 20% 50%, rgba(245, 158, 11, 0.04) 0%, rgba(0, 0, 0, 0.70) 70%)',
              backdropFilter: 'blur(2px)',
            }}
          />

          {/* Panel */}
          <motion.div
            variants={drawerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed left-0 top-0 h-full w-full max-w-[380px] z-50 overflow-hidden"
          >
            {/* Background with subtle noise texture */}
            <div
              className="absolute inset-0"
              style={{
                background: `
                  radial-gradient(ellipse at 10% 20%, rgba(245, 158, 11, 0.03) 0%, transparent 50%),
                  radial-gradient(ellipse at 80% 80%, rgba(139, 92, 246, 0.02) 0%, transparent 50%),
                  linear-gradient(180deg, rgba(12, 14, 20, 0.98) 0%, rgba(8, 10, 16, 0.99) 100%)
                `,
              }}
            />

            {/* Right edge accent */}
            <div
              className="absolute right-0 top-0 bottom-0 w-px"
              style={{
                background: 'linear-gradient(180deg, transparent 0%, rgba(245, 158, 11, 0.2) 30%, rgba(245, 158, 11, 0.25) 50%, rgba(245, 158, 11, 0.2) 70%, transparent 100%)',
              }}
            />

            <div className="relative flex h-full flex-col">
              {/* Header */}
              <div
                className="flex-shrink-0 px-5 py-4"
                style={{
                  borderBottom: '1px solid rgba(245, 158, 11, 0.12)',
                  background: 'linear-gradient(180deg, rgba(245, 158, 11, 0.03) 0%, transparent 100%)',
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center"
                        style={{
                          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(180, 83, 9, 0.08) 100%)',
                          border: '1px solid rgba(245, 158, 11, 0.2)',
                          boxShadow: '0 0 16px rgba(245, 158, 11, 0.08)',
                        }}
                      >
                        <Settings2 className="w-4.5 h-4.5 text-amber-400/90" />
                      </div>
                    </div>

                    <div>
                      <h2 className="font-display text-[0.9375rem] font-semibold text-amber-100/90 tracking-wide">
                        Combat Config
                      </h2>
                      <p className="text-[0.625rem] text-amber-500/50 tracking-wide">
                        {total} active setting{total !== 1 ? 's' : ''} applied
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg p-2 transition-all duration-200 text-slate-500 hover:text-amber-300 hover:bg-amber-500/8"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-fantasy">
                {!hasAnyContent ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="rounded-xl p-6 text-center"
                    style={{
                      background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.05) 0%, transparent 100%)',
                      border: '1px solid rgba(245, 158, 11, 0.12)',
                    }}
                  >
                    <div className="w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center bg-amber-500/10">
                      <Shield className="w-6 h-6 text-amber-400/40" />
                    </div>
                    <p className="text-sm text-amber-300/60 font-display">No config data</p>
                    <p className="text-xs text-amber-400/40 mt-1">Import a build to detect combat configurations</p>
                  </motion.div>
                ) : (
                  <div className="space-y-5">
                    {activeConfigs.length > 0 && (
                      <div>
                        <SectionHeader
                          label="Active In Baseline"
                          count={activeConfigs.length}
                          theme={THEMES.active}
                          icon={<Check className="w-3.5 h-3.5" />}
                        />
                        <p className="text-[0.625rem] text-slate-600 mb-2.5 leading-snug">
                          These settings are already part of the current combat baseline. The tag on each row shows why it is active.
                        </p>
                        <div className="space-y-1.5">
                          {activeConfigs.map((c, i) => (
                            <ConfigRow
                              key={c.label}
                              config={c}
                              index={i}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {sortedOpportunities.length > 0 && (
                      <div>
                        <SectionHeader
                          label="Inactive Potential"
                          count={sortedOpportunities.length}
                          theme={THEMES.opportunity}
                          icon={<TrendingUp className="w-3.5 h-3.5" />}
                        />
                        <p className="text-[0.625rem] text-slate-600 mb-2.5 leading-snug">
                          High-impact configs not currently active — would need a source added to the build.
                        </p>
                        <div className="space-y-1.5">
                          {sortedOpportunities.map((item, i) => (
                            <OpportunityRow key={item.label} item={item} index={i} />
                          ))}
                        </div>
                      </div>
                    )}


                  </div>
                )}
              </div>

              {/* Footer */}
              <div
                className="flex-shrink-0 px-5 py-3"
                style={{ borderTop: '1px solid rgba(245, 158, 11, 0.08)' }}
              >
                <div className="flex items-center justify-center gap-2">
                  <Info className="w-3 h-3 text-slate-600" />
                  <p className="text-[0.625rem] text-slate-600">
                    These settings are applied in PoB before analysis; sidebar totals may use Pinnacle boss context
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default ConfigDetailPanel;
