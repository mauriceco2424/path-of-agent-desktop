/**
 * BuildLibraryPage — compact, grouped overview of build progression guides.
 *
 * Lives at `/library`. Fetches the summary list from
 * `GET /api/v1/build-library` via `useBuildLibraryList()` and renders guides
 * as dense row-cards grouped by ascendancy, with ascendancy emblems pulled
 * from the passive-tree sprite sheet (see AscendancyEmblem.tsx). Clicking a
 * row navigates to `/library/:slug`.
 *
 * Top toolbar offers sort (popularity / DPS / EHP / name) and a set of
 * class-filter chips. Groups are ordered by base class (Marauder → Scion),
 * and within a group guides are sorted by the active sort key.
 *
 * @module desktop/src/pages/BuildLibraryPage
 */

import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Library,
  Loader2,
  AlertCircle,
  Sword,
  Shield,
  TrendingUp,
  ExternalLink,
  ArrowUpDown,
  Coins,
  User,
  LogOut,
} from 'lucide-react';
import seerIcon from '@/assets/seer_icon.png';
import { cn } from '../lib/utils';
import { useAuthAccount } from '../hooks/useAuthAccount';
import { WindowControls } from '../components/ui/WindowControls';
import { DiscordButton } from '../components/ui/DiscordButton';
import { VersionBadge } from '../components/ui/VersionBadge';
import { SettingsPopover } from '../components/ui/SettingsPopover';
import { useBuildLibraryList } from '../hooks/useBuildLibrary';
import type { BuildGuideSummary } from '@shared/types/build-library';
import { AscendancyEmblem } from '../components/build-library/AscendancyEmblem';
import {
  BASE_CLASS_META,
  getAccent,
  getBaseClass,
  type BaseClass,
} from '../components/build-library/ascendancy-meta';

// =============================================================================
// Helpers
// =============================================================================

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

type SortKey = 'popularity' | 'dps' | 'ehp' | 'name';

const SORT_LABELS: Record<SortKey, string> = {
  popularity: 'Popularity',
  dps: 'DPS',
  ehp: 'EHP',
  name: 'Name',
};

function sortGuides(guides: BuildGuideSummary[], key: SortKey): BuildGuideSummary[] {
  const copy = [...guides];
  switch (key) {
    case 'popularity':
      // Unranked guides sink to the bottom
      return copy.sort((a, b) => (a.popularityRank ?? 1e6) - (b.popularityRank ?? 1e6));
    case 'dps':
      return copy.sort((a, b) => b.displayDps - a.displayDps);
    case 'ehp':
      return copy.sort((a, b) => b.displayEhp - a.displayEhp);
    case 'name':
      return copy.sort((a, b) => a.skill.localeCompare(b.skill));
  }
}

// =============================================================================
// Compact guide tile
// =============================================================================

interface GuideCardProps {
  guide: BuildGuideSummary;
  onClick: () => void;
}

function GuideCard({ guide, onClick }: GuideCardProps) {
  const accent = getAccent(guide.ascendancy);

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      title={guide.tagline}
      className="group relative overflow-hidden rounded-lg text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-0 flex flex-col items-center px-3 pt-4 pb-3"
      style={{
        background:
          'linear-gradient(160deg, rgba(2,6,23,0.92) 0%, rgba(15,23,42,0.85) 60%, rgba(2,6,23,0.94) 100%)',
        border: `1px solid ${accent.accent}22`,
        boxShadow:
          '0 6px 22px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.3)',
      }}
    >
      {/* Top edge highlight */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent 10%, ${accent.accent}55 50%, transparent 90%)`,
        }}
      />

      {/* Radial spotlight from behind the emblem */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 55% 45% at 50% 22%, ${accent.glow} 0%, transparent 70%)`,
        }}
      />

      {/* Hover border overlay */}
      <div
        className="absolute inset-0 rounded-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        style={{ border: `1px solid ${accent.accent}66` }}
      />

      {/* Rank badge — top-right corner */}
      {guide.popularityRank !== undefined && (
        <div
          className="absolute top-2 right-2 flex items-center gap-0.5 px-1.5 py-[2px] rounded text-[0.5625rem] font-display tracking-wider uppercase z-10"
          style={{
            color: '#fcd34d',
            background: 'rgba(251, 191, 36, 0.06)',
            border: '1px solid rgba(251, 191, 36, 0.22)',
          }}
          title={`Rank #${guide.popularityRank} (${guide.popularityPct ?? 0}% of ladder)`}
        >
          <TrendingUp className="w-2.5 h-2.5" />
          <span className="tabular-nums">{guide.popularityRank}</span>
        </div>
      )}

      {/* Emblem */}
      <div className="relative z-10 mb-2.5 transition-transform duration-300 group-hover:scale-105">
        <AscendancyEmblem ascendancy={guide.ascendancy} size={64} />
      </div>

      {/* Skill name */}
      <h3
        className="relative z-10 text-[0.8125rem] font-display font-semibold text-slate-100 tracking-wide text-center leading-tight line-clamp-2 mb-0.5 w-full"
        style={{ textShadow: `0 0 10px ${accent.glow}` }}
      >
        {guide.skill}
      </h3>

      {/* Ascendancy */}
      <span
        className="relative z-10 text-[0.625rem] font-display font-medium tracking-[0.15em] uppercase mb-2.5"
        style={{ color: accent.accent }}
      >
        {guide.ascendancy}
      </span>

      {/* Stat footer */}
      <div
        className="relative z-10 w-full flex items-center justify-between gap-1.5 pt-2"
        style={{ borderTop: `1px solid ${accent.accent}1a` }}
      >
        <div className="flex items-center gap-1 min-w-0">
          <Sword className="w-3 h-3 text-red-400/80 flex-shrink-0" />
          <span className="text-[0.6875rem] font-mono font-semibold text-red-300/90 tabular-nums truncate">
            {formatNum(guide.displayDps)}
          </span>
        </div>
        <div className="flex items-center gap-1 min-w-0">
          <Shield className="w-3 h-3 text-teal-400/80 flex-shrink-0" />
          <span className="text-[0.6875rem] font-mono font-semibold text-teal-300/90 tabular-nums truncate">
            {formatNum(guide.displayEhp)}
          </span>
        </div>
      </div>

      {/* Bottom edge glow on hover */}
      <div
        className="absolute bottom-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        style={{
          background: `linear-gradient(90deg, transparent 10%, ${accent.accent}88 50%, transparent 90%)`,
        }}
      />
    </motion.button>
  );
}

// =============================================================================
// Group section
// =============================================================================

interface GroupSectionProps {
  baseClass: BaseClass;
  guides: BuildGuideSummary[];
  onOpen: (slug: string) => void;
}

function GroupSection({ baseClass, guides, onOpen }: GroupSectionProps) {
  const meta = BASE_CLASS_META[baseClass];
  if (guides.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="mb-6"
    >
      {/* Header: accent bar + name + count + fading divider */}
      <div className="flex items-center gap-3 mb-2.5">
        <div
          className="w-1 h-4 rounded-full"
          style={{
            background: `linear-gradient(180deg, ${meta.accent} 0%, ${meta.accent}66 100%)`,
          }}
        />
        <span
          className="text-[0.6875rem] font-display font-semibold uppercase tracking-[0.2em]"
          style={{ color: meta.accent }}
        >
          {baseClass}
        </span>
        <span className="text-[0.6875rem] font-mono text-slate-500 tabular-nums">
          {guides.length}
        </span>
        <div
          className="flex-1 h-px"
          style={{
            background: `linear-gradient(90deg, ${meta.accent}40 0%, ${meta.accent}15 40%, transparent 100%)`,
          }}
        />
      </div>

      {/* Grid: 2 cols → 3 cols → 4 cols → 5 cols as width allows */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
        {guides.map((g) => (
          <GuideCard key={g.slug} guide={g} onClick={() => onOpen(g.slug)} />
        ))}
      </div>
    </motion.section>
  );
}

// =============================================================================
// Toolbar (sort + class filter)
// =============================================================================

interface ToolbarProps {
  totalCount: number;
  sortKey: SortKey;
  onSortChange: (k: SortKey) => void;
  availableClasses: BaseClass[];
  activeClass: BaseClass | null;
  onClassChange: (c: BaseClass | null) => void;
}

function Toolbar({
  totalCount,
  sortKey,
  onSortChange,
  availableClasses,
  activeClass,
  onClassChange,
}: ToolbarProps) {
  return (
    <div
      className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-lg mb-5"
      style={{
        background: 'linear-gradient(180deg, rgba(15,23,42,0.55) 0%, rgba(2,6,23,0.75) 100%)',
        border: '1px solid rgba(251, 191, 36, 0.12)',
      }}
    >
      {/* Count */}
      <div className="flex items-center gap-2">
        <Library className="w-4 h-4 text-amber-400/80" />
        <span className="text-[0.8125rem] font-display text-amber-200/90 tracking-wide">
          {totalCount} guide{totalCount === 1 ? '' : 's'}
        </span>
      </div>

      <div className="h-4 w-px bg-slate-700/50" />

      {/* Class chips */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          onClick={() => onClassChange(null)}
          className={cn(
            'px-2.5 py-1 rounded text-[0.6875rem] font-display uppercase tracking-wider transition-all',
            activeClass === null
              ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40'
              : 'bg-slate-800/40 text-slate-500 border border-slate-700/30 hover:text-slate-300 hover:border-slate-600/50',
          )}
        >
          All
        </button>
        {availableClasses.map((c) => {
          const meta = BASE_CLASS_META[c];
          const active = activeClass === c;
          return (
            <button
              key={c}
              onClick={() => onClassChange(active ? null : c)}
              className={cn(
                'px-2.5 py-1 rounded text-[0.6875rem] font-display uppercase tracking-wider transition-all border',
              )}
              style={{
                color: active ? meta.accent : 'rgb(100 116 139)',
                background: active ? `${meta.accent}1a` : 'rgba(30, 41, 59, 0.4)',
                borderColor: active ? `${meta.accent}66` : 'rgba(51, 65, 85, 0.3)',
              }}
            >
              {c}
            </button>
          );
        })}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
        <span className="text-[0.6875rem] font-display uppercase tracking-wider text-slate-500">
          Sort
        </span>
        <div className="flex items-center gap-0.5 rounded-md p-0.5"
          style={{
            background: 'rgba(2,6,23,0.6)',
            border: '1px solid rgba(51, 65, 85, 0.4)',
          }}
        >
          {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
            <button
              key={k}
              onClick={() => onSortChange(k)}
              className={cn(
                'px-2 py-1 rounded text-[0.6875rem] font-display uppercase tracking-wider transition-all',
                sortKey === k
                  ? 'bg-amber-500/15 text-amber-300'
                  : 'text-slate-500 hover:text-slate-300',
              )}
            >
              {SORT_LABELS[k]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Empty / loading / error states
// =============================================================================

function EmptyState() {
  return (
    <div className="text-center py-16">
      <div
        className="inline-flex w-14 h-14 rounded-full items-center justify-center mb-4"
        style={{
          background:
            'radial-gradient(circle at 30% 30%, rgba(251, 191, 36, 0.18) 0%, rgba(251, 191, 36, 0.04) 70%)',
          border: '1px solid rgba(251, 191, 36, 0.25)',
        }}
      >
        <Library className="w-6 h-6 text-amber-300/80" />
      </div>
      <h3 className="text-base font-display font-semibold text-slate-200 mb-1">
        No Guides Yet
      </h3>
      <p className="text-sm text-slate-400 max-w-md mx-auto">
        The build library is currently empty. Run{' '}
        <code className="px-1.5 py-0.5 rounded bg-slate-800/60 text-amber-300 font-mono text-xs">
          generate-build-guide.ts
        </code>{' '}
        to add the first guide.
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
      <span className="text-[0.8125rem] text-slate-400">Loading build library…</span>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 gap-4">
      <div
        className="inline-flex w-12 h-12 rounded-full items-center justify-center"
        style={{
          background:
            'radial-gradient(circle at 30% 30%, rgba(239, 68, 68, 0.18) 0%, rgba(239, 68, 68, 0.04) 70%)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
        }}
      >
        <AlertCircle className="w-6 h-6 text-red-400" />
      </div>
      <p className="text-sm text-red-300 max-w-md text-center">{message}</p>
      <button
        onClick={onRetry}
        className="px-3 py-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-700/80 border border-slate-700/50 hover:border-amber-500/30 text-[0.8125rem] text-slate-300 hover:text-amber-300 transition-all"
      >
        Retry
      </button>
    </div>
  );
}

// =============================================================================
// Main BuildLibraryPage component
// =============================================================================

export function BuildLibraryPage() {
  const navigate = useNavigate();
  const authAccount = useAuthAccount();
  const { guides, isLoading, error, reload } = useBuildLibraryList();

  const [sortKey, setSortKey] = useState<SortKey>('popularity');
  const [activeClass, setActiveClass] = useState<BaseClass | null>(null);

  const goToGuide = useCallback((slug: string) => navigate(`/library/${slug}`), [navigate]);
  const goHome = useCallback(() => navigate('/'), [navigate]);

  // Group + sort + filter.
  const grouped = useMemo(() => {
    const bucket = new Map<BaseClass, BuildGuideSummary[]>();
    for (const g of guides) {
      const bc = getBaseClass(g.ascendancy);
      if (activeClass && bc !== activeClass) continue;
      const arr = bucket.get(bc) ?? [];
      arr.push(g);
      bucket.set(bc, arr);
    }
    // Sort within each group, then return groups in canonical class order.
    return (Object.keys(BASE_CLASS_META) as BaseClass[])
      .sort((a, b) => BASE_CLASS_META[a].order - BASE_CLASS_META[b].order)
      .map((bc) => ({ baseClass: bc, guides: sortGuides(bucket.get(bc) ?? [], sortKey) }))
      .filter((g) => g.guides.length > 0);
  }, [guides, sortKey, activeClass]);

  const availableClasses = useMemo(() => {
    const set = new Set<BaseClass>();
    for (const g of guides) set.add(getBaseClass(g.ascendancy));
    return (Array.from(set) as BaseClass[]).sort(
      (a, b) => BASE_CLASS_META[a].order - BASE_CLASS_META[b].order,
    );
  }, [guides]);

  const visibleCount = useMemo(
    () => grouped.reduce((sum, g) => sum + g.guides.length, 0),
    [grouped],
  );

  return (
    <div className="fixed inset-0 overflow-hidden">
      {/* Cosmic void background layer */}
      <div className="absolute inset-0 z-0">
        <img
          src="/mockups/cosmic-void-bg.png"
          alt=""
          className="w-full h-full object-cover"
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-slate-950/40" />
      </div>

      {/* Main content layer */}
      <div className="relative z-10 h-full bg-forge-atmosphere-translucent vignette-overlay grain-overlay flex flex-col">
        {/* Compact window header */}
        <header
          data-tauri-drag-region
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
        >
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="relative">
                <img src={seerIcon} alt="Path of Agent" className="w-5 h-5 rounded-full" />
                <div className="absolute inset-0 blur-lg bg-cyan-500/30 rounded-full" />
              </div>
              <span className="text-sm font-display text-amber-200/80">Path of Agent</span>
            </div>

            <button
              onClick={goHome}
              className={cn(
                'group flex items-center gap-2 px-3 py-2 rounded-lg',
                'bg-slate-900/50 hover:bg-slate-800/70',
                'border border-slate-700/30 hover:border-amber-500/30',
                'transition-all duration-200',
              )}
            >
              <ArrowLeft className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition-colors" />
              <span className="text-sm text-slate-500 group-hover:text-slate-300 transition-colors">
                Back
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {authAccount.isAuthenticated && !authAccount.isLoading && (
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5',
                    'rounded-lg bg-slate-800/60 border border-slate-700/50',
                    'shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]',
                  )}
                  title="Credit balance"
                >
                  <Coins className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-sm font-medium text-amber-300 tabular-nums">
                    {authAccount.creditBalance !== null
                      ? authAccount.creditBalance.toLocaleString('en-US')
                      : '—'}
                  </span>
                </div>
                <div
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5',
                    'rounded-lg bg-slate-800/60 border border-slate-700/50',
                    'shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]',
                  )}
                >
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-sm text-slate-300 max-w-[160px] truncate">
                    {authAccount.email || authAccount.accountName || 'Account'}
                  </span>
                </div>
                <button
                  onClick={async () => {
                    try {
                      const { invoke } = await import('@tauri-apps/api/core');
                      await invoke('logout');
                      window.location.reload();
                    } catch {
                      window.location.reload();
                    }
                  }}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1.5',
                    'rounded-lg bg-slate-800/40 hover:bg-red-950/40',
                    'border border-slate-700/40 hover:border-red-500/30',
                    'transition-all duration-200',
                  )}
                  title="Sign out"
                >
                  <LogOut className="w-3.5 h-3.5 text-slate-500 hover:text-red-400" />
                </button>
              </div>
            )}
            <VersionBadge />
            <DiscordButton />
            <SettingsPopover />
            <WindowControls />
          </div>
        </header>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto scrollbar-fantasy px-6 pb-10">
          <div className="w-full max-w-5xl mx-auto">
            {/* Slim title row */}
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="flex items-baseline gap-3 mb-4 mt-1"
            >
              <h1
                className="text-2xl font-display font-bold text-amber-200 tracking-wide"
                style={{ textShadow: '0 0 14px rgba(251, 191, 36, 0.28)' }}
              >
                Build Library
              </h1>
              <span className="text-[0.75rem] text-slate-500 font-display uppercase tracking-wider">
                Ladder-distilled progression guides
              </span>
            </motion.div>

            {/* Toolbar (only when there's something to filter) */}
            {!isLoading && !error && guides.length > 0 && (
              <Toolbar
                totalCount={visibleCount}
                sortKey={sortKey}
                onSortChange={setSortKey}
                availableClasses={availableClasses}
                activeClass={activeClass}
                onClassChange={setActiveClass}
              />
            )}

            {/* States */}
            {isLoading && <LoadingState />}
            {error && !isLoading && <ErrorState message={error} onRetry={reload} />}
            {!isLoading && !error && guides.length === 0 && <EmptyState />}

            {/* Grouped guides */}
            {!isLoading && !error && guides.length > 0 && (
              <div>
                {grouped.map((g) => (
                  <GroupSection
                    key={g.baseClass}
                    baseClass={g.baseClass}
                    guides={g.guides}
                    onOpen={goToGuide}
                  />
                ))}
                {visibleCount === 0 && (
                  <p className="text-center text-[0.8125rem] text-slate-500 py-10">
                    No guides match the current filter.
                  </p>
                )}
              </div>
            )}

            {/* Footer attribution */}
            {!isLoading && !error && guides.length > 0 && (
              <div className="text-center mt-8">
                <div className="text-[0.625rem] text-slate-600">
                  Ladder data sourced from{' '}
                  <a
                    href="https://poe.ninja/poe1/builds"
                    target="_blank"
                    rel="noopener noreferrer"
                    title="View ladder builds on poe.ninja"
                    className="inline-flex items-center gap-0.5 text-slate-500 hover:text-amber-300 transition-colors underline decoration-dotted underline-offset-2"
                  >
                    poe.ninja
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default BuildLibraryPage;
