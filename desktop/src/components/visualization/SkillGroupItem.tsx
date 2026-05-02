/**
 * SkillGroupItem Component
 *
 * Displays a single socket group with colored left border, slot badge,
 * and enhanced highlighting when linked to improvement cards.
 */

import { forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, Star } from 'lucide-react';
import { cn } from '../../lib/utils';
import { GemListDisplay } from './GemListDisplay';
import { getSkillGroupColor } from '../../utils/skill-group-colors';

export interface SocketGroup {
  index: number;
  label?: string;
  slot?: string;
  /** Source descriptor for item/node-granted groups (undefined for normal socketed groups) */
  source?: string;
  mainActiveSkill: number; // 1-based index
  skills: string[];
  gemList?: Array<{
    nameSpec?: string;
    level?: number;
    quality?: number;
    isSupport: boolean;
    gemColor?: 'red' | 'green' | 'blue' | 'white';
    isVaal?: boolean;
    isAwakened?: boolean;
    qualityType?: 'standard' | 'anomalous' | 'divergent' | 'phantasmal';
    /** Primary skill type from PoB (aura, herald, guard, warcry, movement, etc.) */
    skillType?: string;
    damageType?: string;
    /** Full gem tags from PoB (e.g., { aura: true, spell: true, fire: true }) */
    tags?: Record<string, boolean>;
    /** Human-readable tag string from PoB (e.g., "Spell, AoE, Fire, Duration") */
    tagString?: string;
    /** Icon URL from PoE Wiki */
    iconUrl?: string;
    // Tooltip data from RePoE
    /** Gem description text */
    description?: string | null;
    /** Level-specific stat lines (in-game tooltip text) */
    statText?: string[];
    /** Mana cost at current level */
    manaCost?: number | null;
    /** Mana reservation % (for auras) */
    manaReservation?: number | null;
    /** Life reservation % (for blood magic auras) */
    lifeReservation?: number | null;
    /** Attribute requirements */
    requirements?: {
      level?: number | null;
      str?: number | null;
      dex?: number | null;
      int?: number | null;
    };
    /** Gem tags (Spell, Attack, Fire, etc.) */
    gemTags?: string[];
    /** Cost multiplier % for support gems */
    costMultiplier?: number | null;
    /** Damage effectiveness % */
    damageEffectiveness?: number | null;
  }>;
}

interface SkillGroupItemProps {
  group: SocketGroup;
  isMainGroup: boolean;
  isExpanded: boolean;
  isHighlighted: boolean;
  onToggle: () => void;
}

export const SkillGroupItem = forwardRef<HTMLDivElement, SkillGroupItemProps>(
  function SkillGroupItem(
    { group, isMainGroup, isExpanded, isHighlighted, onToggle },
    ref
  ) {
    const groupColor = getSkillGroupColor(group.index);
    const gemList = group.gemList || [];
    const gemCount = gemList.length;
    const linkCount = gemCount > 1 ? `${gemCount}L` : gemCount === 1 ? '1L' : '';

    // Calculate group characteristics
    const activeGems = gemList.filter((g) => !g.isSupport);
    const supportCount = gemList.filter((g) => g.isSupport).length;

    // Detect "utility group" - multiple active skills with few/no supports
    const isUtilityGroup = activeGems.length > 1 && supportCount < activeGems.length;

    // Meaningful links = active skill(s) with support gem(s)
    const hasMeaningfulLinks = activeGems.length >= 1 && supportCount >= 1;

    // Get primary skill name for display
    const primarySkillIndex = group.mainActiveSkill - 1;
    const primaryGem = activeGems[primarySkillIndex] || activeGems[0];
    const primarySkillName = primaryGem?.nameSpec || group.skills[0] || 'Unknown Skill';

    // Slot display
    const slotName = group.slot?.trim() || 'Unslotted';

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
          {/* Expand/Collapse icon */}
          <span className="text-slate-500">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </span>

          {/* Main group indicator */}
          {isMainGroup && <Star className="w-4 h-4 text-amber-400 flex-shrink-0" />}

          {/* Primary skill name */}
          <span
            className={cn(
              'text-sm font-medium truncate flex-1',
              isMainGroup ? 'text-amber-300' : 'text-slate-200'
            )}
          >
            {primarySkillName}
          </span>

          {/* Slot badge */}
          <span className="text-xs px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-400 border border-slate-700/50">
            {slotName}
          </span>

          {/* Link count badge */}
          {linkCount && (
            <span
              className={cn(
                'text-xs px-1.5 py-0.5 rounded border',
                isMainGroup
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  : 'bg-slate-800 text-slate-400 border-slate-700/60'
              )}
            >
              {linkCount}
            </span>
          )}
        </button>

        {/* Expanded content - show gems */}
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
                {/* Gem list with link visualization */}
                {gemList.length > 0 ? (
                  <div
                    className={cn(
                      isHighlighted && ['rounded-lg p-2 border', groupColor.bg, groupColor.border]
                    )}
                  >
                    <GemListDisplay
                      gemList={gemList}
                      mainActiveSkillIndex={group.mainActiveSkill - 1}
                      isMainGroup={isMainGroup}
                      hasMeaningfulLinks={hasMeaningfulLinks}
                      isUtilityGroup={isUtilityGroup}
                    />
                  </div>
                ) : (
                  // Fallback to skills array if no gemList
                  <div className="space-y-1">
                    {group.skills.map((skill, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-500 flex-shrink-0" />
                        <span className="text-slate-300">{skill}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* No gems in this group */}
                {(!gemList || gemList.length === 0) && group.skills.length === 0 && (
                  <div className="text-sm text-slate-500 italic">No gems socketed</div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }
);

export default SkillGroupItem;
