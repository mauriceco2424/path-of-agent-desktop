/**
 * TreeViewport Utilities
 *
 * Utility functions for creating and managing a pixi-viewport for the passive tree.
 * Provides pan/zoom functionality configuration.
 *
 * NOTE: The main InteractiveTreeCanvas.tsx now creates and manages the viewport directly.
 * These utilities are kept for potential future use or refactoring.
 *
 * @module desktop/src/components/visualization/tree/TreeViewport
 */

import { Viewport } from 'pixi-viewport';
import { Application, Container } from 'pixi.js';
import type { MutableRefObject } from 'react';

/**
 * World bounds definition
 */
export interface WorldBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * Configuration for creating a tree viewport
 */
export interface TreeViewportConfig {
  /** Pixi Application instance */
  app: Application;
  /** Screen/canvas width */
  screenWidth: number;
  /** Screen/canvas height */
  screenHeight: number;
  /** World coordinate bounds */
  worldBounds: WorldBounds;
  /** Optional ref to store the viewport instance */
  viewportRef?: MutableRefObject<Viewport | null>;
  /** Minimum zoom scale (default: 0.1) */
  minZoom?: number;
  /** Maximum zoom scale (default: 4) */
  maxZoom?: number;
}

/**
 * Result from creating a viewport
 */
export interface TreeViewportResult {
  /** The created viewport instance */
  viewport: Viewport;
  /** Content container for adding tree layers */
  contentContainer: Container;
  /** Cleanup function to destroy the viewport */
  destroy: () => void;
}

/**
 * Create a configured viewport for the passive tree visualization.
 *
 * The viewport provides:
 * - Drag to pan
 * - Scroll wheel to zoom
 * - Pinch to zoom (touch)
 * - Deceleration (momentum after drag)
 * - Zoom limits
 * - Initial centering and fit
 *
 * @param config - Viewport configuration
 * @returns Created viewport and content container
 *
 * @example
 * ```typescript
 * const { viewport, contentContainer, destroy } = createTreeViewport({
 *   app,
 *   screenWidth: 800,
 *   screenHeight: 600,
 *   worldBounds: { minX: -15000, maxX: 15000, minY: -15000, maxY: 15000 },
 * });
 *
 * // Add layers to contentContainer
 * contentContainer.addChild(connectionLayer);
 * contentContainer.addChild(nodeLayer);
 *
 * // Cleanup when done
 * destroy();
 * ```
 */
export function createTreeViewport(config: TreeViewportConfig): TreeViewportResult {
  const {
    app,
    screenWidth,
    screenHeight,
    worldBounds,
    viewportRef,
    minZoom = 0.1,
    maxZoom = 4,
  } = config;

  // Calculate world dimensions
  const worldWidth = worldBounds.maxX - worldBounds.minX;
  const worldHeight = worldBounds.maxY - worldBounds.minY;

  // Create viewport
  const viewport = new Viewport({
    screenWidth,
    screenHeight,
    worldWidth,
    worldHeight,
    events: app.renderer.events,
  });

  // Enable interactions
  viewport
    .drag()
    .pinch()
    .wheel()
    .decelerate();

  // Set zoom limits
  viewport.clampZoom({
    minScale: minZoom,
    maxScale: maxZoom,
  });

  // Center the viewport on the tree center
  viewport.moveCenter(
    worldBounds.minX + worldWidth / 2,
    worldBounds.minY + worldHeight / 2
  );

  // Fit the tree to the screen initially
  viewport.fit(true, worldWidth, worldHeight);

  // Create a container for content
  const contentContainer = new Container();
  viewport.addChild(contentContainer);

  // Add viewport to stage
  app.stage.addChild(viewport);

  // Store ref if provided
  if (viewportRef) {
    viewportRef.current = viewport;
  }

  // Cleanup function
  const destroy = () => {
    viewport.destroy({ children: true });
    if (viewportRef) {
      viewportRef.current = null;
    }
  };

  return {
    viewport,
    contentContainer,
    destroy,
  };
}

/**
 * Update viewport dimensions when screen size changes
 */
export function resizeViewport(viewport: Viewport, screenWidth: number, screenHeight: number): void {
  viewport.resize(screenWidth, screenHeight);
}

/**
 * Center the viewport on a specific world position
 */
export function centerViewportOn(viewport: Viewport, x: number, y: number, animate: boolean = false): void {
  if (animate) {
    viewport.animate({
      position: { x, y },
      time: 500,
      ease: 'easeOutQuad',
    });
  } else {
    viewport.moveCenter(x, y);
  }
}

/**
 * Zoom the viewport to a specific scale
 */
export function zoomViewportTo(viewport: Viewport, scale: number, animate: boolean = false): void {
  if (animate) {
    viewport.animate({
      scale,
      time: 300,
      ease: 'easeOutQuad',
    });
  } else {
    viewport.setZoom(scale);
  }
}

/**
 * Fit the entire tree in the viewport
 */
export function fitTreeInViewport(viewport: Viewport, worldBounds: WorldBounds, padding: number = 0): void {
  const worldWidth = worldBounds.maxX - worldBounds.minX + padding * 2;
  const worldHeight = worldBounds.maxY - worldBounds.minY + padding * 2;

  viewport.fit(true, worldWidth, worldHeight);
  viewport.moveCenter(
    worldBounds.minX + (worldBounds.maxX - worldBounds.minX) / 2,
    worldBounds.minY + (worldBounds.maxY - worldBounds.minY) / 2
  );
}

export default createTreeViewport;
