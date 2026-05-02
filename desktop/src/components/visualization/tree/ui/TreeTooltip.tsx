import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  TreeTooltipContent,
  getHeaderStyle,
  getNodeTypeLabel,
} from './TreeTooltipContent';
import type { TooltipNode } from './TreeTooltipContent';

// Re-export types so existing imports from TreeTooltip still work
export type { MasteryEffect, SocketedJewelInfo, TooltipNode, StatToken, ClusterJewelDetails, ClusterNotableSummary, TimelessTransformInfo } from './TreeTooltipContent';

// Re-export helpers and sub-components that may be used externally
export {
  parseStatText,
  ColoredStatLine,
  DimmedStatLine,
  MasteryEffectDisplay,
  JewelSocketDisplay,
  getHeaderStyle,
  getNodeTypeLabel,
  rarityHeaderColors,
  TreeTooltipContent,
} from './TreeTooltipContent';

interface TreeTooltipProps {
  /** The node to display information for */
  node: TooltipNode | null;
  /** Screen position for the tooltip */
  position: { x: number; y: number } | null;
  /** Whether the node is currently allocated */
  isAllocated?: boolean;
  /** Additional CSS class names */
  className?: string;
}

/**
 * TreeTooltip Component
 *
 * Displays node information on hover with PoE-style formatting.
 * Rendered as a React portal to escape overflow:hidden containers.
 *
 * Features:
 * - Node name with type-appropriate coloring
 * - Stat list with numeric value highlighting
 * - Reminder text in italics
 * - Enhanced mastery effect display:
 *   - Selected effect shown prominently with active indicator
 *   - Other available effects shown dimmed below
 *   - Scrollable list for masteries with many options
 * - Jewel socket display with socketed jewel info
 * - Dark theme matching the app aesthetic
 */
export function TreeTooltip({
  node,
  position,
  isAllocated = false,
  className,
}: TreeTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [resolvedPosition, setResolvedPosition] = useState(position);
  const hasStats = node?.stats && node.stats.length > 0;

  useLayoutEffect(() => {
    if (!node || !position) {
      return;
    }

    const edgePadding = 12;
    const offsetX = 18;
    const offsetY = 14;
    const fallbackWidth = node.type === 'mastery' ? 460 : 360;
    const fallbackHeight = node.type === 'mastery' ? 520 : 320;
    const tooltipWidth = tooltipRef.current?.offsetWidth ?? fallbackWidth;
    const tooltipHeight = tooltipRef.current?.offsetHeight ?? fallbackHeight;

    let nextX = position.x + offsetX;
    let nextY = position.y + offsetY;

    if (nextX + tooltipWidth > window.innerWidth - edgePadding) {
      nextX = position.x - tooltipWidth - offsetX;
    }

    if (nextY + tooltipHeight > window.innerHeight - edgePadding) {
      nextY = position.y - tooltipHeight - offsetY;
    }

    nextX = Math.max(edgePadding, Math.min(nextX, window.innerWidth - tooltipWidth - edgePadding));
    nextY = Math.max(edgePadding, Math.min(nextY, window.innerHeight - tooltipHeight - edgePadding));

    setResolvedPosition((current) => {
      if (current?.x === nextX && current?.y === nextY) {
        return current;
      }
      return { x: nextX, y: nextY };
    });
  }, [node, position]);

  // Don't render if no node, position, or resolved position
  if (!node || !position || !resolvedPosition) {
    return null;
  }

  // Don't show tooltip for normal nodes without stats
  if (node.type === 'normal' && !hasStats) {
    return null;
  }

  const tooltipContent = (
    <div
      ref={tooltipRef}
      style={{
        position: 'fixed',
        left: resolvedPosition.x,
        top: resolvedPosition.y,
        zIndex: 9999,
      }}
      className="pointer-events-none"
    >
      <TreeTooltipContent
        node={node}
        isAllocated={isAllocated}
        className={className}
      />
    </div>
  );

  // Render as portal to escape any overflow containers
  return createPortal(tooltipContent, document.body);
}

export default TreeTooltip;
