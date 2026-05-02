/**
 * SkillGemItem Component
 *
 * Displays a single active skill gem with its linked support gems.
 * Used in the per-gem categorized Skills panel.
 */

import { forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, Star } from 'lucide-react';
import { cn } from '../../lib/utils';
import { getSkillGroupColor } from '../../utils/skill-group-colors';

/**
 * Support gem data for display
 */
export interface LinkedSupport {
  name: string;
  level?: number;
  quality?: number;
  gemColor?: 'red' | 'green' | 'blue' | 'white';
  isAwakened?: boolean;
  qualityType?: 'standard' | 'anomalous' | 'divergent' | 'phantasmal';
}

/**
 * Active skill gem with linked supports
 */
export interface ActiveSkillGem {
  /** Unique identifier (groupIndex-gemName) */
  id: string;
  /** Socket group index this gem belongs to */
  groupIndex: number;
  /** Index within the active gems of the group */
  gemIndex: number;
  /** Gem name */
  name: string;
  /** Gem level */
  level?: number;
  /** Gem quality */
  quality?: number;
  /** Primary skill type from PoB */
  skillType?: string;
  /** Primary damage type */
  damageType?: string;
  /** Gem color based on attribute */
  gemColor?: 'red' | 'green' | 'blue' | 'white';
  /** Whether this is a Vaal variant */
  isVaal?: boolean;
  /** Whether this is an Awakened gem */
  isAwakened?: boolean;
  /** Quality type variant */
  qualityType?: 'standard' | 'anomalous' | 'divergent' | 'phantasmal';
  /** Full gem tags from PoB */
  tags?: Record<string, boolean>;
  /** Human-readable tag string */
  tagString?: string;
  /** Equipment slot containing this gem */
  slot?: string;
  /** Whether this is the build's main skill */
  isMainSkill: boolean;
  /** Support gems linked to this active skill */
  linkedSupports: LinkedSupport[];
  /** True if this gem has a secondary support effect (e.g., Autoexertion) */
  hasSecondarySupport?: boolean;
  /** Name of the secondary support effect */
  secondarySupportName?: string;
  /** Name of the trigger support that activates this gem (e.g., "Cast when Damage Taken") */
  triggeredBy?: string;
}

interface SkillGemItemProps {
  gem: ActiveSkillGem;
  isExpanded: boolean;
  isHighlighted: boolean;
  onToggle: () => void;
}

/**
 * Get gem color class for display
 */
function getGemColorClass(color?: string): string {
  switch (color) {
    case 'red':
      return 'text-red-400';
    case 'green':
      return 'text-green-400';
    case 'blue':
      return 'text-blue-400';
    case 'white':
      return 'text-slate-200';
    default:
      return 'text-slate-400';
  }
}

/**
 * Get gem dot color for bullet points
 */
function getGemDotClass(color?: string): string {
  switch (color) {
    case 'red':
      return 'bg-red-400';
    case 'green':
      return 'bg-green-400';
    case 'blue':
      return 'bg-blue-400';
    case 'white':
      return 'bg-slate-200';
    default:
      return 'bg-slate-500';
  }
}

export const SkillGemItem = forwardRef<HTMLDivElement, SkillGemItemProps>(
  function SkillGemItem({ gem, isExpanded, isHighlighted, onToggle }, ref) {
    const groupColor = getSkillGroupColor(gem.groupIndex);
    const hasSupports = gem.linkedSupports.length > 0;
    const linkCount = gem.linkedSupports.length + 1; // Active + supports

    return (
      <div
        ref={ref}
        className={cn(
          'rounded-xl border-l-4 border transition-all duration-150',
          'border-slate-700/40',
          // Highlighted state: ring + glow + scale
          isHighlighted && [
            'ring-2 ring-offset-1 ring-offset-slate-900',
            'shadow-lg scale-[1.02] z-10',
          ]
        )}
        style={{
          backgroundColor: isHighlighted ? groupColor.bgRaw : 'rgba(0, 0, 0, 0.4)',
          borderLeftColor: groupColor.borderRaw,
          boxShadow: isHighlighted ? groupColor.glowRaw : undefined,
        }}
      >
        {/* Header - always visible */}
        <button
          onClick={onToggle}
          className={cn(
            'w-full flex items-center gap-2 px-3 py-2',
            'text-left transition-colors hover:bg-slate-800/30'
          )}
        >
          {/* Expand/Collapse icon - only show if has supports */}
          {hasSupports ? (
            <span className="text-slate-500">
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </span>
          ) : (
            <span className="w-4" /> // Spacer for alignment
          )}

          {/* Main skill indicator */}
          {gem.isMainSkill && <Star className="w-4 h-4 text-amber-400 flex-shrink-0" />}

          {/* Gem color dot */}
          <span
            className={cn('w-2 h-2 rounded-full flex-shrink-0', getGemDotClass(gem.gemColor))}
          />

          {/* Gem name */}
          <span
            className={cn(
              'text-sm font-medium truncate flex-1',
              gem.isMainSkill ? 'text-amber-300' : getGemColorClass(gem.gemColor)
            )}
          >
            {gem.isVaal && <span className="text-red-400">Vaal </span>}
            {gem.isAwakened && <span className="text-purple-400">Awakened </span>}
            {gem.name.replace(/^(Vaal |Awakened )/, '')}
          </span>

          {/* Triggered indicator */}
          {gem.triggeredBy && (
            <span className="text-[0.625rem] px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 italic">
              (trigger)
            </span>
          )}

          {/* Slot badge */}
          {gem.slot && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-400 border border-slate-700/50">
              {gem.slot}
            </span>
          )}

          {/* Dual-nature gem badge (e.g., Autoexertion provides support to other skills) */}
          {gem.hasSecondarySupport && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30">
              +Support
            </span>
          )}

          {/* Link count badge */}
          {hasSupports && (
            <span
              className={cn(
                'text-xs px-1.5 py-0.5 rounded border',
                gem.isMainSkill
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  : 'bg-slate-800 text-slate-400 border-slate-700/60'
              )}
            >
              {linkCount}L
            </span>
          )}
        </button>

        {/* Expanded content - show linked supports */}
        <AnimatePresence>
          {isExpanded && hasSupports && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-3 pt-1 border-t border-slate-700/50">
                <div
                  className={cn(
                    isHighlighted && ['rounded-lg p-2 border', groupColor.bg, groupColor.border]
                  )}
                >
                  <div className="flex flex-wrap gap-1.5">
                    {gem.linkedSupports.map((support, idx) => (
                      <div
                        key={`${support.name}-${idx}`}
                        className={cn(
                          'flex items-center gap-1.5 px-2 py-1 rounded-lg',
                          'bg-slate-800/60 border border-slate-700/40',
                          'text-xs'
                        )}
                      >
                        {/* Support gem color dot */}
                        <span
                          className={cn(
                            'w-1.5 h-1.5 rounded-full flex-shrink-0',
                            getGemDotClass(support.gemColor)
                          )}
                        />
                        {/* Support name */}
                        <span className={getGemColorClass(support.gemColor)}>
                          {support.isAwakened && (
                            <span className="text-purple-400">Awk. </span>
                          )}
                          {support.name
                            .replace(/^Awakened /, '')
                            .replace(/ Support$/, '')}
                        </span>
                        {/* Level/Quality */}
                        {(support.level || support.quality) && (
                          <span className="text-slate-500">
                            {support.level ?? 20}/{support.quality ?? 0}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }
);

export default SkillGemItem;
