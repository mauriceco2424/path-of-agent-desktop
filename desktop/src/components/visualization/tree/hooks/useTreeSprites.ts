/**
 * Tree Sprites Hook
 *
 * Loads passive tree sprite sheets from the PoE CDN and creates
 * individual Pixi.js textures by slicing the sheets using UV coordinates.
 * Textures are cached to prevent re-loading when zoom level changes.
 *
 * @module visualization/tree/hooks/useTreeSprites
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Texture, Rectangle } from 'pixi.js';
import type { SpriteConfig } from '../types';
import { getFrameTextureCategory, selectZoomLevel } from '../utils/sprite-resolver';

// ============================================================================
// Types
// ============================================================================

/**
 * Coordinates for a sprite within a sprite sheet
 */
export interface SpriteCoords {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Zoom level specific sprite data
 */
export interface ZoomLevelSprites {
  filename: string;
  w: number;
  h: number;
  coords: Record<string, SpriteCoords>;
}

/**
 * Map of sprite keys to their Pixi textures
 */
export type SpriteTextures = Record<string, Texture>;

/**
 * Return value from useTreeSprites hook
 */
export interface UseTreeSpritesResult {
  /**
   * Map of sprite key to Texture.
   * Keys are in format: `${category}:${coordKey}`
   * e.g., "normalActive:Art/2DArt/SkillIcons/passives/damage.png"
   */
  textures: SpriteTextures;
  /**
   * Whether sprites are currently loading
   */
  loading: boolean;
  /**
   * Error message if loading failed
   */
  error: string | null;
  /**
   * Get a texture by category and coord key
   */
  getTexture: (category: string, coordKey: string) => Texture | null;
  /**
   * Get a frame texture by frame key
   */
  getFrameTexture: (frameKey: string) => Texture | null;
  /**
   * Current zoom level being used
   */
  currentZoomLevel: string;
  /**
   * Debug info for troubleshooting sprite loading
   */
  debugInfo?: string;
  /**
   * Explicit signal that textures have been loaded and committed to state.
   * More reliable than checking !loading && textures.length > 0
   */
  texturesReady: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Categories of sprites to preload
 * These are the essential categories needed for tree rendering
 */
const PRELOAD_CATEGORIES = [
  'normalActive',
  'normalInactive',
  'notableActive',
  'notableInactive',
  'keystoneActive',
  'keystoneInactive',
  'normalActiveLegion',
  'normalInactiveLegion',
  'notableActiveLegion',
  'notableInactiveLegion',
  'keystoneActiveLegion',
  'keystoneInactiveLegion',
  'mastery',
  'masteryInactive',
  'masteryActiveSelected',
  'masteryActiveEffect',
  'frame',
  'ascendancy',
  'groupBackground',
  'line',
  'jewelRadius', // Cluster jewel decorative rings
  'jewel', // Socketed jewel active overlays (JewelSocketActive*)
] as const;

const TREE_LEGION_SPRITE_SCHEME = 'poa-tree-legion:';

const STANDALONE_CONNECTOR_KEYS = [
  'LineConnectorActive',
  'LineConnectorIntermediate',
  'LineConnectorNormal',
  'Orbit1Active',
  'Orbit1Intermediate',
  'Orbit1Normal',
  'Orbit2Active',
  'Orbit2Intermediate',
  'Orbit2Normal',
  'Orbit3Active',
  'Orbit3Intermediate',
  'Orbit3Normal',
  'Orbit4Active',
  'Orbit4Intermediate',
  'Orbit4Normal',
  'Orbit5Active',
  'Orbit5Intermediate',
  'Orbit5Normal',
  'Orbit6Active',
  'Orbit6Intermediate',
  'Orbit6Normal',
] as const;

const STANDALONE_TREE_UI_KEYS = [
  'ring',
  'small_ring',
  'ShadedOuterRing',
  'ShadedOuterRingFlipped',
  'ShadedInnerRing',
  'ShadedInnerRingFlipped',
] as const;

/**
 * Cache for loaded sprite sheet textures
 * Keyed by sprite sheet URL
 */
const spriteSheetCache = new Map<string, Texture>();

/**
 * Cache for sliced individual sprite textures
 * Keyed by `${sheetUrl}:${x}:${y}:${w}:${h}`
 */
const textureSliceCache = new Map<string, Texture>();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the backend URL for API calls
 */
function getBackendUrl(): string {
  // In Tauri, use the configured backend URL
  // In browser dev mode, use localhost
  return import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:9876';
}

/**
 * Convert a PoE CDN URL to use our backend proxy to bypass CORS
 */
function getProxiedUrl(originalUrl: string): string {
  if (originalUrl.startsWith(TREE_LEGION_SPRITE_SCHEME)) {
    const backendUrl = getBackendUrl();
    const assetName = originalUrl.slice(TREE_LEGION_SPRITE_SCHEME.length);
    return `${backendUrl}/api/v1/tree-legion-sprite-asset?name=${encodeURIComponent(assetName)}`;
  }

  // Only proxy PoE CDN URLs
  if (originalUrl.startsWith('https://web.poecdn.com/')) {
    const backendUrl = getBackendUrl();
    return `${backendUrl}/api/v1/sprite-proxy?url=${encodeURIComponent(originalUrl)}`;
  }
  return originalUrl;
}

function getConnectorAssetUrl(name: string): string {
  const backendUrl = getBackendUrl();
  return `${backendUrl}/api/v1/tree-connector-asset?name=${encodeURIComponent(name)}`;
}

function getTreeUiAssetUrl(name: string): string {
  const backendUrl = getBackendUrl();
  return `${backendUrl}/api/v1/tree-ui-asset?name=${encodeURIComponent(name)}`;
}

/**
 * Load an image from a URL using HTMLImageElement
 * More reliable than Pixi's Assets.load in webview environments
 */
function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      console.log(`[loadImageElement] Loaded: ${img.width}x${img.height}`);
      resolve(img);
    };

    img.onerror = (err) => {
      console.error(`[loadImageElement] Failed to load: ${url}`, err);
      reject(new Error(`Failed to load image: ${url}`));
    };

    img.src = url;
  });
}

/**
 * Load a sprite sheet texture from URL, using cache if available
 *
 * @param url - The sprite sheet URL (will be proxied through backend)
 * @returns Promise resolving to the loaded texture
 */
async function loadSpriteSheet(url: string): Promise<Texture> {
  // Check cache first (use original URL as key)
  const cached = spriteSheetCache.get(url);
  if (cached) {
    console.log(`[useTreeSprites] Cache hit for: ${url}`);
    return cached;
  }

  // Proxy through backend to bypass CORS
  const proxiedUrl = getProxiedUrl(url);
  console.log(`[useTreeSprites] Loading sprite sheet: ${url}`);
  console.log(`[useTreeSprites] Proxied URL: ${proxiedUrl}`);

  try {
    // Fetch the image as a blob first, then create a texture
    // This works better in Tauri's webview environment
    console.log(`[useTreeSprites] Fetching via fetch API: ${proxiedUrl.substring(0, 80)}...`);
    const response = await fetch(proxiedUrl);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const blob = await response.blob();
    console.log(`[useTreeSprites] Got blob: ${blob.size} bytes, type: ${blob.type}`);

    // Convert blob to data URL (base64) — blob: URLs are unreliable in Tauri WebView2
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('FileReader failed'));
      reader.readAsDataURL(blob);
    });

    try {
      // Load image using HTMLImageElement with data URL (reliable in webview)
      const img = await loadImageElement(dataUrl);
      console.log(`[useTreeSprites] Image loaded: ${img.width}x${img.height}`);

      // Create texture from the loaded image
      const texture = Texture.from(img);

      // Cache using original URL as key
      spriteSheetCache.set(url, texture);
      return texture;
    } catch (imgErr) {
      console.error(`[useTreeSprites] Image load failed:`, imgErr);
      throw imgErr;
    }
  } catch (err) {
    console.error(`[useTreeSprites] Failed to load sprite sheet: ${url}`, err);
    throw err;
  }
}

/**
 * Create a texture slice from a sprite sheet
 *
 * @param sheetTexture - The source sprite sheet texture
 * @param coords - The coordinates to slice
 * @param sheetUrl - URL for cache key
 * @returns The sliced texture
 */
function createTextureSlice(
  sheetTexture: Texture,
  coords: SpriteCoords,
  sheetUrl: string
): Texture {
  const cacheKey = `${sheetUrl}:${coords.x}:${coords.y}:${coords.w}:${coords.h}`;

  // Check cache first
  const cached = textureSliceCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Create a new texture using a frame rectangle
  const frame = new Rectangle(coords.x, coords.y, coords.w, coords.h);
  const slicedTexture = new Texture({
    source: sheetTexture.source,
    frame,
  });

  textureSliceCache.set(cacheKey, slicedTexture);
  return slicedTexture;
}

/**
 * Normalize path separators to forward slashes for consistent key lookup.
 * The tree JSON may have backslash paths on Windows.
 */
function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}

/**
 * Build texture key from category and coord key
 */
function buildTextureKey(category: string, coordKey: string): string {
  return `${category}:${normalizePath(coordKey)}`;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook to load and manage tree sprite textures
 *
 * Loads sprite sheets from PoE CDN based on the sprite configuration
 * from the tree-data endpoint. Creates individual textures by slicing
 * the sprite sheets using the provided UV coordinates.
 *
 * @param spriteConfig - Sprite configuration from tree data
 * @param zoomLevel - Current viewport zoom scale (0-1+)
 * @returns Object with textures map, loading state, and helper functions
 *
 * @example
 * ```tsx
 * const { textures, loading, getTexture } = useTreeSprites(treeData.sprites, 0.5);
 *
 * // Get a specific node icon texture
 * const iconTexture = getTexture('normalActive', node.icon);
 *
 * // Get a frame texture
 * const frameTexture = getFrameTexture('NotableFrameAllocated');
 * ```
 */
export function useTreeSprites(
  spriteConfig: SpriteConfig | undefined,
  zoomLevel: number
): UseTreeSpritesResult {
  const [textures, setTextures] = useState<SpriteTextures>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentZoomLevel, setCurrentZoomLevel] = useState('0.3835');
  const [debugInfo, setDebugInfo] = useState<string>('init');
  const [texturesReady, setTexturesReady] = useState(false);

  // Track mounted state for async cleanup
  const mountedRef = useRef(true);

  // Track which sheets we've already loaded for this zoom level
  const loadedSheetsRef = useRef(new Set<string>());

  // Create stable key for sprite config to use as dependency
  // This prevents issues with object reference changes and ensures effect re-runs
  // when sprites become available after initial undefined state
  const spriteConfigKey = spriteConfig
    ? Object.keys(spriteConfig).sort().join(',')
    : '';

  const selectedZoom = useMemo(() => {
    if (!spriteConfig) {
      return null;
    }

    const availableLevels = spriteConfig.normalActive
      ? Object.keys(spriteConfig.normalActive).map(Number).filter(n => !isNaN(n))
      : [0.1246, 0.2109, 0.2972, 0.3835];

    return selectZoomLevel(zoomLevel, availableLevels);
  }, [spriteConfig, zoomLevel]);

  // Load sprites when config or effective sprite zoom changes.
  // This avoids tearing down the sprite state on every wheel tick.
  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    const configCategories = spriteConfig ? Object.keys(spriteConfig) : [];
    setDebugInfo(`effect: cfg=${configCategories.length} z=${zoomLevel.toFixed(2)} key=${spriteConfigKey.slice(0, 20)}`);

    console.log('[useTreeSprites] Effect running:', {
      hasSpriteConfig: !!spriteConfig,
      spriteConfigCategories: configCategories.slice(0, 5),
      zoomLevel,
      spriteConfigKey: spriteConfigKey.slice(0, 50),
    });

    if (!spriteConfig) {
      console.log('[useTreeSprites] No sprite config, setting loading=false');
      setDebugInfo('no config');
      setLoading(false);
      return () => { mountedRef.current = false; };
    }

    if (!selectedZoom) {
      setLoading(false);
      return () => { mountedRef.current = false; };
    }

    loadedSheetsRef.current.clear();
    setTexturesReady(false);

    console.log('[useTreeSprites] Zoom level selection:', {
      viewportZoom: zoomLevel,
      selectedZoom,
    });
    setCurrentZoomLevel(selectedZoom);

    // Load sprites asynchronously, passing cancellation check
    loadSprites(spriteConfig, selectedZoom, () => cancelled);

    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
  }, [selectedZoom, spriteConfig, spriteConfigKey]);

  /**
   * Load all sprite sheets for the given configuration and zoom level
   */
  async function loadSprites(config: SpriteConfig, zoom: string, isCancelled?: () => boolean) {
    console.log('[useTreeSprites] loadSprites called:', {
      zoom,
      configCategories: Object.keys(config),
      preloadCategories: PRELOAD_CATEGORIES,
    });

    setDebugInfo(`loading: zoom=${zoom}`);
    setLoading(true);
    setError(null);

    // Collect all textures from all sheets
    const allTextures: SpriteTextures = {};
    let loadedCount = 0;
    let successCount = 0;

    // Build list of sheets to load
    const sheetsToLoad: Array<{
      category: string;
      filename: string;
      coords: Record<string, SpriteCoords>;
    }> = [];

    for (const category of PRELOAD_CATEGORIES) {
      const categoryConfig = config[category];
      if (!categoryConfig) {
        console.log(`[useTreeSprites] Category ${category} not found in config`);
        continue;
      }

      // Some categories (like jewelRadius) use zoom level "1" instead of the standard levels
      // Check for both the requested zoom and "1" as a fallback
      let zoomConfig = categoryConfig[zoom];
      let effectiveZoom = zoom;
      if (!zoomConfig && categoryConfig['1']) {
        zoomConfig = categoryConfig['1'];
        effectiveZoom = '1';
        console.log(`[useTreeSprites] Using fallback zoom "1" for ${category}`);
      }
      if (!zoomConfig) {
        console.log(`[useTreeSprites] Zoom ${zoom} not found for ${category}`);
        continue;
      }

      const { filename, coords } = zoomConfig;
      if (!filename || !coords) {
        console.log(`[useTreeSprites] Missing filename/coords for ${category}`);
        continue;
      }

      // Track this sheet as being loaded (use effectiveZoom for the key)
      const sheetKey = `${category}:${effectiveZoom}`;
      if (loadedSheetsRef.current.has(sheetKey)) {
        console.log(`[useTreeSprites] Already loaded: ${sheetKey}`);
        continue;
      }
      loadedSheetsRef.current.add(sheetKey);
      loadedCount++;

      sheetsToLoad.push({ category, filename, coords });
    }

    const connectorTexturesToLoad = STANDALONE_CONNECTOR_KEYS.map((name) => ({
      category: 'connector',
      name,
      filename: getConnectorAssetUrl(name),
    }));
    const treeUiTexturesToLoad = STANDALONE_TREE_UI_KEYS.map((name) => ({
      category: 'treeUi',
      name,
      filename: getTreeUiAssetUrl(name),
    }));
    loadedCount += connectorTexturesToLoad.length;
    loadedCount += treeUiTexturesToLoad.length;

    console.log(
      `[useTreeSprites] Will load ${sheetsToLoad.length} sprite sheets and `
      + `${connectorTexturesToLoad.length} connector textures and `
      + `${treeUiTexturesToLoad.length} tree UI textures`
    );
    setDebugInfo(
      `loading ${sheetsToLoad.length} sheets + ${connectorTexturesToLoad.length} connectors + ${treeUiTexturesToLoad.length} ui...`
    );

    // Load all sheets in parallel
    const loadJobs = [
      ...sheetsToLoad.map(async ({ category, filename, coords }) => {
        console.log(`[useTreeSprites] Starting load: ${category} from ${filename.substring(0, 60)}...`);
        setDebugInfo(`loading: ${category}`);

        try {
          console.log(`[useTreeSprites] [${category}] Calling loadSpriteSheet...`);
          const sheetTexture = await loadSpriteSheet(filename);
          console.log(`[useTreeSprites] [${category}] loadSpriteSheet returned:`, sheetTexture ? 'texture' : 'null');

          if (!mountedRef.current) {
            console.log(`[useTreeSprites] Unmounted during load of ${category}`);
            return { category, count: 0 };
          }

          // Create textures for each sprite in this sheet
          let count = 0;
          const coordEntries = Object.entries(coords);
          console.log(`[useTreeSprites] [${category}] Slicing ${coordEntries.length} sprites...`);

          for (const [coordKey, coordData] of coordEntries) {
            const texture = createTextureSlice(sheetTexture, coordData, filename);
            const textureKey = buildTextureKey(category, coordKey);
            allTextures[textureKey] = texture;
            count++;
          }

          console.log(`[useTreeSprites] [${category}] SUCCESS: ${count} textures sliced`);
          return { category, count };
        } catch (err) {
          console.error(`[useTreeSprites] [${category}] FAILED:`, err);
          throw err;
        }
      }),
      ...connectorTexturesToLoad.map(async ({ category, filename, name }) => {
        console.log(`[useTreeSprites] Starting load: ${category}/${name}`);

        try {
          const texture = await loadSpriteSheet(filename);
          if (!mountedRef.current) {
            console.log(`[useTreeSprites] Unmounted during load of ${category}/${name}`);
            return { category: `${category}/${name}`, count: 0 };
          }

          allTextures[buildTextureKey(category, name)] = texture;
          console.log(`[useTreeSprites] [${category}/${name}] SUCCESS`);
          return { category: `${category}/${name}`, count: 1 };
        } catch (err) {
          console.error(`[useTreeSprites] [${category}/${name}] FAILED:`, err);
          throw err;
        }
      }),
      ...treeUiTexturesToLoad.map(async ({ category, filename, name }) => {
        console.log(`[useTreeSprites] Starting load: ${category}/${name}`);

        try {
          const texture = await loadSpriteSheet(filename);
          if (!mountedRef.current) {
            console.log(`[useTreeSprites] Unmounted during load of ${category}/${name}`);
            return { category: `${category}/${name}`, count: 0 };
          }

          allTextures[buildTextureKey(category, name)] = texture;
          console.log(`[useTreeSprites] [${category}/${name}] SUCCESS`);
          return { category: `${category}/${name}`, count: 1 };
        } catch (err) {
          console.error(`[useTreeSprites] [${category}/${name}] FAILED:`, err);
          throw err;
        }
      }),
    ];

    console.log(`[useTreeSprites] Starting Promise.allSettled for ${loadJobs.length} loads`);
    const results = await Promise.allSettled(
      loadJobs
    );
    console.log(`[useTreeSprites] Promise.allSettled completed, results:`, results.length);

    // Count successes and failures
    for (const result of results) {
      if (result.status === 'fulfilled') {
        successCount++;
      } else {
        console.error('[useTreeSprites] Sheet load failed:', result.reason);
      }
    }

    if (mountedRef.current) {
      const textureCount = Object.keys(allTextures).length;
      console.log('[useTreeSprites] All sheets processed:', {
        textureCount,
        successCount,
        loadedCount,
        sampleKeys: Object.keys(allTextures).slice(0, 5),
      });

      setDebugInfo(`done: ${textureCount} tex, ${successCount}/${loadedCount} sheets`);
      setTextures(prev => ({ ...prev, ...allTextures }));

      // CRITICAL: Set texturesReady AFTER textures are queued, using microtask
      // to ensure React has processed the setTextures call before signaling ready.
      // This fixes the black screen on first open bug caused by render triggering
      // before textures are actually available in state.
      // Use effect-local cancellation check to prevent stale microtask from
      // firing after cleanup runs and a new effect invocation starts (React strict mode)
      queueMicrotask(() => {
        if (mountedRef.current && !isCancelled?.()) {
          setTexturesReady(textureCount > 0);
          setLoading(false);
        }
      });
    }
  }

  /**
   * Get a texture by category and coordinate key
   */
  const getTexture = useCallback(
    (category: string, coordKey: string): Texture | null => {
      const key = buildTextureKey(category, coordKey);
      return textures[key] || null;
    },
    [textures]
  );

  /**
   * Get a frame texture by frame key
   * Frame textures are in the 'frame' category
   */
  const getFrameTexture = useCallback(
    (frameKey: string): Texture | null => {
      const primaryCategory = getFrameTextureCategory(frameKey);
      return getTexture(primaryCategory, frameKey)
        || (primaryCategory !== 'frame' ? getTexture('frame', frameKey) : null);
    },
    [getTexture]
  );

  return {
    textures,
    loading,
    error,
    getTexture,
    getFrameTexture,
    currentZoomLevel,
    debugInfo,
    texturesReady,
  };
}

// ============================================================================
// Utility Exports
// ============================================================================

/**
 * Clear all cached sprite sheets and textures.
 * Useful for testing or when forcing a reload.
 */
export function clearSpriteCache(): void {
  spriteSheetCache.clear();
  textureSliceCache.clear();
}

/**
 * Preload specific sprite categories for immediate use.
 * Call this before rendering to avoid loading delays.
 *
 * @param spriteConfig - The sprite configuration
 * @param zoomLevel - The zoom level to preload
 * @param categories - Categories to preload (defaults to PRELOAD_CATEGORIES)
 */
export async function preloadSprites(
  spriteConfig: SpriteConfig,
  zoomLevel: string,
  categories: readonly string[] = PRELOAD_CATEGORIES
): Promise<void> {
  const promises: Promise<Texture>[] = [];

  for (const category of categories) {
    const categoryConfig = spriteConfig[category];
    if (!categoryConfig) continue;

    const zoomConfig = categoryConfig[zoomLevel];
    if (!zoomConfig?.filename) continue;

    promises.push(loadSpriteSheet(zoomConfig.filename));
  }

  await Promise.all(promises);
}

export default useTreeSprites;
