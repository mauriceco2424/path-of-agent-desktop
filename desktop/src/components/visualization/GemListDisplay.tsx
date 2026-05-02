/**
 * GemListDisplay Component
 *
 * Renders a list of gems with link indicators, color dots, type badges,
 * and level/quality information. Extracted from SocketGroupItem for reusability.
 */

import { Zap } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Gem color classes mapping attribute colors to Tailwind classes
 */
export const gemColorClasses = {
  red: { bg: 'bg-red-400', text: 'text-red-300' },
  green: { bg: 'bg-green-400', text: 'text-green-300' },
  blue: { bg: 'bg-blue-400', text: 'text-blue-300' },
  white: { bg: 'bg-slate-300', text: 'text-slate-200' },
} as const;

export interface GemListDisplayProps {
  gemList: Array<{
    nameSpec?: string;
    level?: number;
    quality?: number;
    isSupport: boolean;
    gemColor?: 'red' | 'green' | 'blue' | 'white';
    isVaal?: boolean;
    isAwakened?: boolean;
    qualityType?: 'standard' | 'anomalous' | 'divergent' | 'phantasmal';
    skillType?: string;
    damageType?: string;
  }>;
  mainActiveSkillIndex: number;  // 0-based index of main active skill in non-support gems
  isMainGroup: boolean;
  hasMeaningfulLinks: boolean;  // active skill(s) + support gem(s)
  isUtilityGroup: boolean;      // multiple active skills with few supports
}

export function GemListDisplay({
  gemList,
  mainActiveSkillIndex,
  isMainGroup,
  hasMeaningfulLinks,
  isUtilityGroup,
}: GemListDisplayProps) {
  // Track the current index among non-support gems to identify the main active skill
  let nonSupportIndex = 0;

  return (
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
        {gemList.map((gem, idx) => {
          const isActive = !gem.isSupport;

          // Determine if this is the main active skill
          let isMainActive = false;
          if (isActive) {
            isMainActive = nonSupportIndex === mainActiveSkillIndex;
            nonSupportIndex++;
          }

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

              {/* Skill/Damage type tags */}
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
  );
}

export default GemListDisplay;
