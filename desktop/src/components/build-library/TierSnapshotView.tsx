/**
 * TierSnapshotView — renders one captured tier of a BuildGuide.
 *
 * Compact layout (April 2026 redesign, see build-library skill LEARNING-24):
 *   1. Reference character header (account, character, level, source-snapshot)
 *   2. Stat chip grid (reference vs tier median)
 *   3. Equipment + Skills in a 2-column grid (gear left, skills right)
 *      on `lg` and up; stacked below `lg` for narrow viewports
 *   4. Single tree summary row — a "Show Passive Tree" button plus a
 *      one-line stat strip (total points / keystones). The notables breakdown
 *      that used to sit above this button was removed — users didn't need it
 *      and it duplicated the keystones/notables shown in the tree itself.
 *
 * The gear + skills viz components are fed from `snapshot.vizData`, which is
 * baked into the guide JSON at generation time by `captureVizDataFromPoB`
 * (LEARNING-15). `SkillsVizTab` and `GearVizTab` are reused verbatim from the
 * analysis pathway (LEARNING-16 confirmed this is the right move).
 *
 * The tree button opens `<TreeFullscreenModal>` directly without going through
 * `TreeVizTab` — the sidebar version of that component is still used in
 * ChatPage and we don't want to pollute it with guide-specific concerns.
 *
 * Used by: `desktop/src/pages/BuildGuideDetailPage.tsx`
 */

import { motion } from 'framer-motion';
import {
  Sword,
  Zap,
  TreePine,
  User,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { GearVizTab } from '../visualization/GearVizTab';
import { CompactSkillsGrid } from './CompactSkillsGrid';
import { CompactStatsPanel } from './CompactStatsPanel';
import { TreeVizTab } from '../visualization/TreeVizTab';
import { TierNarrativeSection } from './TierNarrativeSection';
import type { BuildVisualizationResponse } from '../../store';
import type { TierSnapshot } from '@shared/types/build-library';

// =============================================================================
// Attribution — link reference characters back to their poe.ninja profile
// =============================================================================

/**
 * poe.ninja's character + profile URLs expect account names in dash format
 * (`Duc170-3261`), NOT the hash format (`Duc170#3261`) we store on the
 * `ReferenceBuild.accountName` field. Matches the convention documented in
 * the build-library skill LEARNING-7 for the /character endpoint.
 */
function ninjaProfileUrl(accountName: string): string {
  const dash = accountName.replace('#', '-');
  return `https://poe.ninja/poe1/profile/${encodeURIComponent(dash)}`;
}

// =============================================================================
// Sub-components
// =============================================================================

interface ColumnHeaderProps {
  title: string;
  Icon: typeof Sword;
  color: string;
}

function ColumnHeader({ title, Icon, color }: ColumnHeaderProps) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <div
        className="w-1 h-4 rounded-full"
        style={{ background: `linear-gradient(180deg, ${color} 0%, ${color}99 100%)` }}
      />
      <Icon className="w-3.5 h-3.5" style={{ color: `${color}cc` }} />
      <span
        className="text-[0.6875rem] font-display font-semibold uppercase tracking-[0.18em]"
        style={{ color: `${color}cc` }}
      >
        {title}
      </span>
      <div
        className="flex-1 h-px"
        style={{
          background: `linear-gradient(90deg, ${color}25 0%, transparent 100%)`,
        }}
      />
    </div>
  );
}

function MissingVizDataNotice() {
  return (
    <div
      className="flex items-start gap-3 rounded-lg px-4 py-3"
      style={{
        background: 'linear-gradient(145deg, rgba(249, 115, 22, 0.05) 0%, rgba(2,6,23,0.5) 100%)',
        border: '1px solid rgba(249, 115, 22, 0.18)',
      }}
    >
      <AlertCircle className="w-4 h-4 text-orange-400/80 mt-0.5 flex-shrink-0" />
      <div className="text-[0.8125rem] text-slate-300/90 leading-relaxed">
        This guide was generated before the rich visualization data was baked into
        guide JSON. Re-run{' '}
        <code className="px-1 py-0.5 rounded bg-slate-800/60 text-amber-300 font-mono text-xs">
          generate-build-guide.ts
        </code>{' '}
        to populate the gear/skills/tree visualizations.
      </div>
    </div>
  );
}

// =============================================================================
// Tree section — wraps the full `<TreeVizTab>` from the analysis pathway.
//
// Sits in the bottom-left slot of the 3-zone layout (gear top-left, skills
// right column, tree bottom-left under gear). TreeVizTab renders the full
// rich sidebar: ascendancy card with sprite icons, keystones, categorized
// notables with tooltips, masteries, timeless passives — exactly what the
// user sees in the analysis page's right sidebar. It already owns its own
// Show Tree button and fullscreen modal, so we just drop it in.
// =============================================================================

interface TreeSectionProps {
  vizData: BuildVisualizationResponse;
}

function TreeSection({ vizData }: TreeSectionProps) {
  return (
    <section>
      <ColumnHeader title="Passive Tree" Icon={TreePine} color="#a855f7" />
      <div
        className="rounded-xl px-4 py-4"
        style={{
          background:
            'linear-gradient(145deg, rgba(168, 85, 247, 0.05) 0%, rgba(2,6,23,0.55) 100%)',
          border: '1px solid rgba(168, 85, 247, 0.18)',
        }}
      >
        <TreeVizTab tree={vizData.tree} items={vizData.items} />
      </div>
    </section>
  );
}

// =============================================================================
// Main component
// =============================================================================

export interface TierSnapshotViewProps {
  snapshot: TierSnapshot;
}

export function TierSnapshotView({ snapshot }: TierSnapshotViewProps) {
  const { reference, referenceStats, medianStats } = snapshot;

  // Cast the baked vizData at the boundary. Shape is guaranteed by
  // `captureVizDataFromPoB` (which calls the same transform helpers as the
  // live /visualization-stream route).
  const vizData = snapshot.vizData as BuildVisualizationResponse | undefined;

  return (
    <motion.div
      key={snapshot.tier}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="space-y-6"
    >
      {/* ─── Reference character + stat chips ──────────────────────────────── */}
      <div
        className="relative overflow-hidden rounded-xl p-5"
        style={{
          background:
            'linear-gradient(160deg, rgba(2,6,23,0.96) 0%, rgba(15,23,42,0.92) 40%, rgba(8,15,35,0.96) 100%)',
          border: '1px solid rgba(167, 139, 250, 0.18)',
          boxShadow:
            '0 8px 32px rgba(0,0,0,0.45), 0 0 40px rgba(167,139,250,0.04), inset 0 1px 0 rgba(255,255,255,0.04)',
        }}
      >
        <div
          className="absolute top-0 left-0 right-0 h-px"
          style={{
            background:
              'linear-gradient(90deg, transparent 8%, rgba(167,139,250,0.2) 25%, rgba(167,139,250,0.5) 50%, rgba(167,139,250,0.2) 75%, transparent 92%)',
          }}
        />

        <div className="relative z-10">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="min-w-0 flex-1">
              <div className="text-[0.6875rem] font-display font-semibold uppercase tracking-[0.18em] text-violet-300/90 mb-1">
                Reference Character
              </div>
              <a
                href={ninjaProfileUrl(reference.accountName)}
                target="_blank"
                rel="noopener noreferrer"
                title={`View ${reference.characterName} on poe.ninja`}
                className="group flex items-center gap-2 hover:text-violet-200 transition-colors"
              >
                <User className="w-4 h-4 text-slate-400 group-hover:text-violet-300 transition-colors" />
                <span className="text-base font-display font-bold text-slate-100 group-hover:text-violet-100 transition-colors">
                  {reference.characterName}
                </span>
                <span className="text-xs text-slate-500 group-hover:text-slate-400 transition-colors">
                  {reference.accountName}
                </span>
                <ExternalLink className="w-3 h-3 text-slate-600 group-hover:text-violet-300 transition-colors" />
              </a>
              <div className="flex items-center gap-2 mt-1.5 text-[0.6875rem] text-slate-400">
                <span>L{reference.level}</span>
                <span className="text-slate-600">·</span>
                <span>{reference.className}</span>
                <span className="text-slate-600">·</span>
                <span className="text-violet-300/80">{reference.ascendancy}</span>
                {reference.timeMachineLabel && (
                  <>
                    <span className="text-slate-600">·</span>
                    <span className="text-slate-500">snapshot {reference.timeMachineLabel}</span>
                  </>
                )}
                <span className="text-slate-600">·</span>
                <span className="text-slate-500 italic">via poe.ninja</span>
              </div>
            </div>
            <div
              className="px-2.5 py-1 rounded text-[0.625rem] font-display font-semibold tracking-wider uppercase flex-shrink-0"
              style={{
                color: '#fcd34d',
                background: 'rgba(251, 191, 36, 0.06)',
                border: '1px solid rgba(251, 191, 36, 0.22)',
              }}
            >
              n = {snapshot.sampleSize}
            </div>
          </div>

          {/* Compact stats panel — hero row (DPS/EHP/Life) + categorized
              detail grid (offense, defense, avoidance, resists, charges,
              attributes, pantheon). Driven by snapshot.detailedStats which
              is baked at capture time by pob-capture's extractDetailedStats.
              Old guides without detailedStats fall back to just the hero row. */}
          <CompactStatsPanel
            referenceStats={referenceStats}
            medianStats={medianStats}
            detailedStats={snapshot.detailedStats}
          />
        </div>
      </div>

      {/* ─── LLM-written tier narrative (mechanics + defences + playstyle) ─
          Optional: only renders for guides regenerated after the narrative
          layer landed. Sits between the reference card and the loadout
          viz so the reader gets prose context first. */}
      {snapshot.narrative && <TierNarrativeSection narrative={snapshot.narrative} />}

      {/* ─── Viz zone: 3-zone layout rendered via a 2-col grid ───────────────
          Left column (fixed ~440px): gear on top, tree section below.
          Right column (fills): the compact 2-col skill grid, full height.

          Fixed left column width is necessary because the equipment icon
          grid is absolutely positioned at 320px + padding — an `auto` or
          `minmax(0,auto)` left column causes the skills column to collapse
          to a tiny sliver in flex layout. On narrow viewports everything
          stacks. */}
      {vizData ? (
        <div className="grid grid-cols-1 lg:grid-cols-[440px_minmax(0,1fr)] gap-5">
          {/* Left column: gear (top) + tree (bottom) */}
          <div className="flex flex-col gap-5 min-w-0">
            <section>
              <ColumnHeader title="Equipment" Icon={Sword} color="#14b8a6" />
              <div
                className="rounded-xl px-4 py-4"
                style={{
                  background:
                    'linear-gradient(145deg, rgba(20, 184, 166, 0.04) 0%, rgba(2,6,23,0.55) 100%)',
                  border: '1px solid rgba(20, 184, 166, 0.15)',
                }}
              >
                <GearVizTab
                  items={vizData.items}
                  skills={vizData.skills}
                  clusterNodes={vizData.tree?.clusterNodes}
                  timelessBySocket={vizData.tree?.timelessBySocket}
                />
              </div>
            </section>

            <TreeSection vizData={vizData} />
          </div>

          {/* Right column: skills (always 2 side-by-side inside the card) */}
          <section className="min-w-0">
            <ColumnHeader title="Skill Gems & Links" Icon={Zap} color="#3b82f6" />
            <div
              className="rounded-xl px-3 py-3 h-full"
              style={{
                background:
                  'linear-gradient(145deg, rgba(59, 130, 246, 0.04) 0%, rgba(2,6,23,0.55) 100%)',
                border: '1px solid rgba(59, 130, 246, 0.15)',
              }}
            >
              <CompactSkillsGrid skills={vizData.skills} items={vizData.items} />
            </div>
          </section>
        </div>
      ) : (
        <MissingVizDataNotice />
      )}
    </motion.div>
  );
}
