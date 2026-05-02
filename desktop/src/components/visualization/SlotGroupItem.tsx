/**
 * SlotGroupItem Component
 *
 * Slot-level collapsible that groups multiple socket groups from the same gear slot.
 * For example, "Gloves" might have 3 socket groups - this component shows "Gloves"
 * once with all groups inside.
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
    skillType?: string;
    damageType?: string;
    /** Icon URL from PoE Wiki */
    iconUrl?: string;
  }>;
}

interface SlotGroupItemProps {
  slot: string; // e.g., "Gloves", "Body Armour"
  groups: SocketGroup[]; // All socket groups in this slot
  isMainSlot: boolean; // Whether this slot contains the main skill
  mainGroupIndex?: number; // Index of the main socket group (if in this slot)
  isExpanded: boolean;
  focusedGroupIndex?: number | null;
  hoveredGroupIndex?: number | null;
  onToggle: () => void;
}

export const SlotGroupItem = forwardRef<HTMLDivElement, SlotGroupItemProps>(
  function SlotGroupItem(
    {
      slot,
      groups,
      isMainSlot,
      mainGroupIndex,
      isExpanded,
      focusedGroupIndex,
      hoveredGroupIndex,
      onToggle,
    },
    ref
  ) {
  // Calculate max link count from all groups in this slot
  const maxLinkCount = Math.max(...groups.map((g) => g.gemList?.length || 0));
  const linkCountDisplay = maxLinkCount > 1 ? `${maxLinkCount}L` : '';
  const focusedGroupInSlot = !!focusedGroupIndex && groups.some((g) => g.index === focusedGroupIndex);
  const hoveredGroupInSlot = !!hoveredGroupIndex && groups.some((g) => g.index === hoveredGroupIndex);
  const highlightGroupIndex = hoveredGroupInSlot ? hoveredGroupIndex : focusedGroupIndex;
  const highlightColor = getSkillGroupColor(highlightGroupIndex);
  const showHighlight = focusedGroupInSlot || hoveredGroupInSlot;

  return (
    <div
      ref={ref}
      className={cn(
        'rounded-xl border transition-colors duration-200',
        isMainSlot
          ? 'border-amber-500/40 bg-black/60 shadow-lg shadow-amber-500/10'
          : 'border-slate-700/60 bg-black/50 hover:border-slate-600/70',
        showHighlight && [
          highlightColor.border,
          highlightColor.glow,
          'shadow-lg',
        ],
        hoveredGroupInSlot && 'ring-1 ring-white/10'
      )}
    >
      {/* Header - always visible */}
      <button
        onClick={onToggle}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2',
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

        {/* Main slot indicator */}
        {isMainSlot && (
          <Star className="w-4 h-4 text-amber-400 flex-shrink-0" />
        )}

        {/* Slot name */}
        <span
          className={cn(
            'text-base font-medium truncate flex-1',
            isMainSlot ? 'text-amber-300' : 'text-slate-200'
          )}
        >
          {slot}
        </span>

        {/* Link count badge (largest from all groups) */}
        {linkCountDisplay && (
          <span
            className={cn(
              'text-sm px-1.5 py-0.5 rounded border',
              isMainSlot
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                : 'bg-slate-800 text-slate-400 border-slate-700/60'
            )}
          >
            {linkCountDisplay}
          </span>
        )}
      </button>

      {/* Expanded content - show all groups */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 pt-1 border-t border-slate-700/50 space-y-3">
              {groups.map((group) => {
                const isMainGroup = mainGroupIndex === group.index;
                const isFocusedGroup = group.index === focusedGroupIndex;
                const isHoveredGroup = group.index === hoveredGroupIndex;
                const groupColor = getSkillGroupColor(group.index);
                const gemList = group.gemList || [];
                const gemCount = gemList.length;
                const groupLinkCount = gemCount > 1 ? `${gemCount}L` : '1L';

                // Calculate group characteristics
                const activeSkillCount = gemList.filter((g) => !g.isSupport).length;
                const supportCount = gemList.filter((g) => g.isSupport).length;
                const activeGems = gemList.filter((g) => !g.isSupport);

                // Detect "utility group" - multiple active skills with few/no supports
                const isUtilityGroup =
                  activeGems.length > 1 && supportCount < activeGems.length;

                // Meaningful links = active skill(s) with support gem(s)
                const hasMeaningfulLinks = activeSkillCount >= 1 && supportCount >= 1;

                return (
                  <div key={group.index} className="space-y-1.5">
                    {/* Group sub-header */}
                    <div className="flex items-center gap-2 text-sm">
                      <span
                        className={cn(
                          'font-medium',
                          isMainGroup ? 'text-amber-300' : 'text-slate-400'
                        )}
                      >
                        Group {group.index}
                      </span>
                      <span
                        className={cn(
                          'px-1 py-0.5 rounded text-xs',
                          isMainGroup
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-slate-700 text-slate-500'
                        )}
                      >
                        {groupLinkCount}
                      </span>
                      {isMainGroup && (
                        <Star className="w-3 h-3 text-amber-400" />
                      )}
                    </div>

                    {/* Gem list with link visualization */}
                    {gemList.length > 0 ? (
                      <div
                        className={cn(
                          'ml-2',
                          (isFocusedGroup || isHoveredGroup) && [
                            'rounded-lg p-2 border',
                            groupColor.bg,
                            groupColor.border,
                            isHoveredGroup && 'shadow-[0_0_14px_rgba(255,255,255,0.18)]'
                          ]
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
                      <div className="space-y-1 ml-2">
                        {group.skills.map((skill, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-2 text-sm"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-500 flex-shrink-0" />
                            <span className="text-slate-300">{skill}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* No gems in this group */}
                    {(!gemList || gemList.length === 0) &&
                      group.skills.length === 0 && (
                        <div className="text-sm text-slate-500 italic ml-2">
                          No gems socketed
                        </div>
                      )}
                  </div>
                );
              })}

              {/* Empty state if no groups */}
              {groups.length === 0 && (
                <div className="text-sm text-slate-500 italic">
                  No socket groups in this slot
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
  }
);

export default SlotGroupItem;
