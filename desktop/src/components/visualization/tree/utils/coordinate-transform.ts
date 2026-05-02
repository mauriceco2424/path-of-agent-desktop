import type { ViewportState } from '../types';

export function worldToScreen(
  worldX: number,
  worldY: number,
  viewport: ViewportState,
  screenWidth: number,
  screenHeight: number
): { x: number; y: number } {
  const centerX = screenWidth / 2;
  const centerY = screenHeight / 2;

  return {
    x: centerX + (worldX - viewport.x) * viewport.scale,
    y: centerY + (worldY - viewport.y) * viewport.scale,
  };
}

export function screenToWorld(
  screenX: number,
  screenY: number,
  viewport: ViewportState,
  screenWidth: number,
  screenHeight: number
): { x: number; y: number } {
  const centerX = screenWidth / 2;
  const centerY = screenHeight / 2;

  return {
    x: viewport.x + (screenX - centerX) / viewport.scale,
    y: viewport.y + (screenY - centerY) / viewport.scale,
  };
}

export function getVisibleBounds(
  viewport: ViewportState,
  screenWidth: number,
  screenHeight: number
): { minX: number; maxX: number; minY: number; maxY: number } {
  const halfWidth = screenWidth / 2 / viewport.scale;
  const halfHeight = screenHeight / 2 / viewport.scale;

  return {
    minX: viewport.x - halfWidth,
    maxX: viewport.x + halfWidth,
    minY: viewport.y - halfHeight,
    maxY: viewport.y + halfHeight,
  };
}

export function isNodeVisible(
  nodeX: number,
  nodeY: number,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  padding: number = 50
): boolean {
  return (
    nodeX >= bounds.minX - padding &&
    nodeX <= bounds.maxX + padding &&
    nodeY >= bounds.minY - padding &&
    nodeY <= bounds.maxY + padding
  );
}
