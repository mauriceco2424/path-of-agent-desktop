import { useMemo } from 'react';
import { useTreeData } from './useTreeData';
import type { SpriteConfig } from '../types';
import { selectZoomLevel } from '../utils/sprite-resolver';

/**
 * Icon information for a single tree node, used for sidebar display
 */
export interface NodeIconInfo {
  iconPath: string;
  /** Sprite category for looking up the correct sprite sheet */
  spriteCategory: string;
}

/**
 * Data needed to render CSS sprite icons in the sidebar
 */
export interface SidebarSpriteData {
  /** Map from node name to icon info */
  nodeIconMap: Map<string, NodeIconInfo>;
  /** Full sprite configuration for all categories/zoom levels */
  spriteConfig: SpriteConfig | undefined;
  /** Selected zoom level key (always highest quality) */
  zoomLevel: string;
  /** Whether all required data is loaded and ready */
  ready: boolean;
}

const EMPTY_MAP = new Map<string, NodeIconInfo>();

/**
 * Hook that wraps useTreeData() and provides a name-to-icon mapping
 * for rendering passive tree node icons in the sidebar using CSS sprites.
 *
 * Builds a Map<nodeName, NodeIconInfo> from tree node data, categorizing
 * nodes by type (keystone, notable, ascendancy, normal) for sprite lookup.
 */
export function useSidebarSpriteData(): SidebarSpriteData {
  const { data } = useTreeData();

  const nodeIconMap = useMemo(() => {
    if (!data?.nodes) {
      return EMPTY_MAP;
    }

    const map = new Map<string, NodeIconInfo>();

    for (const node of data.nodes) {
      if (!node.name || !node.icon) {
        continue;
      }

      let spriteCategory: string;

      if (node.type === 'keystone') {
        spriteCategory = 'keystoneActive';
      } else if (node.type === 'notable') {
        spriteCategory = 'notableActive';
      } else if (node.type === 'normal' || node.type === 'ascendancy' || node.ascendancyName) {
        // Ascendancy nodes use normalActive sprites (the 'ascendancy' sprite sheet
        // only contains class portrait frames, not individual node icons)
        spriteCategory = 'normalActive';
      } else if (node.type === 'mastery') {
        // Mastery nodes use activeIcon for allocated state
        const masteryIcon = node.activeIcon || node.icon;
        if (masteryIcon && !map.has(node.name)) {
          map.set(node.name, {
            iconPath: masteryIcon,
            spriteCategory: 'masteryActiveSelected',
          });
        }
        continue;
      } else {
        // Skip jewelSocket and other types not needed in sidebar
        continue;
      }

      // Only set if not already in map (first occurrence wins)
      if (!map.has(node.name)) {
        map.set(node.name, {
          iconPath: node.icon,
          spriteCategory,
        });
      }
    }

    return map;
  }, [data]);

  const zoomLevel = useMemo(() => {
    if (!data?.imageZoomLevels) {
      return '';
    }
    return selectZoomLevel(1, data.imageZoomLevels);
  }, [data?.imageZoomLevels]);

  const ready = !!data && !!data.sprites && zoomLevel !== '';

  return {
    nodeIconMap,
    spriteConfig: data?.sprites,
    zoomLevel,
    ready,
  };
}
