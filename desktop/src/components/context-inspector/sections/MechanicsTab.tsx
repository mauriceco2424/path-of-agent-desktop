/**
 * MechanicsTab - Three-tier grouped display of game mechanics reference sections.
 *
 * Groups sections into:
 * 1. Core Reference — holistic mechanics reference (full-width, teal accent)
 * 2. Universal Mechanics — 6 always-injected modules (2-col grid, blue accent)
 * 3. Build-Specific Mechanics — L2-selected modules (2-col grid, amber accent)
 *
 * Follows the BuildContextTab grouped rendering pattern with color-coded groups,
 * section counts, and token subtotals per group.
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Shield, Crosshair } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { LLMContextSection } from '../../../store';
import { ContextInspectorSection, type AccentColor } from '../../shared/ContextInspectorSection';
import { formatTokens } from '../ContextInspectorModal';

// =============================================================================
// Types
// =============================================================================

interface MechanicsTabProps {
  sections: LLMContextSection[];
  totalTokens: number;
}

type MechanicsGroup = 'core' | 'universal' | 'build-specific';

interface GroupConfig {
  id: MechanicsGroup;
  label: string;
  accent: AccentColor;
  accentGradient: string;
  labelColor: string;
  icon: LucideIcon;
  /** 'full' = single-column space-y-2, 'grid' = 2-column grid */
  layout: 'full' | 'grid';
}

// =============================================================================
// Classification
// =============================================================================

const UNIVERSAL_MODULE_NAMES = new Set([
  'Armour Effectiveness by Hit Size',
  'Spell Suppression Breakpoint',
  'Max Resistance Exponential Scaling',
  'Guard Skill Selection Thresholds',
  'Leech and Recovery Rate Caps',
  'Increased Damage Saturation',
  'Reflect Damage and Movement Skill Safety',
]);

function classifyMechanicsSection(label: string): MechanicsGroup {
  if (label.toLowerCase().includes('holistic')) return 'core';
  const stripped = label.replace(/^Mechanics:\s*/i, '');
  if (UNIVERSAL_MODULE_NAMES.has(stripped)) return 'universal';
  return 'build-specific';
}

/** Strip redundant "Mechanics: " prefix since we are already in the Mechanics tab. */
function cleanMechanicsLabel(label: string): string {
  return label.replace(/^Mechanics:\s*/i, '');
}

function getMechanicsIcon(group: MechanicsGroup): LucideIcon {
  switch (group) {
    case 'core': return BookOpen;
    case 'universal': return Shield;
    case 'build-specific': return Crosshair;
  }
}

// =============================================================================
// Group Configs
// =============================================================================

const GROUP_CONFIGS: GroupConfig[] = [
  {
    id: 'core',
    label: 'Core Reference',
    accent: 'teal',
    accentGradient: 'from-teal-400 to-teal-600',
    labelColor: 'text-teal-300/80',
    icon: BookOpen,
    layout: 'full',
  },
  {
    id: 'universal',
    label: 'Universal Mechanics',
    accent: 'blue',
    accentGradient: 'from-blue-400 to-blue-600',
    labelColor: 'text-blue-300/80',
    icon: Shield,
    layout: 'grid',
  },
  {
    id: 'build-specific',
    label: 'Build-Specific Mechanics',
    accent: 'amber',
    accentGradient: 'from-amber-400 to-amber-600',
    labelColor: 'text-amber-300/80',
    icon: Crosshair,
    layout: 'grid',
  },
];

// =============================================================================
// Component
// =============================================================================

export function MechanicsTab({ sections, totalTokens }: MechanicsTabProps) {
  const { grouped, allTokens } = useMemo(() => {
    const groupMap = new Map<MechanicsGroup, LLMContextSection[]>();

    for (const section of sections) {
      const group = classifyMechanicsSection(section.label);
      if (!groupMap.has(group)) groupMap.set(group, []);
      groupMap.get(group)!.push(section);
    }

    const tokens = sections.reduce((sum, s) => sum + s.tokenEstimate, 0);

    return { grouped: groupMap, allTokens: tokens };
  }, [sections]);

  if (sections.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-xl p-8 text-center max-w-md mx-auto mt-12"
        style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, transparent 100%)',
          border: '1px solid rgba(16, 185, 129, 0.15)',
        }}
      >
        <BookOpen className="w-6 h-6 text-emerald-400/40 mx-auto mb-3" />
        <p className="text-sm text-emerald-300/60 font-display">No mechanics reference in this call</p>
        <p className="text-xs text-emerald-400/40 mt-1">
          Mechanics references appear in holistic assessment calls.
        </p>
      </motion.div>
    );
  }

  // Track running index for staggered animations across groups
  let runningIndex = 0;

  return (
    <div className="space-y-6">
      {GROUP_CONFIGS.map((groupCfg, groupIdx) => {
        const items = grouped.get(groupCfg.id);
        if (!items || items.length === 0) return null;

        const groupTokens = items.reduce((sum, s) => sum + s.tokenEstimate, 0);
        const startIndex = runningIndex;
        runningIndex += items.length;

        return (
          <div key={groupCfg.id} className="space-y-3">
            {/* Group header */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: groupIdx * 0.04 }}
              className="flex items-center gap-2"
            >
              <div className={`w-1 h-4 rounded-full bg-gradient-to-b ${groupCfg.accentGradient}`} />
              <span className={`text-[0.6875rem] font-display font-semibold ${groupCfg.labelColor} uppercase tracking-wider`}>
                {groupCfg.label}
              </span>
              <span className="text-[0.5625rem] text-slate-500 ml-auto tabular-nums">
                {items.length} {items.length === 1 ? 'section' : 'sections'} &bull; ~{formatTokens(groupTokens)}
              </span>
            </motion.div>

            {/* Section cards — full-width for core, 2-column grid for others */}
            <div className={
              groupCfg.layout === 'full'
                ? 'space-y-2'
                : 'grid grid-cols-1 md:grid-cols-2 gap-2'
            }>
              {items.map((section, idx) => (
                <ContextInspectorSection
                  key={`mechanics-${groupCfg.id}-${section.label}-${idx}`}
                  label={cleanMechanicsLabel(section.label)}
                  content={section.content}
                  tokenEstimate={section.tokenEstimate}
                  totalTokens={allTokens || totalTokens}
                  icon={getMechanicsIcon(groupCfg.id)}
                  index={startIndex + idx}
                  accent={groupCfg.accent}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
