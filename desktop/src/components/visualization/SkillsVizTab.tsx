/**
 * SkillsVizTab Component - Compact Skills Display
 *
 * Displays skill gems organized by equipment slot.
 * Clean, compact design with inline socket + skill name display.
 */

import { useRef, useEffect, useMemo } from 'react';
import {
  Shirt,
  Crown,
  Hand,
  Footprints,
  Sword,
  Shield,
  Gem,
} from 'lucide-react';
import { SkillGemGroup, type GemData } from './SkillGemGroup';
import type { BuildVisualizationResponse } from '../../store';
import type { SocketGroup } from './SkillGroupItem';
import { cn } from '../../lib/utils';

interface SkillsVizTabProps {
  skills: BuildVisualizationResponse['skills'];
  items: BuildVisualizationResponse['items'];
  focusedSkillGroupIndex?: number | null;
  hoveredSkillGroupIndex?: number | null;
}

export const SKILL_SLOT_ORDER = [
  'Body Armour',
  'Helmet',
  'Gloves',
  'Boots',
  'Weapon 1',
  'Weapon 2',
  'Weapon 1 Swap',
  'Weapon 2 Swap',
  'Amulet',
  'Ring 1',
  'Ring 2',
  'Belt',
];

const SLOT_META: Record<string, { icon: typeof Shirt; label: string }> = {
  'Body Armour': { icon: Shirt, label: 'Body Armour' },
  Helmet: { icon: Crown, label: 'Helmet' },
  Gloves: { icon: Hand, label: 'Gloves' },
  Boots: { icon: Footprints, label: 'Boots' },
  'Weapon 1': { icon: Sword, label: 'Main Hand' },
  'Weapon 2': { icon: Shield, label: 'Off Hand' },
  'Weapon 1 Swap': { icon: Sword, label: 'Swap Main' },
  'Weapon 2 Swap': { icon: Shield, label: 'Swap Off' },
};

export function getSlotMeta(slot: string): { icon: typeof Shirt; label: string } {
  return SLOT_META[slot] || { icon: Gem, label: slot };
}

// Trigger support detection
const TRIGGER_TARGET_TYPES: Record<string, Set<string>> = {
  'Cast when Damage Taken Support': new Set(['spell', 'guard']),
  'Cast when Damage Taken': new Set(['spell', 'guard']),
  'Cast When Damage Taken Support': new Set(['spell', 'guard']),
  'Cast When Damage Taken': new Set(['spell', 'guard']),
  'Autoexertion Support': new Set(['warcry']),
  Autoexertion: new Set(['warcry']),
  'Cast on Critical Strike Support': new Set(['spell']),
  'Cast on Critical Strike': new Set(['spell']),
  'Cast On Critical Strike Support': new Set(['spell']),
  'Cast On Critical Strike': new Set(['spell']),
  'Cast while Channelling Support': new Set(['spell']),
  'Cast while Channelling': new Set(['spell']),
  'Cast While Channelling Support': new Set(['spell']),
  'Cast While Channelling': new Set(['spell']),
  'Cast when Stunned Support': new Set(['spell']),
  'Cast when Stunned': new Set(['spell']),
  'Cast When Stunned Support': new Set(['spell']),
  'Cast When Stunned': new Set(['spell']),
  'Spellslinger Support': new Set(['spell']),
  Spellslinger: new Set(['spell']),
  'Arcanist Brand Support': new Set(['spell']),
  'Arcanist Brand': new Set(['spell']),
  'Hextouch Support': new Set(['hex', 'curse', 'spell']),
  Hextouch: new Set(['hex', 'curse', 'spell']),
  'Mark on Hit Support': new Set(['mark']),
  'Mark on Hit': new Set(['mark']),
};

function isTriggerSupport(supportName: string): boolean {
  return supportName in TRIGGER_TARGET_TYPES;
}

function canTriggerAffectGem(
  triggerName: string,
  gem: { skillType?: string; tags?: Record<string, boolean> }
): boolean {
  const targetTypes = TRIGGER_TARGET_TYPES[triggerName];
  if (!targetTypes) return false;
  if (gem.skillType && targetTypes.has(gem.skillType)) return true;
  if (gem.tags) {
    for (const tag of Object.keys(gem.tags)) {
      if (gem.tags[tag] && targetTypes.has(tag.toLowerCase())) return true;
    }
  }
  return false;
}

function gemColorToSocketColor(gemColor?: string): string {
  switch (gemColor) {
    case 'red': return 'R';
    case 'green': return 'G';
    case 'blue': return 'B';
    case 'white': return 'W';
    default: return 'W';
  }
}

function generateSocketsFromGems(
  gems: Array<{ gemColor?: string }>
): Array<{ color: string; group: number }> {
  return gems.map((gem) => ({
    color: gemColorToSocketColor(gem.gemColor),
    group: 0,
  }));
}

export interface ProcessedSocketGroup {
  groupId: string;
  groupIndex: number;
  slot: string;
  source?: string;
  gems: GemData[];
  sockets?: Array<{ color: string; group: number }>;
  isMainGroup: boolean;
  mainActiveIndex: number;
}

export interface SlotData {
  slot: string;
  socketGroups: ProcessedSocketGroup[];
  isMainSlot: boolean;
}

export function processSocketGroupsBySlot(
  groups: SocketGroup[],
  mainSocketGroup: number,
): SlotData[] {
  const slotMap = new Map<string, ProcessedSocketGroup[]>();
  const mainSlotName = groups.find((g) => g.index === mainSocketGroup)?.slot;

  for (const group of groups) {
    if (!group.gemList || group.gemList.length === 0) continue;

    const slot = group.slot || 'Unslotted';
    const isMainGroup = group.index === mainSocketGroup;
    const mainActiveIndex = (group.mainActiveSkill ?? 1) - 1;

    const gems: GemData[] = group.gemList.map((gem) => {
      let triggeredBy: string | undefined;
      if (!gem.isSupport) {
        const triggerSupport = group.gemList?.find(
          (g) =>
            g.isSupport &&
            g.nameSpec &&
            isTriggerSupport(g.nameSpec) &&
            canTriggerAffectGem(g.nameSpec, gem)
        );
        if (triggerSupport?.nameSpec) {
          triggeredBy = triggerSupport.nameSpec
            .replace(/ Support$/i, '')
            .replace(/^Cast /, '');
        }
      }

      return {
        name: gem.nameSpec || 'Unknown Gem',
        level: gem.level,
        quality: gem.quality,
        gemColor: gem.gemColor,
        isSupport: gem.isSupport,
        isAwakened: gem.isAwakened,
        isVaal: gem.isVaal,
        qualityType: gem.qualityType,
        skillType: gem.skillType,
        triggeredBy,
        iconUrl: gem.iconUrl,
        // Tooltip data from API
        description: gem.description,
        statText: gem.statText,
        manaCost: gem.manaCost,
        manaReservation: gem.manaReservation,
        lifeReservation: gem.lifeReservation,
        requirements: gem.requirements,
        gemTags: gem.gemTags,
        costMultiplier: gem.costMultiplier,
        damageEffectiveness: gem.damageEffectiveness,
      };
    });

    // Always derive socket colors from gem attributes (gemColor), not physical item sockets.
    // Physical item sockets are ordered by slot position on the item, which doesn't match
    // the gem order in PoB's socket group (active skill first, then supports by index).
    const sockets = generateSocketsFromGems(gems);

    const processedGroup: ProcessedSocketGroup = {
      groupId: `group-${group.index}`,
      groupIndex: group.index,
      slot,
      source: group.source,
      gems,
      sockets,
      isMainGroup,
      mainActiveIndex,
    };

    if (!slotMap.has(slot)) {
      slotMap.set(slot, []);
    }
    slotMap.get(slot)!.push(processedGroup);
  }

  const slotDataArray: SlotData[] = [];
  for (const [slot, socketGroups] of slotMap) {
    socketGroups.sort((a, b) => {
      if (a.isMainGroup && !b.isMainGroup) return -1;
      if (!a.isMainGroup && b.isMainGroup) return 1;
      return a.groupIndex - b.groupIndex;
    });

    slotDataArray.push({
      slot,
      socketGroups,
      isMainSlot: slot === mainSlotName,
    });
  }

  slotDataArray.sort((a, b) => {
    if (a.isMainSlot && !b.isMainSlot) return -1;
    if (!a.isMainSlot && b.isMainSlot) return 1;

    const aIndex = SKILL_SLOT_ORDER.indexOf(a.slot);
    const bIndex = SKILL_SLOT_ORDER.indexOf(b.slot);

    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    return a.slot.localeCompare(b.slot);
  });

  return slotDataArray;
}

export function SkillsVizTab({
  skills,
  focusedSkillGroupIndex,
  hoveredSkillGroupIndex,
}: SkillsVizTabProps) {
  const { groups, mainSocketGroup } = skills;

  const groupRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const enabledGroups = useMemo(
    () => groups.filter((g) => g.enabled) as SocketGroup[],
    [groups]
  );

  const slotData = useMemo(
    () => processSocketGroupsBySlot(enabledGroups, mainSocketGroup),
    [enabledGroups, mainSocketGroup]
  );

  const highlightGroupIndex = hoveredSkillGroupIndex ?? focusedSkillGroupIndex;

  useEffect(() => {
    if (highlightGroupIndex !== null && highlightGroupIndex !== undefined) {
      const groupId = `group-${highlightGroupIndex}`;
      const el = groupRefs.current.get(groupId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [highlightGroupIndex]);

  const isGroupHighlighted = (groupIndex: number) =>
    groupIndex === highlightGroupIndex;

  const totalGroups = slotData.reduce(
    (sum, sd) => sum + sd.socketGroups.length,
    0
  );

  return (
    <div className="space-y-4">
      {/* Slot sections */}
      {slotData.map((slotItem) => {
        const meta = getSlotMeta(slotItem.slot);
        const Icon = meta.icon;

        return (
          <section key={slotItem.slot}>
            {/* Slot Header - matches other viz tabs */}
            <div className="flex items-center gap-2 mb-2">
              <Icon
                className={cn(
                  'w-3.5 h-3.5',
                  slotItem.isMainSlot ? 'text-amber-400' : 'text-amber-400/80'
                )}
              />
              <span
                className={cn(
                  'text-xs font-display font-semibold uppercase tracking-widest',
                  slotItem.isMainSlot ? 'text-amber-400' : 'text-amber-400/80'
                )}
              >
                {meta.label}
              </span>
              {slotItem.isMainSlot && (
                <span className="text-[0.5625rem] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  Main
                </span>
              )}
              <div className={cn(
                'flex-1 h-px',
                slotItem.isMainSlot ? 'bg-amber-500/20' : 'bg-slate-700/40'
              )} />
            </div>

            {/* Socket groups */}
            <div className="space-y-2 pl-1">
              {slotItem.socketGroups.map((socketGroup) => (
                <SkillGemGroup
                  key={socketGroup.groupId}
                  ref={(el) => {
                    if (el) groupRefs.current.set(socketGroup.groupId, el);
                  }}
                  groupIndex={socketGroup.groupIndex}
                  gems={socketGroup.gems}
                  sockets={socketGroup.sockets}
                  source={socketGroup.source}
                  isMainGroup={socketGroup.isMainGroup}
                  mainActiveIndex={socketGroup.mainActiveIndex}
                  isHighlighted={isGroupHighlighted(socketGroup.groupIndex)}
                />
              ))}
            </div>
          </section>
        );
      })}

      {/* Empty state */}
      {totalGroups === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-slate-500">
          <Gem className="w-8 h-8 mb-2 text-slate-600" />
          <p className="text-sm">No skill gems found</p>
        </div>
      )}
    </div>
  );
}

export default SkillsVizTab;
