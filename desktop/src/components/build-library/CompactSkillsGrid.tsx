/**
 * CompactSkillsGrid — build-library variant of `SkillsVizTab` that lays the
 * per-slot skill groups out in a 2–3 column grid instead of one vertical
 * stack.
 *
 * The original `SkillsVizTab` is shared with ChatPage's right sidebar, where a
 * narrow column makes a stacked vertical list the right call. On the build
 * guide detail page the skills panel sits beside the gear column and has
 * plenty of horizontal room — stacking wastes space and forces the reader to
 * scroll through 7–10 slot sections. This component reuses the same slot
 * processor, slot metadata, and `SkillGemGroup` primitive as `SkillsVizTab`,
 * but lays the resulting sections out as:
 *
 *   - The MAIN skill's slot always spans the full grid width on top (it's
 *     the build's headline — users want it front and center).
 *   - The remaining slots flow into a 2-column grid (1 col on narrow
 *     viewports as a fallback). Two columns is the sweet spot for the
 *     build-library layout — the skills column shares its parent grid with
 *     gear+tree on the left, so there's never room for a 3rd skill column.
 *
 * Long gem names inside each card are already `.truncate`-d and have hover
 * tooltips (via `SkillGemGroup`'s existing `<Tooltip>` wrapper), so cramped
 * cards degrade gracefully — the user just hovers to read the full name.
 *
 * See build-library skill LEARNING-24 for the design context.
 *
 * @module desktop/src/components/build-library/CompactSkillsGrid
 */

import { useMemo } from 'react';
import { Gem } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  processSocketGroupsBySlot,
  getSlotMeta,
  type SlotData,
} from '../visualization/SkillsVizTab';
import { SkillGemGroup } from '../visualization/SkillGemGroup';
import type { BuildVisualizationResponse } from '../../store';
import type { SocketGroup } from '../visualization/SkillGroupItem';

// =============================================================================
// Props
// =============================================================================

export interface CompactSkillsGridProps {
  skills: BuildVisualizationResponse['skills'];
  /** Not consumed directly — kept for symmetry with `SkillsVizTab` API. */
  items?: BuildVisualizationResponse['items'];
}

// =============================================================================
// Sub-components
// =============================================================================

interface SlotCardProps {
  slot: SlotData;
  fullWidth?: boolean;
}

function SlotCard({ slot, fullWidth }: SlotCardProps) {
  const meta = getSlotMeta(slot.slot);
  const Icon = meta.icon;
  const isMainSlot = slot.isMainSlot;

  return (
    <section
      className={cn(
        'rounded-md px-2.5 py-2 min-w-0',
        fullWidth && 'col-span-full',
      )}
      style={{
        background: isMainSlot
          ? 'linear-gradient(145deg, rgba(251,191,36,0.07) 0%, rgba(2,6,23,0.6) 100%)'
          : 'linear-gradient(145deg, rgba(59,130,246,0.04) 0%, rgba(2,6,23,0.55) 100%)',
        border: isMainSlot
          ? '1px solid rgba(251,191,36,0.3)'
          : '1px solid rgba(71,85,105,0.3)',
        boxShadow: isMainSlot
          ? 'inset 0 1px 0 rgba(255,255,255,0.04), 0 0 18px rgba(251,191,36,0.05)'
          : 'inset 0 1px 0 rgba(255,255,255,0.03)',
      }}
    >
      {/* Slot header — tighter than SkillsVizTab's version, no filler bar */}
      <div className="flex items-center gap-1.5 mb-1.5 min-w-0">
        <Icon
          className={cn(
            'w-3 h-3 flex-shrink-0',
            isMainSlot ? 'text-amber-400' : 'text-amber-400/70',
          )}
        />
        <span
          className={cn(
            'text-[0.625rem] font-display font-semibold uppercase tracking-widest truncate',
            isMainSlot ? 'text-amber-300' : 'text-amber-300/70',
          )}
          title={meta.label}
        >
          {meta.label}
        </span>
        {isMainSlot && (
          <span className="text-[0.5rem] font-bold uppercase px-1 py-px rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 flex-shrink-0">
            Main
          </span>
        )}
      </div>

      {/* Socket groups for this slot — `min-w-0` makes the inner flex rows
          shrink instead of overflow, which triggers `.truncate` on long
          gem names. */}
      <div className="space-y-1.5 min-w-0">
        {slot.socketGroups.map((socketGroup) => (
          <SkillGemGroup
            key={socketGroup.groupId}
            groupIndex={socketGroup.groupIndex}
            gems={socketGroup.gems}
            sockets={socketGroup.sockets}
            source={socketGroup.source}
            isMainGroup={socketGroup.isMainGroup}
            mainActiveIndex={socketGroup.mainActiveIndex}
          />
        ))}
      </div>
    </section>
  );
}

// =============================================================================
// Main component
// =============================================================================

export function CompactSkillsGrid({ skills }: CompactSkillsGridProps) {
  const { groups, mainSocketGroup } = skills;

  const enabledGroups = useMemo(
    () => groups.filter((g) => g.enabled) as SocketGroup[],
    [groups],
  );

  const slotData = useMemo(
    () => processSocketGroupsBySlot(enabledGroups, mainSocketGroup),
    [enabledGroups, mainSocketGroup],
  );

  // Main slot goes first (full-width); the rest flow into a 2–3 col grid.
  const { mainSlot, otherSlots } = useMemo(() => {
    const main = slotData.find((s) => s.isMainSlot);
    const others = slotData.filter((s) => !s.isMainSlot);
    return { mainSlot: main, otherSlots: others };
  }, [slotData]);

  const totalGroups = slotData.reduce(
    (sum, sd) => sum + sd.socketGroups.length,
    0,
  );

  if (totalGroups === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-slate-500">
        <Gem className="w-7 h-7 mb-2 text-slate-600" />
        <p className="text-sm">No skill gems found</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
      {mainSlot && <SlotCard slot={mainSlot} fullWidth />}
      {otherSlots.map((slot) => (
        <SlotCard key={slot.slot} slot={slot} />
      ))}
    </div>
  );
}

export default CompactSkillsGrid;
