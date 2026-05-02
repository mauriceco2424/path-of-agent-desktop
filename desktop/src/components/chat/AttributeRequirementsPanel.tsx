/**
 * AttributeRequirementsPanel Component
 *
 * Slide-in panel from the LEFT edge showing attribute requirement analysis.
 * Displays which items/gems create the highest attribute demands and
 * highlights "gaps" where removing one source would significantly reduce
 * attribute pressure.
 *
 * Design: "Strategist's Grimoire" — PoE item-frame inspired rows
 * with left accent borders, atmospheric glows, and dark fantasy aesthetic.
 *
 * @module desktop/src/components/chat/AttributeRequirementsPanel
 */

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, BarChart3, AlertTriangle, TrendingDown, Info, ShieldOff } from 'lucide-react';
import { cn } from '../../lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────

export interface AttributeRequirementSource {
  name: string;
  slot: string;
  type: 'item' | 'gem';
  requirement: number;
}

export interface AttributeGapData {
  current: number;
  required: number;
  surplus: number;
  sources: AttributeRequirementSource[];
  gap: number;
  gapItem: string | null;
}

export interface AttributeRequirementsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  data: {
    str: AttributeGapData;
    dex: AttributeGapData;
    int: AttributeGapData;
    /** Supreme Ostentation: all attribute requirements are ignored */
    ignoreAttrReq?: boolean;
  } | null;
}

// ── Attribute color themes ────────────────────────────────────────────────

interface AttrTheme {
  label: string;
  accent: string;
  accentRgb: string;
  textColor: string;
  badgeColor: string;
  badgeBg: string;
  badgeBorder: string;
  barColor: string;
  headerColor: string;
}

const ATTR_THEMES: Record<string, AttrTheme> = {
  str: {
    label: 'Strength',
    accent: 'red',
    accentRgb: '248, 113, 113',
    textColor: 'text-red-400',
    badgeColor: 'text-red-300',
    badgeBg: 'bg-red-500/10',
    badgeBorder: 'border-red-500/25',
    barColor: 'bg-red-500/70',
    headerColor: 'text-red-300',
  },
  dex: {
    label: 'Dexterity',
    accent: 'emerald',
    accentRgb: '52, 211, 153',
    textColor: 'text-emerald-400',
    badgeColor: 'text-emerald-300',
    badgeBg: 'bg-emerald-500/10',
    badgeBorder: 'border-emerald-500/25',
    barColor: 'bg-emerald-500/70',
    headerColor: 'text-emerald-300',
  },
  int: {
    label: 'Intelligence',
    accent: 'blue',
    accentRgb: '96, 165, 250',
    textColor: 'text-blue-400',
    badgeColor: 'text-blue-300',
    badgeBg: 'bg-blue-500/10',
    badgeBorder: 'border-blue-500/25',
    barColor: 'bg-blue-500/70',
    headerColor: 'text-blue-300',
  },
};

// ── Animation variants ────────────────────────────────────────────────────

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

// ── Sub-components ────────────────────────────────────────────────────────

function StatusLine({ data, theme }: { data: AttributeGapData; theme: AttrTheme }) {
  const isDeficit = data.surplus < 0;
  const surplusAbs = Math.abs(data.surplus);

  return (
    <div className="flex items-center gap-2 mt-1.5 mb-2.5">
      <span className="text-[0.75rem] font-bold text-slate-200 tabular-nums">
        {data.current}
      </span>
      <span className="text-[0.625rem] text-slate-500">/</span>
      <span className="text-[0.75rem] font-semibold text-slate-400 tabular-nums">
        {data.required}
      </span>
      <span
        className={cn(
          'text-[0.6875rem] font-bold tabular-nums ml-1',
          isDeficit ? 'text-amber-400' : 'text-emerald-400/80',
        )}
        style={{
          textShadow: isDeficit
            ? '0 0 8px rgba(251, 191, 36, 0.3)'
            : undefined,
        }}
      >
        ({isDeficit ? '-' : '+'}{surplusAbs} {isDeficit ? 'DEFICIT' : 'surplus'})
      </span>
    </div>
  );
}

function GapCallout({ gap, gapItem }: { gap: number; gapItem: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="relative rounded-md my-1.5"
      style={{
        background: 'rgba(251, 191, 36, 0.06)',
        borderLeft: '2px solid rgba(251, 191, 36, 0.5)',
        boxShadow: 'inset 4px 0 12px -4px rgba(251, 191, 36, 0.12)',
      }}
    >
      <div className="py-2 px-3 flex items-start gap-2">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400/80 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-[0.625rem] font-semibold text-amber-300/90 leading-tight">
            Gap of {gap} between #1 and #2
          </p>
          <p className="text-[0.5625rem] text-amber-400/50 mt-0.5 leading-snug">
            Removing <span className="text-amber-300/70 font-medium">{gapItem}</span> would
            significantly reduce this attribute requirement
          </p>
        </div>
      </div>
    </motion.div>
  );
}

function SourceRow({
  source,
  maxRequirement,
  theme,
  index,
}: {
  source: AttributeRequirementSource;
  maxRequirement: number;
  theme: AttrTheme;
  index: number;
}) {
  const barPct = maxRequirement > 0 ? (source.requirement / maxRequirement) * 100 : 0;

  return (
    <motion.div
      custom={index}
      variants={itemVariants}
      initial="hidden"
      animate="visible"
      className="relative rounded-md transition-all duration-200 group"
      style={{
        background: `rgba(${theme.accentRgb}, 0.03)`,
        borderLeft: `2px solid rgba(${theme.accentRgb}, ${barPct > 80 ? 0.5 : 0.2})`,
      }}
    >
      <div className="py-2 px-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[0.6875rem] font-semibold text-slate-200 leading-tight truncate">
                {source.name}
              </span>
              <span className="text-[0.5625rem] text-slate-500 flex-shrink-0">
                {source.type === 'gem' ? 'Gem' : source.slot}
              </span>
            </div>
            {/* Requirement bar */}
            <div className="mt-1.5 h-[3px] rounded-full bg-slate-800/60 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${barPct}%` }}
                transition={{ duration: 0.5, ease: 'easeOut', delay: index * 0.04 }}
                className={cn('h-full rounded-full', theme.barColor)}
              />
            </div>
          </div>
          <span
            className={cn(
              'text-[0.75rem] font-bold tabular-nums flex-shrink-0',
              theme.textColor,
            )}
          >
            {source.requirement}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

function AttributeSection({
  attrKey,
  data,
}: {
  attrKey: 'str' | 'dex' | 'int';
  data: AttributeGapData;
}) {
  const theme = ATTR_THEMES[attrKey];
  const isDeficit = data.surplus < 0;

  const sortedSources = useMemo(
    () => [...data.sources].sort((a, b) => b.requirement - a.requirement),
    [data.sources],
  );

  const maxReq = sortedSources.length > 0 ? sortedSources[0].requirement : 0;
  const showGapCallout = data.gap >= 20 && data.gapItem != null;

  if (sortedSources.length === 0) return null;

  return (
    <div className="mb-4">
      {/* Section header */}
      <div className="flex items-center gap-2 mb-1">
        <span
          className={cn(
            'text-[0.625rem] px-2 py-[1px] rounded border uppercase tracking-widest font-bold flex-shrink-0',
            theme.badgeBg,
            theme.badgeColor,
            theme.badgeBorder,
          )}
        >
          {theme.label}
        </span>
        <div
          className="flex-1 h-px"
          style={{
            background: `linear-gradient(90deg, rgba(${theme.accentRgb}, 0.15) 0%, transparent 100%)`,
          }}
        />
        <span className="text-[0.625rem] text-slate-600 tabular-nums">
          {sortedSources.length} source{sortedSources.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Status line */}
      <StatusLine data={data} theme={theme} />

      {/* Sources list with optional gap callout */}
      <div
        className={cn('space-y-1.5 rounded-lg p-1', isDeficit && 'ring-1 ring-red-500/15')}
        style={isDeficit ? { boxShadow: 'inset 0 0 20px rgba(248, 113, 113, 0.04)' } : undefined}
      >
        {sortedSources.map((source, i) => (
          <div key={`${source.type}-${source.name}-${source.slot}`}>
            <SourceRow
              source={source}
              maxRequirement={maxReq}
              theme={theme}
              index={i}
            />
            {/* Gap callout between #1 and #2 */}
            {i === 0 && showGapCallout && (
              <GapCallout gap={data.gap} gapItem={data.gapItem!} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────

export function AttributeRequirementsPanel({
  isOpen,
  onClose,
  data,
}: AttributeRequirementsPanelProps) {
  const hasAnyContent = data != null && (
    data.str.sources.length > 0 ||
    data.dex.sources.length > 0 ||
    data.int.sources.length > 0
  );

  const totalSources = data
    ? data.str.sources.length + data.dex.sources.length + data.int.sources.length
    : 0;

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
              background:
                'radial-gradient(ellipse at 20% 50%, rgba(245, 158, 11, 0.04) 0%, rgba(0, 0, 0, 0.70) 70%)',
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
                background:
                  'linear-gradient(180deg, transparent 0%, rgba(245, 158, 11, 0.2) 30%, rgba(245, 158, 11, 0.25) 50%, rgba(245, 158, 11, 0.2) 70%, transparent 100%)',
              }}
            />

            <div className="relative flex h-full flex-col">
              {/* Header */}
              <div
                className="flex-shrink-0 px-5 py-4"
                style={{
                  borderBottom: '1px solid rgba(245, 158, 11, 0.12)',
                  background:
                    'linear-gradient(180deg, rgba(245, 158, 11, 0.03) 0%, transparent 100%)',
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center"
                        style={{
                          background:
                            'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(180, 83, 9, 0.08) 100%)',
                          border: '1px solid rgba(245, 158, 11, 0.2)',
                          boxShadow: '0 0 16px rgba(245, 158, 11, 0.08)',
                        }}
                      >
                        <BarChart3 className="w-4.5 h-4.5 text-amber-400/90" />
                      </div>
                    </div>

                    <div>
                      <h2 className="font-display text-[0.9375rem] font-semibold text-amber-100/90 tracking-wide">
                        Attribute Requirements
                      </h2>
                      <p className="text-[0.625rem] text-amber-500/50 tracking-wide">
                        {totalSources} requirement source{totalSources !== 1 ? 's' : ''} found
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
                      background:
                        'linear-gradient(135deg, rgba(245, 158, 11, 0.05) 0%, transparent 100%)',
                      border: '1px solid rgba(245, 158, 11, 0.12)',
                    }}
                  >
                    <div className="w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center bg-amber-500/10">
                      <TrendingDown className="w-6 h-6 text-amber-400/40" />
                    </div>
                    <p className="text-sm text-amber-300/60 font-display">
                      No attribute data
                    </p>
                    <p className="text-xs text-amber-400/40 mt-1">
                      Import a build to analyze attribute requirements
                    </p>
                  </motion.div>
                ) : (
                  <div className="space-y-2">
                    {data!.ignoreAttrReq && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3 }}
                        className="relative rounded-md mb-3"
                        style={{
                          background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.08) 0%, rgba(168, 85, 247, 0.03) 100%)',
                          borderLeft: '2px solid rgba(168, 85, 247, 0.5)',
                          boxShadow: 'inset 4px 0 12px -4px rgba(168, 85, 247, 0.12)',
                        }}
                      >
                        <div className="py-2.5 px-3 flex items-start gap-2.5">
                          <ShieldOff className="w-4 h-4 text-purple-400/80 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-[0.6875rem] font-semibold text-purple-300/90 leading-tight">
                              Supreme Ostentation
                            </p>
                            <p className="text-[0.5625rem] text-purple-400/50 mt-0.5 leading-snug">
                              All attribute requirements are ignored. The sources below are informational only.
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                    <AttributeSection attrKey="str" data={data!.str} />
                    <AttributeSection attrKey="dex" data={data!.dex} />
                    <AttributeSection attrKey="int" data={data!.int} />
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
                    Gap highlights items that dominate attribute pressure
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

export default AttributeRequirementsPanel;
