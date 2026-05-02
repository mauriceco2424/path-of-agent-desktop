/**
 * SocketGroupCard Component - Premium PoE Skill Card
 *
 * Displays a socket group with dark fantasy game UI styling:
 * - Socket chain visualization with metallic links
 * - Active skill with glowing main skill indicator
 * - Support gems with color-coded hierarchy
 * - Premium badges for triggers and quality types
 */

import { forwardRef } from 'react';
import { Star, Zap, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';
import { SocketChainDisplay } from './SocketChainDisplay';

/**
 * Gem data for display
 */
export interface GemDisplayData {
  name: string;
  level?: number;
  quality?: number;
  gemColor?: 'red' | 'green' | 'blue' | 'white';
  isSupport: boolean;
  isAwakened?: boolean;
  isVaal?: boolean;
  qualityType?: 'standard' | 'anomalous' | 'divergent' | 'phantasmal';
  skillType?: string;
  triggeredBy?: string;
}

interface SocketGroupCardProps {
  /** Group index for color coding */
  groupIndex: number;
  /** Gems in this socket group */
  gems: GemDisplayData[];
  /** Physical socket data from the item */
  sockets?: Array<{ color: string; group: number }>;
  /** Whether this is the main skill group */
  isMainGroup: boolean;
  /** Index of the main active skill (0-based) */
  mainActiveIndex: number;
  /** Whether this group is highlighted (from action card) */
  isHighlighted: boolean;
}

/**
 * Gem color configurations for premium styling
 */
const GEM_COLORS: Record<string, {
  text: string;
  dot: string;
  glow: string;
}> = {
  red: {
    text: 'text-red-300',
    dot: 'bg-gradient-to-br from-red-400 to-red-600',
    glow: 'shadow-[0_0_4px_rgba(239,68,68,0.5)]',
  },
  green: {
    text: 'text-emerald-300',
    dot: 'bg-gradient-to-br from-emerald-400 to-emerald-600',
    glow: 'shadow-[0_0_4px_rgba(16,185,129,0.5)]',
  },
  blue: {
    text: 'text-blue-300',
    dot: 'bg-gradient-to-br from-blue-400 to-blue-600',
    glow: 'shadow-[0_0_4px_rgba(59,130,246,0.5)]',
  },
  white: {
    text: 'text-slate-200',
    dot: 'bg-gradient-to-br from-slate-200 to-slate-400',
    glow: 'shadow-[0_0_3px_rgba(226,232,240,0.4)]',
  },
};

function getGemStyle(color?: string) {
  return GEM_COLORS[color || 'white'] || GEM_COLORS.white;
}

/**
 * Format level/quality display
 */
function formatLevelQuality(level?: number, quality?: number): string {
  if (level === undefined && quality === undefined) return '';
  return `${level ?? 20}/${quality ?? 0}`;
}

/**
 * Quality type badge configurations
 */
const QUALITY_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  anomalous: { bg: 'bg-cyan-500/20', text: 'text-cyan-300', label: 'A' },
  divergent: { bg: 'bg-orange-500/20', text: 'text-orange-300', label: 'D' },
  phantasmal: { bg: 'bg-pink-500/20', text: 'text-pink-300', label: 'P' },
};

export const SocketGroupCard = forwardRef<HTMLDivElement, SocketGroupCardProps>(
  function SocketGroupCard(
    { groupIndex, gems, sockets, isMainGroup, mainActiveIndex, isHighlighted },
    ref
  ) {
    // Separate active and support gems
    const activeGems = gems.filter((g) => !g.isSupport);
    const supportGems = gems.filter((g) => g.isSupport);

    return (
      <div
        ref={ref}
        className={cn(
          'relative rounded-lg overflow-hidden',
          // Premium dark background with subtle gradient
          'bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-slate-950/95',
          // Metallic border styling
          'border border-slate-700/60',
          // Forge-style depth shadow
          'shadow-[0_2px_8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.03)]',
          'transition-all duration-200',
          // Main group accent styling
          isMainGroup && [
            'border-l-2 border-l-amber-500/70',
            'bg-gradient-to-br from-amber-950/20 via-slate-900/90 to-slate-950/95',
          ],
          !isMainGroup && 'border-l-2 border-l-slate-600/50',
          // Highlight styling when improvement card is hovered
          isHighlighted && [
            'ring-2 ring-offset-1 ring-offset-slate-950 ring-amber-500/50',
            'shadow-[0_0_20px_rgba(251,191,36,0.15),0_4px_12px_rgba(0,0,0,0.6)]',
            'scale-[1.01] z-10',
          ],
          // Hover effect
          'hover:border-slate-600/80',
          'hover:shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.05)]'
        )}
      >
        <div className="p-3 space-y-3">
          {/* Socket chain visualization */}
          {sockets && sockets.length > 0 && (
            <SocketChainDisplay sockets={sockets} isMainGroup={isMainGroup} />
          )}

          {/* Active gems section */}
          <div className="space-y-1.5">
            {activeGems.map((gem, idx) => {
              const isMainSkill = isMainGroup && idx === mainActiveIndex;
              const gemStyle = getGemStyle(gem.gemColor);

              return (
                <div
                  key={`active-${gem.name}-${idx}`}
                  className={cn(
                    'flex items-center gap-2.5 py-1 px-1 rounded',
                    isMainSkill && 'bg-amber-500/5'
                  )}
                >
                  {/* Main skill star or gem orb */}
                  {isMainSkill ? (
                    <div className="relative flex-shrink-0">
                      <Star className="w-4 h-4 text-amber-400" />
                      <div className="absolute inset-0 blur-sm bg-amber-400/30 rounded-full" />
                    </div>
                  ) : (
                    <span
                      className={cn(
                        'w-2.5 h-2.5 rounded-full flex-shrink-0 border border-white/20',
                        gemStyle.dot,
                        gemStyle.glow
                      )}
                    />
                  )}

                  {/* Gem name with variants */}
                  <span
                    className={cn(
                      'text-sm font-medium flex-1 truncate',
                      isMainSkill ? 'text-amber-200' : gemStyle.text
                    )}
                  >
                    {gem.isVaal && (
                      <span className="text-red-400 font-semibold">Vaal </span>
                    )}
                    {gem.isAwakened && (
                      <span className="text-purple-400">
                        <Sparkles className="w-3 h-3 inline mr-0.5 -mt-0.5" />
                      </span>
                    )}
                    {gem.name.replace(/^(Vaal |Awakened )/, '')}
                  </span>

                  {/* Level/Quality badge */}
                  {(gem.level || gem.quality) && (
                    <span
                      className={cn(
                        'text-[0.625rem] font-medium tabular-nums',
                        'px-1.5 py-0.5 rounded',
                        'bg-slate-800/60 border border-slate-700/40',
                        isMainSkill ? 'text-amber-300/80' : 'text-slate-400'
                      )}
                    >
                      {formatLevelQuality(gem.level, gem.quality)}
                    </span>
                  )}

                  {/* Trigger indicator badge */}
                  {gem.triggeredBy && (
                    <span
                      className={cn(
                        'flex items-center gap-1 text-[0.625rem] font-medium',
                        'px-1.5 py-0.5 rounded',
                        'bg-cyan-500/10 border border-cyan-500/30',
                        'text-cyan-300'
                      )}
                    >
                      <Zap className="w-2.5 h-2.5" />
                      trigger
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Support gems section */}
          {supportGems.length > 0 && (
            <div
              className={cn(
                'pt-2 mt-2 space-y-1',
                'border-t border-slate-700/40'
              )}
            >
              {supportGems.map((gem, idx) => {
                const gemStyle = getGemStyle(gem.gemColor);

                return (
                  <div
                    key={`support-${gem.name}-${idx}`}
                    className={cn(
                      'flex items-center gap-2 pl-2',
                      'group'
                    )}
                  >
                    {/* Small gem dot with glow */}
                    <span
                      className={cn(
                        'w-1.5 h-1.5 rounded-full flex-shrink-0',
                        gemStyle.dot,
                        'opacity-80 group-hover:opacity-100',
                        'transition-opacity duration-150'
                      )}
                    />

                    {/* Support name */}
                    <span
                      className={cn(
                        'text-xs flex-1 truncate',
                        gemStyle.text,
                        'opacity-70 group-hover:opacity-100',
                        'transition-opacity duration-150'
                      )}
                    >
                      {gem.isAwakened && (
                        <span className="text-purple-400 mr-1">Awk.</span>
                      )}
                      {gem.name.replace(/^Awakened /, '').replace(/ Support$/, '')}
                    </span>

                    {/* Level/Quality */}
                    {(gem.level || gem.quality) && (
                      <span className="text-[0.625rem] text-slate-500 tabular-nums">
                        {formatLevelQuality(gem.level, gem.quality)}
                      </span>
                    )}

                    {/* Quality type badge */}
                    {gem.qualityType && gem.qualityType !== 'standard' && (
                      <span
                        className={cn(
                          'text-[0.5625rem] px-1 py-0.5 rounded font-bold',
                          'border',
                          QUALITY_BADGES[gem.qualityType]?.bg || 'bg-slate-500/20',
                          QUALITY_BADGES[gem.qualityType]?.text || 'text-slate-300',
                          'border-current/30'
                        )}
                      >
                        {QUALITY_BADGES[gem.qualityType]?.label || '?'}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }
);

export default SocketGroupCard;
