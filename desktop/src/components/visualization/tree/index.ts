// Main component
export { InteractiveTreeCanvas } from './InteractiveTreeCanvas';
export type { InteractiveTreeCanvasProps } from './InteractiveTreeCanvas';

// Fullscreen modal
export { TreeFullscreenModal } from './TreeFullscreenModal';
export type { TreeFullscreenModalProps } from './TreeFullscreenModal';

// Viewport utilities
export {
  createTreeViewport,
  resizeViewport,
  centerViewportOn,
  zoomViewportTo,
  fitTreeInViewport,
} from './TreeViewport';
export type { WorldBounds, TreeViewportConfig, TreeViewportResult } from './TreeViewport';

// Layer utilities
export {
  createNodeLayer,
  renderNode,
  getNodeColor,
  getNodeSize,
  NODE_LAYER_COLORS,
  NODE_LAYER_SIZES,
} from './layers/NodeLayer';
export type { NodeLayerConfig } from './layers/NodeLayer';

export {
  createConnectionLayer,
  drawConnections,
  getConnectionColor,
  getConnectionLineWidth,
  buildConnectionsFromNodes,
  CONNECTION_COLORS,
  CONNECTION_LINE_WIDTH,
} from './layers/ConnectionLayer';
export type { ConnectionLayerConfig } from './layers/ConnectionLayer';

export {
  createJewelSocketOverlay,
  drawJewelSocketOverlays,
  getSocketsWithOverlays,
  JEWEL_RADIUS_BY_INDEX,
} from './layers/JewelSocketOverlay';
export type {
  AnimatedOverlaySprite,
  JewelOverlayRenderResult,
  JewelSocketInfo,
  JewelSocketOverlayConfig,
  JewelSocketOverlayTextures,
} from './layers/JewelSocketOverlay';

export {
  createClusterJewelLayer,
  buildClusterJewelData,
  drawClusterJewel,
  drawClusterBackground,
  drawClusterConnections,
  drawClusterNode,
  CLUSTER_COLORS,
} from './layers/ClusterJewelLayer';
export type {
  ClusterJewel,
  ClusterNodeRenderInfo,
  ClusterConnectionInfo,
  ClusterJewelLayerConfig,
} from './layers/ClusterJewelLayer';

export {
  createAscendancyLayer,
  drawAllAscendancies,
  drawAscendancyFrame,
  extractAscendancyData,
  getAscendancyColors,
  ASCENDANCY_COLORS,
  ASCENDANCY_FRAME,
} from './layers/AscendancyLayer';
export type { AscendancyLayerConfig, AscendancyGroupData } from './layers/AscendancyLayer';

// Cluster Jewel Utilities
export {
  isClusterNode,
  parseClusterNodeId,
  calculateClusterNodePosition,
  calculateClusterLayout,
  generateClusterConnections,
  groupClusterNodesBySocket,
  CLUSTER_NODE_OFFSET,
  CLUSTER_SIZES,
  CLUSTER_ORBIT_RADII,
  CLUSTER_SKILLS_PER_ORBIT,
} from './utils/cluster-layout';
export type {
  ClusterSize,
  ClusterNodeInfo,
  ClusterJewelData,
  ClusterNodePosition,
} from './utils/cluster-layout';

// Hooks
export { useTreeData, clearTreeDataCache } from './hooks/useTreeData';
export { useViewportCulling, filterNodesByBounds } from './hooks/useViewportCulling';
export {
  useTreeSprites,
  clearSpriteCache,
  preloadSprites,
} from './hooks/useTreeSprites';
export { useNodeInteraction } from './hooks/useNodeInteraction';
export { useTreeViewport } from './hooks/useTreeViewport';

// UI Components (HTML-based, rendered outside Pixi canvas)
export { TreeTooltip, TreeControls } from './ui';
export type { TooltipNode, MasteryEffect, SocketedJewelInfo, TreeControlsProps } from './ui';

// Sprite utilities
export {
  createNodeSprite,
  renderNodeSprite,
  drawNodeShape,
  drawNodeGlow,
  mapNodeType,
  NODE_COLORS,
  NODE_SIZES,
} from './sprites/NodeSprite';
export type { NodeSpriteConfig, NodeType } from './sprites/NodeSprite';

export {
  createJewelSocketSprite,
  renderJewelSocketSprite,
  drawSocketShape,
  drawSocketGlow,
  drawDiamond,
  getJewelColor,
  SOCKET_COLORS,
  SOCKET_SIZE,
} from './sprites/JewelSocketSprite';
export type { JewelSocketSpriteConfig } from './sprites/JewelSocketSprite';

// Types
export type {
  TreeNode,
  TreeConnection,
  TreeBounds,
  TreeData,
} from './hooks/useTreeData';

export type {
  SpriteCoords,
  ZoomLevelSprites,
  SpriteTextures,
  UseTreeSpritesResult,
} from './hooks/useTreeSprites';

export type {
  AllocationState,
  SpriteCategory,
  SpriteResolution,
} from './utils/sprite-resolver';

export type {
  NodeInteractionState,
  UseNodeInteractionOptions,
  UseNodeInteractionResult,
} from './hooks/useNodeInteraction';

export type {
  TreeViewportControls,
  UseTreeViewportOptions,
} from './hooks/useTreeViewport';
