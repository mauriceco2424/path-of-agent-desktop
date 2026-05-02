/**
 * LevelingView — the top-level view shown when the user picks "Leveling" in
 * the build guide's section picker (see build-library skill LEARNING-24).
 *
 * Replaces the older `LevelingSectionView.tsx` which rendered inside the
 * tier-scoped scroll container and made it look like leveling was "appended
 * to each tier". This component is rendered at the same level as the tier
 * snapshot — so when Leveling is active, the variant selector, tier snapshot,
 * transitions, and core foundation are all hidden by the parent page.
 *
 * Content:
 *   1. Overview — existing prose card
 *   2. Skill progression — each step rendered with baked gem icons (main
 *      skill large, supports in a row) instead of plain-text chips
 *   3. Gear priorities — plain-text bullets (no PoB gear grid)
 *   4. Weapon progression — existing prose
 *   5. Leveling tree — a button that opens `<LevelingTreeModal>` when the
 *      authored `allocationOrder` exists; otherwise falls back to the
 *      notables chip list + external tree URL link (KFH-style placeholder)
 *   6. Gotchas — existing warning bullets
 *
 * Gem icon URLs are baked into `LevelingSkillStep.mainSkillIconUrl` /
 * `supportIconUrls` by `bakeLevelingIcons` at guide-generation time. When
 * these are missing (pre-bake guide JSON), the view falls back to plain-text
 * chips so old guides still render.
 *
 * @module desktop/src/components/build-library/LevelingView
 */

import { useState } from 'react';
import {
  Sparkles,
  Sword,
  Package,
  TreePine,
  AlertTriangle,
  ExternalLink,
  Maximize2,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { LevelingTreeModal } from './LevelingTreeModal';
import { SemanticMarkdown } from '../../utils/semantic-markdown';
import type {
  LevelingGemRef,
  LevelingSection,
  LevelingSkillStep,
} from '@shared/types/build-library';

/** Routes prose through SemanticMarkdown so `<skill>`, `<unique>`, `<keystone>`,
 *  `<notable>`, `<mechanic>`, `<stat>` tags render with styled interactive spans.
 *  Same treatment as `TierNarrativeSection.ProseBody`. */
function Prose({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cn('leading-relaxed [&>p]:m-0 space-y-2.5', className)}>
      <SemanticMarkdown content={text} />
    </div>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

interface SectionHeaderProps {
  title: string;
  Icon: typeof Sword;
  color?: string;
  subtitle?: string;
}

function SectionHeader({ title, Icon, color = '#fbbf24', subtitle }: SectionHeaderProps) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-2.5">
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
          style={{ background: `linear-gradient(90deg, ${color}25 0%, transparent 100%)` }}
        />
      </div>
      {subtitle && <p className="mt-1 ml-6 text-[0.6875rem] text-slate-500">{subtitle}</p>}
    </div>
  );
}

// =============================================================================
// Skill progression step with baked gem icons
// =============================================================================

interface SkillStepRowProps {
  step: LevelingSkillStep;
  index: number;
}

/** Small gem tile used for non-main-link gems (travel / aura / herald / buff / curse). */
function GemTile({ gem, size = 32 }: { gem: LevelingGemRef; size?: number }) {
  return (
    <div className="flex flex-col items-center" title={gem.name}>
      <div
        className="rounded-md p-0.5 flex items-center justify-center"
        style={{
          width: size,
          height: size,
          background:
            'linear-gradient(145deg, rgba(100, 116, 139, 0.18) 0%, rgba(15, 23, 42, 0.6) 100%)',
          border: '1px solid rgba(100, 116, 139, 0.35)',
        }}
      >
        {gem.iconUrl ? (
          <img
            src={gem.iconUrl}
            alt={gem.name}
            className="w-full h-full object-contain"
            loading="lazy"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : null}
      </div>
      <div className="mt-1 max-w-[84px] text-[0.5625rem] text-center text-slate-400 leading-tight truncate">
        {gem.name.replace(/ Support$/, '')}
      </div>
    </div>
  );
}

function GemGroup({
  label,
  color,
  gems,
}: {
  label: string;
  color: string;
  gems: LevelingGemRef[];
}) {
  if (!gems.length) return null;
  return (
    <div className="min-w-0">
      <div
        className="text-[0.5625rem] font-display uppercase tracking-wider mb-1.5"
        style={{ color }}
      >
        {label}
      </div>
      <div className="flex flex-wrap gap-2">
        {gems.map((gem, i) => (
          <GemTile key={`${gem.name}-${i}`} gem={gem} />
        ))}
      </div>
    </div>
  );
}

/**
 * One step in the leveling skill progression. The main skill gem gets a
 * prominent icon on the left; supports stack in a row next to it. Additional
 * loadout groups (travel, aura, herald, buff, curse) are rendered below.
 * Falls back to plain-text chips when icon URLs are missing (old guide JSON).
 */
function SkillStepRow({ step, index }: SkillStepRowProps) {
  const mainIcon = step.mainSkillIconUrl;
  const supportIcons = step.supportIconUrls;
  const hasIcons = !!mainIcon;

  const travelGems: LevelingGemRef[] = step.travelSkill ? [step.travelSkill] : [];
  const curseGems: LevelingGemRef[] = step.curseOrMark ? [step.curseOrMark] : [];
  const hasLoadoutExtras =
    travelGems.length > 0 ||
    (step.auras && step.auras.length > 0) ||
    (step.heralds && step.heralds.length > 0) ||
    (step.buffs && step.buffs.length > 0) ||
    curseGems.length > 0;

  return (
    <div
      className="relative rounded-lg p-4"
      style={{
        background: 'linear-gradient(145deg, rgba(59, 130, 246, 0.05) 0%, rgba(2,6,23,0.55) 100%)',
        border: '1px solid rgba(59, 130, 246, 0.18)',
      }}
    >
      <div className="flex items-start gap-4">
        {/* Step marker */}
        <div
          className="w-12 h-12 rounded-lg flex flex-col items-center justify-center flex-shrink-0"
          style={{
            background:
              'radial-gradient(circle at 30% 30%, rgba(59, 130, 246, 0.25) 0%, rgba(59, 130, 246, 0.05) 70%)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
          }}
        >
          <span className="text-[0.5625rem] font-display uppercase tracking-wider text-blue-300/80">
            Step
          </span>
          <span className="text-sm font-mono font-bold text-blue-200">{index + 1}</span>
        </div>

        <div className="flex-1 min-w-0">
          {/* Act / level tag */}
          <div className="text-[0.6875rem] font-display font-semibold uppercase tracking-wider text-blue-300/90 mb-2">
            {step.actOrLevel}
          </div>

          {hasIcons ? (
            <div className="flex items-start gap-4">
              {/* Main gem icon (large) */}
              <div className="flex flex-col items-center flex-shrink-0">
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center p-0.5"
                  style={{
                    background:
                      'radial-gradient(circle at 30% 30%, rgba(251,191,36,0.18) 0%, rgba(251,191,36,0.03) 60%, transparent 100%)',
                    border: '1px solid rgba(251,191,36,0.35)',
                    boxShadow: '0 0 14px rgba(251,191,36,0.08)',
                  }}
                >
                  <img
                    src={mainIcon}
                    alt={step.mainSkill}
                    className="w-full h-full object-contain"
                    loading="lazy"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
                <div className="mt-1 max-w-[84px] text-[0.625rem] text-center font-display font-semibold text-amber-200 leading-tight">
                  {step.mainSkill}
                </div>
              </div>

              {/* Support gem icons */}
              {supportIcons && supportIcons.length > 0 && (
                <div className="flex-1 min-w-0">
                  <div className="text-[0.5625rem] font-display uppercase tracking-wider text-slate-500 mb-1.5">
                    Supports
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {step.supports?.map((name, i) => (
                      <GemTile
                        key={`${name}-${i}`}
                        gem={{ name, iconUrl: supportIcons[i] }}
                        size={36}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            // Legacy fallback — plain-text chips (for old guide JSON without
            // baked icon URLs).
            <div>
              <div className="text-sm font-semibold text-amber-300 mb-1">{step.mainSkill}</div>
              {step.supports && step.supports.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {step.supports.map((sup) => (
                    <span
                      key={sup}
                      className="text-[0.625rem] px-1.5 py-0.5 rounded text-slate-400 bg-slate-900/40 border border-slate-700/40"
                    >
                      {sup}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Additional loadout: travel / aura / herald / buff / curse */}
          {hasIcons && hasLoadoutExtras && (
            <div className="mt-4 pt-3 border-t border-slate-700/40 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-x-4 gap-y-3">
              <GemGroup label="Travel" color="#818cf8" gems={travelGems} />
              <GemGroup label="Auras" color="#60a5fa" gems={step.auras ?? []} />
              <GemGroup label="Heralds" color="#f87171" gems={step.heralds ?? []} />
              <GemGroup label="Buffs" color="#facc15" gems={step.buffs ?? []} />
              <GemGroup label="Curse / Mark" color="#c084fc" gems={curseGems} />
            </div>
          )}

          {step.note && (
            <Prose
              text={step.note}
              className="mt-3 text-[0.75rem] text-slate-400/90"
            />
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Leveling tree section — button when allocationOrder is authored, fallback
// notables chip list + URL link when not (matches KFH-placeholder behavior).
// =============================================================================

interface LevelingTreeSectionProps {
  leveling: LevelingSection;
  ascendancyName?: string;
}

function LevelingTreeSection({ leveling, ascendancyName }: LevelingTreeSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = leveling.treeReference;
  if (!ref) return null;

  const hasAllocation = !!ref.allocationOrder && ref.allocationOrder.length > 0;

  return (
    <div>
      <SectionHeader
        title="Leveling Tree"
        Icon={TreePine}
        color="#a855f7"
        subtitle={
          hasAllocation
            ? 'Scrub the level slider to see which points the reference player takes at each level.'
            : undefined
        }
      />
      <div
        className="rounded-lg p-4"
        style={{
          background: 'linear-gradient(145deg, rgba(168, 85, 247, 0.05) 0%, rgba(2,6,23,0.55) 100%)',
          border: '1px solid rgba(168, 85, 247, 0.18)',
        }}
      >
        <div className="flex items-baseline gap-3 mb-3 text-xs text-slate-400">
          <span>Target level:</span>
          <span className="text-base font-mono font-semibold text-slate-100">
            {ref.levelTarget}
          </span>
          {hasAllocation && (
            <>
              <span className="text-slate-700">·</span>
              <span className="text-slate-500">
                {ref.allocationOrder!.length} authored picks
              </span>
            </>
          )}
        </div>

        {hasAllocation ? (
          <button
            onClick={() => setIsOpen(true)}
            className={cn(
              'inline-flex items-center gap-2 h-9 px-4 rounded-lg',
              'bg-gradient-to-br from-violet-500/20 to-violet-600/5',
              'border border-violet-500/40 hover:border-violet-400/70',
              'text-violet-200 hover:text-violet-100',
              'shadow-[0_0_14px_rgba(168,85,247,0.1)] hover:shadow-[0_0_22px_rgba(168,85,247,0.25)]',
              'transition-all duration-300 group',
            )}
          >
            <Maximize2 className="w-3.5 h-3.5 transition-transform duration-300 group-hover:scale-110" />
            <span className="text-[0.75rem] font-display font-semibold tracking-wide uppercase">
              Show Leveling Tree
            </span>
          </button>
        ) : (
          <>
            {ref.notables && ref.notables.length > 0 && (
              <div className="mb-3">
                <div className="text-[0.5625rem] font-display font-semibold uppercase tracking-wider text-violet-400/80 mb-1.5">
                  Aim for these notables
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {ref.notables.map((n) => (
                    <span
                      key={n}
                      className="text-[0.625rem] px-1.5 py-0.5 rounded text-violet-300 bg-violet-500/10 border border-violet-500/25"
                    >
                      {n}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {ref.url && (
              <a
                href={ref.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[0.6875rem] text-violet-300/80 hover:text-violet-200 transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                Open passive tree
              </a>
            )}
          </>
        )}
      </div>

      {hasAllocation && (
        <LevelingTreeModal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          allocationOrder={ref.allocationOrder!}
          waypoints={ref.waypoints}
          ascendancyName={ascendancyName}
          levelTarget={ref.levelTarget}
        />
      )}
    </div>
  );
}

// =============================================================================
// Main component
// =============================================================================

export interface LevelingViewProps {
  leveling: LevelingSection;
  /** Ascendancy name forwarded to the leveling tree modal for the portrait. */
  ascendancyName?: string;
}

export function LevelingView({ leveling, ascendancyName }: LevelingViewProps) {
  return (
    <div className="space-y-8">
      {/* Overview */}
      <div
        className="relative overflow-hidden rounded-xl p-5"
        style={{
          background:
            'linear-gradient(160deg, rgba(2,6,23,0.96) 0%, rgba(15,23,42,0.92) 40%, rgba(8,15,35,0.96) 100%)',
          border: '1px solid rgba(251, 191, 36, 0.15)',
          boxShadow:
            '0 8px 32px rgba(0,0,0,0.45), 0 0 40px rgba(251,191,36,0.03), inset 0 1px 0 rgba(255,255,255,0.04)',
        }}
      >
        <div
          className="absolute top-0 left-0 right-0 h-px"
          style={{
            background:
              'linear-gradient(90deg, transparent 8%, rgba(251,191,36,0.2) 25%, rgba(253,224,71,0.5) 50%, rgba(251,191,36,0.2) 75%, transparent 92%)',
          }}
        />
        <div className="relative z-10">
          <SectionHeader title="Leveling Overview" Icon={Sparkles} color="#fbbf24" />
          <Prose text={leveling.overview} className="text-sm text-slate-300/90" />
        </div>
      </div>

      {/* Skill progression with baked gem icons */}
      <div>
        <SectionHeader
          title="Skill Progression"
          Icon={Sword}
          color="#3b82f6"
          subtitle="Full socket loadout at each milestone — main link, travel, auras, heralds, buffs, and curse."
        />
        <div className="space-y-2.5">
          {leveling.skillProgression.map((step, idx) => (
            <SkillStepRow key={`${step.actOrLevel}-${idx}`} step={step} index={idx} />
          ))}
        </div>
      </div>

      {/* Leveling tree (button or fallback) */}
      <LevelingTreeSection leveling={leveling} ascendancyName={ascendancyName} />

      {/* Gear priorities — plain-text hints, no PoB grid */}
      <div>
        <SectionHeader
          title="Gear Priorities"
          Icon={Package}
          color="#14b8a6"
          subtitle="What to look for on each slot while leveling — no fixed gear snapshot."
        />
        <div className="space-y-1.5">
          {leveling.gearPriorities.map((priority, idx) => (
            <div
              key={idx}
              className="flex items-start gap-2.5 px-3 py-2 rounded-lg"
              style={{
                background: 'linear-gradient(145deg, rgba(20, 184, 166, 0.04) 0%, rgba(2,6,23,0.4) 100%)',
                border: '1px solid rgba(20, 184, 166, 0.12)',
              }}
            >
              <div
                className="w-1.5 h-1.5 rounded-full mt-[7px] flex-shrink-0"
                style={{ backgroundColor: '#14b8a6', boxShadow: '0 0 6px rgba(20,184,166,0.4)' }}
              />
              <Prose
                text={priority}
                className="text-[0.8125rem] text-slate-300/90 flex-1"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Weapon progression */}
      <div>
        <SectionHeader title="Weapon Progression" Icon={Sword} color="#ef4444" />
        <div
          className="rounded-lg p-4"
          style={{
            background: 'linear-gradient(145deg, rgba(239, 68, 68, 0.04) 0%, rgba(2,6,23,0.5) 100%)',
            border: '1px solid rgba(239, 68, 68, 0.15)',
          }}
        >
          <Prose
            text={leveling.weaponProgression}
            className="text-[0.8125rem] text-slate-300/90"
          />
        </div>
      </div>

      {/* Gotchas */}
      {leveling.gotchas && leveling.gotchas.length > 0 && (
        <div>
          <SectionHeader title="Gotchas" Icon={AlertTriangle} color="#f97316" />
          <div className="space-y-2">
            {leveling.gotchas.map((gotcha, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg"
                style={{
                  background:
                    'linear-gradient(145deg, rgba(249, 115, 22, 0.05) 0%, rgba(2,6,23,0.5) 100%)',
                  border: '1px solid rgba(249, 115, 22, 0.18)',
                }}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-orange-400/80 mt-0.5 flex-shrink-0" />
                <Prose
                  text={gotcha}
                  className="text-[0.8125rem] text-slate-300/90 flex-1"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default LevelingView;
