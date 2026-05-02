import { useState, useCallback, useEffect, useRef } from 'react';
import type { Viewport } from 'pixi-viewport';
import type { TreeNode } from './useTreeData';

interface ViewportBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

interface UseViewportCullingOptions {
  /** Extra padding around viewport to include nodes just outside view */
  padding?: number;
  /** Debounce time for viewport move events in ms */
  debounceMs?: number;
}

/**
 * Hook that provides viewport culling functionality for tree nodes.
 * Only nodes within the visible viewport (plus padding) are returned,
 * significantly improving rendering performance for large trees.
 *
 * @param nodes - All tree nodes
 * @param viewport - The pixi-viewport instance (null if not yet created)
 * @param options - Culling options
 * @returns Array of nodes visible in the current viewport
 */
export function useViewportCulling(
  nodes: TreeNode[],
  viewport: Viewport | null,
  options: UseViewportCullingOptions = {}
): TreeNode[] {
  const { padding = 100, debounceMs = 16 } = options;

  const [visibleNodes, setVisibleNodes] = useState<TreeNode[]>(nodes);
  const debounceRef = useRef<number | null>(null);
  const lastBoundsRef = useRef<ViewportBounds | null>(null);

  /**
   * Calculate visible nodes based on current viewport bounds.
   */
  const calculateVisibleNodes = useCallback(
    (bounds: ViewportBounds) => {
      // Add padding to bounds
      const expandedBounds = {
        left: bounds.left - padding,
        right: bounds.right + padding,
        top: bounds.top - padding,
        bottom: bounds.bottom + padding,
      };

      // Filter nodes that are within the expanded bounds
      const visible = nodes.filter((node) => {
        // Account for node size (largest nodes are keystones at ~32 radius)
        const nodeRadius = 40;
        return (
          node.x + nodeRadius >= expandedBounds.left &&
          node.x - nodeRadius <= expandedBounds.right &&
          node.y + nodeRadius >= expandedBounds.top &&
          node.y - nodeRadius <= expandedBounds.bottom
        );
      });

      return visible;
    },
    [nodes, padding]
  );

  /**
   * Get current viewport bounds in world coordinates.
   */
  const getViewportBounds = useCallback((): ViewportBounds | null => {
    if (!viewport) return null;

    // Get viewport corners in world coordinates
    const topLeft = viewport.toWorld(0, 0);
    const bottomRight = viewport.toWorld(
      viewport.screenWidth,
      viewport.screenHeight
    );

    return {
      left: Math.min(topLeft.x, bottomRight.x),
      right: Math.max(topLeft.x, bottomRight.x),
      top: Math.min(topLeft.y, bottomRight.y),
      bottom: Math.max(topLeft.y, bottomRight.y),
    };
  }, [viewport]);

  /**
   * Update visible nodes with debouncing.
   */
  const updateVisibleNodes = useCallback(() => {
    const bounds = getViewportBounds();
    if (!bounds) return;

    // Skip update if bounds haven't changed significantly
    if (lastBoundsRef.current) {
      const threshold = 10;
      const last = lastBoundsRef.current;
      if (
        Math.abs(bounds.left - last.left) < threshold &&
        Math.abs(bounds.right - last.right) < threshold &&
        Math.abs(bounds.top - last.top) < threshold &&
        Math.abs(bounds.bottom - last.bottom) < threshold
      ) {
        return;
      }
    }

    lastBoundsRef.current = bounds;
    setVisibleNodes(calculateVisibleNodes(bounds));
  }, [getViewportBounds, calculateVisibleNodes]);

  /**
   * Debounced viewport update handler.
   */
  const handleViewportChange = useCallback(() => {
    if (debounceRef.current !== null) {
      cancelAnimationFrame(debounceRef.current);
    }
    debounceRef.current = requestAnimationFrame(() => {
      updateVisibleNodes();
      debounceRef.current = null;
    });
  }, [updateVisibleNodes]);

  // Subscribe to viewport events
  useEffect(() => {
    if (!viewport) return;

    // Initial calculation
    updateVisibleNodes();

    // Listen for viewport changes
    viewport.on('moved', handleViewportChange);
    viewport.on('zoomed', handleViewportChange);
    viewport.on('moved-end', handleViewportChange);
    viewport.on('zoomed-end', handleViewportChange);

    return () => {
      viewport.off('moved', handleViewportChange);
      viewport.off('zoomed', handleViewportChange);
      viewport.off('moved-end', handleViewportChange);
      viewport.off('zoomed-end', handleViewportChange);

      if (debounceRef.current !== null) {
        cancelAnimationFrame(debounceRef.current);
      }
    };
  }, [viewport, handleViewportChange, updateVisibleNodes]);

  // Update when nodes change
  useEffect(() => {
    if (viewport) {
      updateVisibleNodes();
    } else {
      // No viewport, return all nodes
      setVisibleNodes(nodes);
    }
  }, [nodes, viewport, updateVisibleNodes]);

  return visibleNodes;
}

/**
 * Simple bounds check without viewport - useful for initial render
 * or when viewport is not available.
 */
export function filterNodesByBounds(
  nodes: TreeNode[],
  bounds: ViewportBounds,
  padding = 100
): TreeNode[] {
  const expandedBounds = {
    left: bounds.left - padding,
    right: bounds.right + padding,
    top: bounds.top - padding,
    bottom: bounds.bottom + padding,
  };

  const nodeRadius = 40;
  return nodes.filter(
    (node) =>
      node.x + nodeRadius >= expandedBounds.left &&
      node.x - nodeRadius <= expandedBounds.right &&
      node.y + nodeRadius >= expandedBounds.top &&
      node.y - nodeRadius <= expandedBounds.bottom
  );
}
