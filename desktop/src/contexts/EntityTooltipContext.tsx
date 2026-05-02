/**
 * EntityTooltipContext
 *
 * Aggregates all entity lookup data (tree nodes, gems, uniques) into a single
 * React context so that inline EntitySpan components can access tooltip data
 * without prop drilling. Each data source is fetched once and module-level cached.
 */

import { createContext, useContext, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { preloadImages } from '../utils/image-preloader';
import { useTreeNodeEnrichment } from '../hooks/useTreeNodeEnrichment';
import { useGemLookup } from '../hooks/useGemLookup';
import type { GemTooltipPayload } from '../hooks/useGemLookup';
import { useUniqueLookup } from '../hooks/useUniqueLookup';
import type { UniqueTooltipPayload } from '../hooks/useUniqueLookup';
import type { NodeIconInfo } from '../components/visualization/tree/hooks/useSidebarSpriteData';
import type { SpriteConfig } from '../components/visualization/tree/types';
import type { MasteryEffect } from '../components/visualization/tree/hooks/useTreeData';

export interface EntityTooltipContextValue {
  // Tree
  nodeStatsMap: Map<string, string[]>;
  nodeTypeMap: Map<string, string>;
  nodeIconMap: Map<string, NodeIconInfo>;
  spriteConfig: SpriteConfig | undefined;
  zoomLevel: string;
  treeReady: boolean;
  /** Map from node name to mastery effects (for mastery nodes) */
  nodeMasteryMap: Map<string, MasteryEffect[]>;
  // Gems
  gemMap: Map<string, GemTooltipPayload>;
  gemReady: boolean;
  // Uniques
  uniqueMap: Map<string, UniqueTooltipPayload>;
  uniqueReady: boolean;
}

const EMPTY_STRING_ARRAY_MAP = new Map<string, string[]>();
const EMPTY_STRING_MAP = new Map<string, string>();
const EMPTY_ICON_MAP = new Map<string, NodeIconInfo>();
const EMPTY_GEM_MAP = new Map<string, GemTooltipPayload>();
const EMPTY_UNIQUE_MAP = new Map<string, UniqueTooltipPayload>();
const EMPTY_MASTERY_MAP = new Map<string, MasteryEffect[]>();

const DEFAULT_VALUE: EntityTooltipContextValue = {
  nodeStatsMap: EMPTY_STRING_ARRAY_MAP,
  nodeTypeMap: EMPTY_STRING_MAP,
  nodeIconMap: EMPTY_ICON_MAP,
  spriteConfig: undefined,
  zoomLevel: '',
  treeReady: false,
  nodeMasteryMap: EMPTY_MASTERY_MAP,
  gemMap: EMPTY_GEM_MAP,
  gemReady: false,
  uniqueMap: EMPTY_UNIQUE_MAP,
  uniqueReady: false,
};

const EntityTooltipCtx = createContext<EntityTooltipContextValue>(DEFAULT_VALUE);

interface EntityTooltipProviderProps {
  children: ReactNode;
}

export function EntityTooltipProvider({ children }: EntityTooltipProviderProps) {
  const {
    nodeIconMap,
    spriteConfig,
    zoomLevel,
    ready: treeReady,
    nodeStatsMap,
    nodeTypeMap,
    nodeMasteryMap,
  } = useTreeNodeEnrichment();

  const { gemMap, ready: gemReady } = useGemLookup();
  const { uniqueMap, ready: uniqueReady } = useUniqueLookup();

  // Preload sprite sheet images into browser cache as soon as tree data is ready
  useEffect(() => {
    if (!spriteConfig || !zoomLevel) return;
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:9876';
    const urls: string[] = [];
    for (const category of Object.values(spriteConfig)) {
      const sheetData = category[zoomLevel];
      if (sheetData?.filename) {
        urls.push(`${backendUrl}/api/v1/sprite-proxy?url=${encodeURIComponent(sheetData.filename)}`);
      }
    }
    if (urls.length > 0) preloadImages(urls);
  }, [spriteConfig, zoomLevel]);

  const value = useMemo<EntityTooltipContextValue>(
    () => ({
      nodeStatsMap,
      nodeTypeMap,
      nodeIconMap,
      spriteConfig,
      zoomLevel,
      treeReady,
      nodeMasteryMap,
      gemMap,
      gemReady,
      uniqueMap,
      uniqueReady,
    }),
    [nodeStatsMap, nodeTypeMap, nodeIconMap, spriteConfig, zoomLevel, treeReady, nodeMasteryMap, gemMap, gemReady, uniqueMap, uniqueReady]
  );

  return (
    <EntityTooltipCtx.Provider value={value}>
      {children}
    </EntityTooltipCtx.Provider>
  );
}

export function useEntityTooltips(): EntityTooltipContextValue {
  return useContext(EntityTooltipCtx);
}
