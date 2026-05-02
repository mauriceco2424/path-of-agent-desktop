/**
 * AscendancyLayer Utilities
 *
 * Utility functions for rendering ascendancy decorative frames using vanilla Pixi.js.
 *
 * NOTE: The main InteractiveTreeCanvas.tsx now handles rendering directly.
 * These utilities are kept for potential future use or refactoring.
 *
 * @module visualization/tree/layers/AscendancyLayer
 */

import { Container, Graphics } from 'pixi.js';
import type { TreeNode } from '../hooks/useTreeData';

// Re-export types for consumers
export type { TreeNode };

/**
 * Colors for ascendancy rendering based on PoB's visual style.
 * Each ascendancy class has a themed color scheme.
 */
export const ASCENDANCY_COLORS: Record<string, { primary: number; secondary: number; glow: number }> = {
  // Duelist ascendancies
  Slayer: { primary: 0xcc4444, secondary: 0x882222, glow: 0xff5555 },
  Gladiator: { primary: 0xdd6622, secondary: 0x883311, glow: 0xff8844 },
  Champion: { primary: 0xccaa44, secondary: 0x886622, glow: 0xffcc55 },

  // Shadow ascendancies
  Assassin: { primary: 0x8844aa, secondary: 0x442266, glow: 0xaa66cc },
  Saboteur: { primary: 0x44aa88, secondary: 0x226644, glow: 0x66ccaa },
  Trickster: { primary: 0x4488cc, secondary: 0x224466, glow: 0x66aaff },

  // Marauder ascendancies
  Juggernaut: { primary: 0xcc6644, secondary: 0x883322, glow: 0xff8866 },
  Berserker: { primary: 0xdd4422, secondary: 0x882211, glow: 0xff6644 },
  Chieftain: { primary: 0xdd8844, secondary: 0x884422, glow: 0xffaa66 },

  // Witch ascendancies
  Necromancer: { primary: 0x66aa66, secondary: 0x336633, glow: 0x88cc88 },
  Elementalist: { primary: 0xaa44aa, secondary: 0x662266, glow: 0xcc66cc },
  Occultist: { primary: 0x6644aa, secondary: 0x332266, glow: 0x8866cc },

  // Ranger ascendancies
  Deadeye: { primary: 0x44cc66, secondary: 0x228833, glow: 0x66ff88 },
  Raider: { primary: 0x44ccaa, secondary: 0x228866, glow: 0x66ffcc },
  Warden: { primary: 0x44ccaa, secondary: 0x228866, glow: 0x66ffcc },
  Pathfinder: { primary: 0x88cc44, secondary: 0x448822, glow: 0xaaff66 },

  // Templar ascendancies
  Inquisitor: { primary: 0xcccc44, secondary: 0x888822, glow: 0xffff66 },
  Hierophant: { primary: 0x44aacc, secondary: 0x226688, glow: 0x66ccff },
  Guardian: { primary: 0xaaaacc, secondary: 0x666688, glow: 0xccccff },

  // Scion ascendancies
  Ascendant: { primary: 0xcccccc, secondary: 0x888888, glow: 0xffffff },
  Reliquarian: { primary: 0xccaa44, secondary: 0x886622, glow: 0xffdd66 },

  // Default fallback
  default: { primary: 0x666688, secondary: 0x333344, glow: 0x8888aa },
};

/**
 * Get ascendancy colors with fallback
 */
export function getAscendancyColors(ascendancyName?: string): { primary: number; secondary: number; glow: number } {
  return ASCENDANCY_COLORS[ascendancyName || ''] || ASCENDANCY_COLORS.default;
}

/**
 * Ascendancy frame size configuration
 */
export const ASCENDANCY_FRAME = {
  /** Outer ring radius */
  outerRadius: 280,
  /** Inner ring radius */
  innerRadius: 260,
  /** Ring line thickness */
  ringWidth: 4,
  /** Decorative notch count */
  notchCount: 8,
  /** Notch length */
  notchLength: 20,
} as const;

/**
 * Configuration for ascendancy layer rendering
 */
export interface AscendancyLayerConfig {
  /** All tree nodes */
  nodes: TreeNode[];
  /** IDs of currently allocated nodes */
  allocatedNodes: number[];
  /** Currently selected ascendancy name */
  currentAscendancy?: string;
  /** Opacity for non-current ascendancy backgrounds (0-1) */
  inactiveOpacity?: number;
}

/**
 * Ascendancy group data
 */
export interface AscendancyGroupData {
  startNode: TreeNode | null;
  nodes: TreeNode[];
  center: { x: number; y: number };
}

/**
 * Extract ascendancy group data from nodes
 */
export function extractAscendancyData(nodes: TreeNode[]): Map<string, AscendancyGroupData> {
  const ascendancyGroups = new Map<string, AscendancyGroupData>();

  // First pass: collect all ascendancy nodes
  for (const node of nodes) {
    if (!node.ascendancyName) continue;

    const existing = ascendancyGroups.get(node.ascendancyName) || {
      startNode: null,
      nodes: [],
      center: { x: 0, y: 0 },
    };

    existing.nodes.push(node);

    if (node.isAscendancyStart) {
      existing.startNode = node;
      existing.center = { x: node.x, y: node.y };
    }

    ascendancyGroups.set(node.ascendancyName, existing);
  }

  // Second pass: calculate center for ascendancies without explicit start nodes
  for (const [name, data] of ascendancyGroups.entries()) {
    if (!data.startNode && data.nodes.length > 0) {
      // Calculate centroid of all nodes
      let sumX = 0;
      let sumY = 0;
      for (const node of data.nodes) {
        sumX += node.x;
        sumY += node.y;
      }
      data.center = {
        x: sumX / data.nodes.length,
        y: sumY / data.nodes.length,
      };
    }
  }

  return ascendancyGroups;
}

/**
 * Draw the decorative frame for an ascendancy
 */
export function drawAscendancyFrame(
  graphics: Graphics,
  centerX: number,
  centerY: number,
  ascendancyName: string,
  isActive: boolean,
  inactiveOpacity: number = 0.25
): void {
  const colors = getAscendancyColors(ascendancyName);
  const opacity = isActive ? 1 : inactiveOpacity;

  const { outerRadius, innerRadius, ringWidth, notchCount, notchLength } = ASCENDANCY_FRAME;

  // Draw outer glow (multiple layers for soft effect)
  if (isActive) {
    const glowLayers = 4;
    for (let i = glowLayers; i > 0; i--) {
      const glowRadius = outerRadius + i * 8;
      const glowAlpha = 0.08 / i;
      graphics.circle(centerX, centerY, glowRadius);
      graphics.fill({ color: colors.glow, alpha: glowAlpha });
    }
  }

  // Draw outer ring
  graphics.circle(centerX, centerY, outerRadius);
  graphics.stroke({
    color: colors.primary,
    width: ringWidth,
    alpha: opacity * 0.9,
  });

  // Draw inner ring
  graphics.circle(centerX, centerY, innerRadius);
  graphics.stroke({
    color: colors.secondary,
    width: ringWidth * 0.6,
    alpha: opacity * 0.6,
  });

  // Draw decorative notches around the outer ring
  for (let i = 0; i < notchCount; i++) {
    const angle = (2 * Math.PI * i) / notchCount - Math.PI / 2;
    const startX = centerX + (outerRadius - notchLength / 2) * Math.cos(angle);
    const startY = centerY + (outerRadius - notchLength / 2) * Math.sin(angle);
    const endX = centerX + (outerRadius + notchLength / 2) * Math.cos(angle);
    const endY = centerY + (outerRadius + notchLength / 2) * Math.sin(angle);

    graphics.moveTo(startX, startY);
    graphics.lineTo(endX, endY);
    graphics.stroke({
      color: colors.primary,
      width: 3,
      alpha: opacity * 0.8,
    });
  }

  // Draw background fill (very subtle)
  graphics.circle(centerX, centerY, innerRadius - 10);
  graphics.fill({
    color: colors.secondary,
    alpha: opacity * 0.1,
  });

  // Draw connecting line to outer edge (representing connection to main tree)
  if (isActive) {
    // Calculate direction towards tree center (approximate)
    const treeCenterX = 0;
    const treeCenterY = 0;
    const dirX = treeCenterX - centerX;
    const dirY = treeCenterY - centerY;
    const dist = Math.sqrt(dirX * dirX + dirY * dirY);
    const normX = dirX / dist;
    const normY = dirY / dist;

    const connStartX = centerX + normX * outerRadius;
    const connStartY = centerY + normY * outerRadius;
    const connEndX = centerX + normX * (outerRadius + 50);
    const connEndY = centerY + normY * (outerRadius + 50);

    graphics.moveTo(connStartX, connStartY);
    graphics.lineTo(connEndX, connEndY);
    graphics.stroke({
      color: colors.primary,
      width: 3,
      alpha: 0.5,
    });
  }
}

/**
 * Draw allocated node indicator effect
 */
export function drawAllocatedIndicator(
  graphics: Graphics,
  node: TreeNode,
  ascendancyName: string,
  allocatedSet: Set<number>
): void {
  if (!allocatedSet.has(node.id)) return;
  if (node.isAscendancyStart) return; // Don't add extra effect to start node

  const colors = getAscendancyColors(ascendancyName);

  // Draw a small glow ring around allocated nodes
  graphics.circle(node.x, node.y, 28);
  graphics.stroke({
    color: colors.glow,
    width: 2,
    alpha: 0.6,
  });

  // Inner glow
  graphics.circle(node.x, node.y, 22);
  graphics.fill({
    color: colors.glow,
    alpha: 0.15,
  });
}

/**
 * Draw all ascendancy decorations to a Graphics object
 */
export function drawAllAscendancies(
  graphics: Graphics,
  config: AscendancyLayerConfig
): void {
  const { nodes, allocatedNodes, currentAscendancy, inactiveOpacity = 0.25 } = config;

  const allocatedSet = new Set(allocatedNodes);
  const ascendancyData = extractAscendancyData(nodes);

  graphics.clear();

  // Sort to draw current ascendancy last (on top)
  const sortedAscendancies = Array.from(ascendancyData.entries()).sort(([nameA], [nameB]) => {
    if (nameA === currentAscendancy) return 1;
    if (nameB === currentAscendancy) return -1;
    return 0;
  });

  for (const [ascendancyName, data] of sortedAscendancies) {
    const isActive = ascendancyName === currentAscendancy;

    // Draw the frame
    drawAscendancyFrame(graphics, data.center.x, data.center.y, ascendancyName, isActive, inactiveOpacity);

    // Draw allocated node indicators (only for active ascendancy)
    if (isActive) {
      for (const node of data.nodes) {
        drawAllocatedIndicator(graphics, node, ascendancyName, allocatedSet);
      }
    }
  }
}

/**
 * Create an ascendancy layer container
 *
 * @param config - Ascendancy layer configuration
 * @returns Container with ascendancy graphics, or null if no ascendancies found
 */
export function createAscendancyLayer(config: AscendancyLayerConfig): Container | null {
  const ascendancyData = extractAscendancyData(config.nodes);

  if (ascendancyData.size === 0) {
    return null;
  }

  const container = new Container();
  const graphics = new Graphics();

  drawAllAscendancies(graphics, config);
  container.addChild(graphics);

  return container;
}

export default createAscendancyLayer;
