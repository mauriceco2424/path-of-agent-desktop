/**
 * Sprite Resolver Utility
 *
 * Resolves the correct sprite key based on node type, allocation state,
 * and other node properties. Used by the tree visualization to determine
 * which sprite to render for each node.
 *
 * @module visualization/tree/utils/sprite-resolver
 */

import type { RenderableNode, SpriteConfig } from '../types';

// ============================================================================
// Types
// ============================================================================

/**
 * Node allocation state for sprite selection
 */
export type AllocationState = 'allocated' | 'canAllocate' | 'unallocated';

/**
 * Sprite categories available in the tree data
 */
export type SpriteCategory =
  | 'normalActive'
  | 'normalInactive'
  | 'notableActive'
  | 'notableInactive'
  | 'keystoneActive'
  | 'keystoneInactive'
  | 'mastery'
  | 'masteryConnected'
  | 'masteryActiveSelected'
  | 'masteryInactive'
  | 'masteryActiveEffect'
  | 'ascendancy'
  | 'frame'
  | 'jewel'
  | 'startNode'
  | 'groupBackground'
  | 'line';

/**
 * Result of sprite resolution
 */
export interface SpriteResolution {
  /** Icon sprite category (for the node's icon image) */
  iconCategory: SpriteCategory;
  /** Icon sprite key (path within the sprite sheet coords) */
  iconKey: string;
  /** Frame sprite key (from the 'frame' category) */
  frameKey: string | null;
  /** Whether this node should render an active effect overlay */
  hasActiveEffect: boolean;
  /** Active effect sprite key (if applicable) */
  activeEffectKey?: string;
}

const SPRITE_ICON_FALLBACK_ORDER: SpriteCategory[] = [
  'keystoneActive',
  'notableActive',
  'normalActive',
  'keystoneInactive',
  'notableInactive',
  'normalInactive',
  'masteryActiveSelected',
  'masteryInactive',
  'mastery',
];

const TRANSFORMED_NODE_ICON_ALIASES: Record<string, string> = {
  'Corrupted Soul': 'Art/2DArt/SkillIcons/passives/CorruptedDefences.dds',
  'Divine Flesh': 'Art/2DArt/SkillIcons/passives/DivineFlesh.dds',
  'Immortal Ambition': 'Art/2DArt/SkillIcons/passives/SoulTetherKeystone.dds',
  'Inner Conviction': 'Art/2DArt/SkillIcons/passives/InnerConviction.dds',
  'Tempered by War': 'Art/2DArt/SkillIcons/passives/TemperedByWar.dds',
  'Eternal Youth': 'Art/2DArt/SkillIcons/passives/EternalYouth.dds',
  'Strength of Blood': 'Art/2DArt/SkillIcons/passives/StrengthOfBlood.dds',
  'Glancing Blows': 'Art/2DArt/SkillIcons/passives/GlancingBlows.dds',
  'Wind Dancer': 'Art/2DArt/SkillIcons/passives/WindDancer.dds',
  'The Agnostic': 'Art/2DArt/SkillIcons/passives/MiracleMaker.dds',
  'Power of Purpose': 'Art/2DArt/SkillIcons/passives/PowerOfPurpose.dds',
  'Transcendence': 'Art/2DArt/SkillIcons/passives/TranscendenceKeystone.dds',
  'Supreme Decadence': 'Art/2DArt/SkillIcons/passives/SupremeDecadence.dds',
  'Supreme Grandstanding': 'Art/2DArt/SkillIcons/passives/SupremeGrandstand.dds',
  'Supreme Grandstand': 'Art/2DArt/SkillIcons/passives/SupremeGrandstand.dds',
  'Supreme Ego': 'Art/2DArt/SkillIcons/passives/SupremeEgo.dds',
  'Supreme Prodigy': 'Art/2DArt/SkillIcons/passives/SupremeProdigy.dds',
};

export function normalizeSpriteIconPath(iconPath?: string): string {
  return (iconPath ?? '').replace(/\\/g, '/');
}

export function getKnownTransformedNodeIconAlias(nodeName?: string): string | undefined {
  return nodeName ? TRANSFORMED_NODE_ICON_ALIASES[nodeName] : undefined;
}

export function findSpriteCategoryForIcon(
  iconPath: string | undefined,
  spriteConfig: SpriteConfig | undefined,
  zoomLevel: string | undefined,
  preferredCategories: string[] = []
): string | null {
  const normalizedPath = normalizeSpriteIconPath(iconPath);
  if (!normalizedPath || !spriteConfig || !zoomLevel) {
    return null;
  }

  const orderedCategories = [
    ...preferredCategories,
    ...SPRITE_ICON_FALLBACK_ORDER,
    ...Object.keys(spriteConfig),
  ];
  const seen = new Set<string>();

  for (const category of orderedCategories) {
    if (seen.has(category)) {
      continue;
    }
    seen.add(category);

    const categoryData = spriteConfig[category];
    const sheetData = categoryData?.[zoomLevel];
    if (sheetData?.coords?.[normalizedPath]) {
      return category;
    }
  }

  return null;
}

export function getRepresentativeSpriteIconSize(
  spriteConfig: SpriteConfig | undefined,
  category: string | undefined,
  zoomLevel: string | undefined
): { width: number; height: number } | null {
  if (!spriteConfig || !category || !zoomLevel) {
    return null;
  }

  const coords = spriteConfig[category]?.[zoomLevel]?.coords;
  if (!coords) {
    return null;
  }

  const firstCoord = Object.values(coords)[0];
  if (!firstCoord) {
    return null;
  }

  return {
    width: firstCoord.w,
    height: firstCoord.h,
  };
}

/**
 * Normalize legacy ascendancy aliases used by tree art keys.
 */
export function normalizeAscendancyName(ascendancyName?: string): string | undefined {
  if (!ascendancyName) {
    return undefined;
  }
  return ascendancyName === 'Raider' ? 'Warden' : ascendancyName;
}

/**
 * Resolve the portrait asset key for an ascendancy group.
 */
export function getAscendancyClassSpriteKey(ascendancyName?: string): string | null {
  const normalizedAscendancy = normalizeAscendancyName(ascendancyName);
  if (!normalizedAscendancy) {
    return null;
  }

  // The standard Ranger portrait art is still keyed as ClassesRaider.
  if (normalizedAscendancy === 'Warden') {
    return 'ClassesRaider';
  }

  return `Classes${normalizedAscendancy}`;
}

/**
 * Resolve which sprite sheet category contains the requested frame.
 */
export function getFrameTextureCategory(frameKey: string): SpriteCategory {
  if (frameKey.startsWith('AscendancyFrame')) {
    return 'ascendancy';
  }
  return 'frame';
}

// ============================================================================
// Frame Key Mappings
// ============================================================================

/**
 * Frame sprite keys for normal (small) passives
 */
const NORMAL_FRAMES = {
  allocated: 'PSSkillFrameActive',
  canAllocate: 'PSSkillFrameHighlighted',
  unallocated: 'PSSkillFrame',
} as const;

/**
 * Frame sprite keys for notable passives
 */
const NOTABLE_FRAMES = {
  allocated: 'NotableFrameAllocated',
  canAllocate: 'NotableFrameCanAllocate',
  unallocated: 'NotableFrameUnallocated',
} as const;

/**
 * Frame sprite keys for keystone passives
 */
const KEYSTONE_FRAMES = {
  allocated: 'KeystoneFrameAllocated',
  canAllocate: 'KeystoneFrameCanAllocate',
  unallocated: 'KeystoneFrameUnallocated',
} as const;

/**
 * Frame sprite keys for jewel sockets
 */
const JEWEL_FRAMES = {
  allocated: 'JewelFrameAllocated',
  canAllocate: 'JewelFrameCanAllocate',
  unallocated: 'JewelFrameUnallocated',
} as const;

/**
 * Frame sprite keys for ascendancy small nodes
 */
const ASCENDANCY_SMALL_FRAMES = {
  allocated: 'AscendancyFrameSmallAllocated',
  canAllocate: 'AscendancyFrameSmallCanAllocate',
  unallocated: 'AscendancyFrameSmallNormal',
} as const;

/**
 * Frame sprite keys for ascendancy notable/large nodes
 */
const ASCENDANCY_LARGE_FRAMES = {
  allocated: 'AscendancyFrameLargeAllocated',
  canAllocate: 'AscendancyFrameLargeCanAllocate',
  unallocated: 'AscendancyFrameLargeNormal',
} as const;

/**
 * Mastery nodes render from their dedicated mastery assets in PoB.
 * They do not get a separate frame sprite layered on top.
 */

// ============================================================================
// Sprite Resolution Functions
// ============================================================================

/**
 * Get the sprite category for a node's icon based on type and allocation
 *
 * @param node - The renderable node
 * @param isAllocated - Whether the node is currently allocated
 * @returns The sprite category for the node's icon
 */
export function getIconSpriteCategory(
  node: RenderableNode,
  isAllocated: boolean
): SpriteCategory {
  if (node.isAscendancyStart) {
    return 'ascendancy';
  }

  if (node.isMastery) {
    if (isAllocated) {
      return 'masteryActiveSelected';
    }
    return 'masteryInactive';
  }

  if (node.isKeystone) {
    return isAllocated ? 'keystoneActive' : 'keystoneInactive';
  }

  if (node.isNotable) {
    return isAllocated ? 'notableActive' : 'notableInactive';
  }

  if (node.isJewelSocket) {
    return 'jewel';
  }

  // Normal small passives
  return isAllocated ? 'normalActive' : 'normalInactive';
}

/**
 * Get the frame sprite key for a node based on type, allocation, and whether
 * it's an ascendancy node
 *
 * @param node - The renderable node
 * @param state - The allocation state (allocated, canAllocate, unallocated)
 * @returns The frame sprite key, or null if the node doesn't have a frame
 */
export function getFrameSpriteKey(
  node: RenderableNode,
  state: AllocationState
): string | null {
  // Ascendancy start nodes don't have frames
  if (node.isAscendancyStart) {
    return null;
  }

  // Mastery nodes do not use a separate frame in PoB.
  if (node.isMastery) {
    return null;
  }

  // Jewel sockets
  if (node.isJewelSocket) {
    return JEWEL_FRAMES[state];
  }

  // Ascendancy nodes
  if (node.ascendancyName) {
    // Large nodes (notables/keystones) in ascendancies
    if (node.isNotable || node.isKeystone) {
      return ASCENDANCY_LARGE_FRAMES[state];
    }
    // Small ascendancy nodes
    return ASCENDANCY_SMALL_FRAMES[state];
  }

  // Regular tree nodes
  if (node.isKeystone) {
    return KEYSTONE_FRAMES[state];
  }

  if (node.isNotable) {
    return NOTABLE_FRAMES[state];
  }

  // Normal small passives
  return NORMAL_FRAMES[state];
}

/**
 * Resolve all sprite information for a node
 *
 * @param node - The renderable node
 * @param isAllocated - Whether the node is allocated
 * @param canAllocate - Whether the node can be allocated (connected to tree)
 * @returns Complete sprite resolution with icon, frame, and effect info
 */
export function resolveSpriteInfo(
  node: RenderableNode,
  isAllocated: boolean,
  canAllocate: boolean = false
): SpriteResolution {
  const state: AllocationState = isAllocated
    ? 'allocated'
    : canAllocate
      ? 'canAllocate'
      : 'unallocated';

  const iconCategory = getIconSpriteCategory(node, isAllocated);
  const frameKey = getFrameSpriteKey(node, state);
  const iconKey = node.isAscendancyStart
    ? 'AscendancyMiddle'
    : node.isMastery
      ? (isAllocated ? node.activeIcon : node.inactiveIcon) || node.icon
      : node.icon;

  // Determine if this node should have an active effect overlay
  const hasActiveEffect = isAllocated && node.isMastery;

  return {
    iconCategory,
    iconKey,
    frameKey,
    hasActiveEffect,
    activeEffectKey: hasActiveEffect ? node.activeEffectImage : undefined,
  };
}

/**
 * Get the sprite key for a connection line based on allocation state
 *
 * @param isAllocated - Whether both connected nodes are allocated
 * @param isPartiallyAllocated - Whether one node is allocated (path line)
 * @returns The line sprite key
 */
export function getLineSpriteKey(
  isAllocated: boolean,
  isPartiallyAllocated: boolean = false
): string {
  if (isAllocated) {
    return 'LineConnectorActive';
  }
  if (isPartiallyAllocated) {
    return 'LineConnectorIntermediate';
  }
  return 'LineConnectorNormal';
}

/**
 * Get the appropriate zoom level key for sprite selection
 *
 * Sprites are provided at multiple zoom levels. We ALWAYS select the highest
 * quality sprites available because:
 * 1. High-res sprites scale down nicely without quality loss
 * 2. Low-res sprites look pixelated/blurry when scaled up (zoomed in)
 *
 * @param scale - Current viewport scale (0-1+) - not used, always returns highest
 * @param availableLevels - Available zoom levels from sprite config
 * @returns The zoom level key to use (always highest quality, e.g., "0.3835")
 */
export function selectZoomLevel(
  _scale: number,
  availableLevels: number[] = [0.1246, 0.2109, 0.2972, 0.3835]
): string {
  // PoB pins modern passive tree sprites to the 0.3835 sheet even when larger
  // atlas variants are available. Matching that keeps notable/mastery art sized
  // like PoB instead of inflating it with the largest exported sheet.
  if (availableLevels.some((level) => Math.abs(level - 0.3835) < 0.0001)) {
    return '0.3835';
  }

  // Fallback for legacy data that does not include the modern sheet.
  const sortedLevels = [...availableLevels].sort((a, b) => b - a);
  return sortedLevels[0].toString();
}

/**
 * Get node size in world units based on node type
 *
 * These sizes are based on PoB's artWidth values and affect
 * both rendering size and click detection radius.
 *
 * @param node - The renderable node
 * @returns The node size in world units
 */
export function getNodeSize(node: RenderableNode): number {
  // Sizes from PoB nodeOverlay artWidth * 1.33
  if (node.isKeystone) {
    return 84 * 1.33; // ~112
  }
  if (node.isNotable || node.isJewelSocket) {
    return 58 * 1.33; // ~77
  }
  if (node.isMastery) {
    return 65 * 1.33; // ~86
  }
  // Normal passives
  return 40 * 1.33; // ~53
}
