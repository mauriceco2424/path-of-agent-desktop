/**
 * LadderConfigTab - Ladder data display mirroring BuildContextTab layout.
 *
 * Parses ### subsections from ladder ## sections and groups them into
 * semantic categories displayed in a 2-column grid:
 * - Benchmarks & Defenses (DPS/EHP/life/armour/defensive layers)
 * - Skills & Gems (supports, auras, heralds, other skills, gem placement)
 * - Tree & Passives (keystones, notables, ascendancy, clusters, masteries, etc.)
 * - Equipment (unique items, rare mods)
 * - Jewels & Flasks (unique jewels, jewel mods, unique flasks, flask mods)
 * - Meta & Tiers (tier insights)
 *
 * Standalone ladder sections (e.g., Ladder Config Comparison) that don't
 * contain ### subsections are shown as individual cards in a separate group.
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3,
  FileText,
  Gem,
  TreePine,
  Wrench,
  Diamond,
  FlaskConical,
  TrendingUp,
  Shield,
  Zap,
  Database,
  Crosshair,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { LLMContextSection } from '../../../store';
import { ContextInspectorSection, type AccentColor } from '../../shared/ContextInspectorSection';
import { parseSubsections, formatTokens } from '../ContextInspectorModal';

// =============================================================================
// Types
// =============================================================================

interface LadderConfigTabProps {
  sections: LLMContextSection[];
  totalTokens: number;
}

interface SubsectionItem {
  label: string;
  content: string;
  tokenEstimate: number;
}

type LadderGroup = 'benchmarks' | 'skills' | 'tree' | 'equipment' | 'jewels' | 'meta' | 'other';

interface GroupConfig {
  id: LadderGroup;
  label: string;
  accent: AccentColor;
  accentGradient: string;
  labelColor: string;
}

// =============================================================================
// Constants
// =============================================================================

const GROUP_CONFIGS: GroupConfig[] = [
  { id: 'benchmarks', label: 'Benchmarks & Defenses', accent: 'teal', accentGradient: 'from-teal-400 to-teal-600', labelColor: 'text-teal-300/80' },
  { id: 'skills', label: 'Skills & Gems', accent: 'blue', accentGradient: 'from-blue-400 to-blue-600', labelColor: 'text-blue-300/80' },
  { id: 'tree', label: 'Tree & Passives', accent: 'emerald', accentGradient: 'from-emerald-400 to-emerald-600', labelColor: 'text-emerald-300/80' },
  { id: 'equipment', label: 'Equipment', accent: 'amber', accentGradient: 'from-amber-400 to-amber-600', labelColor: 'text-amber-300/80' },
  { id: 'jewels', label: 'Jewels & Flasks', accent: 'violet', accentGradient: 'from-violet-400 to-violet-600', labelColor: 'text-violet-300/80' },
  { id: 'meta', label: 'Meta & Tiers', accent: 'slate', accentGradient: 'from-slate-400 to-slate-600', labelColor: 'text-slate-300/80' },
  { id: 'other', label: 'Other Ladder Data', accent: 'slate', accentGradient: 'from-slate-400 to-slate-600', labelColor: 'text-slate-300/80' },
];

// =============================================================================
// Helpers
// =============================================================================

function categorizeSubsection(label: string): LadderGroup {
  const lower = label.toLowerCase();
  // Benchmarks & Defenses
  if (lower.includes('benchmark') || lower.includes('defensive layer')) return 'benchmarks';
  // Skills & Gems
  if (lower.includes('support') || lower.includes('aura') || lower.includes('herald') || lower.includes('other skill') || lower.includes('gem placement') || lower.includes('gem linkage')) return 'skills';
  // Tree & Passives
  if (lower.includes('keystone') || lower.includes('notable') || lower.includes('ascendancy') || lower.includes('cluster') || lower.includes('master') || lower.includes('pantheon') || lower.includes('bandit') || lower.includes('bloodline')) return 'tree';
  // Equipment (uniques + rare mods)
  if (lower.includes('unique item') || lower.includes('rare mod')) return 'equipment';
  // Jewels & Flasks
  if (lower.includes('jewel') || lower.includes('flask')) return 'jewels';
  // Meta & Tiers
  if (lower.includes('tier') || lower.includes('meta')) return 'meta';
  return 'other';
}

function getLadderIcon(label: string): LucideIcon {
  const lower = label.toLowerCase();
  if (lower.includes('benchmark')) return BarChart3;
  if (lower.includes('defensive')) return Shield;
  if (lower.includes('support') || lower.includes('gem')) return Gem;
  if (lower.includes('aura') || lower.includes('herald')) return Zap;
  if (lower.includes('other skill')) return Crosshair;
  if (lower.includes('keystone') || lower.includes('notable') || lower.includes('passive') || lower.includes('tree') || lower.includes('ascendancy') || lower.includes('master') || lower.includes('cluster')) return TreePine;
  if (lower.includes('unique item') || lower.includes('rare mod')) return Wrench;
  if (lower.includes('jewel')) return Diamond;
  if (lower.includes('flask')) return FlaskConical;
  if (lower.includes('tier') || lower.includes('meta')) return TrendingUp;
  if (lower.includes('ladder')) return Database;
  return FileText;
}

// =============================================================================
// Component
// =============================================================================

export function LadderConfigTab({ sections, totalTokens }: LadderConfigTabProps) {
  const { grouped, standaloneSections, subsectionTokens } = useMemo(() => {
    const subs: SubsectionItem[] = [];
    const standalone: LLMContextSection[] = [];

    for (const section of sections) {
      // Parse ### subsections from ladder data sections
      const parsed = parseSubsections(section.content);
      if (parsed.length > 1) {
        // Section has meaningful subsections — flatten them
        subs.push(...parsed);
      } else {
        // No ### subsections — check if this ## section matches a known category
        // (e.g., "Gem Linkages" → skills). If so, treat it as a subsection of that group.
        const rawLabel = section.label || parsed[0]?.label || '';
        const group = categorizeSubsection(rawLabel);
        if (group !== 'other') {
          // Clean "Ladder: Gem Linkages (30 builds, levels 98-100)" → "Gem Linkages"
          const cleanLabel = rawLabel
            .replace(/^#+\s*/, '')           // strip leading ## markers
            .replace(/^Ladder:\s*/i, '')     // strip "Ladder: " prefix
            .replace(/\s*\(.*\)\s*$/, '');   // strip trailing parenthetical
          subs.push({
            label: cleanLabel || rawLabel,
            content: parsed[0]?.content || section.content,
            tokenEstimate: parsed[0]?.tokenEstimate || Math.ceil(section.content.length / 4),
          });
        } else {
          standalone.push(section);
        }
      }
    }

    // Group subsections by category
    const groups = new Map<LadderGroup, SubsectionItem[]>();
    for (const sub of subs) {
      const group = categorizeSubsection(sub.label);
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group)!.push(sub);
    }

    return {
      grouped: groups,
      standaloneSections: standalone,
      subsectionTokens: subs.reduce((sum, s) => sum + s.tokenEstimate, 0),
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
        <BarChart3 className="w-6 h-6 text-teal-400/40 mx-auto mb-3" />
        <p className="text-sm text-teal-300/60 font-display">No ladder data in this call</p>
        <p className="text-xs text-teal-400/40 mt-1">
          Ladder data appears in analysis calls with ladder benchmarks enabled.
        </p>
      </motion.div>
    );
  }

  let runningIndex = 0;

  return (
    <div className="space-y-6">
      {/* Standalone sections (e.g., Ladder Config Comparison) */}
      {standaloneSections.length > 0 && (
        <div className="space-y-2">
          {standaloneSections.map((section, idx) => (
            <ContextInspectorSection
              key={`standalone-${section.label}-${idx}`}
              label={section.label}
              content={section.content}
              tokenEstimate={section.tokenEstimate}
              totalTokens={totalTokens}
              icon={getLadderIcon(section.label)}
              index={runningIndex++}
              accent="slate"
            />
          ))}
        </div>
      )}

      {/* Grouped subsections — mirroring BuildContextTab layout */}
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
                {items.length} sections &bull; ~{formatTokens(groupTokens)}
              </span>
            </motion.div>

            {/* Section cards in 2-column grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {items.map((sub, idx) => (
                <ContextInspectorSection
                  key={`ladder-${groupCfg.id}-${sub.label}-${idx}`}
                  label={sub.label}
                  content={sub.content}
                  tokenEstimate={sub.tokenEstimate}
                  totalTokens={subsectionTokens || totalTokens}
                  icon={getLadderIcon(sub.label)}
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
