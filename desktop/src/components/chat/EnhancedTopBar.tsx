/**
 * EnhancedTopBar Component
 *
 * Premium top navigation bar for the ChatPage with refined PoE aesthetics.
 * Features build info on the left and action buttons on the right.
 *
 * Design: Dark forge-metal aesthetic with amber accents and subtle depth.
 * Typography: Cinzel for ascendancy names, system fonts for technical data.
 */

import { motion } from 'framer-motion';
import { ArrowLeft, Coins, Settings } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTokenStore } from '../../store/tokenSlice';
import { CREDIT_COST_USD } from '../../../../shared/types/Credits';

// ============================================
// Types
// ============================================

export interface EnhancedTopBarProps {
  /** Build name (optional display name) */
  buildName?: string;
  /** Ascendancy class name */
  ascendancy: string;
  /** Character level */
  level: number;
  /** Main skill name (optional) */
  mainSkill?: string;
  /** Back navigation handler */
  onBack: () => void;
  /** Credit balance - if undefined, pulls from store */
  creditBalance?: number | null;
  /** Handler for opening settings */
  onOpenSettings?: () => void;
  /** Additional CSS classes */
  className?: string;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Format credit balance as a readable integer
 */
function formatCredits(credits: number | null): string {
  if (credits === null) return '—';
  return credits.toLocaleString('en-US');
}

// ============================================
// Sub-Components
// ============================================

/**
 * Back button with hover animation
 */
function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      onClick={onClick}
      className={cn(
        'group relative flex items-center justify-center',
        'w-10 h-10 rounded-lg',
        'bg-slate-800/60 hover:bg-slate-700/80',
        'border border-slate-700/50 hover:border-amber-500/30',
        'transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-amber-500/30'
      )}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      aria-label="Go back"
    >
      <ArrowLeft
        className={cn(
          'w-5 h-5',
          'text-slate-400 group-hover:text-amber-400',
          'transition-colors duration-200'
        )}
      />
      {/* Subtle glow on hover */}
      <div
        className={cn(
          'absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100',
          'bg-gradient-to-r from-amber-500/5 to-transparent',
          'transition-opacity duration-200 pointer-events-none'
        )}
      />
    </motion.button>
  );
}

/**
 * Build info display with ascendancy and level
 */
function BuildInfo({
  ascendancy,
  level,
  mainSkill,
}: {
  ascendancy: string;
  level: number;
  mainSkill?: string;
}) {
  return (
    <div className="flex flex-col justify-center min-w-0">
      {/* Ascendancy name - Cinzel font for PoE flavor */}
      <h1
        className={cn(
          'font-display text-base font-medium leading-tight',
          'text-amber-400',
          'truncate'
        )}
        title={ascendancy}
      >
        {ascendancy}
      </h1>
      {/* Level and optional main skill */}
      <div className="flex items-center gap-2 mt-0.5">
        <span className="text-xs text-slate-500 tabular-nums">
          Level {level}
        </span>
        {mainSkill && (
          <>
            <span className="text-slate-700">|</span>
            <span
              className="text-xs text-slate-400 truncate max-w-[280px]"
              title={mainSkill}
            >
              {mainSkill}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Credit balance badge with coin icon - forge styled.
 * In dev mode: shows session USD cost + token count instead of credit balance.
 */
function CreditBadge({
  credits,
  onClick,
}: {
  credits: number | null;
  onClick?: () => void;
}) {
  const costUsd = useTokenStore((state) => state.totals.costUsd);
  const totalTokens = useTokenStore((state) => state.totals.totalTokens);
  const isDev = import.meta.env.DEV;

  const displayText = isDev
    ? `$${costUsd < 1 ? costUsd.toFixed(3) : costUsd.toFixed(2)}`
    : formatCredits(credits);
  const label = isDev ? 'Session cost (USD)' : 'Credit balance';

  return (
    <motion.button
      onClick={onClick}
      className={cn(
        'group flex items-center gap-2 px-3 py-1.5',
        'rounded-lg',
        'bg-slate-800/60 hover:bg-slate-700/70',
        'border border-slate-700/50 hover:border-amber-500/40',
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]',
        'transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-amber-500/30',
        !onClick && 'cursor-default'
      )}
      whileHover={onClick ? { scale: 1.02 } : {}}
      whileTap={onClick ? { scale: 0.98 } : {}}
      aria-label={label}
      disabled={!onClick}
    >
      {/* Coin icon with subtle glow */}
      <div className="relative">
        <Coins className="w-4 h-4 text-amber-400" />
        <div className="absolute inset-0 blur-sm bg-amber-500/20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <span className="text-sm font-medium text-amber-300 tabular-nums">
        {displayText}
      </span>
      {isDev && totalTokens > 0 && (
        <>
          <span className="text-[0.625rem] text-slate-500 tabular-nums">
            {totalTokens >= 1000 ? `${(totalTokens / 1000).toFixed(1)}K` : totalTokens}
          </span>
          <span className="text-[0.5625rem] text-amber-400/40 tabular-nums">
            {Math.floor(costUsd / CREDIT_COST_USD)}c
          </span>
        </>
      )}
    </motion.button>
  );
}

/**
 * Icon action button with tooltip-like title
 */
function IconButton({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled || !onClick}
      className={cn(
        'group relative flex items-center justify-center',
        'w-9 h-9 rounded-lg',
        'bg-slate-800/40 hover:bg-slate-700/60',
        'border border-slate-700/30 hover:border-slate-600/50',
        'transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-amber-500/30',
        'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-slate-800/40'
      )}
      whileHover={!disabled && onClick ? { scale: 1.05 } : {}}
      whileTap={!disabled && onClick ? { scale: 0.95 } : {}}
      title={label}
      aria-label={label}
    >
      <Icon
        className={cn(
          'w-4 h-4',
          'text-slate-400 group-hover:text-amber-400',
          'transition-colors duration-200',
          disabled && 'group-hover:text-slate-400'
        )}
      />
    </motion.button>
  );
}

// ============================================
// Main Component
// ============================================

export function EnhancedTopBar({
  ascendancy,
  level,
  mainSkill,
  onBack,
  creditBalance,
  onOpenSettings,
  className,
}: EnhancedTopBarProps) {
  // Get credit balance from store if not provided
  const storeCredits = useTokenStore((state) => state.creditBalance);
  const displayCredits = creditBalance !== undefined ? creditBalance : storeCredits;

  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={cn(
        'relative flex items-center justify-between',
        'h-14 px-4',
        // Dark forge-metal background with depth
        'bg-gradient-to-b from-slate-900/95 to-slate-900/80',
        // Bottom border with subtle amber accent line
        'border-b border-slate-800/60',
        // Subtle shadow for depth
        'shadow-[0_2px_12px_rgba(0,0,0,0.4)]',
        className
      )}
    >
      {/* Decorative top accent line */}
      <div
        className={cn(
          'absolute top-0 left-0 right-0 h-px',
          'bg-gradient-to-r from-transparent via-amber-500/20 to-transparent'
        )}
      />

      {/* Left Section: Back + Build Info */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <BackButton onClick={onBack} />

        {/* Vertical divider */}
        <div className="h-8 w-px bg-gradient-to-b from-transparent via-slate-700/50 to-transparent flex-shrink-0" />

        <BuildInfo
          ascendancy={ascendancy}
          level={level}
          mainSkill={mainSkill}
        />
      </div>

      {/* Right Section: Actions */}
      <div className="flex items-center gap-2">
        {/* Credit Balance Badge */}
        <CreditBadge credits={displayCredits} />

        {/* Divider */}
        <div className="h-6 w-px bg-slate-700/30 mx-1" />

        {/* Settings Button */}
        <IconButton
          icon={Settings}
          label="Settings"
          onClick={onOpenSettings}
        />
      </div>

      {/* Bottom accent line for depth */}
      <div
        className={cn(
          'absolute bottom-0 left-0 right-0 h-px',
          'bg-gradient-to-r from-slate-700/0 via-slate-700/50 to-slate-700/0'
        )}
      />
    </motion.header>
  );
}

export default EnhancedTopBar;
