import { useMemo } from 'react';
import { cn } from '../../../../lib/utils';
import type { SpriteConfig } from '../types';
import { findSpriteCategoryForIcon, normalizeSpriteIconPath } from '../utils/sprite-resolver';

/**
 * Props for the TreeNodeIcon component
 */
interface TreeNodeIconProps {
  /** Icon path key within the sprite sheet coords (e.g., "Art/2DArt/SkillIcons/...") */
  iconPath: string;
  /** Sprite category for sheet lookup (e.g., 'keystoneActive', 'notableActive') */
  spriteCategory: string;
  /** Full sprite configuration from tree data */
  spriteConfig: SpriteConfig;
  /** Zoom level key for sprite sheet selection (e.g., "0.3835") */
  zoomLevel: string;
  /** Rendered icon size in pixels */
  size?: number;
  /** Additional CSS classes */
  className?: string;
}

const DEFAULT_SIZE = 24;
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:9876';
const TREE_LEGION_SPRITE_SCHEME = 'poa-tree-legion:';

function resolveSpriteSheetUrl(filename: string): string {
  if (filename.startsWith(TREE_LEGION_SPRITE_SCHEME)) {
    const assetName = filename.slice(TREE_LEGION_SPRITE_SCHEME.length);
    return `${BACKEND_URL}/api/v1/tree-legion-sprite-asset?name=${encodeURIComponent(assetName)}`;
  }

  if (filename.startsWith('https://web.poecdn.com/')) {
    return `${BACKEND_URL}/api/v1/sprite-proxy?url=${encodeURIComponent(filename)}`;
  }

  return filename;
}

/**
 * Pure CSS sprite renderer for passive tree node icons.
 *
 * Renders a single node icon by computing background-position and
 * background-size from the sprite sheet configuration. No Pixi.js dependency.
 *
 * The sprite proxy endpoint is HTTP-cached by the browser, so many icons
 * sharing the same sprite sheet only trigger a single network fetch.
 *
 * Returns null if any sprite lookup fails (graceful fallback).
 */
export function TreeNodeIcon({
  iconPath,
  spriteCategory,
  spriteConfig,
  zoomLevel,
  size = DEFAULT_SIZE,
  className,
}: TreeNodeIconProps) {
  const style = useMemo(() => {
    const resolvedCategory = findSpriteCategoryForIcon(
      iconPath,
      spriteConfig,
      zoomLevel,
      [spriteCategory]
    );
    if (!resolvedCategory) {
      return null;
    }

    // Step 1: Look up the sprite sheet for this category and zoom level
    const categoryData = spriteConfig[resolvedCategory];
    if (!categoryData) {
      return null;
    }

    const sheetData = categoryData[zoomLevel];
    if (!sheetData) {
      return null;
    }

    // Step 2: Normalize the icon path (backslashes to forward slashes) and look up coords
    const normalizedPath = normalizeSpriteIconPath(iconPath);
    const coords = sheetData.coords[normalizedPath];
    if (!coords) {
      return null;
    }

    // Step 3: Compute the proxied URL for the sprite sheet
    const proxiedUrl = resolveSpriteSheetUrl(sheetData.filename);

    // Step 4: Compute scale factor and CSS background properties
    const scale = size / coords.w;

    return {
      backgroundImage: `url(${proxiedUrl})`,
      backgroundPosition: `${-(coords.x * scale)}px ${-(coords.y * scale)}px`,
      backgroundSize: `${sheetData.w * scale}px ${sheetData.h * scale}px`,
      width: `${size}px`,
      height: `${size}px`,
    } as React.CSSProperties;
  }, [iconPath, spriteCategory, spriteConfig, zoomLevel, size]);

  if (!style) {
    return null;
  }

  return (
    <span
      className={cn('rounded-full overflow-hidden inline-block flex-shrink-0', className)}
      style={style}
    />
  );
}
