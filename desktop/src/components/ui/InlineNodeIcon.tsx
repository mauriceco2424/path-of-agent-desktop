/**
 * InlineNodeIcon Component
 *
 * A tiny (14px) CSS sprite icon for rendering passive tree node icons inline
 * within text flow. Reuses the sprite rendering logic from TreeNodeIcon.
 * Renders inline-block with vertical alignment to sit naturally in text
 * without disrupting line height.
 *
 * Returns null if the node is not found in the icon map or sprite data is unavailable.
 */

import { TreeNodeIcon } from '../visualization/tree/ui/TreeNodeIcon';
import type { NodeIconInfo } from '../visualization/tree/hooks/useSidebarSpriteData';
import type { SpriteConfig } from '../visualization/tree/types';

const INLINE_ICON_SIZE = 14;

interface InlineNodeIconProps {
  /** Node name to look up in the icon map */
  name: string;
  /** Node icon info from the enrichment map */
  nodeIcon: NodeIconInfo;
  /** Full sprite configuration */
  spriteConfig: SpriteConfig;
  /** Zoom level key for sprite sheet selection */
  zoomLevel: string;
}

export function InlineNodeIcon({
  nodeIcon,
  spriteConfig,
  zoomLevel,
}: InlineNodeIconProps) {
  return (
    <TreeNodeIcon
      iconPath={nodeIcon.iconPath}
      spriteCategory={nodeIcon.spriteCategory}
      spriteConfig={spriteConfig}
      zoomLevel={zoomLevel}
      size={INLINE_ICON_SIZE}
      className="inline-block align-middle mr-1 -mt-px"
    />
  );
}
