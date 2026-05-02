/**
 * InteractiveTreeCanvas Component
 *
 * Main canvas component for rendering the interactive passive skill tree.
 * Uses vanilla Pixi.js with a React wrapper for better control.
 *
 * @module desktop/src/components/visualization/tree/InteractiveTreeCanvas
 */

import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Application, Container, Graphics, MeshSimple, Sprite, Texture, TilingSprite } from 'pixi.js';
import { Viewport } from 'pixi-viewport';
import { useTreeData, type TreeNode, type TreeData } from './hooks/useTreeData';
import { useTreeSprites } from './hooks/useTreeSprites';
import { TreeTooltip, type SocketedJewelInfo, type TooltipNode, type ClusterJewelDetails, type TimelessTransformInfo } from './ui/TreeTooltip';
import { TreeControls } from './ui/TreeControls';
import type { TreeViewportControls } from './hooks/useTreeViewport';
import {
  drawJewelSocketOverlays,
  type JewelSocketInfo,
  type JewelSocketOverlayTextures,
} from './layers/JewelSocketOverlay';
import {
  findSpriteCategoryForIcon,
  getAscendancyClassSpriteKey,
  getKnownTransformedNodeIconAlias,
  getNodeSize,
  getRepresentativeSpriteIconSize,
  normalizeAscendancyName,
  resolveSpriteInfo,
} from './utils/sprite-resolver';
import type { RenderableNode } from './types';
import {
  isClusterNode,
  groupClusterNodesBySocket,
  calculateClusterLayout,
  generateClusterConnections,
  type ClusterNodePosition,
  type ClusterSize,
} from './utils/cluster-layout';
import { shouldHideTreeConnection } from './utils/connection-visibility';
import {
  buildOrbitConnectorLayouts,
  buildStraightConnectorLayout,
  getConnectionState,
  getConnectorStyle,
  type ConnectionState,
  type ConnectorCenter,
} from './utils/connector-art';
import { extractNormalizedWheelDelta, getWheelZoomScale } from './utils/wheel-zoom';
import { buildNodeJewelEffectsMap } from './utils/jewel-radius-effects';
import { resolveTooltipMasteryDisplay } from './utils/mastery-display';
import useDesktopStore from '../../../store';
import type { ClusterNodeData } from '../../../store';

// Node visual constants
const NODE_COLORS = {
  allocated: {
    keystone: 0xffd700,
    notable: 0xe6b800,
    small: 0xccaa00,
    mastery: 0xb366ff,
    jewelSocket: 0x00ccff,
    ascendancy: 0xff6600,
  },
  unallocated: {
    keystone: 0x666666,
    notable: 0x555555,
    small: 0x444444,
    mastery: 0x553366,
    jewelSocket: 0x336666,
    ascendancy: 0x553300,
  },
  diffAdded: 0x00ff88,    // Green glow for nodes to be added
  diffRemoved: 0xff4444,  // Red glow for nodes to be removed
  searchHighlight: 0x38bdf8, // Sky-blue glow for search matches
};

// Node sizes scaled for PoE tree coordinates (world is ~26000 units wide)
const NODE_SIZES = {
  keystone: 150,
  notable: 100,
  small: 50,
  mastery: 90,
  jewelSocket: 100,
  ascendancy: 90,
};

// Cluster jewel node styling - slightly smaller and desaturated colors
const CLUSTER_NODE_COLORS = {
  allocated: {
    notable: 0xd9a050, // Desaturated gold
    small: 0xb89030,   // Desaturated amber
    socket: 0x00aacc,  // Cyan for nested sockets
  },
  unallocated: {
    notable: 0x887755, // Tan (brighter for visibility on dark ring)
    small: 0x776644,   // Brown (brighter for visibility on dark ring)
    socket: 0x448888,  // Cyan (brighter for visibility on dark ring)
  },
};

// Cluster node sizes - smaller than main tree
const CLUSTER_NODE_SIZES = {
  notable: 70,
  small: 35,
  socket: 70,
  mastery: 60,
  keystone: 100,
};

const POB_ASSET_SCALE = 2 * 1.33;
const POB_LINE_CONNECTOR_SCALE = 1.33;
const POB_ORBIT_CONNECTOR_SCALE = 2 * 1.33;
const INACTIVE_ASCENDANCY_ALPHA = 0.25;

const PIXI_DYNAMIC_IMPORT_RELOAD_KEY = 'poa:tree:pixi-dynamic-import-reloaded';

function isDynamicImportChunkError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return (
    message.includes('Failed to fetch dynamically imported module')
    || message.includes('Importing a module script failed')
    || message.includes('Failed to load module script')
  );
}

function recoverFromDynamicImportError(): boolean {
  if (typeof window === 'undefined') return false;

  const hasRetried = window.sessionStorage.getItem(PIXI_DYNAMIC_IMPORT_RELOAD_KEY) === '1';
  if (hasRetried) return false;

  window.sessionStorage.setItem(PIXI_DYNAMIC_IMPORT_RELOAD_KEY, '1');
  window.location.reload();
  return true;
}

export interface InteractiveTreeCanvasProps {
  width: number;
  height: number;
  allocatedNodes: number[];
  /** Tree nodes granted externally, such as annoints, without path connectivity */
  grantedNodeIds?: number[];
  className?: string;
  ascendancyName?: string;
  showControls?: boolean;
  controlsPosition?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  onNodeClick?: (node: TreeNode) => void;
  onNodeHover?: (node: TreeNode | null) => void;
  /** Map of socket node ID -> equipped jewel info for tooltip display */
  equippedJewels?: Map<number, SocketedJewelInfo>;
  /** Map of mastery node ID -> selected effect ID for tooltip display */
  masterySelections?: Record<number, number>;
  /** Cluster jewel nodes with PoB-calculated positions (if provided, uses these instead of local calculation) */
  clusterNodes?: ClusterNodeData[];
  /** Live per-build node overrides from PoB (timeless/radius-modified nodes) */
  nodeOverrides?: Record<number, {
    name: string;
    stats: string[];
    icon?: string;
    activeEffectImage?: string;
    reminderText?: string[];
  }>;
  /** Per-socket timeless jewel data: which nodes each timeless jewel transforms */
  timelessBySocket?: Record<number, {
    jewelName: string;
    conquerorLine?: string;
    transformedNodes: Array<{
      id: number;
      name: string;
      stats: string[];
      originalName?: string;
    }>;
  }>;
  /** External tree data override — when provided, skips the internal useTreeData() hook.
   *  Used by the atlas tree canvas to inject atlas tree data in the same format. */
  treeDataOverride?: TreeData | null;
  /** Search string to highlight matching nodes with a glow. Matches against node name and stats. */
  searchHighlight?: string;
  /** Explicit diff override — when provided, these nodes are highlighted green instead of reading from the store.
   *  Used by the atlas tree canvas to show suggested path nodes without affecting the character tree diff. */
  diffNodes?: { added: number[]; removed: number[] } | null;
}

/**
 * Interactive passive skill tree canvas using Pixi.js
 */
export function InteractiveTreeCanvas({
  width,
  height,
  allocatedNodes,
  grantedNodeIds = [],
  className,
  ascendancyName,
  showControls = true,
  controlsPosition = 'bottom-right',
  onNodeClick,
  onNodeHover,
  equippedJewels,
  masterySelections,
  clusterNodes,
  nodeOverrides,
  timelessBySocket,
  treeDataOverride,
  searchHighlight,
  diffNodes,
}: InteractiveTreeCanvasProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const viewportRef = useRef<Viewport | null>(null);
  const hasRenderedRef = useRef(false);
  const savedViewStateRef = useRef<{ scale: number; x: number; y: number } | null>(null);
  const lastWheelEventRef = useRef<{
    timeStamp: number;
    clientX: number;
    clientY: number;
    delta: number;
  } | null>(null);
  const renderIdleTimeoutRef = useRef<number | null>(null);
  // Debounce search highlight to avoid full scene rebuild on every keystroke
  const [debouncedSearchHighlight, setDebouncedSearchHighlight] = useState(searchHighlight);
  useEffect(() => {
    if (searchHighlight === debouncedSearchHighlight) return;
    const timer = setTimeout(() => setDebouncedSearchHighlight(searchHighlight), 250);
    return () => clearTimeout(timer);
  }, [searchHighlight, debouncedSearchHighlight]);
  const [hoveredNode, setHoveredNode] = useState<TooltipNode | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const [currentZoom, setCurrentZoom] = useState(100);
  const [appReady, setAppReady] = useState(false);
  const [renderTrigger, setRenderTrigger] = useState(0);
  const [initError, setInitError] = useState<string | null>(null);

  // Fetch tree data (skip internal fetch when override is provided)
  const internal = useTreeData();
  const treeData = treeDataOverride !== undefined ? treeDataOverride : internal.data;
  const isLoading = treeDataOverride !== undefined ? !treeDataOverride : internal.loading;
  const error = treeDataOverride !== undefined ? null : internal.error;
  const retry = internal.retry;

  // Debug: Check if sprites are in tree data (only log once when data changes)
  // This log runs on every render - reduce to essential info only

  // Load sprite textures
  const {
    textures,
    getTexture,
    getFrameTexture,
    currentZoomLevel,
    texturesReady,
  } = useTreeSprites(treeData?.sprites, currentZoom / 100);

  // Use the explicit ready signal from the hook - more reliable than deriving it
  const spritesReady = texturesReady;

  const canonicalNodeVisualsByName = useMemo(() => {
    if (!treeData) {
      return new Map<string, Pick<TreeNode, 'icon' | 'activeEffectImage' | 'reminderText'>>();
    }

    const visuals = new Map<string, Pick<TreeNode, 'icon' | 'activeEffectImage' | 'reminderText'>>();

    for (const node of treeData.nodes) {
      if (!node.name) {
        continue;
      }

      const payload = {
        icon: node.icon,
        activeEffectImage: node.activeEffectImage,
        reminderText: node.reminderText,
      };

      const typedKey = `${node.type}:${node.name}`;
      if (!visuals.has(typedKey)) {
        visuals.set(typedKey, payload);
      }

      if (!visuals.has(node.name)) {
        visuals.set(node.name, payload);
      }
    }

    return visuals;
  }, [treeData]);

  const resolveOverrideIcon = useCallback((
    node: TreeNode,
    override: NonNullable<InteractiveTreeCanvasProps['nodeOverrides']>[number]
  ): string => {
    const hasTransformedName = Boolean(override.name && override.name !== node.name);
    const transformedVisuals = hasTransformedName
      ? canonicalNodeVisualsByName.get(`${node.type}:${override.name}`)
        ?? canonicalNodeVisualsByName.get(override.name)
      : undefined;

    // Radius-only effects such as Light of Meaning can attach override metadata
    // without changing the node identity. In that case we must keep the base art.
    if (!hasTransformedName) {
      return node.icon ?? override.icon ?? '';
    }

    const aliasedIcon = getKnownTransformedNodeIconAlias(override.name);

    return transformedVisuals?.icon ?? aliasedIcon ?? override.icon ?? node.icon ?? '';
  }, [canonicalNodeVisualsByName]);

  const resolveNodeIconTexture = useCallback((
    iconKey: string | undefined,
    preferredCategory: string
  ): {
    texture: Texture | null;
    resolvedCategory: string | null;
    iconTargetMaxSize?: number;
  } => {
    if (!spritesReady || !iconKey) {
      return { texture: null, resolvedCategory: null };
    }

    const directTexture = getTexture(preferredCategory, iconKey);
    if (directTexture) {
      return {
        texture: directTexture,
        resolvedCategory: preferredCategory,
      };
    }

    const fallbackCategory = findSpriteCategoryForIcon(
      iconKey,
      treeData?.sprites,
      currentZoomLevel,
      [preferredCategory]
    );

    if (!fallbackCategory || fallbackCategory === preferredCategory) {
      return { texture: null, resolvedCategory: null };
    }

    const fallbackTexture = getTexture(fallbackCategory, iconKey);
    const representativeSize = getRepresentativeSpriteIconSize(
      treeData?.sprites,
      preferredCategory,
      currentZoomLevel,
    );

    return {
      texture: fallbackTexture,
      resolvedCategory: fallbackCategory,
      iconTargetMaxSize: representativeSize
        ? Math.max(representativeSize.width, representativeSize.height) * POB_ASSET_SCALE
        : undefined,
    };
  }, [currentZoomLevel, getTexture, spritesReady, treeData?.sprites]);

  // Pre-compute jewel radius effects map (nodeId -> granted effects from jewels)
  const effectiveTreeNodes = useMemo(() => {
    if (!treeData) return [];
    if (!nodeOverrides || Object.keys(nodeOverrides).length === 0) {
      return treeData.nodes;
    }

    return treeData.nodes.map((node) => {
      const override = nodeOverrides[node.id];
      if (!override) return node;
      const overrideIcon = resolveOverrideIcon(node, override);
      const transformedVisuals = override.name && override.name !== node.name
        ? canonicalNodeVisualsByName.get(`${node.type}:${override.name}`)
          ?? canonicalNodeVisualsByName.get(override.name)
        : undefined;
      return {
        ...node,
        name: override.name,
        stats: override.stats,
        icon: overrideIcon,
        activeIcon: node.type === 'mastery'
          ? overrideIcon || node.activeIcon
          : node.activeIcon,
        activeEffectImage:
          transformedVisuals?.activeEffectImage
          ?? override.activeEffectImage
          ?? node.activeEffectImage,
        reminderText:
          override.reminderText
          ?? transformedVisuals?.reminderText
          ?? node.reminderText,
      };
    });
  }, [canonicalNodeVisualsByName, nodeOverrides, resolveOverrideIcon, treeData]);

  const jewelEffectsMap = useMemo(
    () => treeData ? buildNodeJewelEffectsMap(equippedJewels ?? new Map(), effectiveTreeNodes) : new Map(),
    [effectiveTreeNodes, equippedJewels, treeData],
  );

  // ============================================================================
  // RENDER TRIGGER EFFECT
  // ============================================================================
  // This effect controls WHEN the tree renders. It must wait for ALL prerequisites:
  // 1. appReady - Pixi application is initialized
  // 2. treeData - Tree node data is fetched from backend
  // 3. !isLoading - Data fetch is complete
  // 4. texturesReady - Sprite textures are loaded AND committed to state
  //
  // CRITICAL: We use texturesReady (explicit signal from useTreeSprites) instead of
  // !spritesLoading. The texturesReady flag is set via queueMicrotask AFTER setTextures(),
  // ensuring textures are actually available when this effect triggers the render.
  // This fixes the black screen on first open bug.
  // ============================================================================
  useEffect(() => {
    // All prerequisites must be met before triggering render
    const isReady = appReady && treeData && !isLoading && texturesReady;

    if (!isReady) {
      return;
    }

    // No setTimeout needed - texturesReady guarantees textures are committed
    setRenderTrigger(t => t + 1);
  }, [appReady, treeData, isLoading, texturesReady]);

  // Create stable reference to allocated nodes to avoid dependency array issues
  const allocatedNodesRef = useRef(allocatedNodes);
  allocatedNodesRef.current = allocatedNodes;

  // Tree diff visualization state (added/removed node highlighting)
  // When diffNodes prop is provided (e.g. atlas canvas), it takes precedence over the store value.
  const storeDiffNodes = useDesktopStore((s) => s.treeDiffNodes);
  const treeDiffNodes = diffNodes !== undefined ? diffNodes : storeDiffNodes;
  const treeDiffNodesRef = useRef(treeDiffNodes);
  treeDiffNodesRef.current = treeDiffNodes;

  // Preview cluster subgraph — set when a user clicks a TR pill for a
  // suggested cluster jewel. Merged into clusterNodes so the full cluster
  // "wheel" renders even though the jewel isn't in the persisted build.
  // Node IDs on the preview subgraph can collide with real cluster nodes
  // (PoB reuses the bit-packed ID space), so preview entries lose to real
  // ones during de-dup.
  const previewClusterNodes = useDesktopStore((s) => s.treePreviewClusterNodes);
  const effectiveClusterNodes = useMemo(() => {
    if (!previewClusterNodes || previewClusterNodes.length === 0) return clusterNodes;
    const base = clusterNodes ?? [];
    const existingIds = new Set(base.map((n) => n.id));
    const merged = [...base];
    for (const p of previewClusterNodes) {
      if (existingIds.has(p.id)) continue;
      merged.push(p as unknown as ClusterNodeData);
    }
    return merged;
  }, [clusterNodes, previewClusterNodes]);

  // Create allocated nodes set for quick lookup (shared by tooltip + render effect via ref)
  const allocatedSet = useMemo(() => new Set([
    ...allocatedNodes,
    ...(effectiveClusterNodes?.filter((node) => node.isAllocated).map((node) => node.id) ?? []),
  ]), [allocatedNodes, effectiveClusterNodes]);
  const allocatedSetRef = useRef(allocatedSet);
  allocatedSetRef.current = allocatedSet;

  const visuallyAllocatedSet = useMemo(() => new Set([
    ...allocatedNodes,
    ...grantedNodeIds,
    ...(effectiveClusterNodes?.filter((node) => node.isAllocated).map((node) => node.id) ?? []),
  ]), [allocatedNodes, grantedNodeIds, effectiveClusterNodes]);
  const visuallyAllocatedSetRef = useRef(visuallyAllocatedSet);
  visuallyAllocatedSetRef.current = visuallyAllocatedSet;

  const scheduleRendererSleep = useCallback((delayMs: number = 220) => {
    if (typeof window === 'undefined') {
      return;
    }

    if (renderIdleTimeoutRef.current != null) {
      window.clearTimeout(renderIdleTimeoutRef.current);
    }

    renderIdleTimeoutRef.current = window.setTimeout(() => {
      const app = appRef.current;
      if (!app) {
        return;
      }

      app.ticker.stop();
      renderIdleTimeoutRef.current = null;
    }, delayMs);
  }, []);

  const wakeRenderer = useCallback((idleDelayMs: number = 220, renderNow: boolean = false) => {
    const app = appRef.current;
    if (!app) {
      return;
    }

    if (!app.ticker.started) {
      app.ticker.start();
    }

    if (renderNow) {
      app.render();
    }

    scheduleRendererSleep(idleDelayMs);
  }, [scheduleRendererSleep]);

  // Initialize Pixi application
  useEffect(() => {
    const container = canvasRef.current;
    if (!container) return;

    // Track if this effect instance is still active (for Strict Mode cleanup)
    let isActive = true;
    let app: Application | null = null;

    // Clear any existing canvases from previous renders
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    const initApp = async () => {
      const newApp = new Application();

      try {
        await newApp.init({
          width,
          height,
          backgroundColor: 0x0a0a0f,
          antialias: true,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
        });

        // Check if effect was cleaned up while we were initializing
        if (!isActive) {
          newApp.destroy(true, { children: true });
          return;
        }

        app = newApp;

        // Clear container again in case Strict Mode added something
        while (container.firstChild) {
          container.removeChild(container.firstChild);
        }

        container.appendChild(newApp.canvas);

        // Keep the renderer idle until interaction or an explicit animation needs it.
        newApp.ticker.stop();

        appRef.current = newApp;
        if (typeof window !== 'undefined') {
          window.sessionStorage.removeItem(PIXI_DYNAMIC_IMPORT_RELOAD_KEY);
        }
        setInitError(null);
        setAppReady(true);
      } catch (err) {
        console.error('[TreeCanvas] Failed to initialize Pixi app:', err);

        if (isDynamicImportChunkError(err) && recoverFromDynamicImportError()) {
          return;
        }

        setInitError('Tree renderer failed to initialize. Try reloading the app.');

        // Avoid secondary crash if init failed before renderer was assigned.
        const hasRenderer = Boolean(
          (newApp as Application & { renderer?: unknown }).renderer
        );
        if (hasRenderer) {
          try {
            newApp.destroy(true, { children: true });
          } catch {
            // Ignore destroy errors after init failure.
          }
        }
      }
    };

    initApp();

    return () => {
      isActive = false;

      if (renderIdleTimeoutRef.current != null && typeof window !== 'undefined') {
        window.clearTimeout(renderIdleTimeoutRef.current);
        renderIdleTimeoutRef.current = null;
      }

      // CRITICAL: Remove viewport from stage BEFORE destroying app
      // This prevents the resize plugin bug (this._cancelResize is not a function)
      // The viewport's resize plugin has a bug when destroyed via parent.destroy()
      if (viewportRef.current) {
        try {
          // Remove from parent first to prevent cascading destroy
          if (viewportRef.current.parent) {
            viewportRef.current.parent.removeChild(viewportRef.current);
          }
          // Clear children manually
          viewportRef.current.removeChildren();
        } catch (e) {
          // Ignore cleanup errors
        }
        viewportRef.current = null;
      }

      // Now safe to destroy app (viewport is no longer a child)
      if (app) {
        try {
          app.destroy(true, { children: true });
        } catch (e) {
          // Ignore destroy errors
        }
      }
      if (appRef.current) {
        try {
          appRef.current.destroy(true, { children: true });
        } catch (e) {
          // Ignore destroy errors
        }
        appRef.current = null;
      }
      hasRenderedRef.current = false;
      savedViewStateRef.current = null; // Reset so next mount does initial fit
      setAppReady(false);
    };
  }, []);

  // Update app size when dimensions change.
  // Include appReady so we also catch the race where the parent updates width/height
  // while Pixi is still initializing asynchronously. Without this, the first open can
  // stay stuck at a stale smaller canvas size until the modal is reopened.
  useEffect(() => {
    if (!appReady || !appRef.current) {
      return;
    }

    try {
      appRef.current.renderer.resize(width, height);
      if (viewportRef.current) {
        // Note: viewport.resize can trigger the resize plugin
        // Wrap in try-catch to handle any plugin bugs
        viewportRef.current.resize(width, height);
      }

      if (hasRenderedRef.current) {
        appRef.current.render();
        scheduleRendererSleep(120);
      }
    } catch (e) {
      // Ignore resize errors (can happen during cleanup race conditions)
    }
  }, [appReady, width, height, scheduleRendererSleep]);

  // Render tree when data is loaded and app is ready
  useEffect(() => {
    // Early return if not ready - texturesReady ensures sprites are committed to state
    // This prevents black screen on first open by waiting for textures
    if (!appReady || !appRef.current || !treeData || isLoading || !texturesReady) {
      return;
    }

    const app = appRef.current;

    // Safety check: ensure the canvas is actually in the DOM
    if (!app.canvas || !app.canvas.parentElement) {
      console.warn('[TreeCanvas] App canvas not in DOM, skipping render');
      return;
    }

    // Mark that we've rendered
    hasRenderedRef.current = true;

    // Use the shared allocated sets from refs so node visuals can differ from path connectivity.
    const allocatedSet = allocatedSetRef.current;
    const visuallyAllocatedSet = visuallyAllocatedSetRef.current;
    const isNodeAllocated = (nodeId: number): boolean => allocatedSet.has(nodeId);
    const isNodeVisuallyAllocated = (nodeId: number): boolean => visuallyAllocatedSet.has(nodeId);

    // Create diff sets for tree diff visualization (green=added, red=removed)
    const diffAddedSet = new Set(treeDiffNodesRef.current?.added ?? []);
    const diffRemovedSet = new Set(treeDiffNodesRef.current?.removed ?? []);

    // Build search highlight set: match nodes whose name or stats contain the search term
    const searchHighlightSet = new Set<number>();
    if (debouncedSearchHighlight && debouncedSearchHighlight.trim().length >= 2) {
      const lower = debouncedSearchHighlight.trim().toLowerCase();
      for (const node of treeData.nodes) {
        const nameMatch = node.name?.toLowerCase().includes(lower);
        const statsMatch = node.stats?.some(s => s.toLowerCase().includes(lower));
        if (nameMatch || statsMatch) {
          searchHighlightSet.add(node.id);
        }
      }
    }

    // Clean up old viewport safely before creating new one
    // IMPORTANT: Do NOT call plugins.removeAll() - resize plugin has _cancelResize bug
    if (viewportRef.current) {
      // Save current view state before destroying viewport
      savedViewStateRef.current = {
        scale: viewportRef.current.scale.x,
        x: viewportRef.current.x,
        y: viewportRef.current.y,
      };
      try {
        // Just remove from parent and clear children - don't touch plugins
        if (viewportRef.current.parent) {
          viewportRef.current.parent.removeChild(viewportRef.current);
        }
        viewportRef.current.removeChildren();
      } catch (e) {
        // Ignore cleanup errors
      }
      viewportRef.current = null;
    }

    // Clear existing content from stage
    app.stage.removeChildren();

    // Create viewport for pan/zoom
    const bounds = treeData.bounds;
    const worldWidth = bounds.maxX - bounds.minX + 2000;
    const worldHeight = bounds.maxY - bounds.minY + 2000;

    const viewport = new Viewport({
      screenWidth: width,
      screenHeight: height,
      worldWidth,
      worldHeight,
      events: app.renderer.events,
      passiveWheel: false,    // Allow preventDefault for proper zoom
      stopPropagation: true,  // Prevent event bubbling
      disableOnContextMenu: true,
    });

    // Enable plugins in order
    viewport.drag();
    viewport.pinch();
    // NOTE: We use a manual wheel handler (see below) for better WebView2 compatibility
    // Don't enable pixi-viewport's wheel plugin - it conflicts with our manual handler
    viewport.decelerate({ friction: 0.95 });

    viewport.clampZoom({
      minScale: 0.02, // 2%
      maxScale: 2.0,  // 200%
    });

    // Track zoom changes with named handler for proper cleanup
    const handleZoom = () => {
      setCurrentZoom(Math.round(viewport.scale.x * 100));
      wakeRenderer(260, !app.ticker.started);
    };
    const handleViewportMotion = () => {
      wakeRenderer(260, !app.ticker.started);
    };
    viewport.on('zoomed', handleZoom);
    viewport.on('moved', handleViewportMotion);
    viewport.on('moved-end', handleViewportMotion);
    viewport.on('zoomed-end', handleViewportMotion);

    // Add viewport to stage FIRST, then set zoom/center
    app.stage.addChild(viewport);
    viewportRef.current = viewport;

    // Center on tree center (the tree center is approximately at 0,0)
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;

    // Restore previous view state or do initial fit
    if (savedViewStateRef.current) {
      // Restore saved zoom/position from before viewport was recreated
      viewport.scale.set(savedViewStateRef.current.scale);
      viewport.x = savedViewStateRef.current.x;
      viewport.y = savedViewStateRef.current.y;
    } else {
      // First time: fit tree to view
      viewport.fit(true, worldWidth, worldHeight);
      viewport.moveCenter(centerX, centerY);
    }

    // Create layers — order determines z-index (later = on top).
    // Cluster layers sit between main connections and main nodes so that
    // jewel socket nodes (in nodeLayer) always render above cluster connections.
    // Enable cullableChildren on node-heavy layers so Pixi.js v8's built-in
    // CullerPlugin skips draw calls for off-screen containers.
    const groupLayer = new Container();
    const masteryEffectLayer = new Container();
    const connectionLayer = new Container();
    connectionLayer.cullableChildren = true;
    const clusterRingLayer = new Container();
    const clusterConnectionLayer = new Container();
    clusterConnectionLayer.cullableChildren = true;
    const clusterNodeLayer = new Container();
    clusterNodeLayer.cullableChildren = true;
    const nodeLayer = new Container();
    nodeLayer.cullableChildren = true;
    viewport.addChild(groupLayer);              // 0: tree group backgrounds
    viewport.addChild(masteryEffectLayer);      // 1: mastery active effect backgrounds (below connections)
    viewport.addChild(connectionLayer);         // 2: main tree connections
    viewport.addChild(clusterRingLayer);        // 3: cluster ring backgrounds
    viewport.addChild(clusterConnectionLayer);  // 4: cluster connections
    viewport.addChild(clusterNodeLayer);        // 5: cluster nodes
    viewport.addChild(nodeLayer);               // 6: main tree nodes (jewel sockets on top)

    // Track socket positions for jewel radius overlays (main tree + cluster sockets).
    const socketPositions = new Map<number, { x: number; y: number }>();
    const allocatedSocketIds = new Set<number>();
    const clusterSocketIds = new Set<number>();
    // Build a set of "phantom proxy" socket IDs to hide.
    //
    // Every Large Jewel Socket has 6 nested-proxy descendants in the static
    // tree data (3 Medium + 3 Small sockets, linked via `expansionJewel.parent`).
    // PoB only renders these when NO cluster is equipped — when a cluster is
    // present, PoB replaces them with the cluster subgraph. Without this hide
    // step, those 6 phantoms render as extra empty socket slots around the
    // cluster wheel, which is the "weird empty dots next to the cluster" bug.
    //
    // Rule: hide any node whose ancestor chain (expansionJewel.parent → parent
    // → ...) terminates at a socket that has cluster subgraph nodes in
    // `effectiveClusterNodes`. Keep proxies that are themselves allocated with
    // a real jewel (e.g. Watcher's Eye in a Small proxy socket) — those are
    // legitimate.
    const activeClusterSockets = new Set<number>();
    for (const cn of effectiveClusterNodes ?? []) {
      if (cn.socketNodeId != null) activeClusterSockets.add(cn.socketNodeId);
    }
    const hiddenProxyIds = new Set<number>();
    if (activeClusterSockets.size > 0) {
      const nodesByIdLocal = new Map<number, typeof effectiveTreeNodes[number]>();
      for (const n of effectiveTreeNodes) nodesByIdLocal.set(n.id, n);
      for (const node of effectiveTreeNodes) {
        if (!node.expansionJewel?.parent) continue;
        if (isNodeAllocated(node.id)) continue;
        // Walk up the parent chain — if any ancestor is an active cluster
        // socket, this proxy is hidden.
        let parentId: number | null = parseInt(node.expansionJewel.parent, 10);
        const seen = new Set<number>();
        while (parentId != null && !isNaN(parentId) && !seen.has(parentId)) {
          seen.add(parentId);
          if (activeClusterSockets.has(parentId)) {
            hiddenProxyIds.add(node.id);
            break;
          }
          const parentNode = nodesByIdLocal.get(parentId);
          const nextParent = parentNode?.expansionJewel?.parent;
          parentId = nextParent ? parseInt(nextParent, 10) : null;
        }
      }
    }

    const renderableTreeNodes = effectiveTreeNodes.filter(
      (node) => !node.isProxy && !hiddenProxyIds.has(node.id),
    );

    for (const node of renderableTreeNodes) {
      if (!node.isJewelSocket) continue;
      socketPositions.set(node.id, { x: node.x, y: node.y });
      if (isNodeAllocated(node.id)) {
        allocatedSocketIds.add(node.id);
      }
    }

    // Build cluster jewel details lookup for rich jewel socket tooltips.
    // Maps socket node ID → structural info (notables, small passive grants, counts).
    const clusterDetailsBySocket = new Map<number, ClusterJewelDetails>();
    if (effectiveClusterNodes && effectiveClusterNodes.length > 0) {
      const grouped = new Map<number, ClusterNodeData[]>();
      for (const cn of effectiveClusterNodes) {
        if (cn.socketNodeId == null) continue;
        const arr = grouped.get(cn.socketNodeId) ?? [];
        arr.push(cn);
        grouped.set(cn.socketNodeId, arr);
      }
      for (const [socketId, nodes] of grouped) {
        const notables = nodes
          .filter(n => n.type === 'Notable')
          .map(n => ({ name: n.name, stats: n.stats ?? [] }));
        const smallPassives = nodes.filter(n => n.type === 'Normal');
        const hasNestedSocket = nodes.some(n => n.type === 'Socket');
        // Extract the small passive grant line from the first small passive's stats
        const smallPassiveGrant = smallPassives.length > 0 && smallPassives[0].stats.length > 0
          ? smallPassives[0].stats[0]
          : undefined;
        clusterDetailsBySocket.set(socketId, {
          totalPassives: nodes.filter(n => n.type !== 'Mastery').length,
          smallPassiveGrant,
          notables,
          hasNestedSocket,
        });
      }
    }

    // Assigned after layers are created so node hover handlers can update overlays.
    let updateJewelOverlay = (_hoveredSocketId: number | null = null) => {};

    // Draw tree group artwork using the same assets PoB uses.
    for (const group of Object.values(treeData.groups)) {
      if (group.isAscendancyStart) {
        const portraitKey = getAscendancyClassSpriteKey(group.ascendancyName);
        const portraitTexture = portraitKey ? getTexture('ascendancy', portraitKey) : null;
        const isActiveAscendancy = normalizeAscendancyName(group.ascendancyName) === normalizeAscendancyName(ascendancyName);

        if (portraitTexture) {
          const portraitSprite = createScaledSprite(portraitTexture, {
            x: group.x,
            y: group.y,
            alpha: isActiveAscendancy ? 1 : INACTIVE_ASCENDANCY_ALPHA,
          });
          groupLayer.addChild(portraitSprite);
        }

        continue;
      }

      const backgroundKey = group.background?.image;
      if (!backgroundKey) {
        continue;
      }

      const backgroundTexture = getTexture('groupBackground', backgroundKey);
      if (!backgroundTexture) {
        continue;
      }

      if (group.background?.isHalfImage) {
        const halfSprites = createMirroredHalfSprites(backgroundTexture, group.x, group.y);
        for (const sprite of halfSprites) {
          groupLayer.addChild(sprite);
        }
      } else {
        const backgroundSprite = createScaledSprite(backgroundTexture, {
          x: group.x,
          y: group.y,
        });
        groupLayer.addChild(backgroundSprite);
      }
    }

    const nodesById = new Map(effectiveTreeNodes.map(n => [n.id, n]));
    const normalizedCurrentAscendancyName = normalizeAscendancyName(ascendancyName);

    // Draw connector art using the same line/orbit textures PoB uses.
    for (const node of renderableTreeNodes) {
      for (const connId of node.connections || []) {
        const connNode = nodesById.get(connId);
        if (connNode && node.id < connId) { // Only draw each connection once
          if (connNode.isProxy) {
            continue;
          }

          // Hide special logical start links that PoB does not render as normal branch lines.
          if (shouldHideTreeConnection(node, connNode)) {
            continue;
          }

          const normalizedFromAscendancy = normalizeAscendancyName(node.ascendancyName);
          const normalizedToAscendancy = normalizeAscendancyName(connNode.ascendancyName);
          if (normalizedFromAscendancy !== normalizedToAscendancy) {
            continue;
          }

          if (node.type === 'mastery' || connNode.type === 'mastery' || node.isClassStart || connNode.isClassStart) {
            continue;
          }

          const state = getConnectionState(allocatedSet.has(node.id) && allocatedSet.has(connId));
          const isMutedAscendancy = !!(
            normalizedFromAscendancy
            && normalizedCurrentAscendancyName
            && normalizedFromAscendancy !== normalizedCurrentAscendancyName
          );

          addPoBConnector(connectionLayer, getTexture, node, connNode, {
            state,
            isMuted: isMutedAscendancy,
            groupCenter: node.group != null && node.group === connNode.group
              ? getGroupCenter(treeData.groups, node.group)
              : null,
          });
        }
      }
    }

    for (const node of renderableTreeNodes) {
      const isAllocated = isNodeVisuallyAllocated(node.id);
      const renderableNode = toRenderableNode(node);
      const spriteInfo = resolveSpriteInfo(renderableNode, isAllocated);
      const nodeSize = getNodeSize(renderableNode);

      // Create a container for this node (holds frame + icon sprites or fallback graphics)
      const nodeContainer = new Container();
      nodeContainer.position.set(node.x, node.y);
      nodeContainer.cullable = true;

      const isMasteryNode = node.type === 'mastery';

      // Try to get sprite textures directly (refs were causing stale closure issues)
      // Only attempt lookup if sprites are ready to avoid wasted lookups
      const resolvedIcon = resolveNodeIconTexture(spriteInfo.iconKey, spriteInfo.iconCategory);
      const frameTexture = spritesReady && spriteInfo.frameKey && !isMasteryNode
        ? getFrameTexture(spriteInfo.frameKey)
        : null;
      const activeEffectTexture = spritesReady && spriteInfo.hasActiveEffect && spriteInfo.activeEffectKey
        ? getTexture('masteryActiveEffect', spriteInfo.activeEffectKey)
        : null;

      // Mastery active effect backgrounds render on a separate layer below connections
      // so that connection lines and neighboring nodes draw on top of the glow
      if (activeEffectTexture && isMasteryNode) {
        const effectSprite = createScaledSprite(activeEffectTexture, { x: node.x, y: node.y });
        masteryEffectLayer.addChild(effectSprite);
      }

      const usedSprites = addNodeSprites(
        nodeContainer,
        isMasteryNode ? null : activeEffectTexture,
        resolvedIcon.texture,
        frameTexture,
        renderableNode,
        { iconTargetMaxSize: resolvedIcon.iconTargetMaxSize, isAllocated }
      );

      // Fallback to geometric shapes if sprites not available
      if (!usedSprites) {
        const nodeType = node.type as keyof typeof NODE_COLORS.allocated;
        const color = isAllocated
          ? NODE_COLORS.allocated[nodeType] || NODE_COLORS.allocated.small
          : NODE_COLORS.unallocated[nodeType] || NODE_COLORS.unallocated.small;
        const size = NODE_SIZES[nodeType] || NODE_SIZES.small;

        const fallbackGraphics = new Graphics();

        if (nodeType === 'keystone') {
          drawPolygon(fallbackGraphics, 0, 0, size, 8, color, isAllocated);
        } else if (nodeType === 'notable' || nodeType === 'ascendancy') {
          drawPolygon(fallbackGraphics, 0, 0, size, 6, color, isAllocated);
        } else if (nodeType === 'jewelSocket') {
          drawPolygon(fallbackGraphics, 0, 0, size, 4, color, isAllocated);
        } else {
          fallbackGraphics.circle(0, 0, size);
          fallbackGraphics.fill({ color, alpha: isAllocated ? 1 : 0.7 });
          fallbackGraphics.stroke({
            width: isAllocated ? 8 : 4,
            color: isAllocated ? 0xffffff : 0x666666,
            alpha: isAllocated ? 0.6 : 0.3,
          });
        }

        nodeContainer.addChild(fallbackGraphics);
      }

      // Tree diff overlay (green for added, red for removed)
      const isDiffAdded = diffAddedSet.has(node.id);
      const isDiffRemoved = diffRemovedSet.has(node.id);
      if (isDiffAdded || isDiffRemoved) {
        const glowGraphics = new Graphics();
        const glowColor = isDiffAdded ? NODE_COLORS.diffAdded : NODE_COLORS.diffRemoved;
        const glowSize = nodeSize * 2.5;

        // Outer glow - larger and brighter
        glowGraphics.circle(0, 0, glowSize);
        glowGraphics.fill({ color: glowColor, alpha: 0.4 });
        glowGraphics.circle(0, 0, glowSize * 0.6);
        glowGraphics.fill({ color: glowColor, alpha: 0.3 });

        // Solid bright ring right around the node edge
        glowGraphics.circle(0, 0, nodeSize * 1.2);
        glowGraphics.stroke({ width: 6, color: glowColor, alpha: 0.9 });

        // Place glow behind node content
        nodeContainer.addChildAt(glowGraphics, 0);
      }

      // Search highlight glow (sky-blue)
      if (searchHighlightSet.has(node.id) && !isDiffAdded && !isDiffRemoved) {
        const searchGlow = new Graphics();
        const glowSize = nodeSize * 2.2;

        searchGlow.circle(0, 0, glowSize);
        searchGlow.fill({ color: NODE_COLORS.searchHighlight, alpha: 0.35 });
        searchGlow.circle(0, 0, glowSize * 0.65);
        searchGlow.fill({ color: NODE_COLORS.searchHighlight, alpha: 0.25 });
        searchGlow.circle(0, 0, nodeSize * 1.15);
        searchGlow.stroke({ width: 4, color: NODE_COLORS.searchHighlight, alpha: 0.8 });

        nodeContainer.addChildAt(searchGlow, 0);
      }

      if (node.isJewelSocket) {
        const socketedJewel = equippedJewels?.get(node.id);
        if (socketedJewel) {
          addSocketedJewelIndicator(nodeContainer, socketedJewel, nodeSize, getTexture);
        }
      }

      // Make the container interactive
      nodeContainer.eventMode = 'static';
      nodeContainer.cursor = 'pointer';
      // Hit area is a circle centered at container origin
      nodeContainer.hitArea = {
        contains: (x: number, y: number) => {
          return Math.sqrt(x * x + y * y) <= nodeSize;
        },
      };

      nodeContainer.on('pointerover', (e) => {
        // For jewel sockets, look up the equipped jewel info
        const socketedJewel = node.isJewelSocket && equippedJewels
          ? equippedJewels.get(node.id) ?? null
          : null;

        const { masteryEffects: tooltipMasteryEffects, selectedMasteryEffect } =
          resolveTooltipMasteryDisplay(node, masterySelections);

        // Look up timeless transform info for jewel sockets
        const timelessInfo = node.isJewelSocket && timelessBySocket?.[node.id]
          ? { conquerorLine: timelessBySocket[node.id].conquerorLine, transformedNodes: timelessBySocket[node.id].transformedNodes }
          : undefined;

        // Create a TooltipNode with the socketed jewel info and selected mastery effect
        const tooltipNode: TooltipNode = {
          ...node,
          masteryEffects: tooltipMasteryEffects,
          socketedJewel,
          selectedMasteryEffect,
          jewelGrantedEffects: jewelEffectsMap.get(node.id),
          clusterJewelDetails: clusterDetailsBySocket.get(node.id),
          timelessInfo,
        };

        setHoveredNode(tooltipNode);
        setTooltipPosition(getTooltipAnchorPosition(e.global));
        updateJewelOverlay(node.isJewelSocket ? node.id : null);
        wakeRenderer(260, true);
        onNodeHover?.(node);
      });

      nodeContainer.on('pointerout', () => {
        setHoveredNode(null);
        setTooltipPosition(null);
        updateJewelOverlay(null);
        wakeRenderer(260, true);
        onNodeHover?.(null);
      });

      nodeContainer.on('pointertap', () => {
        onNodeClick?.(node);
      });

      nodeLayer.addChild(nodeContainer);
    }

    // =========================================================================
    // Cluster Jewel Rendering
    // =========================================================================
    // Cluster jewels are dynamic sub-graphs attached to jewel sockets.
    // Cluster node IDs are >= 65536 (CLUSTER_NODE_OFFSET)
    //
    // When clusterNodes prop is provided (from PoB API), use those positions directly.
    // Otherwise, fall back to local position calculation.

    // Cluster layers (clusterRingLayer, clusterConnectionLayer, clusterNodeLayer)
    // are created above with the main tree layers to ensure correct z-ordering.

    // Check if we have PoB-provided cluster node data
    const usePobapiClusterNodes = effectiveClusterNodes && effectiveClusterNodes.length > 0;

    // Diagnostic: detect when cluster jewels are equipped but no cluster nodes arrived
    if (!usePobapiClusterNodes && equippedJewels && equippedJewels.size > 0) {
      const clusterJewelEntries = Array.from(equippedJewels.values()).filter(j => {
        const name = (j.name || '').toLowerCase();
        const base = (j.baseName || '').toLowerCase();
        return name.includes('cluster jewel') || base.includes('cluster jewel');
      });
      if (clusterJewelEntries.length > 0) {
        console.warn('[TreeCanvas] Cluster jewels equipped but no cluster nodes from PoB API:', {
          clusterJewels: clusterJewelEntries.map(j => j.name),
          clusterNodesProp: effectiveClusterNodes?.length ?? 'undefined',
        });
      }
    }

    if (usePobapiClusterNodes) {
      // =====================================================================
      // Render using PoB API cluster node data (accurate positions)
      // =====================================================================
      const pobClusterNodes = effectiveClusterNodes ?? [];
      // Group cluster nodes by their socket for ring rendering
      const nodesBySocket = new Map<number, ClusterNodeData[]>();
      for (const node of pobClusterNodes) {
        if (node.socketNodeId == null) continue;
        const existing = nodesBySocket.get(node.socketNodeId) ?? [];
        existing.push(node);
        nodesBySocket.set(node.socketNodeId, existing);
      }

      // Resolve socket coordinates for both main-tree sockets and nested cluster sockets.
      const socketNodeById = new Map<number, { x: number; y: number; isAllocated: boolean }>();

      for (const socket of effectiveTreeNodes.filter(n => n.isJewelSocket)) {
        socketNodeById.set(socket.id, {
          x: socket.x,
          y: socket.y,
          isAllocated: isNodeAllocated(socket.id),
        });
      }

      for (const clusterNode of pobClusterNodes) {
        if (clusterNode.type !== 'Socket') continue;
        clusterSocketIds.add(clusterNode.id);
        socketNodeById.set(clusterNode.id, {
          x: clusterNode.x,
          y: clusterNode.y,
          isAllocated: isNodeAllocated(clusterNode.id),
        });
        socketPositions.set(clusterNode.id, { x: clusterNode.x, y: clusterNode.y });
        if (isNodeAllocated(clusterNode.id)) {
          allocatedSocketIds.add(clusterNode.id);
        }
      }

      // Draw rings for each cluster socket and render nodes
      for (const [socketNodeId, socketClusterNodes] of nodesBySocket) {
        // Find the socket position (main tree socket or nested cluster socket)
        const socketNode = socketNodeById.get(socketNodeId);
        if (!socketNode) {
          console.warn(`[TreeCanvas] Socket node ${socketNodeId} not found in tree data`);
          continue;
        }

        const socketX = socketNode.x;
        const socketY = socketNode.y;
        const clusterAnchorNode = socketClusterNodes.find(
          (node) => typeof node.groupX === 'number' && typeof node.groupY === 'number'
        );
        const clusterSize = normalizeClusterSize(
          clusterAnchorNode?.clusterSize,
          socketClusterNodes.find((node) => node.type !== 'Mastery')?.orbit
        );
        const groupX = clusterAnchorNode?.groupX ?? socketX;
        const groupY = clusterAnchorNode?.groupY ?? socketY;
        const orbitRadiusFallback = getClusterOrbitRadius(clusterSize);
        const orbitNodes = socketClusterNodes.filter((node) => node.type !== 'Mastery');
        const orbitRadius = orbitNodes.length > 0
          ? Math.max(...orbitNodes.map((node) => Math.hypot(node.x - groupX, node.y - groupY)))
          : orbitRadiusFallback;
        const ringOuterRadius = orbitRadius * 1.15;

        addClusterRingBackground(
          clusterRingLayer,
          { x: groupX, y: groupY },
          ringOuterRadius
        );

        const clusterNodeById = new Map<number, ClusterNodeData>();
        for (const node of socketClusterNodes) {
          clusterNodeById.set(node.id, node);
        }

        // Belt-and-suspenders: PoB's `node.linked` sometimes includes stale
        // cross-tree refs to unrelated main-tree jewel sockets (e.g. cluster
        // notable 65618 → Watcher's Eye socket 12161 ~800 units away).
        // The Lua handler also filters these, but sessions imported before
        // the Lua fix still carry the stale links in cached vizData. Drop
        // any link that isn't a cluster-id node (>= 0x10000) or this
        // cluster's parent socket.
        const isValidClusterLink = (linkedId: number): boolean =>
          linkedId >= 0x10000 || linkedId === socketNodeId;

        // Diagnostic: detect cluster nodes with missing links (would cause gaps in ring)
        const nodesWithoutLinks = socketClusterNodes.filter(
          n => (!n.links || n.links.length === 0) && n.type !== 'Mastery'
        );
        if (nodesWithoutLinks.length > 0) {
          console.warn('[TreeCanvas] Cluster nodes missing links:', {
            socketId: socketNodeId,
            count: nodesWithoutLinks.length,
            nodes: nodesWithoutLinks.map(n => ({ id: n.id, name: n.name, type: n.type })),
          });
        }

        const drawnEdges = new Set<string>();
        for (const node of socketClusterNodes) {
          for (const linkedNodeId of node.links ?? []) {
            if (!isValidClusterLink(linkedNodeId)) continue;
            const isParentSocketLink = linkedNodeId === socketNodeId;
            const linkedNode = clusterNodeById.get(linkedNodeId);
            const linkedSocketNode = linkedNode ? null : socketNodeById.get(linkedNodeId);

            if (!linkedNode && !linkedSocketNode && !isParentSocketLink) continue;

            const edgeKey = node.id < linkedNodeId
              ? `${node.id}:${linkedNodeId}`
              : `${linkedNodeId}:${node.id}`;
            if (drawnEdges.has(edgeKey)) continue;
            drawnEdges.add(edgeKey);

            const isActive = isNodeAllocated(node.id)
              && (
                isParentSocketLink
                  ? socketNode.isAllocated
                  : linkedNode
                    ? isNodeAllocated(linkedNodeId)
                    : linkedSocketNode?.isAllocated === true
              );
            const state = getConnectionState(isActive);

            if (isParentSocketLink) {
              addPoBConnector(clusterConnectionLayer, getTexture, {
                id: socketNodeId,
                x: socketX,
                y: socketY,
              }, node, {
                state,
                groupCenter: null,
              });
              continue;
            }

            if (linkedNode) {
              addPoBConnector(clusterConnectionLayer, getTexture, node, linkedNode, {
                state,
                groupCenter: { x: groupX, y: groupY },
              });
              continue;
            }

            if (linkedSocketNode) {
              addPoBConnector(
                clusterConnectionLayer,
                getTexture,
                node,
                toClusterSocketConnectorNode(linkedNodeId, linkedSocketNode, node.orbit),
                {
                  state,
                  groupCenter: { x: groupX, y: groupY },
                }
              );
            }
          }
        }

        // Draw cluster nodes using PoB positions
        for (const node of socketClusterNodes) {
          const isAllocated = isNodeVisuallyAllocated(node.id);
          const renderableNode = toClusterRenderableNode(node);
          const isSyntheticCenterNode = isSyntheticClusterCenterNode(node);
          const spriteInfo = resolveSpriteInfo(renderableNode, isAllocated);
          const nodeSize = getNodeSize(renderableNode);
          const nodeContainer = new Container();
          nodeContainer.position.set(node.x, node.y);
          nodeContainer.cullable = true;
          const isMasteryNode = renderableNode.isMastery && !isSyntheticCenterNode;
          const frameTexture = spritesReady && spriteInfo.frameKey && !isMasteryNode && !isSyntheticCenterNode
            ? getFrameTexture(spriteInfo.frameKey)
            : null;
          const activeEffectTexture = spritesReady && spriteInfo.hasActiveEffect && spriteInfo.activeEffectKey
            ? getTexture('masteryActiveEffect', spriteInfo.activeEffectKey)
            : null;

          let iconTexture: Texture | null;
          let iconSizeHint: { iconTargetMaxSize: number | undefined } | undefined;
          if (isSyntheticCenterNode) {
            iconTexture = getSyntheticClusterCenterTexture(getTexture, renderableNode.icon, spritesReady);
            iconSizeHint = undefined;
          } else {
            const resolved = resolveNodeIconTexture(spriteInfo.iconKey, spriteInfo.iconCategory);
            iconTexture = resolved.texture;
            iconSizeHint = { iconTargetMaxSize: resolved.iconTargetMaxSize };
          }

          const usedSprites = addNodeSprites(
            nodeContainer,
            activeEffectTexture,
            iconTexture,
            frameTexture,
            renderableNode,
            iconSizeHint
          );

          if (!usedSprites) {
            const nodeType = getClusterNodeShapeType(node.type);
            let color: number;
            if (nodeType === 'socket') {
              color = isAllocated
                ? CLUSTER_NODE_COLORS.allocated.socket
                : CLUSTER_NODE_COLORS.unallocated.socket;
            } else if (nodeType === 'notable') {
              color = isAllocated
                ? CLUSTER_NODE_COLORS.allocated.notable
                : CLUSTER_NODE_COLORS.unallocated.notable;
            } else {
              color = isAllocated
                ? CLUSTER_NODE_COLORS.allocated.small
                : CLUSTER_NODE_COLORS.unallocated.small;
            }

            const sizeKey = nodeType === 'small' ? 'small' : nodeType;
            const size = CLUSTER_NODE_SIZES[sizeKey as keyof typeof CLUSTER_NODE_SIZES] || CLUSTER_NODE_SIZES.small;
            const fallbackGraphics = new Graphics();

            if (nodeType === 'notable') {
              drawPolygon(fallbackGraphics, 0, 0, size, 6, color, isAllocated);
            } else if (nodeType === 'socket') {
              drawPolygon(fallbackGraphics, 0, 0, size, 4, color, isAllocated);
            } else if (nodeType === 'keystone') {
              drawPolygon(fallbackGraphics, 0, 0, size, 8, color, isAllocated);
            } else {
              fallbackGraphics.circle(0, 0, size);
              fallbackGraphics.fill({ color, alpha: isAllocated ? 1 : 0.75 });
              fallbackGraphics.stroke({
                width: isAllocated ? 6 : 4,
                color: isAllocated ? 0xffffff : 0x888888,
                alpha: isAllocated ? 0.5 : 0.35,
              });
            }

            nodeContainer.addChild(fallbackGraphics);
          }

          if (renderableNode.isJewelSocket) {
            const socketedJewel = equippedJewels?.get(node.id);
            if (socketedJewel) {
              addSocketedJewelIndicator(nodeContainer, socketedJewel, nodeSize, getTexture);
            }
          }

          const clusterTreeNode = toClusterTreeNode(node);
          if (isSyntheticCenterNode) {
            nodeContainer.eventMode = 'none';
            clusterNodeLayer.addChild(nodeContainer);
            continue;
          }

          nodeContainer.eventMode = 'static';
          nodeContainer.cursor = 'pointer';
          nodeContainer.hitArea = {
            contains: (x: number, y: number) => {
              return Math.sqrt(x * x + y * y) <= nodeSize;
            },
          };

          nodeContainer.on('pointerover', (e) => {
            const socketedJewel = renderableNode.isJewelSocket && equippedJewels
              ? equippedJewels.get(node.id) ?? null
              : null;
            const clusterTimelessInfo = renderableNode.isJewelSocket && timelessBySocket?.[node.id]
              ? { conquerorLine: timelessBySocket[node.id].conquerorLine, transformedNodes: timelessBySocket[node.id].transformedNodes }
              : undefined;
            const tooltipNode: TooltipNode = {
              ...clusterTreeNode,
              socketedJewel,
              jewelGrantedEffects: jewelEffectsMap.get(node.id),
              clusterJewelDetails: clusterDetailsBySocket.get(node.id),
              timelessInfo: clusterTimelessInfo,
            };

            setHoveredNode(tooltipNode);
            setTooltipPosition(getTooltipAnchorPosition(e.global));
            updateJewelOverlay(renderableNode.isJewelSocket ? node.id : null);
            wakeRenderer(260, true);
            onNodeHover?.(clusterTreeNode);
          });

          nodeContainer.on('pointerout', () => {
            setHoveredNode(null);
            setTooltipPosition(null);
            updateJewelOverlay(null);
            wakeRenderer(260, true);
            onNodeHover?.(null);
          });

          nodeContainer.on('pointertap', () => {
            onNodeClick?.(clusterTreeNode);
          });

          clusterNodeLayer.addChild(nodeContainer);
        }
      }
    } else {
      // =====================================================================
      // Fallback: Calculate positions locally (legacy behavior)
      // =====================================================================
      // Filter allocated nodes to find cluster nodes
      const clusterNodeIds = Array.from(allocatedSet).filter(id => isClusterNode(id));

      if (clusterNodeIds.length > 0) {
        // Group cluster nodes by their socket
        const clusterGroups = groupClusterNodesBySocket(clusterNodeIds);

        // Find jewel socket nodes in the main tree for position reference
        const jewelSockets = effectiveTreeNodes.filter(n => n.isJewelSocket);

        // Track which sockets have been used to avoid double-assignment
        const usedSocketIds = new Set<number>();

        // Process each cluster group
        for (const [socketKey, localClusterNodes] of clusterGroups) {
          if (localClusterNodes.length === 0) continue;

          // Determine cluster size from the first node
          const firstNode = localClusterNodes[0];
          const clusterSize = firstNode.size;

          // Find the corresponding jewel socket using equipped jewels data
          const socketNode = findClusterJewelSocket(clusterSize, equippedJewels, jewelSockets, usedSocketIds);

          if (!socketNode) {
            console.warn(`[TreeCanvas] Could not find socket for ${clusterSize} cluster jewel`);
            continue;
          }

          // Mark this socket as used
          usedSocketIds.add(socketNode.id);

          // Get socket position
          const socketX = socketNode.x;
          const socketY = socketNode.y;

          const fallbackGroupCenter = getFallbackClusterGroupCenter(socketX, socketY, clusterSize);
          addClusterRingBackground(
            clusterRingLayer,
            fallbackGroupCenter,
            getClusterOrbitRadius(clusterSize) * 1.15
          );

          // Calculate cluster layout positions
          const notableCount = localClusterNodes.filter(n => {
            const config = n.size === 'large' ? [6, 4, 8, 10, 2] :
                           n.size === 'medium' ? [6, 10, 2, 0] : [4];
            return config.includes(n.nodeIndex);
          }).length;

          const socketCount = localClusterNodes.filter(n => {
            const config = n.size === 'large' ? [4, 8, 6] :
                           n.size === 'medium' ? [6] : [4];
            return config.includes(n.nodeIndex);
          }).length;

          const positions = calculateClusterLayout(
            socketX,
            socketY,
            clusterSize,
            localClusterNodes.length,
            notableCount,
            socketCount,
            0
          );

          // Create a position map for rendering
          const positionMap = new Map<number, ClusterNodePosition>();

          // Map actual cluster node IDs to calculated positions
          for (let i = 0; i < localClusterNodes.length && i < positions.length; i++) {
            const clusterNode = localClusterNodes[i];
            const pos = positions.find(p => p.nodeIndex === clusterNode.nodeIndex) || positions[i];
            positionMap.set(clusterNode.id, {
              ...pos,
              id: clusterNode.id,
            });
          }

          // Generate and draw cluster connections
          const connections = generateClusterConnections(
            Array.from(positionMap.values()),
            socketNode.id,
            clusterSize
          );
          const fallbackClusterOrbit = getClusterConnectorOrbit(clusterSize);

          for (const conn of connections) {
            let fromPos: ClusterNodePosition | { x: number; y: number } | undefined;
            let toPos: ClusterNodePosition | { x: number; y: number } | undefined;

            if (conn.fromId === socketNode.id) {
              fromPos = { x: socketX, y: socketY };
            } else {
              const clusterPos = positionMap.get(conn.fromId);
              if (clusterPos) fromPos = { x: clusterPos.x, y: clusterPos.y };
            }

            if (conn.toId === socketNode.id) {
              toPos = { x: socketX, y: socketY };
            } else {
              const clusterPos = positionMap.get(conn.toId);
              if (clusterPos) toPos = { x: clusterPos.x, y: clusterPos.y };
            }

            if (fromPos && toPos) {
              const fromAllocated = conn.fromId === socketNode.id || isNodeAllocated(conn.fromId);
              const toAllocated = conn.toId === socketNode.id || isNodeAllocated(conn.toId);
              const state = getConnectionState(fromAllocated && toAllocated);
              const fromIsSocket = conn.fromId === socketNode.id;
              const toIsSocket = conn.toId === socketNode.id;

              addPoBConnector(clusterConnectionLayer, getTexture, {
                id: conn.fromId,
                x: fromPos.x,
                y: fromPos.y,
                orbit: fromIsSocket ? undefined : fallbackClusterOrbit,
              }, {
                id: conn.toId,
                x: toPos.x,
                y: toPos.y,
                orbit: toIsSocket ? undefined : fallbackClusterOrbit,
              }, {
                state,
                groupCenter: fromIsSocket || toIsSocket ? null : fallbackGroupCenter,
              });
            }
          }

          // Draw cluster nodes
          for (const [nodeId, pos] of positionMap) {
            const isAllocated = isNodeAllocated(nodeId);
            const nodeType = pos.type;

            if (nodeType === 'socket') {
              clusterSocketIds.add(nodeId);
              socketPositions.set(nodeId, { x: pos.x, y: pos.y });
              if (isAllocated) {
                allocatedSocketIds.add(nodeId);
              }
            }

            let color: number;
            if (nodeType === 'socket') {
              color = isAllocated
                ? CLUSTER_NODE_COLORS.allocated.socket
                : CLUSTER_NODE_COLORS.unallocated.socket;
            } else if (nodeType === 'notable') {
              color = isAllocated
                ? CLUSTER_NODE_COLORS.allocated.notable
                : CLUSTER_NODE_COLORS.unallocated.notable;
            } else {
              color = isAllocated
                ? CLUSTER_NODE_COLORS.allocated.small
                : CLUSTER_NODE_COLORS.unallocated.small;
            }

            const size = CLUSTER_NODE_SIZES[nodeType] || CLUSTER_NODE_SIZES.small;

            const clusterNodeGraphics = new Graphics();

            if (nodeType === 'notable') {
              drawPolygon(clusterNodeGraphics, pos.x, pos.y, size, 6, color, isAllocated);
            } else if (nodeType === 'socket') {
              drawPolygon(clusterNodeGraphics, pos.x, pos.y, size, 4, color, isAllocated);
            } else if (nodeType === 'keystone') {
              drawPolygon(clusterNodeGraphics, pos.x, pos.y, size, 8, color, isAllocated);
            } else {
              clusterNodeGraphics.circle(pos.x, pos.y, size);
              clusterNodeGraphics.fill({ color, alpha: isAllocated ? 1 : 0.75 });
              clusterNodeGraphics.stroke({
                width: isAllocated ? 6 : 4,
                color: isAllocated ? 0xffffff : 0x888888,
                alpha: isAllocated ? 0.5 : 0.35,
              });
            }

            clusterNodeGraphics.eventMode = 'static';
            clusterNodeGraphics.cursor = 'pointer';
            clusterNodeGraphics.hitArea = {
              contains: (x: number, y: number) => {
                const dx = x - pos.x;
                const dy = y - pos.y;
                return Math.sqrt(dx * dx + dy * dy) <= size + 5;
              },
            };

            clusterNodeGraphics.on('pointerover', (e) => {
              const treeNodeType = getClusterTreeNodeType(nodeType);
              const socketedJewel = nodeType === 'socket' && equippedJewels
                ? equippedJewels.get(nodeId) ?? null
                : null;
              const parentJewel = equippedJewels?.get(socketNode.id);
              const capitalizedType = nodeType.charAt(0).toUpperCase() + nodeType.slice(1);
              const tooltipNode: TooltipNode = {
                id: nodeId,
                name: `Cluster ${capitalizedType} Passive`,
                stats: parentJewel
                  ? [`Part of ${parentJewel.name}`]
                  : [`Part of ${clusterSize} cluster jewel`],
                x: pos.x,
                y: pos.y,
                type: treeNodeType,
                isJewelSocket: nodeType === 'socket',
                isAscendancyStart: false,
                connections: [],
                icon: '',
                socketedJewel,
                jewelGrantedEffects: jewelEffectsMap.get(nodeId),
              };

              setHoveredNode(tooltipNode);
              setTooltipPosition(getTooltipAnchorPosition(e.global));
              updateJewelOverlay(nodeType === 'socket' ? nodeId : null);
              wakeRenderer(260, true);
            });

            clusterNodeGraphics.on('pointerout', () => {
              setHoveredNode(null);
              setTooltipPosition(null);
              updateJewelOverlay(null);
              wakeRenderer(260, true);
            });

            clusterNodeGraphics.on('pointertap', () => {
              const treeNodeType = getClusterTreeNodeType(nodeType);
              const clusterTreeNode: TreeNode = {
                id: nodeId,
                name: `Cluster ${nodeType.charAt(0).toUpperCase() + nodeType.slice(1)}`,
                stats: [`Part of ${clusterSize} cluster jewel`],
                x: pos.x,
                y: pos.y,
                type: treeNodeType,
                isJewelSocket: nodeType === 'socket',
                isAscendancyStart: false,
                connections: [],
                icon: '',
              };
              onNodeClick?.(clusterTreeNode);
            });

            clusterNodeLayer.addChild(clusterNodeGraphics);
          }
        }
      }
    }

    // Jewel radius overlays (supports main-tree and nested cluster sockets).
    const jewelData = new Map<number, JewelSocketInfo>();
    const passiveNodePositionsByName = new Map<string, { x: number; y: number }>();
    for (const treeNode of effectiveTreeNodes) {
      if (!treeNode.name) continue;
      passiveNodePositionsByName.set(treeNode.name.toLowerCase(), {
        x: treeNode.x,
        y: treeNode.y,
      });
    }
    if (equippedJewels) {
      for (const [nodeId, jewel] of equippedJewels) {
        if (!socketPositions.has(nodeId)) continue;
        jewelData.set(nodeId, {
          nodeId,
          name: jewel.name,
          baseName: jewel.baseName,
          iconUrl: jewel.iconUrl,
          radiusLabel: jewel.radiusLabel,
          radiusIndex: jewel.radiusIndex,
          impossibleEscapeKeystoneName: jewel.impossibleEscapeKeystoneName,
          isTimeless: jewel.isTimeless,
          isThreadOfHope: jewel.isThreadOfHope,
          isClusterJewel: jewel.isClusterJewel,
        });
      }
    }

    const jewelOverlayTextures: JewelSocketOverlayTextures = {
      hoverRing: getTexture('treeUi', 'ring'),
      shadedOuterRing: getTexture('treeUi', 'ShadedOuterRing'),
      shadedOuterRingFlipped: getTexture('treeUi', 'ShadedOuterRingFlipped'),
      shadedInnerRing: getTexture('treeUi', 'ShadedInnerRing'),
      shadedInnerRingFlipped: getTexture('treeUi', 'ShadedInnerRingFlipped'),
      timelessVaal1: getTexture('jewelRadius', 'VaalJewelCircle1'),
      timelessVaal2: getTexture('jewelRadius', 'VaalJewelCircle2'),
      timelessTemplar1: getTexture('jewelRadius', 'TemplarJewelCircle1'),
      timelessTemplar2: getTexture('jewelRadius', 'TemplarJewelCircle2'),
      timelessMaraketh1: getTexture('jewelRadius', 'MarakethJewelCircle1'),
      timelessMaraketh2: getTexture('jewelRadius', 'MarakethJewelCircle2'),
      timelessKarui1: getTexture('jewelRadius', 'KaruiJewelCircle1'),
      timelessKarui2: getTexture('jewelRadius', 'KaruiJewelCircle2'),
      timelessEternal1: getTexture('jewelRadius', 'EternalEmpireJewelCircle1'),
      timelessEternal2: getTexture('jewelRadius', 'EternalEmpireJewelCircle2'),
    };
    const jewelOverlayBaseConfig = {
      socketPositions,
      jewelData,
      allocatedSocketIds,
      clusterSocketIds,
      passiveNodePositionsByName,
      textures: jewelOverlayTextures,
    };
    const jewelOverlayContainer = new Container();

    const overlayInsertIndex = viewport.getChildIndex(nodeLayer);
    viewport.addChildAt(jewelOverlayContainer, overlayInsertIndex);

    updateJewelOverlay = (hoveredSocketId: number | null = null) => {
      drawJewelSocketOverlays(jewelOverlayContainer, {
        ...jewelOverlayBaseConfig,
        hoveredSocketId,
      });
    };
    updateJewelOverlay(null);

    setCurrentZoom(Math.round(viewport.scale.x * 100));

    // Force an immediate render to show the tree
    app.render();
    scheduleRendererSleep(120);

    // Cleanup function to prevent memory leaks
    // IMPORTANT: Do NOT call viewport.plugins.removeAll() or viewport.destroy() here
    // The pixi-viewport resize plugin has a bug where _cancelResize is undefined during cleanup
    return () => {
      try {
        viewport.off('zoomed', handleZoom);
        viewport.off('moved', handleViewportMotion);
        viewport.off('moved-end', handleViewportMotion);
        viewport.off('zoomed-end', handleViewportMotion);
      } catch (e) {
        // Ignore
      }
      // Note: viewport cleanup happens at the START of the next render effect, not here
      // This avoids the resize plugin bug entirely
    };
  }, [appReady, treeData, isLoading, texturesReady, width, height, ascendancyName, onNodeClick, onNodeHover, renderTrigger, equippedJewels, getTexture, getFrameTexture, treeDiffNodes, effectiveClusterNodes, allocatedNodes, grantedNodeIds, effectiveTreeNodes, visuallyAllocatedSet, scheduleRendererSleep, wakeRenderer, debouncedSearchHighlight]);

  // Auto-center viewport on diff nodes when they change (including on first mount)
  const prevDiffForCenterRef = useRef<typeof treeDiffNodes>(null);
  useEffect(() => {
    if (treeDiffNodes !== null && prevDiffForCenterRef.current !== treeDiffNodes && viewportRef.current && treeData) {
      const allIds = [...treeDiffNodes.added, ...treeDiffNodes.removed];
      if (allIds.length > 0) {
        const positions = allIds
          .map(id => effectiveTreeNodes.find(n => n.id === id))
          .filter((n): n is NonNullable<typeof n> => n != null);
        if (positions.length > 0) {
          const cx = positions.reduce((sum, n) => sum + n.x, 0) / positions.length;
          const cy = positions.reduce((sum, n) => sum + n.y, 0) / positions.length;
          // Compute spread to pick a zoom level that fits all nodes
          const maxDist = Math.max(
            ...positions.map(n => Math.sqrt((n.x - cx) ** 2 + (n.y - cy) ** 2)),
            1
          );
          // Scale so spread fits comfortably — larger spread = more zoomed out
          const targetScale = Math.min(1.0, Math.max(0.15, 3000 / maxDist));
          wakeRenderer(800, true);
          viewportRef.current.animate({
            position: { x: cx, y: cy },
            scale: targetScale,
            time: 600,
            ease: 'easeOutQuad',
          });
        }
      }
    }
    prevDiffForCenterRef.current = treeDiffNodes;
  }, [treeDiffNodes, treeData, wakeRenderer]);

  // Zoom limits
  const MIN_SCALE = 0.02; // 2%
  const MAX_SCALE = 2.0;  // 200%

  // Viewport controls
  const viewportControls: TreeViewportControls = {
    zoomIn: useCallback(() => {
      if (viewportRef.current) {
        // Zoom in by 25%
        const oldScale = viewportRef.current.scale.x;
        const newScale = Math.min(MAX_SCALE, oldScale * 1.25);
        viewportRef.current.scale.set(newScale);
        setCurrentZoom(Math.round(newScale * 100));
        wakeRenderer(260, true);
      }
    }, [wakeRenderer]),
    zoomOut: useCallback(() => {
      if (viewportRef.current) {
        // Zoom out by 20%
        const oldScale = viewportRef.current.scale.x;
        const newScale = Math.max(MIN_SCALE, oldScale * 0.8);
        viewportRef.current.scale.set(newScale);
        setCurrentZoom(Math.round(newScale * 100));
        wakeRenderer(260, true);
      }
    }, [wakeRenderer]),
    setZoom: useCallback((zoomPercent: number) => {
      if (viewportRef.current) {
        const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, zoomPercent / 100));
        viewportRef.current.scale.set(newScale);
        setCurrentZoom(Math.round(newScale * 100));
        wakeRenderer(260, true);
      }
    }, [wakeRenderer]),
    resetView: useCallback(() => {
      if (viewportRef.current && treeData) {
        const viewport = viewportRef.current;
        const b = treeData.bounds;

        // Calculate the scale needed to fit the tree with padding
        const padding = 0.9; // 90% of available space
        const scaleX = (width * padding) / (b.maxX - b.minX + 2000);
        const scaleY = (height * padding) / (b.maxY - b.minY + 2000);
        const fitScale = Math.min(scaleX, scaleY, MAX_SCALE);

        // Apply the scale
        viewport.scale.set(fitScale);

        // Center on the tree
        const centerX = (b.minX + b.maxX) / 2;
        const centerY = (b.minY + b.maxY) / 2;

        // Move viewport so the center of the tree is at the center of the screen
        viewport.x = width / 2 - centerX * fitScale;
        viewport.y = height / 2 - centerY * fitScale;

        setCurrentZoom(Math.round(fitScale * 100));
        wakeRenderer(260, true);
      }
    }, [treeData, width, height, wakeRenderer]),
    centerOnClass: useCallback((targetClassName: string) => {
      // Class starting positions (approximate)
      const classPositions: Record<string, { x: number; y: number }> = {
        'Marauder': { x: -10400, y: 5200 },
        'Ranger': { x: 10400, y: 5200 },
        'Witch': { x: 0, y: -9700 },
        'Duelist': { x: 6500, y: 9100 },
        'Templar': { x: -6500, y: -6500 },
        'Shadow': { x: 6500, y: -6500 },
        'Scion': { x: 0, y: 2200 },
      };

      const pos = classPositions[targetClassName];
      if (viewportRef.current && pos) {
        wakeRenderer(800, true);
        viewportRef.current.animate({
          position: pos,
          scale: 0.5,
          time: 500,
          ease: 'easeOutQuad',
        });
      }
    }, [wakeRenderer]),
    centerOnNode: useCallback((nodeId: number) => {
      if (viewportRef.current && treeData) {
        const node = effectiveTreeNodes.find(n => n.id === nodeId);
        if (node) {
          wakeRenderer(800, true);
          viewportRef.current.animate({
            position: { x: node.x, y: node.y },
            scale: 1,
            time: 500,
            ease: 'easeOutQuad',
          });
        }
      }
    }, [treeData, effectiveTreeNodes, wakeRenderer]),
    currentZoom,
    minZoom: 2,   // MIN_SCALE * 100
    maxZoom: 200, // MAX_SCALE * 100
  };

  const applyWheelZoom = useCallback((
    clientX: number,
    clientY: number,
    normalizedDeltaY: number
  ): boolean => {
    const viewport = viewportRef.current;
    const canvasContainer = canvasRef.current;

    if (!viewport || !canvasContainer || normalizedDeltaY === 0) {
      return false;
    }

    const rect = canvasContainer.getBoundingClientRect();
    if (
      clientX < rect.left
      || clientX > rect.right
      || clientY < rect.top
      || clientY > rect.bottom
    ) {
      return false;
    }

    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;
    const oldScale = viewport.scale.x;
    const newScale = getWheelZoomScale(oldScale, normalizedDeltaY, MIN_SCALE, MAX_SCALE);

    if (Math.abs(newScale - oldScale) <= 0.0001) {
      return false;
    }

    const worldX = (mouseX - viewport.x) / oldScale;
    const worldY = (mouseY - viewport.y) / oldScale;

    viewport.scale.set(newScale);
    viewport.x = mouseX - worldX * newScale;
    viewport.y = mouseY - worldY * newScale;

    setCurrentZoom(Math.round(newScale * 100));
    wakeRenderer(260, true);
    return true;
  }, [wakeRenderer]);

  const shouldIgnoreDuplicateWheel = useCallback((
    clientX: number,
    clientY: number,
    normalizedDeltaY: number,
    timeStamp: number
  ): boolean => {
    const previousEvent = lastWheelEventRef.current;
    const isDuplicate = Boolean(
      previousEvent
      && Math.abs(previousEvent.timeStamp - timeStamp) <= 5
      && Math.abs(previousEvent.clientX - clientX) <= 1
      && Math.abs(previousEvent.clientY - clientY) <= 1
      && Math.abs(previousEvent.delta - normalizedDeltaY) <= 0.5
    );

    if (isDuplicate) {
      return true;
    }

    lastWheelEventRef.current = {
      timeStamp,
      clientX,
      clientY,
      delta: normalizedDeltaY,
    };

    return false;
  }, []);

  const getTooltipAnchorPosition = useCallback((globalPos: { x: number; y: number }) => {
    const canvasBounds = canvasRef.current?.getBoundingClientRect();
    if (!canvasBounds) {
      return { x: globalPos.x, y: globalPos.y };
    }

    return {
      x: canvasBounds.left + globalPos.x,
      y: canvasBounds.top + globalPos.y,
    };
  }, []);

  useEffect(() => {
    const rootElement = rootRef.current;
    const canvasContainer = canvasRef.current;
    const rendererElement = appRef.current?.renderer?.events?.domElement as HTMLElement | undefined;

    const targets = new Set<HTMLElement>();
    if (rootElement) targets.add(rootElement);
    if (canvasContainer) targets.add(canvasContainer);
    if (rendererElement) targets.add(rendererElement);

    if (targets.size === 0) {
      return;
    }

    const handleNativeWheel = (event: Event) => {
      const wheelEvent = event as WheelEvent & {
        wheelDelta?: number;
        detail?: number;
      };

      const normalizedDeltaY = extractNormalizedWheelDelta({
        deltaY: wheelEvent.deltaY,
        deltaMode: wheelEvent.deltaMode,
        wheelDelta: wheelEvent.wheelDelta,
        detail: wheelEvent.detail,
      }, canvasContainer?.clientHeight || height);

      if (normalizedDeltaY === 0) {
        return;
      }

      if (
        shouldIgnoreDuplicateWheel(
          wheelEvent.clientX,
          wheelEvent.clientY,
          normalizedDeltaY,
          wheelEvent.timeStamp
        )
      ) {
        wheelEvent.preventDefault();
        wheelEvent.stopPropagation();
        return;
      }

      if (applyWheelZoom(wheelEvent.clientX, wheelEvent.clientY, normalizedDeltaY)) {
        wheelEvent.preventDefault();
        wheelEvent.stopPropagation();
      }
    };

    for (const target of targets) {
      target.addEventListener('wheel', handleNativeWheel, { passive: false, capture: true });
      target.addEventListener('mousewheel', handleNativeWheel, { passive: false, capture: true });
    }

    return () => {
      for (const target of targets) {
        target.removeEventListener('wheel', handleNativeWheel, true);
        target.removeEventListener('mousewheel', handleNativeWheel, true);
      }
    };
  }, [applyWheelZoom, height, appReady, shouldIgnoreDuplicateWheel]);

  // IMPORTANT: Always render the canvas container div so the ref is available
  // for the Pixi init effect. Show loading/error overlays on top instead of
  // returning early, which would prevent the canvas ref from being attached.
  return (
    <div
      ref={rootRef}
      className="relative w-full h-full"
      style={{ touchAction: 'none' }}
    >
      {/* Canvas container - always rendered so ref is available for Pixi init */}
      <div
        ref={canvasRef}
        className="w-full h-full"
        style={{ width: `${width}px`, height: `${height}px` }}
      />

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80">
          <div className="text-slate-400">Loading passive tree...</div>
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 gap-3">
          <div className="text-red-400">Failed to load tree data</div>
          <div className="text-red-300 text-xs max-w-md text-center">{error}</div>
          <button
            onClick={retry}
            className="px-3 py-1.5 text-sm bg-amber-600 hover:bg-amber-500 text-white rounded transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Pixi initialization error overlay */}
      {!error && initError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 gap-3">
          <div className="text-red-400">Failed to initialize tree renderer</div>
          <div className="text-red-300 text-xs max-w-md text-center">{initError}</div>
          <button
            onClick={() => window.location.reload()}
            className="px-3 py-1.5 text-sm bg-amber-600 hover:bg-amber-500 text-white rounded transition-colors"
          >
            Reload App
          </button>
        </div>
      )}

      {/* Tooltip */}
      {hoveredNode && tooltipPosition && (
        <TreeTooltip
          node={hoveredNode}
          position={tooltipPosition}
          isAllocated={visuallyAllocatedSet.has(hoveredNode.id)}
        />
      )}



      {/* Controls */}
      {showControls && (
        <TreeControls
          controls={viewportControls}
          position={controlsPosition}
          className={className}
        />
      )}
    </div>
  );
}

/**
 * Convert TreeNode to RenderableNode format for sprite resolution
 */
function toRenderableNode(node: TreeNode): RenderableNode {
  return {
    id: node.id,
    name: node.name || '',
    stats: node.stats || [],
    x: node.x,
    y: node.y,
    type: node.type === 'normal' ? 'small' : node.type === 'ascendancy' ? 'small' : node.type,
    isKeystone: node.type === 'keystone',
    isNotable: node.type === 'notable',
    isMastery: node.type === 'mastery',
    isJewelSocket: node.type === 'jewelSocket' || node.isJewelSocket === true,
    isAscendancyStart: node.isAscendancyStart === true,
    ascendancyName: node.ascendancyName,
    connections: node.connections || [],
    icon: node.icon || '',
    // Mastery specific icons
    inactiveIcon: node.inactiveIcon,
    activeIcon: node.activeIcon,
    activeEffectImage: node.activeEffectImage,
    masteryEffects: node.masteryEffects,
  };
}

function createScaledSprite(
  texture: Sprite['texture'],
  options: {
    x: number;
    y: number;
    alpha?: number;
    scaleX?: number;
    scaleY?: number;
    targetMaxSize?: number;
  }
): Sprite {
  const sprite = new Sprite(texture);
  sprite.anchor.set(0.5, 0.5);
  sprite.position.set(options.x, options.y);
  if (options.targetMaxSize && texture.width > 0 && texture.height > 0) {
    const sourceMaxSize = Math.max(texture.width, texture.height);
    const fittedScale = options.targetMaxSize / sourceMaxSize;
    sprite.scale.set(
      fittedScale * Math.sign(options.scaleX ?? 1),
      fittedScale * Math.sign(options.scaleY ?? 1)
    );
  } else {
    sprite.scale.set(
      POB_ASSET_SCALE * (options.scaleX ?? 1),
      POB_ASSET_SCALE * (options.scaleY ?? 1)
    );
  }

  if (options.alpha != null) {
    sprite.alpha = options.alpha;
  }

  return sprite;
}

function createMirroredHalfSprites(texture: Sprite['texture'], x: number, y: number): Sprite[] {
  const displayHeight = texture.height * POB_ASSET_SCALE;

  return [
    createScaledSprite(texture, { x, y: y - displayHeight / 2 }),
    createScaledSprite(texture, { x, y: y + displayHeight / 2, scaleY: -1 }),
  ];
}

function addNodeSprites(
  nodeContainer: Container,
  activeEffectTexture: Texture | null,
  iconTexture: Texture | null,
  frameTexture: Texture | null,
  node: RenderableNode,
  options?: {
    iconTargetMaxSize?: number;
    isAllocated?: boolean;
  }
): boolean {
  let usedSprites = false;

  if (activeEffectTexture) {
    const activeEffectSprite = createScaledSprite(activeEffectTexture, { x: 0, y: 0 });
    nodeContainer.addChild(activeEffectSprite);
    usedSprites = true;
  }

  // Add a soft inner glow behind allocated mastery icons to match PoB's luminous look
  // Keep it tight to the icon so connections still render visibly on top
  if (node.isMastery && options?.isAllocated && iconTexture) {
    const iconRadius = Math.min(iconTexture.width, iconTexture.height) * POB_ASSET_SCALE * 0.35;
    const iconGlow = new Graphics();
    iconGlow.circle(0, 0, iconRadius);
    iconGlow.fill({ color: 0xffffff, alpha: 0.2 });
    nodeContainer.addChild(iconGlow);
  }

  if (iconTexture) {
    const iconSprite = createScaledSprite(iconTexture, {
      x: 0,
      y: 0,
      targetMaxSize: options?.iconTargetMaxSize,
    });

    if (frameTexture && !node.isAscendancyStart) {
      const iconMask = createNodeIconMask(iconTexture, node);
      iconSprite.mask = iconMask;
      nodeContainer.addChild(iconMask);
    }

    nodeContainer.addChild(iconSprite);
    usedSprites = true;
  }

  if (frameTexture) {
    const frameSprite = createScaledSprite(frameTexture, { x: 0, y: 0 });
    nodeContainer.addChild(frameSprite);
    usedSprites = true;
  }

  return usedSprites;
}

function createNodeIconMask(texture: Texture, node: RenderableNode): Graphics {
  const mask = new Graphics();
  const radius = Math.min(texture.width, texture.height) * POB_ASSET_SCALE * 0.47;

  if (node.isJewelSocket) {
    mask.poly([
      0, -radius,
      radius, 0,
      0, radius,
      -radius, 0,
    ], true);
  } else {
    mask.circle(0, 0, radius);
  }

  mask.fill({ color: 0xffffff });
  mask.eventMode = 'none';
  return mask;
}

type ConnectorRenderableNode = {
  id: number;
  x: number;
  y: number;
  group?: number;
  orbit?: number;
  type?: TreeNode['type'] | ClusterNodeData['type'];
  isClassStart?: boolean;
  isMastery?: boolean;
  ascendancyName?: string;
};

type TextureGetter = (category: string, coordKey: string) => Texture | null;

const CONNECTOR_MESH_INDICES = new Uint32Array([0, 1, 2, 0, 2, 3]);

function getGroupCenter(
  groups: Record<string, { x: number; y: number }>,
  groupId: number
): ConnectorCenter | null {
  const group = groups[String(groupId)];
  if (!group) {
    return null;
  }

  return { x: group.x, y: group.y };
}

function getClusterConnectorOrbit(clusterSize: ClusterSize): number {
  if (clusterSize === 'large') return 3;
  if (clusterSize === 'medium') return 2;
  return 1;
}

function getFallbackClusterGroupCenter(
  socketX: number,
  socketY: number,
  clusterSize: ClusterSize
): ConnectorCenter {
  const distanceFromCenter = Math.hypot(socketX, socketY);
  const dirX = distanceFromCenter > 0 ? socketX / distanceFromCenter : 0;
  const dirY = distanceFromCenter > 0 ? socketY / distanceFromCenter : 1;
  const groupOffset = getClusterOrbitRadius(clusterSize) * 0.6;

  return {
    x: socketX + dirX * groupOffset,
    y: socketY + dirY * groupOffset,
  };
}

function addClusterRingBackground(
  layer: Container,
  center: ConnectorCenter,
  outerRadius: number
): void {
  const ring = new Graphics();
  const innerRadius = outerRadius * 0.55;

  ring.circle(center.x, center.y, outerRadius);
  ring.fill({ color: 0x0d131d, alpha: 0.14 });
  ring.circle(center.x, center.y, outerRadius);
  ring.stroke({ width: 3, color: 0x8b7355, alpha: 0.42 });
  ring.circle(center.x, center.y, innerRadius);
  ring.stroke({ width: 1.5, color: 0x8b7355, alpha: 0.16 });
  ring.eventMode = 'none';
  layer.addChild(ring);
}

function addPoBConnector(
  layer: Container,
  getTexture: TextureGetter,
  fromNode: ConnectorRenderableNode,
  toNode: ConnectorRenderableNode,
  options: {
    state: ConnectionState;
    groupCenter: ConnectorCenter | null;
    isMuted?: boolean;
  }
): void {
  const style = getConnectorStyle(options.state, { isMuted: options.isMuted });
  const canUseOrbitConnector = Boolean(
    options.groupCenter
    && fromNode.orbit != null
    && fromNode.orbit > 0
    && fromNode.orbit === toNode.orbit
    && !isMasteryConnectorNode(fromNode)
    && !isMasteryConnectorNode(toNode)
    && !fromNode.isClassStart
    && !toNode.isClassStart
  );

  if (canUseOrbitConnector && options.groupCenter) {
    const orbitTexture = getTexture('connector', `Orbit${fromNode.orbit}${options.state}`)
      ?? getTexture('line', `Orbit${fromNode.orbit}${options.state}`);
    if (orbitTexture) {
      const layouts = buildOrbitConnectorLayouts(
        fromNode,
        toNode,
        options.groupCenter,
        fromNode.orbit!,
        { width: orbitTexture.width, height: orbitTexture.height },
        POB_ORBIT_CONNECTOR_SCALE,
        style
      );

      if (layouts.length > 0) {
        for (const layout of layouts) {
          const mesh = new MeshSimple({
            texture: orbitTexture,
            vertices: layout.vertices,
            uvs: layout.uvs,
            indices: CONNECTOR_MESH_INDICES,
          });
          mesh.alpha = layout.style.alpha;
          mesh.tint = layout.style.tint;
          mesh.roundPixels = false;
          mesh.eventMode = 'none';
          layer.addChild(mesh);
        }
        return;
      }
    }
  }

  const lineTexture = getTexture('line', `LineConnector${options.state}`);
  if (lineTexture) {
    const layout = buildStraightConnectorLayout(
      fromNode,
      toNode,
      { width: lineTexture.width, height: lineTexture.height },
      POB_LINE_CONNECTOR_SCALE,
      style
    );

    if (layout) {
      const connector = new TilingSprite({
        texture: lineTexture,
        width: layout.length,
        height: layout.thickness,
        roundPixels: false,
      });
      connector.anchor.set(0, 0.5);
      connector.position.set(layout.x, layout.y);
      connector.rotation = layout.rotation;
      connector.tileScale.set(
        layout.repeatWidth / lineTexture.width,
        layout.thickness / lineTexture.height
      );
      connector.tint = layout.style.tint;
      connector.alpha = layout.style.alpha;
      connector.eventMode = 'none';
      layer.addChild(connector);
      return;
    }
  }

  const fallback = new Graphics();
  fallback.moveTo(fromNode.x, fromNode.y);
  fallback.lineTo(toNode.x, toNode.y);
  fallback.stroke({
    width: options.state === 'Active' ? 12 : 8,
    color: options.state === 'Active' ? 0xd9a050 : 0x554422,
    alpha: options.isMuted ? 0.3 : options.state === 'Active' ? 0.9 : 0.5,
  });
  fallback.eventMode = 'none';
  layer.addChild(fallback);
}

function isMasteryConnectorNode(node: ConnectorRenderableNode): boolean {
  return node.isMastery === true || node.type === 'mastery' || node.type === 'Mastery';
}

/**
 * Map a socketed jewel to the correct JewelSocketActive* sprite key
 * from the 'jewel' sprite category in tree data.
 */
function getJewelOverlaySpriteKey(jewel: SocketedJewelInfo): string {
  const baseName = jewel.baseName.toLowerCase();

  // Cluster jewels use Alt color variants by size
  if (jewel.isClusterJewel) {
    switch (jewel.clusterSize) {
      case 'large': return 'JewelSocketActiveAltPurple';
      case 'medium': return 'JewelSocketActiveAltBlue';
      case 'small': return 'JewelSocketActiveAltRed';
      default: return 'JewelSocketActiveAltPurple';
    }
  }

  if (jewel.isTimeless) return 'JewelSocketActiveLegion';
  if (baseName.includes('abyss') || baseName.includes('eye jewel')) return 'JewelSocketActiveAbyss';
  if (baseName.includes('crimson')) return 'JewelSocketActiveRed';
  if (baseName.includes('viridian')) return 'JewelSocketActiveGreen';
  if (baseName.includes('cobalt')) return 'JewelSocketActiveBlue';
  if (baseName.includes('prismatic')) return 'JewelSocketActivePrismatic';

  // Fallback for unknown jewel types
  return 'JewelSocketActiveRed';
}

/**
 * Color used for the circular fallback indicator when the jewel overlay
 * sprite texture is not available.
 */
function getSocketedJewelIndicatorColor(jewel: SocketedJewelInfo): number {
  const baseName = jewel.baseName.toLowerCase();

  if (jewel.isTimeless) return 0xffc857;
  if (jewel.isClusterJewel) return 0xb36bff;
  if (baseName.includes('abyss') || baseName.includes('eye jewel')) return 0x4de3a8;
  if (baseName.includes('crimson')) return 0xd95757;
  if (baseName.includes('viridian')) return 0x57cf79;
  if (baseName.includes('cobalt')) return 0x5d86ff;
  if (baseName.includes('prismatic')) return 0xf5f1d5;
  if ((jewel.rarity ?? '').toUpperCase() === 'UNIQUE') return 0xd08a34;

  return 0x7f96b3;
}

/**
 * Add a socketed jewel overlay to the node container.
 * Uses the JewelSocketActive* sprite from tree data when available,
 * falling back to a colored circle indicator.
 */
function addSocketedJewelIndicator(
  nodeContainer: Container,
  socketedJewel: SocketedJewelInfo,
  nodeSize: number,
  getTexture: (category: string, key: string) => Texture | null
): void {
  const spriteKey = getJewelOverlaySpriteKey(socketedJewel);
  const texture = getTexture('jewel', spriteKey);

  if (texture) {
    // Render the jewel overlay sprite on top of the socket frame,
    // matching how PoB renders socketed jewel indicators.
    const overlay = createScaledSprite(texture, { x: 0, y: 0 });
    nodeContainer.addChild(overlay);
    return;
  }

  // Fallback: colored circle when sprite texture is not available
  const indicatorColor = getSocketedJewelIndicatorColor(socketedJewel);
  const indicatorRadius = Math.max(14, nodeSize * 0.65);

  const backdrop = new Graphics();
  backdrop.circle(0, 0, indicatorRadius);
  backdrop.fill({ color: 0x05070d, alpha: 0.85 });
  backdrop.circle(0, 0, indicatorRadius);
  backdrop.stroke({ color: indicatorColor, width: 3, alpha: 0.95 });
  nodeContainer.addChild(backdrop);

  const innerGlow = new Graphics();
  innerGlow.circle(0, 0, indicatorRadius * 0.7);
  innerGlow.fill({ color: indicatorColor, alpha: 0.25 });
  nodeContainer.addChild(innerGlow);

  const core = new Graphics();
  core.circle(0, 0, indicatorRadius * 0.4);
  core.fill({ color: indicatorColor, alpha: 0.9 });
  nodeContainer.addChild(core);
}

function isSyntheticClusterCenterNode(node: ClusterNodeData): boolean {
  return node.type === 'Mastery'
    && node.name === 'Nothingness'
    && node.orbit === 0;
}

function getSyntheticClusterCenterTexture(
  getTexture: (category: string, coordKey: string) => Texture | null,
  iconPath: string,
  spritesReady: boolean
): Texture | null {
  if (!spritesReady || !iconPath) {
    return null;
  }

  return getTexture('mastery', iconPath)
    ?? getTexture('masteryInactive', iconPath)
    ?? getTexture('masteryActiveSelected', iconPath);
}

function getClusterNodeShapeType(
  nodeType: ClusterNodeData['type']
): 'small' | 'notable' | 'mastery' | 'keystone' | 'socket' {
  switch (nodeType) {
    case 'Socket':
      return 'socket';
    case 'Notable':
      return 'notable';
    case 'Mastery':
      return 'mastery';
    case 'Keystone':
      return 'keystone';
    default:
      return 'small';
  }
}

function getClusterTreeNodeType(
  nodeType: 'small' | 'normal' | 'notable' | 'mastery' | 'keystone' | 'socket'
): TreeNode['type'] {
  if (nodeType === 'socket') return 'jewelSocket';
  if (nodeType === 'small') return 'normal';
  return nodeType;
}

function normalizeClusterSize(
  clusterSize?: ClusterNodeData['clusterSize'],
  orbit?: number
): ClusterSize {
  if (clusterSize === 'Large') return 'large';
  if (clusterSize === 'Medium') return 'medium';
  if (clusterSize === 'Small') return 'small';

  if (orbit != null) {
    if (orbit >= 3) return 'large';
    if (orbit >= 2) return 'medium';
  }

  return 'small';
}

function getClusterOrbitRadius(clusterSize: ClusterSize): number {
  if (clusterSize === 'large') return 335;
  if (clusterSize === 'medium') return 162;
  return 82;
}

function toClusterSocketConnectorNode(
  id: number,
  socketNode: { x: number; y: number },
  orbit?: number
): ConnectorRenderableNode {
  return {
    id,
    x: socketNode.x,
    y: socketNode.y,
    orbit,
    type: 'jewelSocket',
  };
}

function toClusterRenderableNode(node: ClusterNodeData): RenderableNode {
  const nodeType = getClusterNodeShapeType(node.type);
  const renderType = nodeType === 'socket' ? 'jewelSocket' : nodeType;

  return {
    id: node.id,
    name: node.name,
    stats: node.stats ?? [],
    x: node.x,
    y: node.y,
    type: renderType,
    isKeystone: node.type === 'Keystone',
    isNotable: node.type === 'Notable',
    isMastery: node.type === 'Mastery',
    isJewelSocket: node.type === 'Socket',
    isAscendancyStart: false,
    connections: node.links ?? [],
    icon: node.icon ?? '',
  };
}

function toClusterTreeNode(node: ClusterNodeData): TreeNode {
  const nodeType = getClusterNodeShapeType(node.type);

  return {
    id: node.id,
    name: node.name,
    stats: node.stats ?? [],
    x: node.x,
    y: node.y,
    type: getClusterTreeNodeType(nodeType),
    isJewelSocket: node.type === 'Socket',
    isAscendancyStart: false,
    connections: node.links ?? [],
    icon: node.icon ?? '',
  };
}

// Helper function to draw polygons
function drawPolygon(
  graphics: Graphics,
  x: number,
  y: number,
  radius: number,
  sides: number,
  color: number,
  isAllocated: boolean
) {
  const angleOffset = -Math.PI / 2; // Start from top
  const points: number[] = [];

  for (let i = 0; i < sides; i++) {
    const angle = angleOffset + (2 * Math.PI * i) / sides;
    points.push(x + radius * Math.cos(angle));
    points.push(y + radius * Math.sin(angle));
  }

  graphics.poly(points);
  graphics.fill({ color, alpha: isAllocated ? 1 : 0.7 });

  // Pixi.js v8: pass stroke options directly to stroke()
  // Add border to all nodes for visibility
  graphics.stroke({
    width: isAllocated ? 8 : 4,
    color: isAllocated ? 0xffffff : 0x666666,
    alpha: isAllocated ? 0.6 : 0.3
  });
}

/**
 * Find the socket node that contains a cluster jewel of the given size
 * Uses the equippedJewels map to match cluster jewel base types to sockets
 */
function findClusterJewelSocket(
  clusterSize: ClusterSize,
  equippedJewels: Map<number, SocketedJewelInfo> | undefined,
  jewelSockets: TreeNode[],
  usedSocketIds: Set<number>
): TreeNode | undefined {
  if (!equippedJewels) return undefined;

  for (const socket of jewelSockets) {
    // Skip sockets already used by another cluster
    if (usedSocketIds.has(socket.id)) continue;

    const jewel = equippedJewels.get(socket.id);
    if (!jewel) continue;

    // Use the pre-computed cluster properties from jewel-socket-mapper
    if (jewel.isClusterJewel && jewel.clusterSize === clusterSize) {
      return socket;
    }
  }

  return undefined;
}

export default InteractiveTreeCanvas;
