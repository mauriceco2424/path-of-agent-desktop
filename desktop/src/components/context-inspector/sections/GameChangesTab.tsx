/**
 * GameChangesTab - Recent game changes context display.
 *
 * Parses patch delta content into a two-level hierarchy:
 *   ### 3.28 Mirage (March 2026)        → Patch group header
 *     #### League Mechanic: Mirage       → Expandable card
 *     #### Atlas Overhaul                → Expandable card
 *   ### 3.27 Core Changes ...            → Next patch group
 *     #### Bloodlines                    → Expandable card
 *
 * Each patch group gets a styled header with the patch version/name,
 * and its subsections render as expandable cards in a 2-column grid.
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  GitBranch,
  Map,
  Sparkles,
  Scale,
  FileText,
  Zap,
  Shield,
  Scroll,
  Gem,
  Coins,
  Swords,
  Users,
  Layers,
  Box,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { LLMContextSection } from '../../../store';
import { ContextInspectorSection, type AccentColor } from '../../shared/ContextInspectorSection';
import { formatTokens } from '../ContextInspectorModal';

// =============================================================================
// Types
// =============================================================================

interface GameChangesTabProps {
  sections: LLMContextSection[];
  totalTokens: number;
}

interface PatchSubsection {
  label: string;
  content: string;
  tokenEstimate: number;
}

interface PatchGroup {
  patchTitle: string;
  preamble: string;
  subsections: PatchSubsection[];
  totalTokens: number;
}

// =============================================================================
// Helpers
// =============================================================================

function getChangeIcon(label: string): LucideIcon {
  const lower = label.toLowerCase();
  if (lower.includes('league') || lower.includes('mechanic') || lower.includes('mirage')) return Sparkles;
  if (lower.includes('atlas') || lower.includes('map')) return Map;
  if (lower.includes('balance') || lower.includes('nerf') || lower.includes('buff')) return Scale;
  if (lower.includes('skill') || lower.includes('gem')) return Zap;
  if (lower.includes('defense') || lower.includes('armour') || lower.includes('block')) return Shield;
  if (lower.includes('ascendancy') || lower.includes('rework') || lower.includes('reliquarian')) return Users;
  if (lower.includes('bloodline') || lower.includes('necromantic')) return Scroll;
  if (lower.includes('unique')) return Gem;
  if (lower.includes('currency') || lower.includes('coin')) return Coins;
  if (lower.includes('exceptional') || lower.includes('support')) return Layers;
  if (lower.includes('core') || lower.includes('integration') || lower.includes('removal')) return Box;
  if (lower.includes('melee') || lower.includes('rage') || lower.includes('banner')) return Swords;
  if (lower.includes('base type') || lower.includes('new base')) return Box;
  if (lower.includes('graft')) return Box;
  return FileText;
}

/** Map subsection content type to an accent color for visual differentiation */
function getChangeAccent(label: string): AccentColor {
  const lower = label.toLowerCase();
  if (lower.includes('league') || lower.includes('mechanic') || lower.includes('mirage')) return 'emerald';
  if (lower.includes('atlas') || lower.includes('map')) return 'blue';
  if (lower.includes('balance') || lower.includes('nerf') || lower.includes('buff')) return 'amber';
  if (lower.includes('skill') || lower.includes('gem') || lower.includes('exceptional') || lower.includes('support')) return 'teal';
  if (lower.includes('ascendancy') || lower.includes('bloodline') || lower.includes('reliquarian') || lower.includes('necromantic') || lower.includes('rework')) return 'violet';
  return 'slate';
}

/**
 * Extract a short patch label from the full title for the group badge.
 * "3.28 Mirage (March 2026)" → "3.28 Mirage"
 */
function getPatchBadge(title: string): string {
  const match = title.match(/^(\d+\.\d+\w?)\s+([^(]+)/);
  if (match) return `${match[1]} ${match[2].trim()}`;
  // Fallback: just strip parenthetical
  return title.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

/**
 * Parse game changes content into patch groups.
 * Expects ### for patch headers and #### for subsections.
 * Falls back to flat ### parsing if no #### subsections found.
 */
function parsePatchGroups(content: string): PatchGroup[] {
  const groups: PatchGroup[] = [];

  // Split on ### (patch group headers)
  const patchParts = content.split(/^### /m);

  for (const part of patchParts) {
    if (!part.trim()) continue;

    const nlIdx = part.indexOf('\n');
    const title = nlIdx > 0 ? part.slice(0, nlIdx).trim() : part.trim();
    const body = nlIdx > 0 ? part.slice(nlIdx + 1).trim() : '';

    // Try to parse #### subsections within this patch group
    const subParts = body.split(/^#### /m);
    const preamble = subParts[0]?.trim() || '';
    const subsections: PatchSubsection[] = [];

    // Track the last empty-body heading to use as a category prefix for the next subsection
    let pendingCategory = '';

    for (let i = 1; i < subParts.length; i++) {
      const subPart = subParts[i];
      if (!subPart.trim()) continue;
      const subNl = subPart.indexOf('\n');
      const subLabel = subNl > 0 ? subPart.slice(0, subNl).trim() : subPart.trim();
      const subBody = subNl > 0 ? subPart.slice(subNl + 1).trim() : '';

      if (!subBody) {
        // Empty body — this is a category header (e.g., "Ascendancy Reworks")
        // Store it and prepend to the next subsection's label
        pendingCategory = subLabel;
        continue;
      }

      const label = pendingCategory ? `${pendingCategory}: ${subLabel}` : subLabel;
      pendingCategory = '';

      subsections.push({
        label,
        content: subBody,
        tokenEstimate: Math.ceil(subBody.length / 4),
      });
    }

    if (subsections.length > 0) {
      // This is a proper patch group with subsections
      const groupTokens = subsections.reduce((s, sub) => s + sub.tokenEstimate, 0)
        + Math.ceil(preamble.length / 4);
      groups.push({
        patchTitle: title,
        preamble,
        subsections,
        totalTokens: groupTokens,
      });
    } else {
      // No #### subsections — treat as a single-item group (fallback)
      const tokens = Math.ceil(body.length / 4);
      groups.push({
        patchTitle: title,
        preamble: '',
        subsections: [{
          label: title,
          content: body || part.trim(),
          tokenEstimate: tokens,
        }],
        totalTokens: tokens,
      });
    }
  }

  return groups;
}

// =============================================================================
// Component
// =============================================================================

export function GameChangesTab({ sections, totalTokens }: GameChangesTabProps) {
  const patchGroups = useMemo(() => {
    const allGroups: PatchGroup[] = [];

    for (const section of sections) {
      const groups = parsePatchGroups(section.content);
      allGroups.push(...groups);
    }

    // Sort: newest patch first (by patch number in title)
    allGroups.sort((a, b) => {
      const vA = a.patchTitle.match(/(\d+\.\d+)/)?.[1] || '0';
      const vB = b.patchTitle.match(/(\d+\.\d+)/)?.[1] || '0';
      return parseFloat(vB) - parseFloat(vA);
    });

    return allGroups;
  }, [sections]);

  const sectionTotalTokens = useMemo(
    () => patchGroups.reduce((sum, g) => sum + g.totalTokens, 0),
    [patchGroups]
  );

  const totalSubsections = useMemo(
    () => patchGroups.reduce((sum, g) => sum + g.subsections.length, 0),
    [patchGroups]
  );

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
        <GitBranch className="w-6 h-6 text-teal-400/40 mx-auto mb-3" />
        <p className="text-sm text-teal-300/60 font-display">No game changes data in this call</p>
        <p className="text-xs text-teal-400/40 mt-1">
          Game changes context is included when the oracle needs awareness of recent patches.
        </p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2"
      >
        <div className="w-1 h-4 rounded-full bg-gradient-to-b from-teal-400 to-teal-600" />
        <span className="text-[0.6875rem] font-display font-semibold text-teal-300/80 uppercase tracking-wider">
          Game Changes
        </span>
        <span className="text-[0.5625rem] text-slate-500 ml-auto tabular-nums">
          {patchGroups.length} patches &bull; {totalSubsections} sections &bull; ~{formatTokens(sectionTotalTokens)}
        </span>
      </motion.div>

      {/* Patch groups */}
      {patchGroups.map((group, gIdx) => (
        <motion.div
          key={group.patchTitle}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: gIdx * 0.08, duration: 0.3 }}
          className="space-y-2"
        >
          {/* Patch group header */}
          <div className="flex items-center gap-3 px-1">
            <div
              className="px-2.5 py-1 rounded-md text-[0.6875rem] font-display font-semibold text-teal-300 tabular-nums"
              style={{
                background: 'linear-gradient(135deg, rgba(45, 212, 191, 0.12) 0%, rgba(45, 212, 191, 0.04) 100%)',
                border: '1px solid rgba(45, 212, 191, 0.2)',
              }}
            >
              {getPatchBadge(group.patchTitle)}
            </div>
            <div className="flex-1 h-px bg-gradient-to-r from-teal-500/20 to-transparent" />
            <span className="text-[0.5625rem] text-slate-500 tabular-nums">
              {group.subsections.length} sections &bull; ~{formatTokens(group.totalTokens)}
            </span>
          </div>

          {/* Preamble (if any non-subsection text exists at the group level) */}
          {group.preamble && (
            <div
              className="mx-1 px-3 py-2 rounded-md text-[0.625rem] text-slate-400 leading-relaxed"
              style={{
                background: 'rgba(45, 212, 191, 0.03)',
                border: '1px solid rgba(45, 212, 191, 0.06)',
              }}
            >
              {group.preamble}
            </div>
          )}

          {/* Subsection cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {group.subsections.map((sub, idx) => (
              <ContextInspectorSection
                key={`${group.patchTitle}-${sub.label}-${idx}`}
                label={sub.label}
                content={sub.content}
                tokenEstimate={sub.tokenEstimate}
                totalTokens={group.totalTokens}
                icon={getChangeIcon(sub.label)}
                index={gIdx * 10 + idx}
                accent={getChangeAccent(sub.label)}
              />
            ))}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
