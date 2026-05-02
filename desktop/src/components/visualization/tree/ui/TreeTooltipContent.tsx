import { cn } from '../../../../lib/utils';
import type { TreeNode } from '../hooks/useTreeData';
import type { JewelGrantedEffect } from '../utils/jewel-radius-effects';

// =============================================================================
// Types
// =============================================================================

/**
 * Mastery effect data structure
 */
export interface MasteryEffect {
  effect: number;
  stats: string[];
  reminderText?: string[];
}

/**
 * Socketed jewel information for tooltip display
 */
export interface SocketedJewelInfo {
  /** Jewel name (e.g., "Thread of Hope", "Elegant Hubris") */
  name: string;
  /** Base type (e.g., "Crimson Jewel", "Timeless Jewel") */
  baseName: string;
  /** Optional item icon URL for rendering socketed jewel indicators */
  iconUrl?: string;
  /** Jewel rarity (NORMAL, MAGIC, RARE, UNIQUE) */
  rarity?: string;
  /** Whether this is a timeless jewel */
  isTimeless?: boolean;
  /** Whether this is Thread of Hope */
  isThreadOfHope?: boolean;
  /** Implicit mod lines (e.g. corrupted jewel implicits like "Corrupted Blood cannot be inflicted on you") */
  implicitStats?: string[];
  /** Explicit + crafted mod lines. Implicits are tracked separately in `implicitStats`. */
  stats?: string[];
  /** Radius label (Small, Medium, Large, Variable) */
  radiusLabel?: string;
  /** Radius index from PoB data.jewelRadius */
  radiusIndex?: number;
  /** Keystone targeted by Impossible Escape, if present */
  impossibleEscapeKeystoneName?: string;
  /** Whether this is a cluster jewel */
  isClusterJewel?: boolean;
  /** Cluster jewel size (large, medium, small) */
  clusterSize?: 'large' | 'medium' | 'small';
}

/**
 * Summary of a cluster jewel notable for tooltip display
 */
export interface ClusterNotableSummary {
  name: string;
  stats: string[];
}

/**
 * Cluster jewel structural info for rich socket tooltips
 */
export interface ClusterJewelDetails {
  /** Total passive count (e.g. "Adds 5 Passive Skills") */
  totalPassives: number;
  /** Small passive grant line (e.g. "10% increased Damage while affected by a Herald") */
  smallPassiveGrant?: string;
  /** Notable breakdowns with their stats */
  notables: ClusterNotableSummary[];
  /** Whether the cluster has a nested jewel socket */
  hasNestedSocket: boolean;
}

/**
 * Timeless jewel transformation info for a specific socket
 */
export interface TimelessTransformInfo {
  conquerorLine?: string;
  transformedNodes: Array<{
    id: number;
    name: string;
    stats: string[];
    originalName?: string;
  }>;
}

/**
 * Extended TreeNode with mastery effects for tooltip display
 */
export interface TooltipNode extends TreeNode {
  /** Selected mastery effect for mastery nodes */
  selectedMasteryEffect?: MasteryEffect;
  /** All available mastery effects */
  masteryEffects?: MasteryEffect[];
  /** Reminder text for the node (skill gem flavor text, etc.) */
  reminderText?: string[];
  /** Socketed jewel info (for jewel socket nodes) */
  socketedJewel?: SocketedJewelInfo | null;
  /** Stats granted by jewels with radius effects (for non-socket nodes in a jewel's radius) */
  jewelGrantedEffects?: JewelGrantedEffect[];
  /** Cluster jewel structural details for rich socket tooltips */
  clusterJewelDetails?: ClusterJewelDetails;
  /** Timeless jewel transformation data for this socket */
  timelessInfo?: TimelessTransformInfo;
}

/**
 * Token types for parsed stat text (similar to GemTooltip)
 */
export interface StatToken {
  text: string;
  type: 'value' | 'label';
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Parse a stat text string into tokens, separating numeric values from labels.
 * Handles: "9 to 14", "50%", "0.9 metres", ranges, and multiple values per line.
 */
export function parseStatText(stat: string): StatToken[] {
  // Regex to match numeric values: integers, decimals, ranges ("9 to 14"), percentages
  // Also handles negative numbers and values with +/- prefixes
  const valuePattern = /([+-]?\d+(?:\.\d+)?(?:\s*to\s*[+-]?\d+(?:\.\d+)?)?%?)/g;

  const tokens: StatToken[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = valuePattern.exec(stat)) !== null) {
    // Add label text before this match
    if (match.index > lastIndex) {
      const labelText = stat.slice(lastIndex, match.index);
      if (labelText) {
        tokens.push({ text: labelText, type: 'label' });
      }
    }

    // Add the numeric value
    tokens.push({ text: match[0], type: 'value' });
    lastIndex = match.index + match[0].length;
  }

  // Add remaining label text after last match
  if (lastIndex < stat.length) {
    tokens.push({ text: stat.slice(lastIndex), type: 'label' });
  }

  // If no matches found, return whole string as label
  if (tokens.length === 0) {
    tokens.push({ text: stat, type: 'label' });
  }

  return tokens;
}

/**
 * Get header style based on node type
 */
export function getHeaderStyle(node: TooltipNode): { text: string; glow: string } {
  switch (node.type) {
    case 'keystone':
      return {
        text: 'text-amber-300',
        glow: 'shadow-amber-500/20',
      };
    case 'notable':
      return {
        text: 'text-yellow-300',
        glow: 'shadow-yellow-500/15',
      };
    case 'mastery':
      return {
        text: 'text-purple-300',
        glow: 'shadow-purple-500/20',
      };
    case 'ascendancy':
      return {
        text: 'text-orange-300',
        glow: 'shadow-orange-500/20',
      };
    case 'jewelSocket':
      return {
        text: 'text-blue-300',
        glow: 'shadow-blue-500/20',
      };
    default:
      return {
        text: 'text-slate-200',
        glow: 'shadow-slate-500/10',
      };
  }
}

/**
 * Get node type display label
 */
export function getNodeTypeLabel(node: TooltipNode): string | null {
  switch (node.type) {
    case 'keystone':
      return 'Keystone';
    case 'notable':
      return 'Notable';
    case 'mastery':
      return 'Mastery';
    case 'ascendancy':
      return node.ascendancyName ? `${node.ascendancyName}` : 'Ascendancy';
    case 'jewelSocket':
      return 'Jewel Socket';
    default:
      return null;
  }
}

// =============================================================================
// Sub-components
// =============================================================================

/**
 * Renders a stat line with PoB-style coloring:
 * - Numeric values in cyan
 * - Labels/descriptions in slate gray
 */
export function ColoredStatLine({ stat }: { stat: string }) {
  const tokens = parseStatText(stat);

  return (
    <div className="text-xs leading-relaxed">
      {tokens.map((token, i) => (
        <span
          key={i}
          className={token.type === 'value' ? 'text-cyan-400' : 'text-slate-300'}
        >
          {token.text}
        </span>
      ))}
    </div>
  );
}

/**
 * Renders a dimmed stat line for unselected mastery effects
 */
export function DimmedStatLine({ stat }: { stat: string }) {
  const tokens = parseStatText(stat);

  return (
    <div className="text-xs leading-relaxed opacity-50">
      {tokens.map((token, i) => (
        <span
          key={i}
          className={token.type === 'value' ? 'text-slate-400' : 'text-slate-500'}
        >
          {token.text}
        </span>
      ))}
    </div>
  );
}

/**
 * Mastery Effect Display Component
 *
 * Shows only the selected mastery effect, matching PoB's compact tooltip style.
 */
export function MasteryEffectDisplay({
  selectedEffect,
  allEffects,
  isAllocated,
}: {
  selectedEffect?: MasteryEffect;
  allEffects?: MasteryEffect[];
  isAllocated: boolean;
}) {
  const availableOptionCount = allEffects?.length ?? 0;
  const alternateOptionCount = selectedEffect
    ? Math.max(availableOptionCount - 1, 0)
    : availableOptionCount;

  return (
    <div className="space-y-1.5">
      {selectedEffect ? (
        <div className="space-y-1.5 rounded-md border border-purple-500/35 bg-purple-950/15 px-2.5 py-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[0.56rem] text-purple-400 uppercase tracking-[0.16em] font-medium">
              Selected Effect
            </div>
            {isAllocated && (
              <span className="inline-flex items-center gap-1 rounded-full border border-purple-500/40 bg-purple-500/12 px-2 py-0.5 text-[0.55rem] uppercase tracking-[0.16em] text-purple-300">
                <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
                Active
              </span>
            )}
          </div>

          <div className="space-y-0.5">
            {selectedEffect.stats.map((stat, index) => (
              <ColoredStatLine key={index} stat={stat} />
            ))}
          </div>

          {selectedEffect.reminderText && selectedEffect.reminderText.length > 0 && (
            <div className="space-y-0.5 border-t border-purple-500/20 pt-1.5">
              {selectedEffect.reminderText.map((text, index) => (
                <div
                  key={index}
                  className="text-[0.625rem] text-slate-500 italic leading-snug"
                >
                  {text}
                </div>
              ))}
            </div>
          )}

          {alternateOptionCount > 0 && (
            <div className="border-t border-purple-500/20 pt-1.5 text-[0.625rem] text-slate-500 leading-none">
              {alternateOptionCount} other option{alternateOptionCount !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      ) : isAllocated ? (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="text-[0.56rem] text-amber-400 uppercase tracking-[0.16em] font-medium">
              No Effect Selected
            </div>
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/12 px-2 py-0.5 text-[0.55rem] uppercase tracking-[0.16em] text-amber-300">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              Needs Selection
            </span>
          </div>
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[0.6875rem] text-slate-300 leading-snug">
            A mastery effect should be selected for this node.
          </div>
        </div>
      ) : availableOptionCount > 0 ? (
        <div className="rounded-md border border-slate-700/70 bg-slate-950/45 px-2.5 py-1.5 text-[0.6875rem] text-slate-400 leading-snug">
          {availableOptionCount} mastery option{availableOptionCount !== 1 ? 's are' : ' is'} available.
        </div>
      ) : null}

      {/* Empty state */}
      {!selectedEffect && availableOptionCount === 0 && (
        <div className="text-[0.625rem] text-slate-600 italic">
          No mastery effects available
        </div>
      )}
    </div>
  );
}

// PoB-style rarity header colors - matching ItemTooltip
export const rarityHeaderColors: Record<string, { border: string; text: string }> = {
  NORMAL: { border: 'border-[#3a3a3a]', text: 'text-[#c8c8c8]' },
  MAGIC: { border: 'border-[#4a4aff]', text: 'text-[#8888ff]' },
  RARE: { border: 'border-[#ffff77]', text: 'text-[#ffff77]' },
  UNIQUE: { border: 'border-[#af6025]', text: 'text-[#af6025]' },
};

/**
 * Jewel Socket Display Component
 *
 * Shows socketed jewel information or empty socket state.
 * Styled to match the ItemTooltip component for consistency.
 */
/** Maximum transformed nodes to display before truncating */
const TIMELESS_DISPLAY_LIMIT = 8;

export function JewelSocketDisplay({
  socketedJewel,
  isAllocated,
  clusterJewelDetails,
  timelessInfo,
}: {
  socketedJewel?: SocketedJewelInfo | null;
  isAllocated: boolean;
  clusterJewelDetails?: ClusterJewelDetails;
  timelessInfo?: TimelessTransformInfo;
}) {
  if (!socketedJewel) {
    return (
      <div className="text-center py-2">
        <div className="text-xs text-slate-500 italic">
          {isAllocated ? 'No jewel socketed' : 'Empty socket'}
        </div>
        <div className="text-[0.625rem] text-slate-600 mt-1">
          Allocate this socket to equip a jewel
        </div>
      </div>
    );
  }

  const { name, baseName, rarity, isTimeless, isThreadOfHope, implicitStats, stats, radiusLabel } = socketedJewel;
  const hasImplicitStats = implicitStats && implicitStats.length > 0;
  const hasStats = stats && stats.length > 0;

  const rarityUpper = rarity?.toUpperCase() || 'NORMAL';
  const headerStyle = rarityHeaderColors[rarityUpper] || rarityHeaderColors.NORMAL;

  return (
    <div className={cn(
      'bg-[#0c0c0e] border-2 rounded-sm overflow-hidden',
      headerStyle.border
    )}>
      {/* Subtle inner glow for depth */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#1a1510]/20 to-transparent pointer-events-none" />

      {/* Header - Item name with rarity color */}
      <div className="px-3 py-2 border-b border-[#3a3530]/60 text-center relative">
        <div className={cn('font-pob font-semibold text-sm', headerStyle.text)}>
          {name}
        </div>
        {baseName && baseName !== name && (
          <div className="text-[#7f7f7f] text-[0.6875rem] mt-0.5 font-pob">{baseName}</div>
        )}
      </div>

      {/* Content */}
      <div className="px-3 py-2 space-y-1.5 relative">
        {/* Special jewel indicators */}
        {(isTimeless || isThreadOfHope || radiusLabel) && (
          <div className="flex items-center justify-center gap-1.5 flex-wrap">
            {isTimeless && (
              <span className="text-[0.625rem] px-1.5 py-0.5 rounded bg-amber-900/60 text-amber-400 font-medium">
                Timeless
              </span>
            )}
            {isThreadOfHope && (
              <span className="text-[0.625rem] px-1.5 py-0.5 rounded bg-cyan-900/60 text-cyan-400 font-medium">
                Thread of Hope
              </span>
            )}
            {radiusLabel && (
              <span className="text-[0.625rem] px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-300">
                {radiusLabel} Radius
              </span>
            )}
          </div>
        )}

        {/* Separator before mods */}
        {(isTimeless || isThreadOfHope || radiusLabel) && (hasImplicitStats || hasStats || clusterJewelDetails) && (
          <div className="border-t border-[#3a3530]/50 my-1.5" />
        )}

        {/* Implicits — white like PoB enchants/implicits (#C8C8C8). Separated from explicits below. */}
        {hasImplicitStats && (
          <div className="space-y-0.5">
            {implicitStats!.map((stat, index) => (
              <div key={`impl-${index}`} className="text-xs text-[#C8C8C8] font-pob leading-relaxed">
                {stat}
              </div>
            ))}
          </div>
        )}

        {/* Separator between implicits and explicits (matches ItemTooltip / JewelSection pattern) */}
        {hasImplicitStats && (hasStats || clusterJewelDetails) && (
          <div className="border-t border-[#3a3530]/50 my-1.5" />
        )}

        {/* Cluster jewel enchant lines — white like PoB enchants (#C8C8C8) */}
        {clusterJewelDetails && (
          <div className="space-y-0.5 text-center">
            <div className="text-xs text-[#C8C8C8] font-pob">
              Adds {clusterJewelDetails.totalPassives} Passive Skills
            </div>
            {clusterJewelDetails.hasNestedSocket && (
              <div className="text-xs text-[#C8C8C8] font-pob">
                1 Added Passive Skill is a Jewel Socket
              </div>
            )}
            {clusterJewelDetails.smallPassiveGrant && (
              <div className="text-xs text-[#C8C8C8] font-pob">
                Added Small Passive Skills grant: {clusterJewelDetails.smallPassiveGrant}
              </div>
            )}
            {hasStats && (
              <div className="border-t border-[#3a3530]/50 my-1.5" />
            )}
          </div>
        )}

        {/* Jewel stats — PoB explicit mod blue (#8888FF) */}
        {hasStats && (
          <div className="space-y-0.5">
            {stats.map((stat, index) => (
              <div key={index} className="text-xs text-[#8888FF] font-pob leading-relaxed">
                {stat}
              </div>
            ))}
          </div>
        )}

        {/* Cluster jewel notable breakdowns */}
        {clusterJewelDetails && clusterJewelDetails.notables.length > 0 && (
          <>
            <div className="border-t border-[#3a3530]/50 my-1.5" />
            <div className="space-y-2">
              {clusterJewelDetails.notables.map((notable, i) => (
                <div key={i} className="space-y-0.5">
                  <div className="text-xs text-[#DAA520] font-pob font-semibold">
                    {notable.name}
                  </div>
                  {notable.stats.map((stat, j) => (
                    <div key={j} className="text-[0.6875rem] text-[#C8C8C8] font-pob leading-relaxed pl-1">
                      {stat}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Timeless jewel transformation display */}
        {timelessInfo && timelessInfo.transformedNodes.length > 0 && (() => {
          // Separate nodes with meaningful stats from empty small passives
          const withStats = timelessInfo.transformedNodes.filter(
            n => n.stats.length > 0 && n.stats.some(s => s.trim() !== '')
          );
          const emptyNodes = timelessInfo.transformedNodes.filter(
            n => n.stats.length === 0 || !n.stats.some(s => s.trim() !== '')
          );
          // Group empty nodes by name for compact display
          const emptyByName = new Map<string, number>();
          for (const n of emptyNodes) {
            emptyByName.set(n.name, (emptyByName.get(n.name) ?? 0) + 1);
          }

          return (
            <>
              <div className="border-t border-[#3a3530]/50 my-1.5" />

              {/* Conqueror line */}
              {timelessInfo.conquerorLine && (
                <div className="text-xs text-[#DAA520] font-pob text-center mb-1">
                  {timelessInfo.conquerorLine}
                </div>
              )}

              {/* Transformed passives header */}
              <div className="text-[0.6875rem] text-amber-400 font-pob font-semibold">
                Transformed Passives ({timelessInfo.transformedNodes.length}):
              </div>

              {/* Notable/keystone transforms with actual stats (shown first) */}
              <div className="space-y-1.5 mt-1">
                {withStats.slice(0, TIMELESS_DISPLAY_LIMIT).map((tNode) => (
                  <div key={tNode.id} className="space-y-0.5">
                    <div className="text-xs text-[#C8C8C8] font-pob font-medium">
                      {tNode.name}
                      {tNode.originalName && (
                        <span className="text-[0.5625rem] text-[#5a5a5a] italic ml-1.5">
                          [was: {tNode.originalName}]
                        </span>
                      )}
                    </div>
                    {tNode.stats.map((stat, j) => (
                      <div key={j} className="text-[0.625rem] text-[#7f7f7f] font-pob leading-relaxed pl-1.5">
                        {stat}
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {/* Overflow for notables */}
              {withStats.length > TIMELESS_DISPLAY_LIMIT && (
                <div className="text-[0.625rem] text-[#5a5a5a] italic font-pob text-center mt-1">
                  and {withStats.length - TIMELESS_DISPLAY_LIMIT} more notable transforms...
                </div>
              )}

              {/* Compact summary for empty small passives */}
              {emptyByName.size > 0 && (
                <div className="text-[0.625rem] text-[#5a5a5a] italic font-pob text-center mt-1">
                  {Array.from(emptyByName.entries()).map(([name, count]) =>
                    `${name} ×${count}`
                  ).join(', ')} (small passives, no stats)
                </div>
              )}
            </>
          );
        })()}

        {/* No stats indicator */}
        {!hasStats && !clusterJewelDetails && !timelessInfo && (
          <div className="text-[0.625rem] text-[#5a5a5a] italic font-pob text-center">
            No modifiers
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Displays stats granted by jewels with radius effects.
 * Groups by jewel name when multiple jewels affect a node.
 */
export function JewelGrantedEffectsDisplay({ effects }: { effects: JewelGrantedEffect[] }) {
  // Group effects by jewel (socketNodeId is unique per jewel)
  const byJewel = new Map<number, JewelGrantedEffect>();
  for (const effect of effects) {
    const existing = byJewel.get(effect.socketNodeId);
    if (existing) {
      // Merge stats from same jewel (shouldn't happen normally, but safe)
      existing.grantedStats.push(...effect.grantedStats);
    } else {
      byJewel.set(effect.socketNodeId, { ...effect, grantedStats: [...effect.grantedStats] });
    }
  }

  return (
    <div className="mt-2 pt-2 border-t border-slate-700/50 space-y-1.5">
      {[...byJewel.values()].map((jewel) => (
        <div key={jewel.socketNodeId}>
          <div className="text-[0.625rem] text-teal-400/80 font-medium mb-0.5">
            From: {jewel.jewelName}
          </div>
          <div className="space-y-0.5">
            {jewel.grantedStats.map((stat, i) => (
              <ColoredStatLine key={i} stat={stat} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

interface TreeTooltipContentProps {
  node: TooltipNode;
  isAllocated?: boolean;
  className?: string;
}

/**
 * TreeTooltipContent Component
 *
 * Renders the inner tooltip card content (header + stats + mastery/jewel sections).
 * Does NOT include portal wrapping or fixed positioning -- that is handled by TreeTooltip.
 */
export function TreeTooltipContent({
  node,
  isAllocated = false,
  className,
}: TreeTooltipContentProps) {
  const hasStats = node.stats && node.stats.length > 0;
  const visibleReminderText = (node.reminderText ?? []).filter(
    (text) => !/^Tip:\s*Right click to select a different effect$/i.test(text.trim())
  );
  const hasReminderText = visibleReminderText.length > 0;
  const hasMasteryEffects = node.masteryEffects && node.masteryEffects.length > 0;
  const selectedMastery = node.selectedMasteryEffect;
  const headerStyleVal = getHeaderStyle(node);
  const typeLabel = getNodeTypeLabel(node);
  const tooltipWidthClass =
    node.type === 'mastery'
      ? 'min-w-[240px] max-w-[320px]'
      : 'min-w-[260px] max-w-[360px]';

  return (
    <div
      className={cn(
        // Base styling - dark theme with subtle glow
        tooltipWidthClass,
        'rounded-lg overflow-hidden',
        // Background with frosted glass effect
        'bg-[rgba(20,20,30,0.95)]',
        // Border with golden accent
        'border border-[rgba(255,200,100,0.3)]',
        // Shadow for depth
        'shadow-xl shadow-black/60',
        headerStyleVal.glow,
        className
      )}
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-slate-700/50">
        <div className="flex items-start justify-between gap-2">
          <h4
            className={cn(
              'font-display font-semibold text-sm leading-tight',
              headerStyleVal.text
            )}
          >
            {node.name || 'Unknown Node'}
          </h4>
          {isAllocated && (
            <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[0.625rem] font-medium bg-green-500/20 text-green-400 border border-green-500/30">
              Allocated
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 leading-none">
          {typeLabel && (
            <div className="text-[0.625rem] text-slate-500">{typeLabel}</div>
          )}
          {/* Mastery point indicator for mastery nodes */}
          {node.type === 'mastery' && isAllocated && selectedMastery && (
            <div className="text-[0.625rem] text-purple-400/70">
              (1 Mastery Point)
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-3 py-2 space-y-1.5">
        {/* Stats list (for non-mastery nodes or mastery base stats) */}
        {hasStats && node.type !== 'mastery' && node.type !== 'jewelSocket' && (
          <div className="space-y-0.5">
            {node.stats!.map((stat, index) => (
              <ColoredStatLine key={index} stat={stat} />
            ))}
          </div>
        )}

        {/* Jewel Socket section */}
        {node.type === 'jewelSocket' && (
          <JewelSocketDisplay
            socketedJewel={node.socketedJewel}
            isAllocated={isAllocated}
            clusterJewelDetails={node.clusterJewelDetails}
            timelessInfo={node.timelessInfo}
          />
        )}

        {/* Enhanced Mastery section */}
        {node.type === 'mastery' && (hasMasteryEffects || selectedMastery) && (
          <MasteryEffectDisplay
            selectedEffect={selectedMastery}
            allEffects={node.masteryEffects}
            isAllocated={isAllocated}
          />
        )}

        {/* Simple mastery state when no effects data */}
        {node.type === 'mastery' && !hasMasteryEffects && !selectedMastery && (
          <div className="mt-2 pt-2 border-t border-slate-700/50">
            <div className="text-[0.625rem] text-slate-500 italic">
              No mastery effect data available
            </div>
          </div>
        )}

        {/* Jewel radius granted effects */}
        {node.jewelGrantedEffects && node.jewelGrantedEffects.length > 0 && (
          <JewelGrantedEffectsDisplay effects={node.jewelGrantedEffects} />
        )}

        {/* Reminder text */}
        {hasReminderText && (
          <div
            className={cn(
              'space-y-0.5',
              (hasStats || node.type === 'mastery') && 'mt-2 pt-2 border-t border-slate-700/50'
            )}
          >
            {visibleReminderText.map((text, index) => (
              <div
                key={index}
                className="text-xs text-slate-500 italic leading-relaxed"
              >
                {text}
              </div>
            ))}
          </div>
        )}

        {/* Empty state for nodes without content */}
        {!hasStats && !hasReminderText && node.type !== 'mastery' && (
          <div className="text-xs text-slate-600 italic">
            No additional information
          </div>
        )}
      </div>
    </div>
  );
}
