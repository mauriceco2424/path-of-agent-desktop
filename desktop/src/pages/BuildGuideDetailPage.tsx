/**
 * BuildGuideDetailPage — single-build inspection screen.
 *
 * Lives at `/library/:slug`. Fetches the full BuildGuide via `useBuildGuide()`
 * and renders every section: hero, tier picker, active tier snapshot,
 * leveling narrative, transitions, and core foundation.
 *
 * Long single-scroll layout was chosen over tabs/sections for the inspection
 * use case — the user wants to see everything in one view without hiding
 * data behind tabs.
 *
 * @module desktop/src/pages/BuildGuideDetailPage
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Library,
  TrendingUp,
  Calendar,
  Coins,
  User,
  LogOut,
  Sparkles,
  Layers,
  Share2,
  ExternalLink,
} from 'lucide-react';
import seerIcon from '@/assets/seer_icon.png';
import { cn } from '../lib/utils';
import { useAuthAccount } from '../hooks/useAuthAccount';
import { WindowControls } from '../components/ui/WindowControls';
import { DiscordButton } from '../components/ui/DiscordButton';
import { VersionBadge } from '../components/ui/VersionBadge';
import { SettingsPopover } from '../components/ui/SettingsPopover';
import { useBuildGuide } from '../hooks/useBuildLibrary';
import { useDesktopStore, type BuildVisualizationResponse } from '../store';
import { EntityTooltipProvider } from '../contexts/EntityTooltipContext';
import type { ProgressionTier } from '@shared/types/LadderData';
import type { BuildVariantGuide } from '@shared/types/build-library';
import { TierSnapshotView } from '../components/build-library/TierSnapshotView';
import { LevelingView } from '../components/build-library/LevelingView';
import { BuildNarrativeSection } from '../components/build-library/BuildNarrativeSection';

// =============================================================================
// Section picker — a single horizontal pill row that covers leveling +
// the three mapping tiers. Leveling is a "phase" of the build, not a tier,
// but from the user's mental model it's the first stop in the progression.
// =============================================================================

/**
 * Section-picker values. `'leveling'` is a frontend-only virtual value that
 * swaps the page body to the authored leveling view. The three mapping
 * tiers still come from the shared `ProgressionTier` type.
 */
type GuideSection = 'leveling' | ProgressionTier;

const SECTION_ORDER: GuideSection[] = ['leveling', 'early_mapping', 'endgame', 'aspirational'];

const SECTION_LABELS: Record<GuideSection, string> = {
  leveling: 'Leveling',
  early_mapping: 'Early Mapping',
  endgame: 'Endgame',
  aspirational: 'Aspirational',
};

const SECTION_RANGES: Record<GuideSection, string> = {
  leveling: 'L1–68',
  early_mapping: 'L70–84',
  endgame: 'L85–94',
  aspirational: 'L95–100',
};

interface SectionPickerProps {
  active: GuideSection;
  /** Which mapping tiers have data on the active variant. Leveling is always available. */
  availableTiers: ProgressionTier[];
  onChange: (section: GuideSection) => void;
}

function SectionPicker({ active, availableTiers, onChange }: SectionPickerProps) {
  return (
    <div
      className="inline-flex items-center gap-1 p-1 rounded-xl"
      style={{
        background: 'linear-gradient(145deg, rgba(2,6,23,0.7) 0%, rgba(15,23,42,0.5) 100%)',
        border: '1px solid rgba(167, 139, 250, 0.18)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.3)',
      }}
    >
      {SECTION_ORDER.map((section) => {
        const isActive = active === section;
        const isLeveling = section === 'leveling';
        const isAvailable = isLeveling || availableTiers.includes(section as ProgressionTier);
        // Leveling uses an amber tint to set it apart from the mapping tiers.
        const activeBorder = isLeveling ? '#fcd34d' : '#a78bfa';
        const activeBg = isLeveling
          ? 'linear-gradient(160deg, rgba(251, 191, 36, 0.14) 0%, rgba(251, 191, 36, 0.04) 100%)'
          : 'linear-gradient(160deg, rgba(167, 139, 250, 0.15) 0%, rgba(139, 92, 246, 0.08) 100%)';
        const activeShadow = isLeveling
          ? '0 0 16px rgba(251, 191, 36, 0.15), inset 0 1px 0 rgba(255,255,255,0.06)'
          : '0 0 16px rgba(167, 139, 250, 0.15), inset 0 1px 0 rgba(255,255,255,0.06)';
        const activeText = isLeveling ? 'text-amber-200' : 'text-violet-200';
        return (
          <button
            key={section}
            onClick={() => isAvailable && onChange(section)}
            disabled={!isAvailable}
            className={cn(
              'relative px-4 py-2 rounded-lg transition-all duration-200',
              'flex flex-col items-center gap-0.5 min-w-[110px]',
              isActive
                ? activeText
                : isAvailable
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-slate-700 cursor-not-allowed',
            )}
            style={
              isActive
                ? {
                    background: activeBg,
                    border: `1px solid ${activeBorder}59`,
                    boxShadow: activeShadow,
                  }
                : undefined
            }
          >
            <span className="text-[0.6875rem] font-display font-semibold uppercase tracking-wider">
              {SECTION_LABELS[section]}
            </span>
            <span className="text-[0.5625rem] text-slate-500 font-mono">
              {SECTION_RANGES[section]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// =============================================================================
// Sticky stat strip — small always-visible numbers next to the tier picker
// =============================================================================

function formatStat(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

interface StickyStatStripProps {
  snapshot: NonNullable<ReturnType<typeof useBuildGuide>['guide']>['tiers'][ProgressionTier];
}

function StickyStatStrip({ snapshot }: StickyStatStripProps) {
  if (!snapshot) return null;
  const { referenceStats } = snapshot;
  const items: Array<{ label: string; value: number; color: string }> = [
    { label: 'DPS', value: referenceStats.dps, color: '#fca5a5' },
    { label: 'EHP', value: referenceStats.ehp, color: '#5eead4' },
    { label: 'Life', value: referenceStats.life, color: '#fda4af' },
  ];
  return (
    <div className="hidden md:flex items-center gap-3">
      {items.map((stat) => (
        <div key={stat.label} className="flex items-baseline gap-1.5">
          <span className="text-[0.5625rem] font-display uppercase tracking-wider text-slate-500">
            {stat.label}
          </span>
          <span
            className="text-sm font-mono font-semibold tabular-nums"
            style={{ color: stat.color }}
          >
            {formatStat(stat.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// Section anchor — repeating styled container
// =============================================================================

interface SectionAnchorProps {
  id: string;
  title: string;
  subtitle?: string;
  Icon: typeof Library;
  color?: string;
  children: React.ReactNode;
}

function SectionAnchor({ id, title, subtitle, Icon, color = '#fbbf24', children }: SectionAnchorProps) {
  return (
    <section id={id} className="space-y-3">
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{
            background: `radial-gradient(circle at 30% 30%, ${color}30 0%, ${color}10 60%, transparent 100%)`,
            border: `1px solid ${color}40`,
          }}
        >
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <div>
          <h2
            className="text-lg font-display font-bold tracking-wide"
            style={{ color: `${color}f0`, textShadow: `0 0 14px ${color}33` }}
          >
            {title}
          </h2>
          {subtitle && <p className="text-[0.75rem] text-slate-500">{subtitle}</p>}
        </div>
      </div>
      <div className="divider-ornate w-full" />
      <div className="pt-2">{children}</div>
    </section>
  );
}

// =============================================================================
// Loading / error / not found states
// =============================================================================

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <Loader2 className="w-7 h-7 text-violet-400 animate-spin" />
      <span className="text-sm text-slate-400">Loading build guide…</span>
    </div>
  );
}

function NotFoundState({ slug }: { slug: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div
        className="inline-flex w-16 h-16 rounded-full items-center justify-center"
        style={{
          background: 'radial-gradient(circle at 30% 30%, rgba(148, 163, 184, 0.18) 0%, rgba(148, 163, 184, 0.04) 70%)',
          border: '1px solid rgba(148, 163, 184, 0.3)',
        }}
      >
        <Library className="w-8 h-8 text-slate-400" />
      </div>
      <h3 className="text-lg font-display font-semibold text-slate-200">Guide Not Found</h3>
      <p className="text-sm text-slate-400 text-center max-w-md">
        No guide exists for slug{' '}
        <code className="px-1.5 py-0.5 rounded bg-slate-800/60 text-amber-300 font-mono text-xs">
          {slug}
        </code>
        . It may not have been generated yet.
      </p>
    </div>
  );
}

interface ErrorStateProps {
  message: string;
}

function ErrorState({ message }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div
        className="inline-flex w-14 h-14 rounded-full items-center justify-center"
        style={{
          background: 'radial-gradient(circle at 30% 30%, rgba(239, 68, 68, 0.18) 0%, rgba(239, 68, 68, 0.04) 70%)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
        }}
      >
        <AlertCircle className="w-7 h-7 text-red-400" />
      </div>
      <p className="text-sm text-red-300 max-w-md text-center">{message}</p>
    </div>
  );
}

// =============================================================================
// Variant selector — a row of pill buttons, one per variant of the guide.
// Only rendered when the guide has ≥2 variants. The Standard variant is
// always first and is styled distinctly (amber vs violet for real variants).
// =============================================================================

interface VariantSelectorProps {
  variants: BuildVariantGuide[];
  activeId: string;
  onChange: (id: string) => void;
}

function VariantSelector({ variants, activeId, onChange }: VariantSelectorProps) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Layers className="w-4 h-4 text-violet-400/80" />
        <span className="text-[0.6875rem] font-display font-semibold uppercase tracking-[0.18em] text-violet-300/90">
          Build Variants
        </span>
        <span className="text-[0.625rem] text-slate-500">
          {variants.length > 1
            ? `The ladder splits into ${variants.length} distinct playstyles`
            : 'Single dominant playstyle'}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {variants.map((v) => {
          const isActive = activeId === v.id;
          const accent = v.isDefault ? '#fcd34d' : '#a78bfa';
          return (
            <button
              key={v.id}
              onClick={() => onChange(v.id)}
              className={cn(
                'relative text-left px-4 py-3 rounded-xl transition-all duration-200 min-w-[220px] max-w-[340px]',
                isActive ? 'scale-[1.01]' : 'hover:scale-[1.005]',
              )}
              style={{
                background: isActive
                  ? `linear-gradient(160deg, ${accent}22 0%, ${accent}08 100%)`
                  : 'linear-gradient(160deg, rgba(2,6,23,0.65) 0%, rgba(15,23,42,0.45) 100%)',
                border: `1px solid ${isActive ? accent + '60' : 'rgba(148,163,184,0.15)'}`,
                boxShadow: isActive
                  ? `0 0 18px ${accent}25, inset 0 1px 0 rgba(255,255,255,0.05)`
                  : 'inset 0 1px 0 rgba(255,255,255,0.03)',
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="text-[0.625rem] font-display font-semibold uppercase tracking-[0.15em]"
                  style={{ color: v.isDefault ? '#fcd34d' : '#c4b5fd' }}
                >
                  {v.isDefault ? 'Standard' : `Variant`}
                </span>
                {!v.isDefault && v.share < 1 && (
                  <span className="text-[0.5625rem] text-slate-500 font-mono">
                    {Math.round(v.share * 100)}%
                  </span>
                )}
              </div>
              <div
                className="text-sm font-display font-bold"
                style={{ color: isActive ? '#f8fafc' : '#cbd5e1' }}
              >
                {v.name}
              </div>
              {v.description && (
                <div
                  className="text-[0.6875rem] text-slate-500 mt-1 leading-snug line-clamp-2"
                  title={v.description}
                >
                  {v.description}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// Borrowed-tier notice — subtle chip shown above the tier snapshot when
// the active variant's tier was borrowed from the Standard variant.
// =============================================================================

interface BorrowedTierNoticeProps {
  variantName: string;
}

function BorrowedTierNotice({ variantName }: BorrowedTierNoticeProps) {
  return (
    <div
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg mb-4 text-[0.6875rem]"
      style={{
        background: 'linear-gradient(160deg, rgba(251,191,36,0.08) 0%, rgba(251,191,36,0.02) 100%)',
        border: '1px solid rgba(251,191,36,0.25)',
        color: '#fcd34d',
      }}
    >
      <Share2 className="w-3 h-3" />
      <span className="font-display tracking-wide">
        Shared with Standard — {variantName} has no distinctive build at this tier yet
      </span>
    </div>
  );
}

// =============================================================================
// Main page
// =============================================================================

export function BuildGuideDetailPage() {
  const navigate = useNavigate();
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const authAccount = useAuthAccount();
  const { guide, isLoading, notFound, error } = useBuildGuide(slug);

  // Variants list (always ≥1). Falls back to a synthetic single-variant list
  // for any legacy guide that doesn't have the `variants` field yet.
  const variants: BuildVariantGuide[] = useMemo(() => {
    if (!guide) return [];
    if (guide.variants && guide.variants.length > 0) return guide.variants;
    // Legacy guide (schemaVersion 1) — wrap its tiers in a synthetic Standard.
    return [
      {
        id: 'variant-standard',
        name: 'Standard Build',
        description: '',
        isDefault: true,
        share: 1,
        buildCount: 0,
        distinguishingFeatures: [],
        tiers: guide.tiers ?? {},
        borrowedTiers: [],
      },
    ];
  }, [guide]);

  // Active variant selection — default to the first one (Standard if present).
  const [activeVariantId, setActiveVariantId] = useState<string | null>(null);
  const effectiveVariantId: string =
    activeVariantId && variants.some((v) => v.id === activeVariantId)
      ? activeVariantId
      : variants[0]?.id ?? 'variant-standard';
  const activeVariant: BuildVariantGuide | undefined = variants.find(
    (v) => v.id === effectiveVariantId,
  );

  // Available tiers — derived from the ACTIVE variant's tiers (not the guide's).
  const availableTiers = useMemo<ProgressionTier[]>(() => {
    if (!activeVariant) return [];
    const ORDER: ProgressionTier[] = ['early_mapping', 'endgame', 'aspirational'];
    return ORDER.filter((t) => activeVariant.tiers[t] !== undefined);
  }, [activeVariant]);

  // Active section picker — 'leveling' is the frontend-only 4th option
  // that swaps the body to the authored LevelingView. Default to endgame
  // when available so loading a guide still lands on the "main event".
  const [activeSection, setActiveSection] = useState<GuideSection>('endgame');
  const effectiveSection: GuideSection = (() => {
    if (activeSection === 'leveling') return 'leveling';
    if (availableTiers.includes(activeSection)) return activeSection;
    return availableTiers[0] ?? 'early_mapping';
  })();
  const isLevelingActive = effectiveSection === 'leveling';
  const effectiveActive: ProgressionTier = isLevelingActive
    ? availableTiers[0] ?? 'early_mapping'
    : (effectiveSection as ProgressionTier);

  const goBack = useCallback(() => navigate('/library'), [navigate]);
  const goHome = useCallback(() => navigate('/'), [navigate]);

  const activeSnapshot = activeVariant?.tiers[effectiveActive];
  const isBorrowedTier =
    !isLevelingActive &&
    !!activeVariant &&
    !activeVariant.isDefault &&
    activeVariant.borrowedTiers.includes(effectiveActive);
  const generatedDate = guide ? new Date(guide.generatedAt).toLocaleDateString() : '';

  // Sync the active tier's baked vizData into the global Zustand store so that
  // inline EntitySpan tooltips (UniqueSpan reads s.vizData?.items; tree-node
  // enrichment reads s.vizData?.tree?.nodeOverrides) resolve against THIS
  // tier's build data instead of whatever build happened to be loaded in the
  // chat pathway. Cleared on unmount so we don't leak state into ChatPage.
  const setVizData = useDesktopStore((s) => s.setVizData);
  const setTreeDiffNodes = useDesktopStore((s) => s.setTreeDiffNodes);
  const activeVizData = activeSnapshot?.vizData as BuildVisualizationResponse | undefined;
  useEffect(() => {
    if (!activeVizData) return;
    setVizData(activeVizData);
    // ALSO clear the chat-pathway treeDiffNodes. TreeVizTab has an auto-open
    // effect that triggers fullscreen on any non-null treeDiffNodes change,
    // including first mount. Without this, switching tiers here would remount
    // TreeVizTab with ChatPage's stale diff and pop the tree canvas open.
    setTreeDiffNodes(null);
    return () => setVizData(null);
  }, [activeVizData, setVizData, setTreeDiffNodes]);

  return (
    <EntityTooltipProvider>
    <div className="fixed inset-0 overflow-hidden">
      {/* Cosmic void background layer */}
      <div className="absolute inset-0 z-0">
        <img
          src="/mockups/cosmic-void-bg.png"
          alt=""
          className="w-full h-full object-cover"
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-slate-950/30" />
      </div>

      {/* Main content layer */}
      <div className="relative z-10 h-full bg-forge-atmosphere-translucent vignette-overlay grain-overlay flex flex-col">
        {/* Header */}
        <header
          data-tauri-drag-region
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
        >
          <div className="flex items-center gap-4">
            <button
              onClick={goHome}
              className="flex items-center gap-2"
              aria-label="Path of Agent home"
            >
              <div className="relative">
                <img src={seerIcon} alt="Path of Agent" className="w-5 h-5 rounded-full" />
                <div className="absolute inset-0 blur-lg bg-cyan-500/30 rounded-full" />
              </div>
              <span className="text-sm font-display text-amber-200/80">Path of Agent</span>
            </button>

            <button
              onClick={goBack}
              className={cn(
                'group flex items-center gap-2 px-3 py-2 rounded-lg',
                'bg-slate-900/50 hover:bg-slate-800/70',
                'border border-slate-700/30 hover:border-violet-500/30',
                'transition-all duration-200',
              )}
            >
              <ArrowLeft className="w-4 h-4 text-slate-500 group-hover:text-violet-400 transition-colors" />
              <span className="text-sm text-slate-500 group-hover:text-slate-300 transition-colors">
                Library
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto scrollbar-fantasy px-6 pb-12">
          <div className="w-full max-w-5xl mx-auto">
            {isLoading && <LoadingState />}
            {!isLoading && notFound && <NotFoundState slug={slug ?? ''} />}
            {!isLoading && error && !notFound && <ErrorState message={error} />}

            {!isLoading && guide && !notFound && !error && (
              <>
                {/* Hero */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="mb-8"
                >
                  <div className="flex items-center justify-center gap-4 mb-4">
                    <div className="w-16 h-px bg-gradient-to-r from-transparent to-violet-500/40" />
                    <Sparkles className="w-4 h-4 text-violet-400/80" />
                    <div className="w-16 h-px bg-gradient-to-l from-transparent to-violet-500/40" />
                  </div>
                  <div className="flex items-center justify-center gap-3 mb-2">
                    <span
                      className="px-3 py-1 rounded text-[0.6875rem] font-display font-semibold uppercase tracking-[0.15em]"
                      style={{
                        color: '#a78bfa',
                        background: 'rgba(167, 139, 250, 0.08)',
                        border: '1px solid rgba(167, 139, 250, 0.25)',
                      }}
                    >
                      {guide.ascendancy}
                    </span>
                    {guide.popularity && (
                      <span
                        className="flex items-center gap-1 px-2 py-1 rounded text-[0.625rem] font-display tracking-wider uppercase"
                        style={{
                          color: '#fcd34d',
                          background: 'rgba(251, 191, 36, 0.06)',
                          border: '1px solid rgba(251, 191, 36, 0.2)',
                        }}
                        title={`${guide.popularity.pct}% of ladder, ${guide.popularity.ascendancyCount} on this ascendancy`}
                      >
                        <TrendingUp className="w-3 h-3" />
                        Rank #{guide.popularity.rank}
                      </span>
                    )}
                  </div>
                  <h1
                    className="text-center text-4xl font-display font-bold text-slate-100 tracking-wide mb-3"
                    style={{ textShadow: '0 0 20px rgba(167, 139, 250, 0.35)' }}
                  >
                    {guide.skill}
                  </h1>
                  <p className="text-center text-sm text-slate-400 max-w-2xl mx-auto leading-relaxed mb-4">
                    {guide.tagline}
                  </p>
                  <div className="flex items-center justify-center gap-3 text-[0.625rem] text-slate-500 font-display uppercase tracking-wider">
                    <span>{guide.league} League</span>
                    <span className="text-slate-700">·</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Generated {generatedDate}
                    </span>
                    <span className="text-slate-700">·</span>
                    <a
                      href={`https://poe.ninja/poe1/builds?league=${encodeURIComponent(guide.league)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Ladder data sourced from poe.ninja"
                      className="flex items-center gap-1 text-slate-500 hover:text-violet-300 transition-colors"
                    >
                      <span>Data via poe.ninja</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                  <div className="divider-ornate w-56 mx-auto mt-5" />
                </motion.div>

                {/* Build-level "How This Build Plays" narrative — sits below
                    the hero and above the tier picker, tier-agnostic. Rendered
                    only when the authored narrative has been merged in.
                    Guarded so older guides degrade gracefully. */}
                {guide.buildNarrative && (
                  <BuildNarrativeSection narrative={guide.buildNarrative} />
                )}

                {/* Variant selector intentionally hidden for v1 (2026-04-13).
                    The detector + schema + assembler still produce variants and
                    the server still precomputes them — we just don't surface
                    the selector in the UI yet. Rationale: a top-level "pick a
                    playstyle" chooser is confusing for readers who don't
                    already know the build, borrowed-tier semantics are opaque,
                    and the labels ("Unwavering Stance + Huntleader") name
                    passives without explaining how the playstyle differs. The
                    Standard variant always renders (it's the first entry and
                    is always complete). If we want to surface alternates
                    later, prefer an in-tier "Variations" callout over a
                    top-level selector. See build-library skill LEARNING-28. */}

                {/* Sticky section bar — keeps the Leveling / tier picker visible
                    while scrolling. Stat strip hides when leveling is active
                    (no reference stats for the pre-mapping phase). */}
                <div className="sticky top-0 z-20 -mx-6 px-6 py-3 mb-6 backdrop-blur-md bg-slate-950/70 border-y border-violet-500/15">
                  <div className="flex items-center justify-between gap-4 max-w-5xl mx-auto">
                    <SectionPicker
                      active={effectiveSection}
                      availableTiers={availableTiers}
                      onChange={setActiveSection}
                    />
                    {!isLevelingActive && activeSnapshot && (
                      <StickyStatStrip snapshot={activeSnapshot} />
                    )}
                  </div>
                </div>

                {/* Sections — leveling view replaces the whole tier-relative
                    stack when the Leveling pill is active. */}
                <div className="space-y-10">
                  {isLevelingActive ? (
                    <SectionAnchor
                      id="leveling"
                      title="Leveling Guide"
                      subtitle="L1 → L68 narrative — skills, gear hints, and level-aware tree"
                      Icon={Sparkles}
                      color="#fbbf24"
                    >
                      <LevelingView
                        leveling={guide.leveling}
                        ascendancyName={guide.ascendancy}
                      />
                    </SectionAnchor>
                  ) : (
                    <>
                      {/* Active tier snapshot */}
                      <SectionAnchor
                        id="tier"
                        title={`${SECTION_LABELS[effectiveActive]} Snapshot`}
                        subtitle={SECTION_RANGES[effectiveActive]}
                        Icon={Library}
                        color="#a78bfa"
                      >
                        {isBorrowedTier && activeVariant && (
                          <BorrowedTierNotice variantName={activeVariant.name} />
                        )}
                        <AnimatePresence mode="wait">
                          {activeSnapshot && (
                            <TierSnapshotView
                              snapshot={activeSnapshot}
                              key={`${effectiveVariantId}-${effectiveActive}`}
                            />
                          )}
                        </AnimatePresence>
                      </SectionAnchor>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
    </EntityTooltipProvider>
  );
}

export default BuildGuideDetailPage;
