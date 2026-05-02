/**
 * TreePill Component
 *
 * Renders a tree package reference (TR1, TR2...) as an inline pill with:
 * - Click: highlights added/removed nodes on the tree canvas + switches to tree tab
 * - Hover: Radix tooltip showing node counts, DPS/EHP deltas, and label
 *
 * Falls back to a plain pill (no tooltip) if no tree data is found in the store.
 */

import type { ReactNode } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Network } from 'lucide-react';
import { useTreePackage, type TreePackageData } from '../../store/treePackageStore';
import { useDesktopStore } from '../../store';
import { navigateToRef, navigateToRefCrossTab } from '../../utils/navigate-to-ref';
import { ItemTooltip } from '../visualization/ItemTooltip';

interface TreePillProps {
  packageRef: string;
  children: ReactNode;
}

const PILL_CLASS = [
  'inline-flex items-center gap-1 cursor-pointer',
  'px-2 py-0.5 rounded-full text-[0.6875rem] font-medium leading-tight',
  'text-purple-300 bg-purple-900/25 border border-purple-600/35',
  'hover:bg-purple-800/35 hover:text-purple-200 hover:border-purple-500/50',
  'hover:[box-shadow:0_0_8px_rgba(168,85,247,0.18)]',
  'transition-all duration-200',
].join(' ');

function handleClick(
  ref: string,
  addNodes?: number[],
  removeNodes?: number[],
  clusterSubgraph?: TreePackageData['clusterSubgraph'],
) {
  if (addNodes?.length || removeNodes?.length) {
    // Match exact behavior of ToolStepCard "Show on Tree" button
    const store = useDesktopStore.getState();
    store.setTreeDiffNodes({
      added: addNodes ?? [],
      removed: removeNodes ?? [],
    });
    // For cluster-jewel suggestions, also push the captured subgraph so the
    // canvas can render the full "wheel" (smalls + notables + mastery +
    // internal ring links). Tree-change / non-cluster pills clear the preview
    // to avoid leaving a stale cluster from a previous click.
    store.setTreePreviewClusterNodes(clusterSubgraph ?? null);
    store.setActiveUnifiedTab('tree');
  } else {
    // Fallback: navigate to the tool result card (no node data available)
    if (!navigateToRef(ref)) {
      navigateToRefCrossTab(ref);
    }
  }
}

export function TreePill({ packageRef, children }: TreePillProps) {
  const pkg = useTreePackage(packageRef);

  const hasNodes = pkg && (pkg.addNodes.length > 0 || pkg.removeNodes.length > 0);

  const pill = (
    <span
      role="button"
      tabIndex={0}
      className={PILL_CLASS}
      onClick={() => handleClick(packageRef, pkg?.addNodes, pkg?.removeNodes, pkg?.clusterSubgraph)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') handleClick(packageRef, pkg?.addNodes, pkg?.removeNodes, pkg?.clusterSubgraph);
      }}
    >
      <Network className="w-2.5 h-2.5 flex-shrink-0 opacity-60" />
      {children}
    </span>
  );

  // No data available — render plain pill (still clickable for navigation)
  if (!pkg) {
    return pill;
  }

  return (
    <Tooltip.Provider delayDuration={300}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{pill}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="top"
            sideOffset={8}
            className="z-[9999] animate-in fade-in-0 zoom-in-95 duration-150"
            collisionPadding={12}
          >
            <div className="bg-[#0c0c0e] border border-purple-500/25 rounded-lg p-2.5 shadow-xl max-w-[280px]">
              {/* Stat deltas */}
              {(pkg.dps?.pct || pkg.ehp?.pct) && (
                <div className="flex items-center gap-3 mb-1.5 text-xs font-mono">
                  {pkg.dps?.pct && (
                    <span className={parsePct(pkg.dps.pct) >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                      {pkg.dps.pct} DPS
                    </span>
                  )}
                  {pkg.ehp?.pct && (
                    <span className={parsePct(pkg.ehp.pct) >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                      {pkg.ehp.pct} EHP
                    </span>
                  )}
                </div>
              )}

              {/* Jewel item tooltip — shows mods alongside DPS/EHP */}
              {pkg.jewelText ? (() => {
                const jh = parseJewelHeader(pkg.jewelText);
                return (
                  <ItemTooltip
                    name={jh.name}
                    baseName={jh.baseName}
                    rarity={jh.rarity}
                    mods={jh.mods}
                    raw={pkg.jewelText}
                  />
                );
              })() : (
                <>
                  {/* Label (only when no jewel item card) */}
                  <div className="text-[0.6875rem] font-medium text-purple-200 mb-1.5 leading-snug">
                    {pkg.label || packageRef}
                  </div>

                  {/* Node counts */}
                  <div className="flex items-center gap-3 text-[0.625rem]">
                    {pkg.addNodes.length > 0 && (
                      <span className="flex items-center gap-1 text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/80" />
                        +{pkg.addNodes.length} node{pkg.addNodes.length !== 1 ? 's' : ''}
                      </span>
                    )}
                    {pkg.removeNodes.length > 0 && (
                      <span className="flex items-center gap-1 text-red-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400/80" />
                        -{pkg.removeNodes.length} node{pkg.removeNodes.length !== 1 ? 's' : ''}
                      </span>
                    )}
                    {pkg.pointCost != null && (
                      <span className="text-slate-400">
                        {pkg.pointCost > 0 ? '+' : ''}{pkg.pointCost}pt
                      </span>
                    )}
                  </div>
                </>
              )}

              {/* Click hint */}
              {hasNodes && (
                <div className="mt-1.5 text-[0.5625rem] text-slate-500 italic">
                  Click to show on tree
                </div>
              )}
            </div>
            <Tooltip.Arrow className="fill-[#0c0c0e]" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

function parsePct(pct: string | undefined): number {
  if (!pct) return 0;
  const cleaned = pct.replace(/[^-+.\d]/g, '');
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

/** Parse name, base, rarity, and mods from raw PoB jewel item text. */
function parseJewelHeader(itemText: string): {
  name: string; baseName: string; rarity: string;
  mods?: { implicits: Array<{ text: string; affixType: string; type: string }>; explicits: Array<{ text: string; affixType: string; type: string }>; crafted: Array<{ text: string; affixType: string; type: string }>; enchants: Array<{ text: string; affixType: string; type: string }> };
} {
  const lines = itemText.split('\n').map(l => l.trim()).filter(Boolean);
  let rarity = 'RARE';
  const rarityLine = lines.find(l => l.toLowerCase().startsWith('rarity:'));
  if (rarityLine) {
    const r = rarityLine.split(':')[1]?.trim().toUpperCase() ?? 'RARE';
    if (['NORMAL', 'MAGIC', 'RARE', 'UNIQUE'].includes(r)) rarity = r;
  }
  const rarityIdx = lines.findIndex(l => l.toLowerCase().startsWith('rarity:'));
  const name = rarityIdx >= 0 && rarityIdx + 1 < lines.length ? lines[rarityIdx + 1] : '';
  const baseName = rarityIdx >= 0 && rarityIdx + 2 < lines.length ? lines[rarityIdx + 2] : name;

  // Parse mods from Implicits: N format
  const implicitCountLine = lines.find(l => l.startsWith('Implicits:'));
  if (!implicitCountLine) return { name, baseName, rarity };

  const implicits: Array<{ text: string; affixType: string; type: string }> = [];
  const explicits: Array<{ text: string; affixType: string; type: string }> = [];
  const crafted: Array<{ text: string; affixType: string; type: string }> = [];
  const skipSet = new Set(['Corrupted', 'Shaper Item', 'Elder Item', 'Crusader Item', 'Hunter Item', 'Redeemer Item', 'Warlord Item']);

  const count = parseInt(implicitCountLine.replace('Implicits:', '').trim(), 10) || 0;
  const idx = lines.indexOf(implicitCountLine);
  for (let j = 1; j <= count && idx + j < lines.length; j++) {
    const cleanText = lines[idx + j].replace(/\{tags:[^}]+\}/g, '').trim();
    if (cleanText) implicits.push({ text: cleanText, affixType: 'unknown', type: 'implicit' });
  }
  const explicitStart = idx + 1 + count;
  for (let j = explicitStart; j < lines.length; j++) {
    const line = lines[j];
    if (skipSet.has(line) || line.startsWith('Item Level:') || line.startsWith('LevelReq:') || line.startsWith('Sockets:') || line.startsWith('Quality:')) continue;
    if (line.startsWith('{crafted}')) {
      crafted.push({ text: line.replace('{crafted}', '').trim(), affixType: 'unknown', type: 'crafted' });
    } else if (line.startsWith('{')) {
      continue;
    } else {
      explicits.push({ text: line, affixType: 'unknown', type: 'explicit' });
    }
  }

  return { name, baseName, rarity, mods: { implicits, explicits, crafted, enchants: [] } };
}
