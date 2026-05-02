/**
 * HubPage — landing screen with two entry-point cards.
 *
 * The user lands here at `/`. They pick between:
 *   1. "Analyze My Build" → navigates to /import
 *   2. "Build Library"     → navigates to /library
 *
 * Reuses the same outer chrome as `ImportPage` (cosmic background + forge
 * atmosphere + amber-accented header) so the transition between pages feels
 * continuous. The header is duplicated rather than extracted because both
 * `ImportPage` and `HubPage` are leaf pages — extracting a shared `AppShell`
 * would be a larger refactor than is in scope for this change.
 *
 * Unlike `ImportPage`, the hub intentionally does NOT show the
 * `AnalysisHistoryPanel` right rail. The hub is meant to be a clean,
 * first-impression landing: the user chooses a pathway before seeing any
 * prior-session state. Recent analyses surface on `/import` once the user
 * has taken the "Analyze My Build" path.
 *
 * @module desktop/src/pages/HubPage
 */

import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  User,
  LogOut,
  Coins,
  Sword,
  ArrowRight,
  Library,
} from 'lucide-react';
import seerIcon from '@/assets/seer_icon.png';
import { cn } from '../lib/utils';
import { useAuthAccount } from '../hooks/useAuthAccount';
import { WindowControls } from '../components/ui/WindowControls';
import { DiscordButton } from '../components/ui/DiscordButton';
import { VersionBadge } from '../components/ui/VersionBadge';
import { SettingsPopover } from '../components/ui/SettingsPopover';

// =============================================================================
// Animation variants
// =============================================================================

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 18, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.45, ease: 'easeOut' },
  },
};

// =============================================================================
// Hub Card sub-component
// =============================================================================

interface HubCardProps {
  title: string;
  subtitle: string;
  description: string;
  Icon: typeof Sword;
  /** Hex / rgba string for the accent color (e.g. amber, teal) */
  accent: {
    /** Solid color used for icon, title underline, hover border */
    solid: string;
    /** rgba glow string */
    glow: string;
    /** rgba border idle */
    border: string;
    /** rgba background gradient start */
    bgFrom: string;
  };
  bullets: string[];
  ctaLabel: string;
  onClick: () => void;
}

function HubCard({
  title,
  subtitle,
  description,
  Icon,
  accent,
  bullets,
  ctaLabel,
  onClick,
}: HubCardProps) {
  return (
    <motion.button
      variants={itemVariants}
      onClick={onClick}
      whileHover={{ scale: 1.015, y: -3 }}
      whileTap={{ scale: 0.985 }}
      className={cn(
        'group relative overflow-hidden rounded-2xl text-left',
        'flex flex-col p-7 min-h-[420px]',
        'transition-all duration-300',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50',
      )}
      style={{
        background: `linear-gradient(155deg, ${accent.bgFrom} 0%, rgba(2,6,23,0.92) 55%, rgba(8,15,35,0.96) 100%)`,
        border: `1px solid ${accent.border}`,
        boxShadow: `
          0 12px 48px rgba(0,0,0,0.5),
          0 0 60px ${accent.glow},
          inset 0 1px 0 rgba(255,255,255,0.04),
          inset 0 -1px 0 rgba(0,0,0,0.3)
        `,
      }}
    >
      {/* Top edge highlight */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent 8%, ${accent.solid}33 25%, ${accent.solid}66 50%, ${accent.solid}33 75%, transparent 92%)`,
        }}
      />

      {/* Radial spotlight from above */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 70% 40% at 50% -5%, ${accent.glow} 0%, transparent 60%)`,
        }}
      />

      {/* Bottom edge glow */}
      <div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent 10%, ${accent.solid}33 50%, transparent 90%)`,
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col flex-1">
        {/* Icon container */}
        <div
          className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 mb-5"
          style={{
            background: `radial-gradient(circle at 30% 30%, ${accent.solid}40 0%, ${accent.solid}15 60%, transparent 100%)`,
            border: `1px solid ${accent.solid}55`,
            boxShadow: `0 0 24px ${accent.glow}, inset 0 0 18px ${accent.solid}1a`,
          }}
        >
          <Icon className="w-7 h-7" style={{ color: accent.solid }} />
        </div>

        {/* Subtitle (eyebrow) */}
        <div
          className="text-[0.6875rem] font-display font-semibold uppercase tracking-[0.18em] mb-2"
          style={{ color: `${accent.solid}cc` }}
        >
          {subtitle}
        </div>

        {/* Title */}
        <h2
          className="text-2xl font-display font-bold tracking-wide mb-3 text-slate-100"
          style={{ textShadow: `0 0 16px ${accent.glow}` }}
        >
          {title}
        </h2>

        {/* Description */}
        <p className="text-sm text-slate-400 leading-relaxed mb-6">
          {description}
        </p>

        {/* Bullets */}
        <ul className="space-y-2 mb-7 flex-1">
          {bullets.map((bullet) => (
            <li key={bullet} className="flex items-start gap-2.5 text-[0.8125rem] text-slate-300/85">
              <div
                className="w-1.5 h-1.5 rounded-full mt-[7px] flex-shrink-0"
                style={{ backgroundColor: accent.solid, boxShadow: `0 0 6px ${accent.glow}` }}
              />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>

        {/* CTA */}
        <div
          className="flex items-center justify-between pt-4 mt-auto border-t"
          style={{ borderColor: `${accent.solid}1a` }}
        >
          <span
            className="text-sm font-display font-medium tracking-wider uppercase"
            style={{ color: accent.solid }}
          >
            {ctaLabel}
          </span>
          <ArrowRight
            className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1"
            style={{ color: accent.solid }}
          />
        </div>
      </div>
    </motion.button>
  );
}

// =============================================================================
// Main HubPage component
// =============================================================================

export function HubPage() {
  const navigate = useNavigate();
  const authAccount = useAuthAccount();

  const goToImport = useCallback(() => navigate('/import'), [navigate]);
  const goToLibrary = useCallback(() => navigate('/library'), [navigate]);

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
        <div className="absolute inset-0 bg-slate-950/30" />
      </div>

      {/* Main content layer */}
      <div className="relative z-10 h-full bg-forge-atmosphere-translucent vignette-overlay grain-overlay flex flex-col">
        {/* Compact Header (mirrors ImportPage chrome) */}
        <header
          data-tauri-drag-region
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
        >
          <div className="flex items-center gap-2">
            <div className="relative">
              <img src={seerIcon} alt="Path of Agent" className="w-5 h-5 rounded-full" />
              <div className="absolute inset-0 blur-lg bg-cyan-500/30 rounded-full" />
            </div>
            <span className="text-sm font-display text-amber-200/80">Path of Agent</span>
          </div>

          <div className="flex items-center gap-2">
            {authAccount.isAuthenticated && !authAccount.isLoading && (
              <div className="flex items-center gap-3">
                {/* Credit Balance */}
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

                {/* Account Info */}
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

                {/* Logout */}
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

        {/* Main Content */}
        <div className="flex-1 flex justify-center px-4 pb-8 overflow-y-auto scrollbar-fantasy">
          <div className="w-full max-w-4xl my-auto">
            {/* Hub Column */}
            <div className="w-full min-w-0">
              {/* Hero */}
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="text-center mb-10"
              >
                <motion.div
                  variants={itemVariants}
                  className="flex items-center justify-center gap-4 mb-5"
                >
                  <div className="w-20 h-px bg-gradient-to-r from-transparent to-amber-500/40" />
                  <div className="w-2.5 h-2.5 rotate-45 bg-gradient-to-br from-amber-400 to-amber-700 shadow-[0_0_10px_rgba(251,191,36,0.45)]" />
                  <div className="w-20 h-px bg-gradient-to-l from-transparent to-amber-500/40" />
                </motion.div>
                <motion.h1
                  variants={itemVariants}
                  className="text-4xl font-display font-bold text-amber-300 mb-3 tracking-wide text-glow-amber"
                >
                  Welcome, Exile
                </motion.h1>
                <motion.p
                  variants={itemVariants}
                  className="text-slate-400 text-base max-w-xl mx-auto"
                >
                  Choose your path. Bring your own build for personal analysis,
                  or browse curated progression guides distilled from the ladder.
                </motion.p>
                <motion.div variants={itemVariants} className="divider-ornate w-56 mx-auto mt-6" />
              </motion.div>

              {/* Two-card row */}
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-1 md:grid-cols-2 gap-6"
              >
                <HubCard
                  title="Analyze My Build"
                  subtitle="Personalized · PoB-Verified"
                  description="Import your character via PoE login, account name, or a Path of Building code. Our agent runs your build through gear, skills, and tree analysis with real PoB simulations."
                  Icon={Sword}
                  accent={{
                    solid: '#fbbf24',
                    glow: 'rgba(251, 191, 36, 0.18)',
                    border: 'rgba(251, 191, 36, 0.2)',
                    bgFrom: 'rgba(76, 36, 4, 0.35)',
                  }}
                  bullets={[
                    'Gear, skills, and passive tree reviewed together with real Path of Building simulations',
                    'Benchmarked against ladder players running your skill and ascendancy',
                    'Upgrades priced against live trade listings and your actual currency',
                  ]}
                  ctaLabel="Import & Analyze"
                  onClick={goToImport}
                />

                <HubCard
                  title="Build Library"
                  subtitle="Curated · Ladder-Distilled"
                  description="Maxroll-style progression guides built from real ladder data. Three tiers — early mapping, endgame, and aspirational — each captured from a near-median ladder character with full PoB state."
                  Icon={Library}
                  accent={{
                    solid: '#a78bfa',
                    glow: 'rgba(167, 139, 250, 0.18)',
                    border: 'rgba(167, 139, 250, 0.2)',
                    bgFrom: 'rgba(38, 16, 64, 0.35)',
                  }}
                  bullets={[
                    'Real ladder reference characters per tier',
                    'Authored leveling sections with skill progression',
                    'Core foundation items stable across all tiers',
                  ]}
                  ctaLabel="Browse Library"
                  onClick={goToLibrary}
                />
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HubPage;
