/**
 * TreeVizTab Component
 *
 * Displays tree statistics, ascendancy nodes, keystones, masteries, and notables.
 * Users can click the tree icon to open the full interactive tree in a modal.
 *
 * Notable categories are pre-classified in notable-categories.json for accurate grouping.
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Key, Sparkles, ChevronDown, Shield, Sword, Heart, Zap, Users, BarChart3,
  Settings, Star, TreeDeciduous, Maximize2, CircleDot, Droplets, Hexagon,
} from 'lucide-react';
import useDesktopStore from '../../store';
import type { BuildVisualizationResponse } from '../../store';
import { cn } from '../../lib/utils';
import notableCategoriesData from '../../data/notable-categories.json';
import { TreeFullscreenModal } from './tree';
import { extractEquippedJewels } from './tree/utils';
import { useSidebarSpriteData } from './tree/hooks/useSidebarSpriteData';
import { TreeNodeIcon } from './tree/ui/TreeNodeIcon';
import { getKnownTransformedNodeIconAlias } from './tree/utils/sprite-resolver';

/** Tooltip state for portal-based rendering */
interface TooltipState {
  node: PassiveNode;
  x: number;
  y: number;
  categoryStyle?: { headerText: string };
}

/** Pre-classified notable categories mapping */
const notableCategories = notableCategoriesData as Record<string, string[]>;

/** Keystone/notable with optional stat descriptions for tooltips */
interface PassiveNode {
  name: string;
  stats?: string[];
}

/** Type guard to check if keystones/notables are in the new format with stats */
function isPassiveNodeArray(arr: string[] | PassiveNode[]): arr is PassiveNode[] {
  return arr.length > 0 && typeof arr[0] === 'object' && 'name' in arr[0];
}

/** Normalize keystones/notables to PassiveNode format for consistent rendering */
function normalizePassiveNodes(nodes: string[] | PassiveNode[]): PassiveNode[] {
  if (isPassiveNodeArray(nodes)) {
    return nodes;
  }
  return nodes.map(name => ({ name, stats: undefined }));
}

interface TreeVizTabProps {
  tree: BuildVisualizationResponse['tree'];
  /** Optional items array to extract equipped jewels for tooltip display */
  items?: BuildVisualizationResponse['items'];
}

type NotableCategory = {
  id: string;
  label: string;
};

const NOTABLE_CATEGORIES: NotableCategory[] = [
  { id: 'Offense', label: 'Offense' },
  { id: 'Defense', label: 'Defense' },
  { id: 'Life', label: 'Life' },
  { id: 'Energy Shield', label: 'Energy Shield' },
  { id: 'Minion', label: 'Minion' },
  { id: 'Attributes', label: 'Attributes' },
  { id: 'Utility', label: 'Utility' },
];

/** Category icons mapping */
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'Offense': <Sword className="w-3 h-3" />,
  'Defense': <Shield className="w-3 h-3" />,
  'Life': <Heart className="w-3 h-3" />,
  'Energy Shield': <Zap className="w-3 h-3" />,
  'Minion': <Users className="w-3 h-3" />,
  'Attributes': <BarChart3 className="w-3 h-3" />,
  'Utility': <Settings className="w-3 h-3" />,
};

/** Category color tints for icon gallery ring accents */
const CATEGORY_RING_COLORS: Record<string, {
  border: string;
  borderHover: string;
  glow: string;
  glowHover: string;
  text: string;
  labelText: string;
  divider: string;
}> = {
  'Offense': {
    border: 'border-red-500/30',
    borderHover: 'group-hover:border-red-400/60',
    glow: 'shadow-[0_0_6px_rgba(239,68,68,0.12)]',
    glowHover: 'group-hover:shadow-[0_0_12px_rgba(239,68,68,0.3)]',
    text: 'text-red-300/70',
    labelText: 'text-red-400/80',
    divider: 'from-red-500/30',
  },
  'Defense': {
    border: 'border-sky-500/30',
    borderHover: 'group-hover:border-sky-400/60',
    glow: 'shadow-[0_0_6px_rgba(56,189,248,0.12)]',
    glowHover: 'group-hover:shadow-[0_0_12px_rgba(56,189,248,0.3)]',
    text: 'text-sky-300/70',
    labelText: 'text-sky-400/80',
    divider: 'from-sky-500/30',
  },
  'Life': {
    border: 'border-red-400/30',
    borderHover: 'group-hover:border-red-300/60',
    glow: 'shadow-[0_0_6px_rgba(248,113,113,0.12)]',
    glowHover: 'group-hover:shadow-[0_0_12px_rgba(248,113,113,0.3)]',
    text: 'text-red-300/70',
    labelText: 'text-red-400/70',
    divider: 'from-red-400/30',
  },
  'Energy Shield': {
    border: 'border-blue-400/30',
    borderHover: 'group-hover:border-blue-300/60',
    glow: 'shadow-[0_0_6px_rgba(96,165,250,0.12)]',
    glowHover: 'group-hover:shadow-[0_0_12px_rgba(96,165,250,0.3)]',
    text: 'text-blue-300/70',
    labelText: 'text-blue-400/70',
    divider: 'from-blue-400/30',
  },
  'Minion': {
    border: 'border-teal-500/30',
    borderHover: 'group-hover:border-teal-400/60',
    glow: 'shadow-[0_0_6px_rgba(20,184,166,0.12)]',
    glowHover: 'group-hover:shadow-[0_0_12px_rgba(20,184,166,0.3)]',
    text: 'text-teal-300/70',
    labelText: 'text-teal-400/80',
    divider: 'from-teal-500/30',
  },
  'Attributes': {
    border: 'border-amber-500/25',
    borderHover: 'group-hover:border-amber-400/50',
    glow: 'shadow-[0_0_6px_rgba(251,191,36,0.1)]',
    glowHover: 'group-hover:shadow-[0_0_12px_rgba(251,191,36,0.25)]',
    text: 'text-amber-300/70',
    labelText: 'text-amber-400/70',
    divider: 'from-amber-500/25',
  },
  'Utility': {
    border: 'border-slate-500/25',
    borderHover: 'group-hover:border-slate-400/50',
    glow: 'shadow-[0_0_6px_rgba(148,163,184,0.08)]',
    glowHover: 'group-hover:shadow-[0_0_10px_rgba(148,163,184,0.2)]',
    text: 'text-slate-400/70',
    labelText: 'text-slate-400/70',
    divider: 'from-slate-500/25',
  },
};

const DEFAULT_RING_COLORS = CATEGORY_RING_COLORS['Utility'];

function categorizeNotables(nodes: PassiveNode[]): Array<{ category: NotableCategory; items: PassiveNode[] }> {
  const buckets: Record<string, PassiveNode[]> = {};
  for (const category of NOTABLE_CATEGORIES) {
    buckets[category.id] = [];
  }

  for (const node of nodes) {
    const categories = notableCategories[node.name];
    if (categories && categories.length > 0) {
      for (const categoryId of categories) {
        if (buckets[categoryId]) {
          buckets[categoryId].push(node);
        }
      }
    } else {
      buckets['Utility'].push(node);
    }
  }

  return NOTABLE_CATEGORIES.map(category => ({
    category,
    items: buckets[category.id],
  })).filter(entry => entry.items.length > 0);
}

export function TreeVizTab({ tree, items }: TreeVizTabProps) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);
  const treeDiffNodes = useDesktopStore((s) => s.treeDiffNodes);
  const prevDiffRef = useRef<typeof treeDiffNodes>(null);
  const { nodeIconMap, spriteConfig, zoomLevel } = useSidebarSpriteData();
  const passiveIconMap = useMemo(() => {
    const merged = new Map(nodeIconMap);

    if (tree.nodeOverrides) {
      for (const override of Object.values(tree.nodeOverrides)) {
        const iconPath = getKnownTransformedNodeIconAlias(override.name) ?? override.icon;
        if (!override.name || !iconPath || merged.has(override.name)) {
          continue;
        }

        merged.set(override.name, {
          iconPath,
          // TreeNodeIcon will resolve the actual sprite sheet category if this guess is wrong.
          spriteCategory: 'keystoneActive',
        });
      }
    }

    return merged;
  }, [nodeIconMap, tree.nodeOverrides]);

  // Auto-open fullscreen tree when diff nodes change (including on first mount with diff already set)
  useEffect(() => {
    if (treeDiffNodes !== null && prevDiffRef.current !== treeDiffNodes) {
      setIsFullscreenOpen(true);
    }
    prevDiffRef.current = treeDiffNodes;
  }, [treeDiffNodes]);

  const equippedJewels = useMemo(() => {
    if (!items || items.length === 0) {
      return undefined;
    }
    return extractEquippedJewels(items);
  }, [items]);

  const showTooltip = useCallback((
    e: React.MouseEvent,
    node: PassiveNode,
    categoryStyle?: { headerText: string }
  ) => {
    if (!node.stats?.length) return;
    const rect = e.currentTarget.getBoundingClientRect();

    const tooltipHeight = 60 + (node.stats.length * 20);
    const tooltipWidth = 288;

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    let y: number;

    if (spaceBelow < tooltipHeight + 8 && spaceAbove > spaceBelow) {
      y = rect.top - tooltipHeight - 4;
    } else {
      y = rect.bottom + 4;
    }

    let x = rect.left;
    if (x + tooltipWidth > window.innerWidth - 8) {
      x = window.innerWidth - tooltipWidth - 8;
    }
    if (x < 8) {
      x = 8;
    }

    setTooltip({ node, x, y, categoryStyle });
  }, []);

  const hideTooltip = useCallback(() => setTooltip(null), []);

  const { metadata } = tree;

  const keystonesSource = tree.keystonesWithStats ?? tree.keystones;
  const notablesSource = tree.allNotablesWithStats ?? tree.allNotables;
  const ascendancyNodesSource = tree.ascendancyNodesWithStats ?? [];
  const keystones = normalizePassiveNodes(keystonesSource as string[] | PassiveNode[]);
  const allNotables = normalizePassiveNodes(notablesSource as string[] | PassiveNode[]);
  const ascendancyNodes = normalizePassiveNodes(ascendancyNodesSource as string[] | PassiveNode[]);
  const categorizedNotables = categorizeNotables(allNotables);

  // Resolved masteries from backend (name + stats)
  const masteries: PassiveNode[] = useMemo(() => {
    if (!tree.resolvedMasteries) return [];
    return tree.resolvedMasteries.map(m => ({ name: m.name, stats: m.stats }));
  }, [tree.resolvedMasteries]);

  // Transformed small nodes split by type
  const runecrafts = useMemo(() =>
    (tree.transformedSmallNodes ?? [])
      .filter(n => n.transformationType === 'runecraft')
      .map(n => ({ name: n.name, stats: n.stats, originalName: n.originalName })),
    [tree.transformedSmallNodes]
  );
  const tattoos = useMemo(() =>
    (tree.transformedSmallNodes ?? [])
      .filter(n => n.transformationType === 'tattoo')
      .map(n => ({ name: n.name, stats: n.stats, originalName: n.originalName })),
    [tree.transformedSmallNodes]
  );
  const timelessSmall = useMemo(() =>
    (tree.transformedSmallNodes ?? [])
      .filter(n => n.transformationType === 'timeless')
      .map(n => ({ name: n.name, stats: n.stats, originalName: n.originalName })),
    [tree.transformedSmallNodes]
  );

  return (
    <div className="flex flex-col h-full">

      {/* ─── Hero Header ─── */}
      <div className="flex-shrink-0 mb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              <h2 className="text-base font-display font-bold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-amber-200 to-amber-400 leading-tight truncate">
                {metadata.ascendancyName || metadata.className}
              </h2>
              {metadata.ascendancyName && (
                <p className="text-[0.625rem] text-slate-500 font-medium uppercase tracking-widest leading-tight truncate mt-0.5">
                  {metadata.className}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => setIsFullscreenOpen(true)}
            className={cn(
              'flex-shrink-0 h-7 px-2.5 rounded-lg flex items-center gap-1.5',
              'bg-gradient-to-br from-amber-500/15 to-amber-600/5',
              'border border-amber-500/30 hover:border-amber-400/60',
              'text-amber-400/70 hover:text-amber-300',
              'shadow-[0_0_12px_rgba(251,191,36,0.08)] hover:shadow-[0_0_20px_rgba(251,191,36,0.25)]',
              'transition-all duration-300',
              'group'
            )}
            title="View full passive tree"
          >
            <Maximize2 className="w-3.5 h-3.5 transition-transform duration-300 group-hover:scale-110" />
            <span className="text-[0.625rem] font-display font-semibold tracking-wide uppercase">Show Tree</span>
          </button>
        </div>

        {/* Inline stat bar */}
        <div className="flex items-center gap-3 mt-2 px-1 text-[0.6875rem] tabular-nums">
          <span className="text-slate-500">
            <span className="text-slate-300 font-medium">{metadata.totalNodes}</span> pts
          </span>
          <span className="w-px h-3 bg-slate-700/60" />
          <span className="text-slate-500">
            <span className="text-amber-400 font-medium">{metadata.keystoneCount}</span> keystone{metadata.keystoneCount !== 1 ? 's' : ''}
          </span>
          <span className="w-px h-3 bg-slate-700/60" />
          <span className="text-slate-500">
            <span className="text-slate-300 font-medium">{metadata.notableCount}</span> notable{metadata.notableCount !== 1 ? 's' : ''}
          </span>
          {masteries.length > 0 && (
            <>
              <span className="w-px h-3 bg-slate-700/60" />
              <span className="text-slate-500">
                <span className="text-violet-400 font-medium">{masteries.length}</span> master{masteries.length !== 1 ? 'ies' : 'y'}
              </span>
            </>
          )}
          {runecrafts.length > 0 && (
            <>
              <span className="w-px h-3 bg-slate-700/60" />
              <span className="text-slate-500">
                <span className="text-teal-400 font-medium">{runecrafts.length}</span> runecraft{runecrafts.length !== 1 ? 's' : ''}
              </span>
            </>
          )}
          {tattoos.length > 0 && (
            <>
              <span className="w-px h-3 bg-slate-700/60" />
              <span className="text-slate-500">
                <span className="text-cyan-400 font-medium">{tattoos.length}</span> tattoo{tattoos.length !== 1 ? 's' : ''}
              </span>
            </>
          )}
        </div>
      </div>

      {/* ─── Compact Tree Stats ─── */}
      {tree.treeStats && <CompactTreeStats treeStats={tree.treeStats} />}

      {/* Tree Diff Banner */}
      {treeDiffNodes && (
        <div className="flex items-center gap-2 px-3 py-2 mb-2 rounded bg-blue-950/30 border border-blue-500/30 flex-shrink-0">
          <span className="text-xs text-blue-300 flex-1">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 mr-1 align-middle" />{treeDiffNodes.added.length} added
            <span className="mx-1.5 text-slate-600">|</span>
            <span className="inline-block w-2 h-2 rounded-full bg-red-400 mr-1 align-middle" />{treeDiffNodes.removed.length} removed
          </span>
          <button
            onClick={() => setIsFullscreenOpen(true)}
            className="text-xs text-blue-400 hover:text-blue-300 underline whitespace-nowrap"
          >
            View
          </button>
          <button
            onClick={() => useDesktopStore.getState().setTreeDiffNodes(null)}
            className="text-xs text-slate-500 hover:text-slate-300 underline whitespace-nowrap"
          >
            Clear
          </button>
        </div>
      )}

      {/* ─── Scrollable content ─── */}
      <div className="flex flex-col gap-3 flex-1 overflow-y-auto scrollbar-fantasy pr-1">

        {/* ─── Ascendancy Nodes ─── */}
        {ascendancyNodes.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            <div className="section-embossed rounded-t px-2 py-1.5 mb-0">
              <div className="flex items-center gap-2">
                <Star className="w-3 h-3 text-amber-400 icon-glow-gold" />
                <span className="text-[0.625rem] font-display font-semibold uppercase tracking-widest text-amber-400/90">
                  Ascendancy
                </span>
                <span className="text-[0.625rem] text-slate-600">({ascendancyNodes.length})</span>
              </div>
            </div>
            <div className="card-forge rounded-b rounded-t-none px-2 py-2.5">
              <div className="flex flex-col gap-1.5">
                {ascendancyNodes.map((node, idx) => (
                  <AscendancyNodeRow
                    key={idx}
                    node={node}
                    index={idx}
                    nodeIconMap={passiveIconMap}
                    spriteConfig={spriteConfig}
                    zoomLevel={zoomLevel}
                    showTooltip={showTooltip}
                    hideTooltip={hideTooltip}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ─── Keystones ─── */}
        {keystones.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="section-embossed rounded-t px-2 py-1.5 mb-0">
              <div className="flex items-center gap-2">
                <Key className="w-3 h-3 text-amber-400/80" />
                <span className="text-[0.625rem] font-display font-semibold uppercase tracking-widest text-amber-400/80">
                  Keystones
                </span>
                <span className="text-[0.625rem] text-slate-600">({keystones.length})</span>
              </div>
            </div>
            <div className="card-forge rounded-b rounded-t-none px-2 py-2.5">
              <div className="flex flex-col gap-1.5">
                {keystones.map((keystone, idx) => (
                  <KeystoneRow
                    key={idx}
                    node={keystone}
                    index={idx}
                    nodeIconMap={passiveIconMap}
                    spriteConfig={spriteConfig}
                    zoomLevel={zoomLevel}
                    showTooltip={showTooltip}
                    hideTooltip={hideTooltip}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ─── Masteries ─── */}
        {masteries.length > 0 && (
          <MasteriesSection
            masteries={masteries}
            nodeIconMap={passiveIconMap}
            spriteConfig={spriteConfig}
            zoomLevel={zoomLevel}
            showTooltip={showTooltip}
            hideTooltip={hideTooltip}
          />
        )}

        {/* ─── Runecrafts ─── */}
        {runecrafts.length > 0 && (
          <TransformedNodesSection
            title="Runecrafts"
            nodes={runecrafts}
            defaultExpanded={true}
            icon={<Hexagon className="w-3 h-3 text-teal-400/80" />}
            fallbackIcon={<Hexagon className="w-3 h-3 text-teal-400/50" />}
            headerTextColor="text-teal-400/80"
            hoverBg="hover:bg-teal-500/5"
            borderColor="border-teal-500/30"
            borderHoverColor="group-hover:border-teal-400/55"
            glowColor="shadow-[0_0_6px_rgba(20,184,166,0.1)]"
            glowHoverColor="group-hover:shadow-[0_0_12px_rgba(20,184,166,0.25)]"
            nameColor="text-teal-400/70"
            tooltipHeaderColor="text-teal-300"
            nodeIconMap={passiveIconMap}
            spriteConfig={spriteConfig}
            zoomLevel={zoomLevel}
            showTooltip={showTooltip}
            hideTooltip={hideTooltip}
          />
        )}

        {/* ─── Tattoos ─── */}
        {tattoos.length > 0 && (
          <TransformedNodesSection
            title="Tattoos"
            nodes={tattoos}
            defaultExpanded={true}
            icon={<CircleDot className="w-3 h-3 text-cyan-400/80" />}
            fallbackIcon={<CircleDot className="w-3 h-3 text-cyan-400/50" />}
            headerTextColor="text-cyan-400/80"
            hoverBg="hover:bg-cyan-500/5"
            borderColor="border-cyan-500/30"
            borderHoverColor="group-hover:border-cyan-400/55"
            glowColor="shadow-[0_0_6px_rgba(6,182,212,0.1)]"
            glowHoverColor="group-hover:shadow-[0_0_12px_rgba(6,182,212,0.25)]"
            nameColor="text-cyan-400/70"
            tooltipHeaderColor="text-cyan-300"
            originalLabel="replaced"
            nodeIconMap={passiveIconMap}
            spriteConfig={spriteConfig}
            zoomLevel={zoomLevel}
            showTooltip={showTooltip}
            hideTooltip={hideTooltip}
          />
        )}

        {/* ─── Timeless Passives ─── */}
        {timelessSmall.length > 0 && (
          <TransformedNodesSection
            title="Timeless Passives"
            nodes={timelessSmall}
            defaultExpanded={false}
            icon={<Sparkles className="w-3 h-3 text-amber-400/80" />}
            fallbackIcon={<Sparkles className="w-3 h-3 text-amber-400/50" />}
            headerTextColor="text-amber-400/80"
            hoverBg="hover:bg-amber-500/5"
            borderColor="border-amber-500/30"
            borderHoverColor="group-hover:border-amber-400/55"
            glowColor="shadow-[0_0_6px_rgba(251,191,36,0.1)]"
            glowHoverColor="group-hover:shadow-[0_0_12px_rgba(251,191,36,0.25)]"
            nameColor="text-amber-400/70"
            tooltipHeaderColor="text-amber-300"
            originalLabel="was"
            nodeIconMap={passiveIconMap}
            spriteConfig={spriteConfig}
            zoomLevel={zoomLevel}
            showTooltip={showTooltip}
            hideTooltip={hideTooltip}
          />
        )}

        {/* ─── Anoints ─── */}
        {tree.anoints && tree.anoints.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
          >
            <div className="section-embossed rounded-t px-2 py-1.5 mb-0">
              <div className="flex items-center gap-2">
                <Droplets className="w-3 h-3 text-emerald-400/80" />
                <span className="text-[0.625rem] font-display font-semibold uppercase tracking-widest text-emerald-400/80">
                  Anointed
                </span>
                <span className="text-[0.625rem] text-slate-600">({tree.anoints.length})</span>
              </div>
            </div>
            <div className="card-forge rounded-b rounded-t-none px-2 py-2.5">
              <div className="flex flex-col gap-1.5">
                {tree.anoints.map((anoint, idx) => {
                  const iconInfo = passiveIconMap.get(anoint.name);
                  return (
                    <div
                      key={idx}
                      className="group flex items-center gap-2.5 px-1.5 py-1 rounded hover:bg-emerald-500/[0.04] transition-colors cursor-default"
                      onMouseEnter={(e) => {
                        if (anoint.stats?.length) {
                          showTooltip(e, { name: anoint.name, stats: anoint.stats });
                        }
                      }}
                      onMouseLeave={hideTooltip}
                    >
                      <div className="flex-shrink-0">
                        <div className={cn(
                          'w-7 h-7 rounded-full overflow-hidden',
                          'border border-emerald-500/30 group-hover:border-emerald-400/55',
                          'bg-gradient-to-br from-slate-900 to-slate-950',
                          'shadow-[0_0_6px_rgba(52,211,153,0.1)]',
                          'group-hover:shadow-[0_0_12px_rgba(52,211,153,0.25)]',
                          'transition-all duration-300',
                          'flex items-center justify-center',
                        )}>
                          {iconInfo && spriteConfig ? (
                            <TreeNodeIcon
                              iconPath={iconInfo.iconPath}
                              spriteCategory={iconInfo.spriteCategory}
                              spriteConfig={spriteConfig}
                              zoomLevel={zoomLevel}
                              size={20}
                            />
                          ) : (
                            <Droplets className="w-3 h-3 text-emerald-400/50" />
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[0.6875rem] text-slate-200 leading-tight truncate">
                          {anoint.name}
                        </span>
                        <span className="text-[0.5625rem] text-emerald-400/50 leading-tight">
                          via {anoint.slot}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

        {/* ─── Notables ─── */}
        {categorizedNotables.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <div className="section-embossed rounded-t px-2 py-1.5 mb-0">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Sparkles className="w-3 h-3 text-slate-400" />
                <span className="text-[0.625rem] font-display font-semibold uppercase tracking-widest text-slate-400">
                  Notables
                </span>
                <span className="text-[0.625rem] text-slate-600">({allNotables.length})</span>
              </div>
            </div>
            <div className="card-forge rounded-b rounded-t-none">
              <NotablesGallery
                categorizedNotables={categorizedNotables}
                nodeIconMap={passiveIconMap}
                spriteConfig={spriteConfig}
                zoomLevel={zoomLevel}
                showTooltip={showTooltip}
                hideTooltip={hideTooltip}
              />
            </div>
          </motion.div>
        )}

        {/* Empty state */}
        {metadata.totalNodes === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <TreeDeciduous className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No tree data available</p>
          </div>
        )}
      </div>

      {/* Portal tooltip */}
      {tooltip && tooltip.node.stats && createPortal(
        <div
          style={{
            position: 'fixed',
            left: tooltip.x,
            top: tooltip.y,
            zIndex: 9999,
          }}
          className="pointer-events-none"
        >
          <div className="card-forge card-forge-opaque rounded-lg p-3 w-72 text-sm shadow-xl shadow-black/60">
            <div className={cn(
              'font-display font-medium mb-1.5 border-b border-slate-700/40 pb-1.5',
              tooltip.categoryStyle?.headerText ?? 'text-amber-300'
            )}>
              {tooltip.node.name}
            </div>
            {tooltip.node.stats.map((stat, i) => (
              <div key={i} className="text-slate-400 text-xs leading-relaxed">{stat}</div>
            ))}
          </div>
        </div>,
        document.body
      )}

      {/* Fullscreen Tree Modal */}
      <TreeFullscreenModal
        isOpen={isFullscreenOpen}
        onClose={() => setIsFullscreenOpen(false)}
        allocatedNodes={tree.nodes}
        grantedNodeIds={tree.anoints?.flatMap((anoint) => typeof anoint.nodeId === 'number' ? [anoint.nodeId] : []) ?? []}
        className={metadata.className}
        ascendancyName={metadata.ascendancyName}
        equippedJewels={equippedJewels}
        masterySelections={tree.masterySelections}
        clusterNodes={tree.clusterNodes}
        nodeOverrides={tree.nodeOverrides}
        timelessBySocket={tree.timelessBySocket}
      />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
 * Sub-components
 * ──────────────────────────────────────────────────────────── */

/** Shared sub-component prop types */
interface IconNodeProps {
  node: PassiveNode;
  index: number;
  nodeIconMap: Map<string, { iconPath: string; spriteCategory: string }>;
  spriteConfig: ReturnType<typeof useSidebarSpriteData>['spriteConfig'];
  zoomLevel: string;
  showTooltip: (e: React.MouseEvent, node: PassiveNode, style?: { headerText: string }) => void;
  hideTooltip: () => void;
}

/** Ascendancy node — horizontal row with circular icon, name, and first stat preview */
function AscendancyNodeRow({
  node, index, nodeIconMap, spriteConfig, zoomLevel, showTooltip, hideTooltip,
}: IconNodeProps) {
  const iconInfo = nodeIconMap.get(node.name);
  const previewStat = node.stats?.[0];

  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        'flex items-center gap-2.5 px-2 py-1.5 rounded-md group',
        'hover:bg-amber-500/5',
        'transition-all duration-200',
        node.stats && node.stats.length > 0 ? 'cursor-help' : 'cursor-default'
      )}
      onMouseEnter={(e) => showTooltip(e, node, { headerText: 'text-amber-300' })}
      onMouseLeave={hideTooltip}
    >
      {/* Circular icon with amber ring */}
      <div className="relative flex-shrink-0">
        <div className={cn(
          'w-8 h-8 rounded-full overflow-hidden',
          'border border-amber-500/35 group-hover:border-amber-400/60',
          'bg-gradient-to-br from-slate-900 to-slate-950',
          'shadow-[0_0_8px_rgba(251,191,36,0.12)]',
          'group-hover:shadow-[0_0_14px_rgba(251,191,36,0.25)]',
          'transition-all duration-300',
          'flex items-center justify-center',
        )}>
          {iconInfo && spriteConfig ? (
            <TreeNodeIcon
              iconPath={iconInfo.iconPath}
              spriteCategory={iconInfo.spriteCategory}
              spriteConfig={spriteConfig}
              zoomLevel={zoomLevel}
              size={24}
            />
          ) : (
            <Star className="w-3.5 h-3.5 text-amber-400/50" />
          )}
        </div>
      </div>
      {/* Name + stat preview */}
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-amber-300/90 group-hover:text-amber-200 truncate transition-colors">
          {node.name}
        </div>
        {previewStat && (
          <div className="text-[0.625rem] text-slate-500 truncate mt-0.5 leading-tight">
            {previewStat}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/** Keystone row — same layout as ascendancy but square icon */
function KeystoneRow({
  node, index, nodeIconMap, spriteConfig, zoomLevel, showTooltip, hideTooltip,
}: IconNodeProps) {
  const iconInfo = nodeIconMap.get(node.name);
  const previewStat = node.stats?.[0];

  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        'flex items-center gap-2.5 px-2 py-1.5 rounded-md group',
        'hover:bg-amber-500/5',
        'transition-all duration-200',
        node.stats && node.stats.length > 0 ? 'cursor-help' : 'cursor-default'
      )}
      onMouseEnter={(e) => showTooltip(e, node, { headerText: 'text-amber-300' })}
      onMouseLeave={hideTooltip}
    >
      <div className="relative flex-shrink-0">
        <div className={cn(
          'w-8 h-8 rounded-md overflow-hidden',
          'border border-amber-500/25 group-hover:border-amber-400/50',
          'bg-gradient-to-br from-slate-800 to-slate-900',
          'shadow-[0_0_8px_rgba(251,191,36,0.1)]',
          'group-hover:shadow-[0_0_14px_rgba(251,191,36,0.25)]',
          'transition-all duration-300',
          'flex items-center justify-center',
        )}>
          {iconInfo && spriteConfig ? (
            <TreeNodeIcon
              iconPath={iconInfo.iconPath}
              spriteCategory={iconInfo.spriteCategory}
              spriteConfig={spriteConfig}
              zoomLevel={zoomLevel}
              size={24}
            />
          ) : (
            <Key className="w-3.5 h-3.5 text-amber-400/50" />
          )}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-amber-300/90 group-hover:text-amber-200 truncate transition-colors">
          {node.name}
        </div>
        {previewStat && (
          <div className="text-[0.625rem] text-slate-500 truncate mt-0.5 leading-tight">
            {previewStat}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/** Masteries section — collapsible, shows mastery type icon + selected effect stats */
function MasteriesSection({
  masteries,
  nodeIconMap,
  spriteConfig,
  zoomLevel,
  showTooltip,
  hideTooltip,
}: {
  masteries: PassiveNode[];
  nodeIconMap: Map<string, { iconPath: string; spriteCategory: string }>;
  spriteConfig: ReturnType<typeof useSidebarSpriteData>['spriteConfig'];
  zoomLevel: string;
  showTooltip: (e: React.MouseEvent, node: PassiveNode, style?: { headerText: string }) => void;
  hideTooltip: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12 }}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'w-full section-embossed rounded-t px-2 py-1.5 mb-0',
          'flex items-center gap-2',
          'hover:brightness-110',
          'transition-all duration-100'
        )}
      >
        <CircleDot className="w-3 h-3 text-violet-400/80" />
        <span className="text-[0.625rem] font-display font-semibold uppercase tracking-widest text-violet-400/80">
          Masteries
        </span>
        <span className="text-[0.625rem] text-slate-600">({masteries.length})</span>
        <div className="flex-1" />
        <ChevronDown className={cn(
          'w-3 h-3 text-slate-600 transition-transform duration-200',
          isExpanded && 'rotate-180'
        )} />
      </button>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="card-forge rounded-b rounded-t-none px-2 py-2">
              <div className="flex flex-col gap-1">
                {masteries.map((mastery, idx) => {
                  const iconInfo = nodeIconMap.get(mastery.name);
                  return (
                    <div
                      key={idx}
                      className={cn(
                        'flex items-center gap-2.5 px-2 py-1.5 rounded-md group',
                        'hover:bg-violet-500/5',
                        'transition-colors duration-150',
                        mastery.stats && mastery.stats.length > 0 ? 'cursor-help' : 'cursor-default'
                      )}
                      onMouseEnter={(e) => showTooltip(e, mastery, { headerText: 'text-violet-300' })}
                      onMouseLeave={hideTooltip}
                    >
                      {/* Mastery icon or fallback dot */}
                      <div className="flex-shrink-0">
                        <div className={cn(
                          'w-7 h-7 rounded-full overflow-hidden',
                          'border border-violet-500/30 group-hover:border-violet-400/55',
                          'bg-gradient-to-br from-slate-900 to-slate-950',
                          'shadow-[0_0_6px_rgba(167,139,250,0.1)]',
                          'group-hover:shadow-[0_0_12px_rgba(167,139,250,0.25)]',
                          'transition-all duration-300',
                          'flex items-center justify-center',
                        )}>
                          {iconInfo && spriteConfig ? (
                            <TreeNodeIcon
                              iconPath={iconInfo.iconPath}
                              spriteCategory={iconInfo.spriteCategory}
                              spriteConfig={spriteConfig}
                              zoomLevel={zoomLevel}
                              size={20}
                            />
                          ) : (
                            <CircleDot className="w-3 h-3 text-violet-400/50" />
                          )}
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[0.625rem] text-violet-400/70 font-medium mb-0.5">
                          {mastery.name}
                        </div>
                        {mastery.stats && mastery.stats.length > 0 && (
                          <div className="text-[0.6875rem] text-slate-400 leading-snug truncate">
                            {mastery.stats[0]}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/** Transformed small nodes section — reusable collapsible for runecrafts, tattoos, timeless */
interface TransformedNode {
  name: string;
  stats: string[];
  originalName?: string;
}

function TransformedNodesSection({
  title,
  nodes,
  defaultExpanded,
  icon,
  fallbackIcon,
  headerTextColor,
  hoverBg,
  borderColor,
  borderHoverColor,
  glowColor,
  glowHoverColor,
  nameColor,
  tooltipHeaderColor,
  originalLabel,
  nodeIconMap,
  spriteConfig,
  zoomLevel,
  showTooltip,
  hideTooltip,
}: {
  title: string;
  nodes: TransformedNode[];
  defaultExpanded: boolean;
  icon: React.ReactNode;
  fallbackIcon: React.ReactNode;
  headerTextColor: string;
  hoverBg: string;
  borderColor: string;
  borderHoverColor: string;
  glowColor: string;
  glowHoverColor: string;
  nameColor: string;
  tooltipHeaderColor: string;
  originalLabel?: string;
  nodeIconMap: Map<string, { iconPath: string; spriteCategory: string }>;
  spriteConfig: ReturnType<typeof useSidebarSpriteData>['spriteConfig'];
  zoomLevel: string;
  showTooltip: (e: React.MouseEvent, node: PassiveNode, style?: { headerText: string }) => void;
  hideTooltip: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12 }}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'w-full section-embossed rounded-t px-2 py-1.5 mb-0',
          'flex items-center gap-2',
          'hover:brightness-110',
          'transition-all duration-100'
        )}
      >
        {icon}
        <span className={cn('text-[0.625rem] font-display font-semibold uppercase tracking-widest', headerTextColor)}>
          {title}
        </span>
        <span className="text-[0.625rem] text-slate-600">({nodes.length})</span>
        <div className="flex-1" />
        <ChevronDown className={cn(
          'w-3 h-3 text-slate-600 transition-transform duration-200',
          isExpanded && 'rotate-180'
        )} />
      </button>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="card-forge rounded-b rounded-t-none px-2 py-2">
              <div className="flex flex-col gap-1">
                {nodes.map((node, idx) => {
                  const iconInfo = nodeIconMap.get(node.name);
                  return (
                    <div
                      key={idx}
                      className={cn(
                        'flex items-center gap-2.5 px-2 py-1.5 rounded-md group',
                        hoverBg,
                        'transition-colors duration-150',
                        node.stats.length > 0 ? 'cursor-help' : 'cursor-default'
                      )}
                      onMouseEnter={(e) => showTooltip(e, { name: node.name, stats: node.stats }, { headerText: tooltipHeaderColor })}
                      onMouseLeave={hideTooltip}
                    >
                      {/* Node icon or fallback */}
                      <div className="flex-shrink-0">
                        <div className={cn(
                          'w-7 h-7 rounded-full overflow-hidden',
                          'border', borderColor, borderHoverColor,
                          'bg-gradient-to-br from-slate-900 to-slate-950',
                          glowColor,
                          glowHoverColor,
                          'transition-all duration-300',
                          'flex items-center justify-center',
                        )}>
                          {iconInfo && spriteConfig ? (
                            <TreeNodeIcon
                              iconPath={iconInfo.iconPath}
                              spriteCategory={iconInfo.spriteCategory}
                              spriteConfig={spriteConfig}
                              zoomLevel={zoomLevel}
                              size={20}
                            />
                          ) : (
                            fallbackIcon
                          )}
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className={cn('text-[0.625rem] font-medium mb-0.5', nameColor)}>
                          {node.name}
                        </div>
                        {node.stats.length > 0 && (
                          <div className="text-[0.6875rem] text-slate-400 leading-snug truncate">
                            {node.stats[0]}
                          </div>
                        )}
                        {node.originalName && (
                          <span className="text-[0.5625rem] text-slate-600 italic">
                            {originalLabel ?? 'was'}: {node.originalName}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/** Compact tree stats panel — shows key offensive and defensive stats from tree */
function CompactTreeStats({ treeStats }: { treeStats: NonNullable<BuildVisualizationResponse['tree']['treeStats']> }) {
  const defenseStats = [
    { label: 'Life', value: treeStats.lifeInc, color: 'text-red-400' },
    { label: 'ES', value: treeStats.esInc, color: 'text-blue-400' },
    { label: 'Armour', value: treeStats.armourInc, color: 'text-amber-400/90' },
    { label: 'Eva', value: treeStats.evasionInc, color: 'text-green-400/90' },
    { label: 'Block', value: treeStats.blockBase, color: 'text-slate-300' },
    { label: 'Supp', value: treeStats.spellSuppressBase, color: 'text-violet-400' },
  ].filter(s => s.value > 0);

  const offenseStats = [
    { label: 'Dmg', value: treeStats.damageInc, color: 'text-orange-400' },
    { label: 'Crit', value: treeStats.critChanceInc, color: 'text-yellow-300' },
    { label: 'CritM', value: treeStats.critMultiBase, color: 'text-yellow-400' },
    { label: 'DoT', value: treeStats.dotMultiBase, color: 'text-emerald-400' },
    { label: 'ASpd', value: treeStats.attackSpeedInc, color: 'text-cyan-400' },
    { label: 'CSpd', value: treeStats.castSpeedInc, color: 'text-indigo-400' },
  ].filter(s => s.value > 0);

  if (defenseStats.length === 0 && offenseStats.length === 0) return null;

  return (
    <div className="flex-shrink-0 mb-2 mt-1 px-1">
      <div className="rounded-lg bg-slate-900/40 border border-slate-800/50 px-2.5 py-2 space-y-1.5">
        {/* Defense row */}
        {defenseStats.length > 0 && (
          <div className="flex items-center gap-1">
            <Shield className="w-2.5 h-2.5 text-slate-600 flex-shrink-0" />
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
              {defenseStats.map(s => (
                <span key={s.label} className="text-[0.625rem] tabular-nums whitespace-nowrap">
                  <span className={cn(s.color, 'font-medium')}>+{s.value}%</span>
                  <span className="text-slate-600 ml-0.5">{s.label}</span>
                </span>
              ))}
            </div>
          </div>
        )}
        {/* Offense row */}
        {offenseStats.length > 0 && (
          <div className="flex items-center gap-1">
            <Sword className="w-2.5 h-2.5 text-slate-600 flex-shrink-0" />
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
              {offenseStats.map(s => (
                <span key={s.label} className="text-[0.625rem] tabular-nums whitespace-nowrap">
                  <span className={cn(s.color, 'font-medium')}>+{s.value}%</span>
                  <span className="text-slate-600 ml-0.5">{s.label}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Icon gallery view for notables — grouped by category with colored ring tints */
function NotablesGallery({
  categorizedNotables,
  nodeIconMap,
  spriteConfig,
  zoomLevel,
  showTooltip,
  hideTooltip,
}: {
  categorizedNotables: Array<{ category: NotableCategory; items: PassiveNode[] }>;
  nodeIconMap: Map<string, { iconPath: string; spriteCategory: string }>;
  spriteConfig: ReturnType<typeof useSidebarSpriteData>['spriteConfig'];
  zoomLevel: string;
  showTooltip: (e: React.MouseEvent, node: PassiveNode, style?: { headerText: string }) => void;
  hideTooltip: () => void;
}) {
  return (
    <div className="py-2">
      {categorizedNotables.map(({ category, items }, catIdx) => {
        const colors = CATEGORY_RING_COLORS[category.id] ?? DEFAULT_RING_COLORS;
        return (
          <div key={category.id}>
            {/* Category divider label */}
            <div className="flex items-center gap-2 px-3 py-1.5">
              <div className={cn(
                'h-px flex-1 bg-gradient-to-r to-transparent',
                colors.divider
              )} />
              <span className="flex items-center gap-1.5">
                <span className={cn('opacity-60', colors.labelText)}>{CATEGORY_ICONS[category.id]}</span>
                <span className={cn('text-[0.5625rem] font-display font-semibold uppercase tracking-[0.15em]', colors.labelText)}>
                  {category.label}
                </span>
                <span className="text-[0.5625rem] text-slate-600 tabular-nums">{items.length}</span>
              </span>
              <div className={cn(
                'h-px flex-1 bg-gradient-to-l to-transparent',
                colors.divider
              )} />
            </div>
            {/* Icon grid */}
            <div className="flex flex-wrap gap-2 px-3 pb-2 justify-center">
              {items.map((notable, idx) => (
                <NotableIconCell
                  key={`${category.id}-${idx}`}
                  node={notable}
                  categoryId={category.id}
                  index={idx}
                  isFirstCategory={catIdx === 0}
                  nodeIconMap={nodeIconMap}
                  spriteConfig={spriteConfig}
                  zoomLevel={zoomLevel}
                  showTooltip={showTooltip}
                  hideTooltip={hideTooltip}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Individual notable icon in the gallery — circular with category-colored ring */
function NotableIconCell({
  node,
  categoryId,
  index,
  isFirstCategory,
  nodeIconMap,
  spriteConfig,
  zoomLevel,
  showTooltip,
  hideTooltip,
}: {
  node: PassiveNode;
  categoryId: string;
  index: number;
  isFirstCategory: boolean;
  nodeIconMap: Map<string, { iconPath: string; spriteCategory: string }>;
  spriteConfig: ReturnType<typeof useSidebarSpriteData>['spriteConfig'];
  zoomLevel: string;
  showTooltip: (e: React.MouseEvent, node: PassiveNode, style?: { headerText: string }) => void;
  hideTooltip: () => void;
}) {
  const iconInfo = nodeIconMap.get(node.name);
  const colors = CATEGORY_RING_COLORS[categoryId] ?? DEFAULT_RING_COLORS;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        delay: isFirstCategory ? index * 0.02 : 0,
        duration: 0.2,
      }}
      className={cn(
        'group flex flex-col items-center gap-1',
        node.stats && node.stats.length > 0 ? 'cursor-help' : 'cursor-default'
      )}
      onMouseEnter={(e) => showTooltip(e, node, { headerText: colors.text.replace('/70', '') })}
      onMouseLeave={hideTooltip}
    >
      {/* Icon circle with category-tinted ring */}
      <div className={cn(
        'w-8 h-8 rounded-full overflow-hidden',
        'border',
        colors.border,
        colors.borderHover,
        'bg-gradient-to-br from-slate-900 to-slate-950',
        colors.glow,
        colors.glowHover,
        'transition-all duration-250',
        'flex items-center justify-center',
      )}>
        {iconInfo && spriteConfig ? (
          <TreeNodeIcon
            iconPath={iconInfo.iconPath}
            spriteCategory={iconInfo.spriteCategory}
            spriteConfig={spriteConfig}
            zoomLevel={zoomLevel}
            size={22}
          />
        ) : (
          <Sparkles className="w-3 h-3 text-slate-500" />
        )}
      </div>
      {/* Name */}
      <span className={cn(
        'text-[0.5rem] text-center leading-tight max-w-[52px] truncate',
        'text-slate-500 group-hover:text-slate-300',
        'transition-colors duration-200',
      )}>
        {node.name}
      </span>
    </motion.div>
  );
}

export default TreeVizTab;
