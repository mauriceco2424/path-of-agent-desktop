/**
 * BuildContextTab - Build context and configuration sections display.
 *
 * Splits sections into semantic groups for easier scanning:
 * 1. Character & Stats — Character, Defenses, Attributes, Offense
 * 2. Skills & Effects — Skill Setup, Active Effects, Combat Configuration
 * 3. Equipment — Equipped Gear, Jewels, Flasks, Grafts
 * 4. Progression — Passive Tree
 * 5. Configuration — Config State, Recommended Config
 *
 * Each group has a distinct accent color that flows through to the section cards,
 * creating a visual hierarchy that makes the build context scannable at a glance.
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Package,
  FileText,
  Shield,
  Sword,
  TreePine,
  Gem,
  User,
  Wrench,
  Settings2,
  Zap,
  FlaskConical,
  Diamond,
  Crosshair,
  Activity,
  Gauge,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { LLMContextSection } from '../../../store';
import { ContextInspectorSection, type AccentColor } from '../../shared/ContextInspectorSection';
import { parseSubsections, formatTokens } from '../ContextInspectorModal';

// =============================================================================
// Types
// =============================================================================

interface BuildContextTabProps {
  sections: LLMContextSection[];
  totalTokens: number;
}

interface SubsectionItem {
  label: string;
  content: string;
  tokenEstimate: number;
}

type SectionGroup = 'stats' | 'skills' | 'equipment' | 'progression' | 'ungrouped';

// =============================================================================
// Helpers
// =============================================================================

/** True for config/constraint sections that should NOT be sub-parsed by ### */
function isConfigSection(label: string): boolean {
  const lower = label.toLowerCase();
  return lower.includes('config') || lower.includes('constraint snapshot') || lower.includes('agent assessment');
}

function getBuildIcon(label: string): LucideIcon {
  const lower = label.toLowerCase();
  if (lower.includes('character') || lower.includes('overview')) return User;
  if (lower === 'stats' || lower.includes('defense') || lower.includes('ehp') || lower.includes('armour') || lower.includes('evasion')) return Shield;
  if (lower.includes('attribute') || lower.includes('mana')) return Gauge;
  if (lower.includes('offense') || lower.includes('dps') || lower.includes('damage')) return Sword;
  if (lower.includes('skill setup') || lower.includes('gem') || lower.includes('link')) return Gem;
  if (lower.includes('active effect') || lower.includes('aura') || lower.includes('buff')) return Zap;
  if (lower.includes('combat config')) return Crosshair;
  if (lower.includes('tree') || lower.includes('passive') || lower.includes('keystone')) return TreePine;
  if (lower.includes('gear') || lower.includes('equipment') || lower.includes('item')) return Wrench;
  if (lower.includes('jewel') || lower.includes('cluster')) return Diamond;
  if (lower.includes('flask')) return FlaskConical;
  if (lower.includes('graft')) return Activity;
  return FileText;
}

function getConfigIcon(label: string): LucideIcon {
  const lower = label.toLowerCase();
  if (lower.includes('constraint') || lower.includes('snapshot')) return Shield;
  return Settings2;
}

/** Categorize a build subsection into a semantic group */
function categorizeSubsection(label: string): SectionGroup {
  const lower = label.toLowerCase();
  if (lower.includes('character') || lower.includes('stats') || lower.includes('defense') || lower.includes('attribute') || lower.includes('offense')) return 'stats';
  if (lower.includes('skill') || lower.includes('active effect') || lower.includes('combat config')) return 'skills';
  if (lower.includes('gear') || lower.includes('jewel') || lower.includes('flask') || lower.includes('graft')) return 'equipment';
  if (lower.includes('tree') || lower.includes('passive') || lower.includes('keystone')) return 'progression';
  return 'ungrouped';
}

interface GroupConfig {
  id: SectionGroup;
  label: string;
  accent: AccentColor;
  /** Tailwind gradient classes for the group header accent bar */
  accentGradient: string;
  /** Tailwind text color for the group label */
  labelColor: string;
}

const GROUP_CONFIGS: GroupConfig[] = [
  { id: 'stats', label: 'Character & Stats', accent: 'teal', accentGradient: 'from-teal-400 to-teal-600', labelColor: 'text-teal-300/80' },
  { id: 'skills', label: 'Skills & Effects', accent: 'blue', accentGradient: 'from-blue-400 to-blue-600', labelColor: 'text-blue-300/80' },
  { id: 'equipment', label: 'Equipment', accent: 'amber', accentGradient: 'from-amber-400 to-amber-600', labelColor: 'text-amber-300/80' },
  { id: 'progression', label: 'Progression', accent: 'emerald', accentGradient: 'from-emerald-400 to-emerald-600', labelColor: 'text-emerald-300/80' },
  { id: 'ungrouped', label: 'Other', accent: 'slate', accentGradient: 'from-slate-400 to-slate-600', labelColor: 'text-slate-300/80' },
];

// =============================================================================
// Component
// =============================================================================

export function BuildContextTab({ sections, totalTokens }: BuildContextTabProps) {
  const { groupedBuild, configSections, buildTokens, configTokens } = useMemo(() => {
    const buildSubs: SubsectionItem[] = [];
    const config: LLMContextSection[] = [];

    for (const section of sections) {
      if (isConfigSection(section.label)) {
        config.push(section);
      } else {
        const parsed = parseSubsections(section.content);
        if (parsed.length > 0) {
          buildSubs.push(...parsed);
        } else {
          buildSubs.push({
            label: section.label,
            content: section.content,
            tokenEstimate: section.tokenEstimate,
          });
        }
      }
    }

    // Group build subsections by category
    const grouped = new Map<SectionGroup, SubsectionItem[]>();
    for (const sub of buildSubs) {
      const group = categorizeSubsection(sub.label);
      if (!grouped.has(group)) grouped.set(group, []);
      grouped.get(group)!.push(sub);
    }

    return {
      groupedBuild: grouped,
      configSections: config,
      buildTokens: buildSubs.reduce((sum, s) => sum + s.tokenEstimate, 0),
      configTokens: config.reduce((sum, s) => sum + s.tokenEstimate, 0),
    };
  }, [sections]);

  if (sections.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-xl p-8 text-center max-w-md mx-auto mt-12"
        style={{
          background: 'linear-gradient(135deg, rgba(45, 212, 191, 0.05) 0%, transparent 100%)',
          border: '1px solid rgba(45, 212, 191, 0.15)',
        }}
      >
        <Package className="w-6 h-6 text-teal-400/40 mx-auto mb-3" />
        <p className="text-sm text-teal-300/60 font-display">No build context in this call</p>
        <p className="text-xs text-teal-400/40 mt-1">
          Build context is included in analysis and follow-up calls, not consultations.
        </p>
      </motion.div>
    );
  }

  // Track running index for staggered animations across groups
  let runningIndex = 0;

  return (
    <div className="space-y-6">
      {/* Build Data — grouped by category */}
      {GROUP_CONFIGS.map((groupCfg, groupIdx) => {
        const items = groupedBuild.get(groupCfg.id);
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
                {items.length} sections &bull; ~{formatTokens(groupTokens)}
              </span>
            </motion.div>

            {/* Section cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {items.map((sub, idx) => (
                <ContextInspectorSection
                  key={`build-${groupCfg.id}-${sub.label}-${idx}`}
                  label={sub.label}
                  content={sub.content}
                  tokenEstimate={sub.tokenEstimate}
                  totalTokens={buildTokens || totalTokens}
                  icon={getBuildIcon(sub.label)}
                  index={startIndex + idx}
                  accent={groupCfg.accent}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* Configuration group */}
      {configSections.length > 0 && (
        <div className="space-y-3">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="flex items-center gap-2"
          >
            <div className="w-1 h-4 rounded-full bg-gradient-to-b from-violet-400 to-violet-600" />
            <span className="text-[0.6875rem] font-display font-semibold text-violet-300/80 uppercase tracking-wider">
              Configuration
            </span>
            <span className="text-[0.5625rem] text-slate-500 ml-auto tabular-nums">
              {configSections.length} sections &bull; ~{formatTokens(configTokens)}
            </span>
          </motion.div>

          <div className="space-y-2">
            {configSections.map((section, idx) => (
              <ContextInspectorSection
                key={`config-${section.label}-${idx}`}
                label={section.label}
                content={section.content}
                tokenEstimate={section.tokenEstimate}
                totalTokens={configTokens || totalTokens}
                icon={getConfigIcon(section.label)}
                index={runningIndex + idx}
                accent="violet"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
