/**
 * GemSocket Component - Authentic PoE Gem Visualization
 *
 * A single socket/gem with realistic depth, inner glow, and the
 * characteristic look of Path of Exile skill gems.
 *
 * Features:
 * - Radial gradient for gem depth
 * - Inner light refraction effect
 * - Outer metallic socket frame
 * - Pulsing glow animation for active skills
 */

import { cn } from '../../lib/utils';
import { motion } from 'framer-motion';

export interface GemSocketProps {
  /** Socket color: R (red/str), G (green/dex), B (blue/int), W (white) */
  color: 'R' | 'G' | 'B' | 'W' | string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Whether this gem is the main active skill */
  isMainSkill?: boolean;
  /** Whether this gem is active (not a support) */
  isActive?: boolean;
  /** Whether to show pulsing animation */
  isPulsing?: boolean;
  /** Optional tooltip text */
  tooltip?: string;
  /** Click handler */
  onClick?: () => void;
  /** Additional class names */
  className?: string;
}

/**
 * Gem color configurations with authentic PoE-style gradients
 * Each gem has layers: core glow, mid gradient, outer ring, socket frame
 */
const GEM_THEMES = {
  R: {
    // Strength gem - deep crimson with orange core
    core: 'radial-gradient(circle at 35% 35%, #ff6b4a 0%, #dc2626 40%, #7f1d1d 100%)',
    glow: 'rgba(239, 68, 68, 0.6)',
    glowIntense: 'rgba(248, 113, 113, 0.8)',
    frame: 'from-red-900/80 via-red-800/60 to-red-950/90',
    pulse: 'shadow-[0_0_20px_rgba(239,68,68,0.5),0_0_40px_rgba(239,68,68,0.3)]',
    name: 'Strength',
  },
  G: {
    // Dexterity gem - emerald with bright jade core
    core: 'radial-gradient(circle at 35% 35%, #4ade80 0%, #059669 40%, #064e3b 100%)',
    glow: 'rgba(16, 185, 129, 0.6)',
    glowIntense: 'rgba(52, 211, 153, 0.8)',
    frame: 'from-emerald-900/80 via-emerald-800/60 to-emerald-950/90',
    pulse: 'shadow-[0_0_20px_rgba(16,185,129,0.5),0_0_40px_rgba(16,185,129,0.3)]',
    name: 'Dexterity',
  },
  B: {
    // Intelligence gem - sapphire with cyan core
    core: 'radial-gradient(circle at 35% 35%, #60a5fa 0%, #2563eb 40%, #1e3a5f 100%)',
    glow: 'rgba(59, 130, 246, 0.6)',
    glowIntense: 'rgba(96, 165, 250, 0.8)',
    frame: 'from-blue-900/80 via-blue-800/60 to-blue-950/90',
    pulse: 'shadow-[0_0_20px_rgba(59,130,246,0.5),0_0_40px_rgba(59,130,246,0.3)]',
    name: 'Intelligence',
  },
  W: {
    // White/prismatic gem - pearlescent with silver core
    core: 'radial-gradient(circle at 35% 35%, #f8fafc 0%, #cbd5e1 40%, #475569 100%)',
    glow: 'rgba(226, 232, 240, 0.5)',
    glowIntense: 'rgba(248, 250, 252, 0.7)',
    frame: 'from-slate-700/80 via-slate-600/60 to-slate-800/90',
    pulse: 'shadow-[0_0_20px_rgba(226,232,240,0.4),0_0_40px_rgba(226,232,240,0.2)]',
    name: 'Prismatic',
  },
};

const SIZE_CONFIG = {
  sm: {
    outer: 'w-5 h-5',
    inner: 'w-3.5 h-3.5',
    highlight: 'w-1 h-1',
  },
  md: {
    outer: 'w-7 h-7',
    inner: 'w-5 h-5',
    highlight: 'w-1.5 h-1.5',
  },
  lg: {
    outer: 'w-9 h-9',
    inner: 'w-7 h-7',
    highlight: 'w-2 h-2',
  },
};

export function GemSocket({
  color,
  size = 'md',
  isMainSkill = false,
  isActive = false,
  isPulsing = false,
  tooltip,
  onClick,
  className,
}: GemSocketProps) {
  const theme = GEM_THEMES[color as keyof typeof GEM_THEMES] || GEM_THEMES.W;
  const sizeConfig = SIZE_CONFIG[size];

  return (
    <motion.div
      className={cn(
        'relative group cursor-default',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
      whileHover={{ scale: 1.1 }}
      whileTap={onClick ? { scale: 0.95 } : undefined}
      title={tooltip || theme.name}
    >
      {/* Outer glow for main skill */}
      {(isMainSkill || isPulsing) && (
        <div
          className={cn(
            'absolute inset-0 rounded-full blur-md animate-pulse-slow',
            isMainSkill && 'bg-amber-400/40'
          )}
          style={{
            background: isMainSkill ? undefined : theme.glow,
          }}
        />
      )}

      {/* Socket frame - metallic ring */}
      <div
        className={cn(
          'relative rounded-full',
          sizeConfig.outer,
          // Metallic socket frame gradient
          'bg-gradient-to-br',
          theme.frame,
          // Frame border and shadow
          'border border-slate-600/50',
          'shadow-[inset_0_2px_4px_rgba(0,0,0,0.6),0_1px_2px_rgba(0,0,0,0.4)]',
          // Transition
          'transition-all duration-200',
          // Hover brightening
          'group-hover:border-slate-500/70',
          // Main skill golden frame
          isMainSkill && 'border-amber-500/60 shadow-[inset_0_2px_4px_rgba(0,0,0,0.6),0_0_8px_rgba(251,191,36,0.3)]'
        )}
      >
        {/* Inner gem */}
        <div
          className={cn(
            'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full',
            sizeConfig.inner,
            // Pulsing effect
            isPulsing && 'animate-gem-pulse'
          )}
          style={{
            background: theme.core,
            boxShadow: `
              inset 0 -2px 4px rgba(0,0,0,0.4),
              inset 0 2px 4px rgba(255,255,255,0.15),
              0 0 ${isActive ? '8px' : '4px'} ${theme.glow}
            `,
          }}
        >
          {/* Light refraction highlight */}
          <div
            className={cn(
              'absolute rounded-full bg-white/60',
              sizeConfig.highlight,
              'top-[15%] left-[20%]',
              'blur-[0.5px]'
            )}
          />
        </div>
      </div>
    </motion.div>
  );
}

export default GemSocket;
