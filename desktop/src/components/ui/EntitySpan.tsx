/**
 * EntitySpan Component
 *
 * The main dispatch component for interactive entity tooltips in analysis text.
 * Reads entity lookup data from EntityTooltipContext and renders appropriate
 * tooltips for notables/keystones (tree tooltip), skill gems (gem tooltip),
 * and unique items (item tooltip).
 *
 * Falls back to a plain styled span if entity is not found in lookup maps.
 */

import type { ReactNode } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { useEntityTooltips } from '../../contexts/EntityTooltipContext';
import type { GemTooltipPayload } from '../../hooks/useGemLookup';
import { InlineNodeIcon } from './InlineNodeIcon';
import { InlineGemOrb } from './InlineGemOrb';
import { TreeTooltipContent } from '../visualization/tree/ui/TreeTooltipContent';
import type { TooltipNode } from '../visualization/tree/ui/TreeTooltipContent';
import { GemTooltip } from '../visualization/GemTooltip';
import { ItemTooltip } from '../visualization/ItemTooltip';
import { useDesktopStore } from '../../store';
import type { StructuredMods } from '../../store';

interface EntitySpanProps {
  entityType: string;
  entityName: string;
  /** LLM-specified mastery effect (from <notable effect="..."> attribute). */
  entityEffect?: string;
  className?: string;
  children: ReactNode;
}

/** Try multiple name variations to find a gem in the lookup map */
function resolveGem(
  name: string,
  gemMap: Map<string, GemTooltipPayload>,
): GemTooltipPayload | undefined {
  // Exact match first
  const exact = gemMap.get(name);
  if (exact) return exact;

  // Try with/without "Support" suffix
  const withSupport = name.endsWith(' Support') ? name : `${name} Support`;
  const withoutSupport = name.replace(/\s+Support$/i, '');

  // Try without common prefixes
  const withoutVaal = name.replace(/^Vaal\s+/i, '');
  const withoutAwakened = name.replace(/^Awakened\s+/i, '');

  const candidates = [
    withSupport,
    withoutSupport,
    withoutVaal,
    `${withoutVaal.replace(/\s+Support$/i, '')} Support`,
    withoutAwakened,
    `${withoutAwakened.replace(/\s+Support$/i, '')} Support`,
  ];

  for (const candidate of candidates) {
    const found = gemMap.get(candidate);
    if (found) return found;
  }

  return undefined;
}

/** Build a fallback icon URL from poewiki for a gem name.
 *  Appends " Support" when the name doesn't already include it AND
 *  the gem is likely a support (inferred from context or common naming). */
function buildGemFallbackIconUrl(gemName: string, isSupport?: boolean): string {
  let fullName = gemName;
  if (isSupport && !gemName.endsWith(' Support')) {
    fullName = `${gemName} Support`;
  }
  const slug = fullName.replace(/ /g, '_');
  return `https://www.poewiki.net/wiki/Special:Redirect/file/${encodeURIComponent(slug)}_inventory_icon.png`;
}

/** Map gem color codes to GemTooltip color prop values */
const GEM_COLOR_MAP: Record<string, 'red' | 'green' | 'blue' | 'white'> = {
  r: 'red',
  g: 'green',
  b: 'blue',
  d: 'white',
};

export function EntitySpan({ entityType, entityName, entityEffect, className, children }: EntitySpanProps) {
  const ctx = useEntityTooltips();

  if (entityType === 'notable' || entityType === 'keystone') {
    return (
      <NotableSpan
        entityName={entityName}
        entityEffect={entityEffect}
        className={className}
        ctx={ctx}
      >
        {children}
      </NotableSpan>
    );
  }

  if (entityType === 'skill') {
    return (
      <SkillSpan
        entityName={entityName}
        className={className}
        ctx={ctx}
      >
        {children}
      </SkillSpan>
    );
  }

  if (entityType === 'unique') {
    return (
      <UniqueSpan
        entityName={entityName}
        className={className}
        ctx={ctx}
      >
        {children}
      </UniqueSpan>
    );
  }

  // Unknown entity type, fall back to plain span
  return <span className={className}>{children}</span>;
}

// ---------------------------------------------------------------------------
// Notable / Keystone / Ascendancy Node
// ---------------------------------------------------------------------------

interface EntitySubSpanProps {
  entityName: string;
  /** LLM-specified mastery effect (from <notable effect="..."> attribute). */
  entityEffect?: string;
  className?: string;
  children: ReactNode;
  ctx: ReturnType<typeof useEntityTooltips>;
}

function NotableSpan({ entityName, entityEffect, className, children, ctx }: EntitySubSpanProps) {
  const { nodeStatsMap, nodeTypeMap, nodeIconMap, spriteConfig, zoomLevel, treeReady, nodeMasteryMap } = ctx;

  const stats = nodeStatsMap.get(entityName);
  const nodeType = nodeTypeMap.get(entityName);
  const nodeIcon = nodeIconMap.get(entityName);

  // If tree data not ready or node not found, render with inline icon if possible
  if (!treeReady || !nodeType) {
    return (
      <span className={className}>
        {nodeIcon && spriteConfig && zoomLevel && (
          <InlineNodeIcon
            name={entityName}
            nodeIcon={nodeIcon}
            spriteConfig={spriteConfig}
            zoomLevel={zoomLevel}
          />
        )}
        {children}
      </span>
    );
  }

  // Mastery nodes: show the selected mastery effect in a tooltip (matches sidebar display)
  if (nodeType === 'mastery') {
    return (
      <MasterySpan
        entityName={entityName}
        entityEffect={entityEffect}
        className={className}
        nodeIcon={nodeIcon}
        spriteConfig={spriteConfig}
        zoomLevel={zoomLevel}
      >
        {children}
      </MasterySpan>
    );
  }

  // Build a minimal TooltipNode for TreeTooltipContent
  const tooltipNode: TooltipNode = {
    id: 0,
    x: 0,
    y: 0,
    type: nodeType as TooltipNode['type'],
    name: entityName,
    stats: stats ?? [],
  };

  return (
    <Tooltip.Provider delayDuration={200}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <span className={`${className ?? ''} cursor-help`}>
            {nodeIcon && spriteConfig && zoomLevel && (
              <InlineNodeIcon
                name={entityName}
                nodeIcon={nodeIcon}
                spriteConfig={spriteConfig}
                zoomLevel={zoomLevel}
              />
            )}
            {children}
          </span>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="top"
            sideOffset={6}
            className="z-[9999] animate-in fade-in-0 zoom-in-95 duration-150"
            collisionPadding={8}
          >
            <TreeTooltipContent node={tooltipNode} />
            <Tooltip.Arrow className="fill-[rgba(20,20,30,0.95)]" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

// ---------------------------------------------------------------------------
// Mastery Node (selected effect tooltip)
// ---------------------------------------------------------------------------

import type { NodeIconInfo } from '../visualization/tree/hooks/useSidebarSpriteData';
import type { SpriteConfig } from '../visualization/tree/types';

function MasterySpan({ entityName, entityEffect, className, children, nodeIcon, spriteConfig, zoomLevel }: {
  entityName: string;
  /** LLM-specified mastery effect (from <notable effect="..."> attribute). */
  entityEffect?: string;
  className?: string;
  children: ReactNode;
  nodeIcon: NodeIconInfo | undefined;
  spriteConfig: SpriteConfig | undefined;
  zoomLevel: string | undefined;
}) {
  const resolvedMasteries = useDesktopStore(s => s.vizData?.tree?.resolvedMasteries);
  const selected = resolvedMasteries?.find((m: { name: string; stats: string[] }) => m.name === entityName);

  // Prefer LLM-specified effect (agent recommendation), fall back to current build data
  const effectStats = entityEffect ? [entityEffect] : selected?.stats;

  const icon = nodeIcon && spriteConfig && zoomLevel ? (
    <InlineNodeIcon
      name={entityName}
      nodeIcon={nodeIcon}
      spriteConfig={spriteConfig}
      zoomLevel={zoomLevel}
    />
  ) : null;

  // No effect data from either source — render icon + styled text without tooltip
  if (!effectStats || effectStats.length === 0) {
    return <span className={className}>{icon}{children}</span>;
  }

  return (
    <Tooltip.Provider delayDuration={200}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <span className={`${className ?? ''} cursor-help`}>
            {icon}
            {children}
          </span>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="top"
            sideOffset={6}
            className="z-[9999] animate-in fade-in-0 zoom-in-95 duration-150"
            collisionPadding={8}
          >
            <div className="max-w-[280px] rounded-lg border border-purple-500/30 bg-[rgba(20,20,30,0.95)] px-3 py-2.5 shadow-xl">
              <div className="text-[0.7rem] font-semibold text-purple-300 uppercase tracking-wider mb-1.5">
                {entityName}
              </div>
              <div className="space-y-0.5">
                {effectStats.map((stat: string, i: number) => (
                  <div key={i} className="text-[0.675rem] text-stone-300 leading-snug">{stat}</div>
                ))}
              </div>
            </div>
            <Tooltip.Arrow className="fill-[rgba(20,20,30,0.95)]" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

// ---------------------------------------------------------------------------
// Skill Gem
// ---------------------------------------------------------------------------

function SkillSpan({ entityName, className, children, ctx }: EntitySubSpanProps) {
  const { gemMap, gemReady } = ctx;

  const gem = gemReady ? resolveGem(entityName, gemMap) : undefined;
  const fallbackIconUrl = buildGemFallbackIconUrl(entityName, gem?.isSupport);

  // If gem not found: distinguish "still loading" from "genuinely missing"
  if (!gem) {
    if (!gemReady) {
      // Data still loading — render text only, will re-render when ready
      return <span className={className}>{children}</span>;
    }
    // Data loaded but gem not found — render plain text (no orb icon)
    // This prevents generic categories like "Heralds"/"Auras" from getting icons
    return <span className={className}>{children}</span>;
  }

  const gemColor = GEM_COLOR_MAP[gem.color] ?? 'blue';
  const iconUrl = gem.iconUrl || fallbackIconUrl;

  return (
    <Tooltip.Provider delayDuration={200}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <span className={`${className ?? ''} cursor-help`}>
            <InlineGemOrb color={gem.color} iconUrl={iconUrl} name={entityName} />
            {children}
          </span>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="top"
            sideOffset={6}
            className="z-[9999] animate-in fade-in-0 zoom-in-95 duration-150"
            collisionPadding={8}
          >
            <GemTooltip
              name={entityName}
              gemColor={gemColor}
              isSupport={gem.isSupport}
              description={gem.description}
              statText={gem.statText}
              requirements={gem.requirements}
              gemTags={gem.gemTags}
              manaCost={gem.manaCost}
              manaReservation={gem.manaReservation}
              lifeReservation={gem.lifeReservation}
              costMultiplier={gem.costMultiplier}
              damageEffectiveness={gem.damageEffectiveness}
            />
            <Tooltip.Arrow className="fill-slate-900" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

// ---------------------------------------------------------------------------
// Unique Item
// ---------------------------------------------------------------------------

function UniqueSpan({ entityName, className, children, ctx }: EntitySubSpanProps) {
  const { uniqueMap, uniqueReady } = ctx;

  // Prefer build-specific equipped item data over static database template.
  // This ensures items like timeless jewels (Glorious Vanity) show their actual
  // seed/mods instead of a generic all-variant template.
  const equippedItem = useDesktopStore(s => {
    const items = s.vizData?.items;
    if (!items) return undefined;
    return items.find(i => i.name === entityName && i.rarity === 'UNIQUE');
  });

  // Use equipped item mods if available (build-specific), otherwise fall back to static DB
  let tooltipName = entityName;
  let tooltipBase = '';
  let mods: StructuredMods | undefined;

  if (equippedItem?.mods) {
    tooltipName = equippedItem.name;
    tooltipBase = equippedItem.baseName;
    mods = equippedItem.mods;
  } else {
    const unique = uniqueReady ? uniqueMap.get(entityName) : undefined;
    if (unique) {
      tooltipName = unique.name;
      tooltipBase = unique.baseType;
      mods = {
        implicits: unique.implicits.map((text) => ({
          text,
          affixType: 'implicit',
          type: 'implicit',
        })),
        explicits: unique.explicits.map((e) => ({
          text: e.text,
          affixType: 'explicit',
          type: 'explicit',
        })),
        crafted: [],
        enchants: [],
      };
    }
  }

  // If neither equipped nor static data found, render plain styled span
  if (!mods) {
    return <span className={className}>{children}</span>;
  }

  return (
    <Tooltip.Provider delayDuration={200}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <span className={`${className ?? ''} cursor-help`}>
            {children}
          </span>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="top"
            sideOffset={6}
            className="z-[9999] animate-in fade-in-0 zoom-in-95 duration-150"
            collisionPadding={8}
          >
            <ItemTooltip
              name={tooltipName}
              baseName={tooltipBase}
              rarity="UNIQUE"
              mods={mods}
            />
            <Tooltip.Arrow className="fill-[#0c0c0e]" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
