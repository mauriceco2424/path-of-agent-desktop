/**
 * ProgressionPanel Component - Premium Build Progression UI
 *
 * A polished milestone progression panel for build guides featuring:
 * - Horizontal level timeline with animated progress
 * - Detailed milestone content card with build mechanics
 * - Dark fantasy forge aesthetic with amber/gold accents
 *
 * @module desktop/src/components/build-library/ProgressionPanel
 */

import { motion, AnimatePresence } from 'framer-motion';
import {
  Lightbulb,
  Sparkles,
  Target,
  TrendingUp,
  CheckCircle2,
  Key,
  Zap,
  Loader2,
  Shield,
  Sword,
  Gem,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { AlternativesSection } from './AlternativesSection';
import { SynergiesSection } from './SynergiesSection';
import { KeyDecisionsSection } from './KeyDecisionsSection';
import { ExoticResultsSection } from './ExoticResultsSection';
import type {
  BuildAlternative,
  GuideSynergy,
  GuideDecision,
  GuideTradeOff,
  ExoticTestResult,
  LadderContext,
} from '../../../../shared/types/builds';

// ============================================
// Types
// ============================================

export interface MilestoneDescriptionData {
  level: number;
  label: string;
  mechanics: string;
  newSinceLastLevel: string[];
  gearPriorities: string[];
  progressionTips: string[];
  keyMechanics?: string;
  stats?: {
    dps: number;
    ehp: number;
    life: number;
    es: number;
  };
  convergenceNote?: string;
  // Gem quality priorities - which gems to quality first and why
  gemQualityPriorities?: string[];
  // Build alternatives with trade-off reasoning (L75+ milestones)
  alternatives?: BuildAlternative[];
  // Guide generation fields
  synergies?: GuideSynergy[];
  keyDecisions?: GuideDecision[];
  tradeOffs?: GuideTradeOff[];
  exoticResults?: ExoticTestResult[];
  ladderContext?: LadderContext | null;
}

export interface ProgressionPanelProps {
  milestones: number[];
  selected: number;
  onSelect: (level: number) => void;
  data: MilestoneDescriptionData | null;
  optimizedLevels?: number[];
  isLoading?: boolean;
}

// ============================================
// Constants
// ============================================

const MILESTONE_LABELS: Record<number, string> = {
  12: 'Act 1',
  28: 'Act 3',
  38: 'Act 4+',
  55: 'Act 8',
  68: 'Early Maps',
  75: 'Yellow Maps',
  90: 'Red Maps',
  95: 'Endgame',
  100: 'Fully Maxed',
};

// ============================================
// Utility Functions
// ============================================

function formatNumber(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(0)}K`;
  }
  return value.toString();
}

// ============================================
// Sub-Components
// ============================================

interface TimelineNodeProps {
  level: number;
  label: string;
  isSelected: boolean;
  isPast: boolean;
  isOptimized: boolean;
  onClick: () => void;
}

function TimelineNode({
  level,
  label,
  isSelected,
  isPast,
  isOptimized,
  onClick,
}: TimelineNodeProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative flex flex-col items-center group',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 rounded-lg p-1',
        'transition-transform hover:scale-105'
      )}
    >
      {/* Node circle */}
      <motion.div
        className={cn(
          'relative w-10 h-10 rounded-full border-2 flex items-center justify-center',
          'transition-all duration-300',
          isSelected
            ? 'bg-gradient-to-br from-amber-400 to-amber-600 border-amber-300 shadow-lg shadow-amber-500/40'
            : isPast
            ? 'bg-gradient-to-br from-amber-600/80 to-amber-800/80 border-amber-500/60'
            : 'bg-slate-900/80 border-slate-600/60 group-hover:border-amber-500/50 group-hover:bg-slate-800/80'
        )}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        {/* Level number */}
        <span
          className={cn(
            'text-xs font-bold font-display',
            isSelected
              ? 'text-slate-900'
              : isPast
              ? 'text-amber-200'
              : 'text-slate-400 group-hover:text-amber-300'
          )}
        >
          {level}
        </span>

        {/* Pulsing ring for selected */}
        {isSelected && (
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-amber-400/60"
            initial={{ scale: 1, opacity: 0.8 }}
            animate={{
              scale: [1, 1.4, 1.4],
              opacity: [0.8, 0, 0],
            }}
            transition={{
              duration: 1.8,
              repeat: Infinity,
              ease: 'easeOut',
            }}
          />
        )}

        {/* Optimized indicator (green dot) */}
        {isOptimized && (
          <div className="absolute -top-0.5 -right-0.5 w-3 h-3">
            <div className="absolute inset-0 rounded-full bg-emerald-500 animate-pulse" />
            <div className="absolute inset-0.5 rounded-full bg-emerald-400" />
          </div>
        )}
      </motion.div>

      {/* Phase label */}
      <span
        className={cn(
          'mt-2 text-[0.625rem] font-medium uppercase tracking-wide whitespace-nowrap',
          'transition-colors duration-200',
          isSelected
            ? 'text-amber-300'
            : isPast
            ? 'text-amber-500/70'
            : 'text-slate-500 group-hover:text-slate-400'
        )}
      >
        {label}
      </span>
    </button>
  );
}

interface ContentSectionProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  color: 'amber' | 'green' | 'blue' | 'violet' | 'cyan';
}

function ContentSection({ icon, title, children, color }: ContentSectionProps) {
  const colorClasses = {
    amber: {
      icon: 'text-amber-400',
      border: 'from-amber-500/40 via-amber-500/20 to-transparent',
      title: 'text-amber-400/90',
    },
    green: {
      icon: 'text-emerald-400',
      border: 'from-emerald-500/40 via-emerald-500/20 to-transparent',
      title: 'text-emerald-400/90',
    },
    blue: {
      icon: 'text-blue-400',
      border: 'from-blue-500/40 via-blue-500/20 to-transparent',
      title: 'text-blue-400/90',
    },
    violet: {
      icon: 'text-violet-400',
      border: 'from-violet-500/40 via-violet-500/20 to-transparent',
      title: 'text-violet-400/90',
    },
    cyan: {
      icon: 'text-cyan-400',
      border: 'from-cyan-500/40 via-cyan-500/20 to-transparent',
      title: 'text-cyan-400/90',
    },
  };

  const colors = colorClasses[color];

  return (
    <div className="space-y-3">
      {/* Section header */}
      <div className="flex items-center gap-3">
        <div className={cn('flex-shrink-0', colors.icon)}>{icon}</div>
        <span
          className={cn(
            'text-[0.6875rem] font-display font-semibold uppercase tracking-[0.2em]',
            colors.title
          )}
        >
          {title}
        </span>
        <div
          className={cn('flex-1 h-px bg-gradient-to-r', colors.border)}
        />
      </div>
      {/* Section content */}
      <div className="pl-7">{children}</div>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export function ProgressionPanel({
  milestones,
  selected,
  onSelect,
  data,
  optimizedLevels = [90, 100],
  isLoading = false,
}: ProgressionPanelProps) {
  const selectedIndex = milestones.indexOf(selected);

  return (
    <div className="flex flex-col h-full">
      {/* Timeline Section */}
      <div className="px-4 pt-4 pb-2">
        <div className="card-forge rounded-xl p-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <Zap className="w-4 h-4 text-amber-400 icon-glow-gold" />
              </div>
              <h3 className="text-sm font-display font-semibold uppercase tracking-wider text-amber-100">
                Build Progression
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <span>Current</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Optimized</span>
              </div>
            </div>
          </div>

          {/* Progress Track */}
          <div className="relative px-2">
            {/* Track line background */}
            <div className="absolute top-5 left-7 right-7 h-1 bg-slate-800/80 rounded-full" />

            {/* Active progress line */}
            <motion.div
              className="absolute top-5 left-7 h-1 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-400 rounded-full"
              style={{
                boxShadow: '0 0 12px rgba(251, 191, 36, 0.4)',
              }}
              initial={{ width: 0 }}
              animate={{
                width:
                  selectedIndex > 0
                    ? `calc(${(selectedIndex / (milestones.length - 1)) * 100}% - 28px)`
                    : 0,
              }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />

            {/* Milestone nodes */}
            <div className="relative flex justify-between">
              {milestones.map((level, index) => (
                <TimelineNode
                  key={level}
                  level={level}
                  label={MILESTONE_LABELS[level] || `L${level}`}
                  isSelected={level === selected}
                  isPast={index < selectedIndex}
                  isOptimized={optimizedLevels.includes(level)}
                  onClick={() => onSelect(level)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="flex-1 overflow-y-auto scrollbar-fantasy px-4 pb-4">
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center h-64"
            >
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
                <span className="text-sm text-slate-400">Loading milestone data...</span>
              </div>
            </motion.div>
          ) : data ? (
            <motion.div
              key={data.level}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              {/* Milestone Header Card */}
              <div className="card-forge rounded-xl p-5">
                <div className="flex items-start justify-between gap-4">
                  {/* Level badge and title */}
                  <div className="flex items-center gap-4">
                    <div
                      className={cn(
                        'w-14 h-14 rounded-xl flex items-center justify-center',
                        'bg-gradient-to-br from-amber-500/20 to-amber-600/10',
                        'border border-amber-500/30',
                        'shadow-lg shadow-amber-500/10'
                      )}
                    >
                      <span className="text-2xl font-display font-bold text-amber-300 text-glow-amber">
                        {data.level}
                      </span>
                    </div>
                    <div>
                      <h2 className="text-xl font-display font-bold text-amber-100 text-glow-amber">
                        {data.label}
                      </h2>
                      <p className="text-xs text-slate-500 uppercase tracking-wide mt-0.5">
                        Level {data.level} Milestone
                      </p>
                    </div>
                  </div>

                  {/* Stats display */}
                  {data.stats && (
                    <div className="flex gap-3">
                      <div className="stat-hud-accent px-4 py-2 rounded-lg text-center">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Sword className="w-3.5 h-3.5 text-orange-400" />
                          <span className="text-[0.625rem] uppercase tracking-wider text-slate-500">DPS</span>
                        </div>
                        <span className="text-lg font-display font-bold text-orange-400">
                          {formatNumber(data.stats.dps)}
                        </span>
                      </div>
                      <div className="stat-hud px-4 py-2 rounded-lg text-center">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Shield className="w-3.5 h-3.5 text-cyan-400" />
                          <span className="text-[0.625rem] uppercase tracking-wider text-slate-500">EHP</span>
                        </div>
                        <span className="text-lg font-display font-bold text-cyan-400">
                          {formatNumber(data.stats.ehp)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Build Mechanics Card */}
              <div className="card-forge rounded-xl p-5 space-y-5">
                {/* Build Mechanics */}
                <ContentSection
                  icon={<Lightbulb className="w-4 h-4" />}
                  title="Build Mechanics"
                  color="amber"
                >
                  <p className="text-sm text-slate-300 leading-relaxed">
                    {data.mechanics}
                  </p>

                  {/* Key Mechanics highlight */}
                  {data.keyMechanics && (
                    <div
                      className={cn(
                        'mt-3 p-3 rounded-lg',
                        'bg-gradient-to-r from-amber-500/10 to-transparent',
                        'border-l-2 border-amber-500/50'
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <Key className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-amber-200/90">{data.keyMechanics}</p>
                      </div>
                    </div>
                  )}
                </ContentSection>

                {/* What's New */}
                {data.newSinceLastLevel.length > 0 && (
                  <ContentSection
                    icon={<Sparkles className="w-4 h-4" />}
                    title="What's New"
                    color="green"
                  >
                    <ul className="space-y-2">
                      {data.newSinceLastLevel.map((item, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                          <span className="text-sm text-slate-300">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </ContentSection>
                )}

                {/* Gear Priorities */}
                {data.gearPriorities.length > 0 && (
                  <ContentSection
                    icon={<Target className="w-4 h-4" />}
                    title="Gear Priorities"
                    color="blue"
                  >
                    <ul className="space-y-2">
                      {data.gearPriorities.map((item, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="text-blue-400 text-sm">—</span>
                          <span className="text-sm text-slate-300">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </ContentSection>
                )}

                {/* Gem Quality Priorities - shows which gems to quality first */}
                {data.gemQualityPriorities && data.gemQualityPriorities.length > 0 && (
                  <ContentSection
                    icon={<Gem className="w-4 h-4" />}
                    title="Gem Quality Priorities"
                    color="cyan"
                  >
                    <ul className="space-y-2">
                      {data.gemQualityPriorities.map((item, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="text-cyan-400 text-sm">◆</span>
                          <span className="text-sm text-slate-300">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </ContentSection>
                )}

                {/* Progression Tips */}
                {data.progressionTips.length > 0 && (
                  <ContentSection
                    icon={<TrendingUp className="w-4 h-4" />}
                    title="How to Progress"
                    color="violet"
                  >
                    <ul className="space-y-2">
                      {data.progressionTips.map((item, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="text-violet-400 text-sm">↗</span>
                          <span className="text-sm text-slate-300">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </ContentSection>
                )}

                {/* Convergence Note */}
                {data.convergenceNote && (
                  <div
                    className={cn(
                      'p-4 rounded-lg',
                      'bg-gradient-to-r from-emerald-500/10 to-emerald-600/5',
                      'border border-emerald-500/30'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-1.5 rounded-lg bg-emerald-500/20">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div>
                        <h4 className="text-sm font-display font-semibold text-emerald-300 mb-1">
                          Optimization Complete
                        </h4>
                        <p className="text-sm text-emerald-200/70">{data.convergenceNote}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Build Alternatives - shows trade-offs for L75+ milestones */}
                {data.alternatives && data.alternatives.length > 0 && (
                  <AlternativesSection alternatives={data.alternatives} />
                )}

                {/* Synergies from optimization */}
                {data.synergies && data.synergies.length > 0 && (
                  <SynergiesSection synergies={data.synergies} />
                )}

                {/* Key Decisions */}
                {data.keyDecisions && data.keyDecisions.length > 0 && (
                  <KeyDecisionsSection decisions={data.keyDecisions} />
                )}

                {/* Exotic Mechanics Results */}
                {data.exoticResults && data.exoticResults.length > 0 && (
                  <ExoticResultsSection results={data.exoticResults} />
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center h-64"
            >
              <div className="text-center">
                <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 inline-block mb-3">
                  <Zap className="w-8 h-8 text-slate-600" />
                </div>
                <p className="text-sm text-slate-500">
                  Select a milestone to view build details
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default ProgressionPanel;
