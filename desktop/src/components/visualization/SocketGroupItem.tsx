/**
 * SocketGroupItem Component
 *
 * Expandable accordion item for a socket group.
 * Shows main skill name and link count when collapsed, full gem list when expanded.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, Zap, Star } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Gem color classes mapping attribute colors to Tailwind classes
 */
const gemColorClasses = {
  red: { bg: 'bg-red-400', text: 'text-red-300' },
  green: { bg: 'bg-green-400', text: 'text-green-300' },
  blue: { bg: 'bg-blue-400', text: 'text-blue-300' },
  white: { bg: 'bg-slate-300', text: 'text-slate-200' },
} as const;

interface SocketGroupItemProps {
  group: {
    index: number;
    label?: string;
    slot?: string;
    mainActiveSkill: number;
    skills: string[];
    gemList?: Array<{
      nameSpec?: string;
      level?: number;
      quality?: number;
      isSupport: boolean;
      // Gem display fields
      gemColor?: 'red' | 'green' | 'blue' | 'white';
      isVaal?: boolean;
      isAwakened?: boolean;
      qualityType?: 'standard' | 'anomalous' | 'divergent' | 'phantasmal';
      skillType?: string;
      damageType?: string;
    }>;
  };
  isMainGroup: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}

export function SocketGroupItem({
  group,
  isMainGroup,
  isExpanded,
  onToggle,
}: SocketGroupItemProps) {
  // Get active gems from gemList
  const gemList = group.gemList || [];
  const activeGems = gemList.filter(g => !g.isSupport);
  const mainActiveIndex = typeof group.mainActiveSkill === 'number' && !isNaN(group.mainActiveSkill)
    ? group.mainActiveSkill - 1
    : 0;

  // Keep skills array reference for expanded view fallback
  const skills = group.skills || [];

  // Count active skills vs supports
  const activeSkillCount = group.gemList?.filter((g) => !g.isSupport).length || 0;
  const supportCount = group.gemList?.filter((g) => g.isSupport).length || 0;

  // Detect "utility group" - multiple active skills with few/no supports (e.g., auras socketed together)
  // These don't have a meaningful "main skill" so show slot name instead
  const isUtilityGroup = activeGems.length > 1 && supportCount < activeGems.length;

  // Meaningful links = active skill(s) with support gem(s)
  const hasMeaningfulLinks = activeSkillCount >= 1 && supportCount >= 1;

  // Always use gear slot as header
  const headerLabel = group.slot || `Group ${group.index}`;

  // Keep mainSkillName for identifying the main active skill (used for Zap icon in expanded view)
  const mainSkillName = activeGems[mainActiveIndex]?.nameSpec
    || group.skills?.[mainActiveIndex]
    || group.skills?.[0]
    || activeGems[0]?.nameSpec
    || 'Unknown Skill';

  // Link count = total gems in socket group
  const gemCount = group.gemList?.length || 0;
  const linkCount = gemCount > 1 ? `${gemCount}L` : '';

  return (
    <div
      className={cn(
        'rounded-lg border transition-colors duration-200',
        isMainGroup
          ? 'border-amber-500/50 bg-amber-500/10'
          : 'border-slate-700/50 bg-slate-800/30'
      )}
    >
      {/* Header - always visible */}
      <button
        onClick={onToggle}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2',
          'text-left transition-colors hover:bg-white/5'
        )}
      >
        {/* Expand/Collapse icon */}
        <span className="text-slate-500">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </span>

        {/* Main group indicator */}
        {isMainGroup && (
          <Star className="w-4 h-4 text-amber-400 flex-shrink-0" />
        )}

        {/* Header label (gear slot) */}
        <span
          className={cn(
            'text-base font-medium truncate',
            isMainGroup ? 'text-amber-300' : 'text-slate-200'
          )}
        >
          {headerLabel}
        </span>

        {/* Link count badge */}
        {linkCount && (
          <span
            className={cn(
              'text-sm px-1.5 py-0.5 rounded',
              isMainGroup
                ? 'bg-amber-500/20 text-amber-300'
                : 'bg-slate-700 text-slate-400'
            )}
          >
            {linkCount}
          </span>
        )}

      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 pt-1 border-t border-slate-700/50">
              {/* Label if present */}
              {group.label && (
                <div className="text-sm text-slate-500 mb-2 italic">
                  {group.label}
                </div>
              )}

              {/* Gem list with link visualization */}
              {group.gemList && group.gemList.length > 0 ? (
                <div className="flex gap-2">
                  {/* Link indicator bar for meaningful links */}
                  {hasMeaningfulLinks && (
                    <div className={cn(
                      'w-1 rounded-full flex-shrink-0',
                      isMainGroup
                        ? 'bg-gradient-to-b from-amber-500/80 to-amber-600/40'
                        : 'bg-gradient-to-b from-slate-500/60 to-slate-600/30'
                    )} />
                  )}
                  {/* Dotted line for utility groups */}
                  {isUtilityGroup && !hasMeaningfulLinks && (
                    <div className="w-0.5 flex-shrink-0 border-l-2 border-dashed border-slate-600/40" />
                  )}
                  {/* Gem list */}
                  <div className="flex-1 space-y-1.5">
                    {group.gemList.map((gem, idx) => {
                      const isActive = !gem.isSupport;
                      const isMainActive =
                        isActive &&
                        group.gemList!.filter((g) => !g.isSupport).indexOf(gem) ===
                          group.mainActiveSkill - 1;

                      // Use gemColor if available, fall back to blue for supports, red for active
                      const colors = gem.gemColor
                        ? gemColorClasses[gem.gemColor]
                        : isActive
                          ? gemColorClasses.red
                          : gemColorClasses.blue;

                      return (
                        <div key={idx} className={cn('flex flex-col', isMainActive && 'font-medium')}>
                          <div className="flex items-center gap-2 text-sm">
                            {/* Gem type indicator - use gemColor */}
                            <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', colors.bg)} />

                            {/* Gem name */}
                            <span className={cn('flex-1 truncate', colors.text)}>
                              {gem.nameSpec || 'Unknown'}
                              {isMainActive && (
                                <Zap className="inline-block w-3 h-3 ml-1 text-amber-400" />
                              )}
                            </span>

                            {/* Type badges */}
                            <div className="flex gap-0.5 flex-shrink-0">
                              {gem.isVaal && (
                                <span className="text-[0.625rem] px-1 rounded bg-purple-600/50 text-purple-200">V</span>
                              )}
                              {gem.isAwakened && (
                                <span className="text-[0.625rem] px-1 rounded bg-amber-600/50 text-amber-200">A</span>
                              )}
                              {gem.qualityType && gem.qualityType !== 'standard' && (
                                <span className={cn(
                                  'text-[0.625rem] px-1 rounded',
                                  gem.qualityType === 'anomalous' && 'bg-cyan-600/50 text-cyan-200',
                                  gem.qualityType === 'divergent' && 'bg-orange-600/50 text-orange-200',
                                  gem.qualityType === 'phantasmal' && 'bg-pink-600/50 text-pink-200',
                                )}>
                                  {gem.qualityType.charAt(0).toUpperCase()}
                                </span>
                              )}
                            </div>

                            {/* Level/Quality */}
                            <span className="text-slate-500 flex-shrink-0">
                              {gem.level !== undefined && `L${gem.level}`}
                              {gem.level !== undefined &&
                                gem.quality !== undefined &&
                                '/'}
                              {gem.quality !== undefined && `Q${gem.quality}`}
                            </span>
                          </div>

                          {/* Skill/Damage type tags (only in expanded view) */}
                          {(gem.skillType || gem.damageType) && (
                            <div className="flex gap-1 ml-3.5 mt-0.5">
                              {gem.skillType && (
                                <span className="text-xs text-slate-400 capitalize">{gem.skillType}</span>
                              )}
                              {gem.damageType && (
                                <span className="text-xs text-slate-500">• {gem.damageType}</span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                // Fallback to skills array if no gemList
                <div className="space-y-1">
                  {skills.map((skill, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        'flex items-center gap-2 text-sm',
                        idx === mainActiveIndex && 'font-medium'
                      )}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-500 flex-shrink-0" />
                      <span className="text-slate-300">{skill}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* No gems */}
              {(!group.gemList || group.gemList.length === 0) &&
                skills.length === 0 && (
                  <div className="text-sm text-slate-500 italic">
                    No gems socketed
                  </div>
                )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default SocketGroupItem;
