import { useState, useCallback, useRef, useEffect } from 'react';
import type { TreeNode } from './useTreeData';

/**
 * State for node interactions (hover, selection, tooltip positioning)
 */
export interface NodeInteractionState {
  /** Currently hovered node, or null if none */
  hoveredNode: TreeNode | null;
  /** Currently selected node (via click), or null if none */
  selectedNode: TreeNode | null;
  /** Screen position for the tooltip, or null if hidden */
  tooltipPosition: { x: number; y: number } | null;
}

/**
 * Options for useNodeInteraction hook
 */
export interface UseNodeInteractionOptions {
  /** Container element for calculating tooltip bounds */
  containerRef?: React.RefObject<HTMLElement>;
  /** Tooltip width in pixels (default: 300) */
  tooltipWidth?: number;
  /** Tooltip estimated height in pixels (default: 200) */
  tooltipHeight?: number;
  /** Offset from the node position in pixels (default: 16) */
  tooltipOffset?: number;
  /** External callback when a node is hovered */
  onNodeHover?: (node: TreeNode | null) => void;
  /** External callback when a node is clicked */
  onNodeClick?: (node: TreeNode) => void;
}

/**
 * Return type for useNodeInteraction hook
 */
export interface UseNodeInteractionResult {
  /** Current interaction state */
  state: NodeInteractionState;
  /** Handler for node hover events from the canvas */
  onNodeHover: (node: TreeNode | null, screenPosition?: { x: number; y: number }) => void;
  /** Handler for node click events from the canvas */
  onNodeClick: (node: TreeNode) => void;
  /** Clear the current selection */
  clearSelection: () => void;
  /** Clear all interaction state (hover and selection) */
  clearAll: () => void;
  /** Update tooltip position based on mouse movement */
  updateTooltipPosition: (screenX: number, screenY: number) => void;
}

/**
 * Hook for managing node interaction state in the passive tree visualization.
 *
 * Features:
 * - Tracks hovered and selected nodes
 * - Calculates smart tooltip positioning to stay within viewport bounds
 * - Supports external callbacks for integration with parent components
 *
 * @example
 * ```tsx
 * const containerRef = useRef<HTMLDivElement>(null);
 * const { state, onNodeHover, onNodeClick, clearSelection } = useNodeInteraction({
 *   containerRef,
 *   onNodeHover: (node) => console.log('Hovered:', node?.name),
 *   onNodeClick: (node) => console.log('Clicked:', node.name),
 * });
 * ```
 */
export function useNodeInteraction(
  options: UseNodeInteractionOptions = {}
): UseNodeInteractionResult {
  const {
    containerRef,
    tooltipWidth = 300,
    tooltipHeight = 200,
    tooltipOffset = 16,
    onNodeHover: externalOnNodeHover,
    onNodeClick: externalOnNodeClick,
  } = options;

  const [state, setState] = useState<NodeInteractionState>({
    hoveredNode: null,
    selectedNode: null,
    tooltipPosition: null,
  });

  // Track the last mouse position for tooltip positioning
  const lastMousePosition = useRef<{ x: number; y: number } | null>(null);

  /**
   * Calculate optimal tooltip position that stays within viewport bounds.
   * Default position is to the right of the cursor, flipping left/up as needed.
   */
  const calculateTooltipPosition = useCallback(
    (screenX: number, screenY: number): { x: number; y: number } => {
      // Get container or viewport bounds
      const containerBounds = containerRef?.current?.getBoundingClientRect();
      const viewportWidth = containerBounds?.right ?? window.innerWidth;
      const viewportHeight = containerBounds?.bottom ?? window.innerHeight;
      const viewportLeft = containerBounds?.left ?? 0;
      const viewportTop = containerBounds?.top ?? 0;

      let x = screenX + tooltipOffset;
      let y = screenY + tooltipOffset;

      // Check if tooltip would overflow right edge
      if (x + tooltipWidth > viewportWidth - 8) {
        // Position to the left of the cursor instead
        x = screenX - tooltipWidth - tooltipOffset;

        // Ensure we don't go past the left edge
        if (x < viewportLeft + 8) {
          x = viewportLeft + 8;
        }
      }

      // Check if tooltip would overflow bottom edge
      if (y + tooltipHeight > viewportHeight - 8) {
        // Position above the cursor instead
        y = screenY - tooltipHeight - tooltipOffset;

        // Ensure we don't go past the top edge
        if (y < viewportTop + 8) {
          y = viewportTop + 8;
        }
      }

      // Final clamp to ensure we're within bounds
      x = Math.max(viewportLeft + 8, Math.min(x, viewportWidth - tooltipWidth - 8));
      y = Math.max(viewportTop + 8, Math.min(y, viewportHeight - tooltipHeight - 8));

      return { x, y };
    },
    [containerRef, tooltipWidth, tooltipHeight, tooltipOffset]
  );

  /**
   * Handle node hover events from the canvas
   */
  const handleNodeHover = useCallback(
    (node: TreeNode | null, screenPosition?: { x: number; y: number }) => {
      // Update mouse position if provided
      if (screenPosition) {
        lastMousePosition.current = screenPosition;
      }

      // Calculate tooltip position
      const tooltipPosition = node && lastMousePosition.current
        ? calculateTooltipPosition(
            lastMousePosition.current.x,
            lastMousePosition.current.y
          )
        : null;

      setState((prev) => ({
        ...prev,
        hoveredNode: node,
        tooltipPosition,
      }));

      // Call external callback
      externalOnNodeHover?.(node);
    },
    [calculateTooltipPosition, externalOnNodeHover]
  );

  /**
   * Handle node click events from the canvas
   */
  const handleNodeClick = useCallback(
    (node: TreeNode) => {
      setState((prev) => ({
        ...prev,
        selectedNode: prev.selectedNode?.id === node.id ? null : node,
      }));

      // Call external callback
      externalOnNodeClick?.(node);
    },
    [externalOnNodeClick]
  );

  /**
   * Clear the current selection
   */
  const clearSelection = useCallback(() => {
    setState((prev) => ({
      ...prev,
      selectedNode: null,
    }));
  }, []);

  /**
   * Clear all interaction state
   */
  const clearAll = useCallback(() => {
    setState({
      hoveredNode: null,
      selectedNode: null,
      tooltipPosition: null,
    });
    lastMousePosition.current = null;
  }, []);

  /**
   * Update tooltip position based on mouse movement
   */
  const updateTooltipPosition = useCallback(
    (screenX: number, screenY: number) => {
      lastMousePosition.current = { x: screenX, y: screenY };

      if (state.hoveredNode) {
        const tooltipPosition = calculateTooltipPosition(screenX, screenY);
        setState((prev) => ({
          ...prev,
          tooltipPosition,
        }));
      }
    },
    [state.hoveredNode, calculateTooltipPosition]
  );

  // Clear hover state when mouse leaves the viewport
  useEffect(() => {
    const handleMouseLeave = () => {
      if (state.hoveredNode) {
        setState((prev) => ({
          ...prev,
          hoveredNode: null,
          tooltipPosition: null,
        }));
        externalOnNodeHover?.(null);
      }
    };

    const container = containerRef?.current;
    if (container) {
      container.addEventListener('mouseleave', handleMouseLeave);
      return () => {
        container.removeEventListener('mouseleave', handleMouseLeave);
      };
    }
  }, [containerRef, state.hoveredNode, externalOnNodeHover]);

  return {
    state,
    onNodeHover: handleNodeHover,
    onNodeClick: handleNodeClick,
    clearSelection,
    clearAll,
    updateTooltipPosition,
  };
}

export default useNodeInteraction;
