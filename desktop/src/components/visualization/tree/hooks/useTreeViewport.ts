/**
 * useTreeViewport Hook
 *
 * Provides programmatic control functions for the pixi-viewport instance
 * used in the passive tree visualization. Handles zoom, pan, and navigation
 * operations with smooth animations.
 *
 * @module components/visualization/tree/hooks/useTreeViewport
 */

import { useCallback, useRef, useState, useEffect, type RefObject } from 'react';
import type { Viewport } from 'pixi-viewport';
import { CLASS_START_AREAS } from '@shared/types/tree-location';

// ============================================================================
// Types
// ============================================================================

export interface TreeViewportControls {
  /** Zoom in by one step */
  zoomIn: () => void;
  /** Zoom out by one step */
  zoomOut: () => void;
  /** Set zoom to a specific percentage */
  setZoom?: (zoomPercent: number) => void;
  /** Reset view to fit the entire tree */
  resetView: () => void;
  /** Center the viewport on a class starting area */
  centerOnClass: (className: string) => void;
  /** Center the viewport on a specific node by ID */
  centerOnNode: (nodeId: number, nodes?: Map<number, { x: number; y: number }>) => void;
  /** Current zoom level as a percentage (100 = default) */
  currentZoom: number;
  /** Minimum allowed zoom */
  minZoom: number;
  /** Maximum allowed zoom */
  maxZoom: number;
}

export interface UseTreeViewportOptions {
  /** Reference to the pixi-viewport instance */
  viewportRef: RefObject<Viewport | null>;
  /** World bounds for reset view calculation */
  worldBounds?: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
  /** Zoom factor per step (default: 1.25) */
  zoomStep?: number;
  /** Animation duration in ms (default: 300) */
  animationDuration?: number;
}

// ============================================================================
// Constants
// ============================================================================

/** Default zoom step multiplier */
const DEFAULT_ZOOM_STEP = 1.25;

/** Default animation duration in ms */
const DEFAULT_ANIMATION_DURATION = 300;

/** Minimum zoom scale */
const MIN_ZOOM = 0.1;

/** Maximum zoom scale */
const MAX_ZOOM = 4;

/** Default zoom level for class centering */
const CLASS_CENTER_ZOOM = 0.8;

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook to control the tree viewport programmatically.
 *
 * @param options - Configuration options for viewport control
 * @returns Object containing control functions and current zoom state
 */
export function useTreeViewport({
  viewportRef,
  worldBounds,
  zoomStep = DEFAULT_ZOOM_STEP,
  animationDuration = DEFAULT_ANIMATION_DURATION,
}: UseTreeViewportOptions): TreeViewportControls {
  const [currentZoom, setCurrentZoom] = useState(100);
  const animationFrameRef = useRef<number | null>(null);

  // Update zoom state when viewport changes
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const handleZoomEnd = () => {
      setCurrentZoom(Math.round(viewport.scale.x * 100));
    };

    // Listen for viewport changes
    viewport.on('zoomed', handleZoomEnd);
    viewport.on('zoomed-end', handleZoomEnd);
    viewport.on('moved-end', handleZoomEnd);

    // Set initial zoom
    handleZoomEnd();

    return () => {
      viewport.off('zoomed', handleZoomEnd);
      viewport.off('zoomed-end', handleZoomEnd);
      viewport.off('moved-end', handleZoomEnd);
    };
  }, [viewportRef]);

  // Cleanup animation frame on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  /**
   * Zoom in by one step
   */
  const zoomIn = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const newScale = Math.min(viewport.scale.x * zoomStep, MAX_ZOOM);
    viewport.animate({
      scale: newScale,
      time: animationDuration,
      ease: 'easeOutQuad',
    });
  }, [viewportRef, zoomStep, animationDuration]);

  /**
   * Zoom out by one step
   */
  const zoomOut = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const newScale = Math.max(viewport.scale.x / zoomStep, MIN_ZOOM);
    viewport.animate({
      scale: newScale,
      time: animationDuration,
      ease: 'easeOutQuad',
    });
  }, [viewportRef, zoomStep, animationDuration]);

  /**
   * Reset the view to fit the entire tree
   */
  const resetView = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport || !worldBounds) return;

    const worldWidth = worldBounds.maxX - worldBounds.minX;
    const worldHeight = worldBounds.maxY - worldBounds.minY;
    const centerX = worldBounds.minX + worldWidth / 2;
    const centerY = worldBounds.minY + worldHeight / 2;

    // Calculate scale to fit
    const scaleX = viewport.screenWidth / worldWidth;
    const scaleY = viewport.screenHeight / worldHeight;
    const fitScale = Math.min(scaleX, scaleY) * 0.9; // 90% to add some padding

    viewport.animate({
      position: { x: centerX, y: centerY },
      scale: fitScale,
      time: animationDuration,
      ease: 'easeOutQuad',
    });
  }, [viewportRef, worldBounds, animationDuration]);

  /**
   * Center the viewport on a class starting area
   */
  const centerOnClass = useCallback(
    (className: string) => {
      const viewport = viewportRef.current;
      if (!viewport) return;

      const classArea = CLASS_START_AREAS.find(
        (area) => area.className.toLowerCase() === className.toLowerCase()
      );

      if (!classArea) {
        console.warn(`Class area not found for: ${className}`);
        return;
      }

      viewport.animate({
        position: { x: classArea.coordinates.x, y: classArea.coordinates.y },
        scale: CLASS_CENTER_ZOOM,
        time: animationDuration,
        ease: 'easeOutQuad',
      });
    },
    [viewportRef, animationDuration]
  );

  /**
   * Center the viewport on a specific node
   */
  const centerOnNode = useCallback(
    (nodeId: number, nodes?: Map<number, { x: number; y: number }>) => {
      const viewport = viewportRef.current;
      if (!viewport) return;

      // Try to find node position from provided map
      const node = nodes?.get(nodeId);
      if (!node) {
        console.warn(`Node not found: ${nodeId}`);
        return;
      }

      viewport.animate({
        position: { x: node.x, y: node.y },
        scale: 1.5, // Zoom in closer to see the node
        time: animationDuration,
        ease: 'easeOutQuad',
      });
    },
    [viewportRef, animationDuration]
  );

  return {
    zoomIn,
    zoomOut,
    resetView,
    centerOnClass,
    centerOnNode,
    currentZoom,
    minZoom: Math.round(MIN_ZOOM * 100),
    maxZoom: Math.round(MAX_ZOOM * 100),
  };
}

export default useTreeViewport;
