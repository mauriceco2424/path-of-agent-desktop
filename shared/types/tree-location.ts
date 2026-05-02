/**
 * Tree Node Location Types
 *
 * Type definitions for providing rich location context for passive tree nodes.
 * Used to help users find nodes in-game with detailed location hints.
 *
 * @module shared/types/tree-location
 */

// =============================================================================
// Location Information Types
// =============================================================================

/**
 * Rich location information for a passive tree node.
 *
 * Provides multiple levels of detail to help users locate nodes:
 * - Class area: Which class starting area the node is closest to
 * - Named region: Well-known tree regions (life wheel, crit cluster, etc.)
 * - Points from tree: How many passive points away from current allocation
 */
export interface NodeLocationInfo {
  /**
   * Which class starting area the node is closest to.
   * @example "Near Marauder", "Near Witch", "Center (Scion)"
   */
  classArea: string;

  /**
   * Well-known region name if the node is in a recognized cluster.
   * @example "Life wheel", "Crit cluster", "Aura area"
   */
  namedRegion?: string;

  /**
   * Distance in passive points from the user's current tree allocation.
   * -1 if distance could not be calculated (e.g., unreachable node).
   */
  pointsFromTree: number;

  /**
   * Combined human-readable hint for display.
   * @example "Keystone near Marauder, 12 points away"
   * @example "Notable in Scion life wheel, 4 points away"
   */
  fullHint: string;
}

/**
 * Enhanced node details for tree simulation responses.
 * Includes both basic node info and rich location context.
 */
export interface EnhancedNodeDetail {
  /** Numeric node ID from PoB */
  nodeId: number;

  /** Human-readable node name */
  name: string;

  /** Rich location information */
  locationInfo: NodeLocationInfo;

  /** Whether this node is being allocated or refunded */
  action: 'allocate' | 'refund';

  /** Node type for display purposes */
  nodeType?: 'keystone' | 'notable' | 'small' | 'mastery';
}

// =============================================================================
// Named Region Definitions
// =============================================================================

/**
 * Definition of a well-known tree region.
 * Used to provide familiar landmark names to users.
 */
export interface NamedRegion {
  /** Region identifier */
  id: string;

  /** Display name shown to users */
  displayName: string;

  /** Approximate center coordinates */
  center: { x: number; y: number };

  /** Radius to consider nodes as part of this region */
  radius: number;

  /** Keywords to help identify nodes in this region */
  keywords?: string[];
}

/**
 * Well-known tree regions that players commonly reference.
 * These provide familiar landmarks for node location.
 */
export const NAMED_TREE_REGIONS: NamedRegion[] = [
  {
    id: 'scion_life_wheel',
    displayName: 'Scion life wheel',
    center: { x: 0, y: 0 },
    radius: 4000,
    keywords: ['life', 'constitution', 'purity of flesh'],
  },
  {
    id: 'shadow_crit',
    displayName: 'Shadow crit cluster',
    center: { x: 8000, y: -8000 },
    radius: 3500,
    keywords: ['critical', 'crit', 'multiplier'],
  },
  {
    id: 'templar_aura',
    displayName: 'Templar aura area',
    center: { x: -5000, y: -8000 },
    radius: 3500,
    keywords: ['aura', 'reservation', 'mana reserved'],
  },
  {
    id: 'ranger_evasion',
    displayName: 'Ranger evasion cluster',
    center: { x: 10000, y: 4000 },
    radius: 3500,
    keywords: ['evasion', 'dodge', 'suppress'],
  },
  {
    id: 'duelist_leech',
    displayName: 'Duelist leech area',
    center: { x: 2000, y: 8000 },
    radius: 3500,
    keywords: ['leech', 'life on hit', 'attack'],
  },
  {
    id: 'witch_es',
    displayName: 'Witch ES cluster',
    center: { x: 0, y: -12000 },
    radius: 3500,
    keywords: ['energy shield', 'es', 'recharge'],
  },
  {
    id: 'marauder_armor',
    displayName: 'Marauder armor/life area',
    center: { x: -10000, y: 6000 },
    radius: 4000,
    keywords: ['armour', 'armor', 'life', 'endurance'],
  },
  {
    id: 'jewel_socket_left',
    displayName: 'Left jewel cluster',
    center: { x: -6000, y: 2000 },
    radius: 2500,
    keywords: ['jewel'],
  },
  {
    id: 'jewel_socket_right',
    displayName: 'Right jewel cluster',
    center: { x: 6000, y: 2000 },
    radius: 2500,
    keywords: ['jewel'],
  },
];

// =============================================================================
// Class Area Definitions
// =============================================================================

/**
 * Class starting area information for location hints.
 */
export interface ClassArea {
  /** Class name */
  className: string;

  /** Starting node ID */
  startNodeId: number;

  /** Approximate coordinates of the class start */
  coordinates: { x: number; y: number };
}

/**
 * Class starting areas with their approximate tree positions.
 * Used to determine which class area a node is closest to.
 */
export const CLASS_START_AREAS: ClassArea[] = [
  { className: 'Scion', startNodeId: 2600, coordinates: { x: 0, y: 0 } },
  { className: 'Marauder', startNodeId: 47175, coordinates: { x: -10400, y: 5200 } },
  { className: 'Ranger', startNodeId: 50986, coordinates: { x: 10400, y: 5200 } },
  { className: 'Witch', startNodeId: 58833, coordinates: { x: 0, y: -10400 } },
  { className: 'Duelist', startNodeId: 44683, coordinates: { x: -5200, y: 9000 } },
  { className: 'Templar', startNodeId: 61525, coordinates: { x: -7800, y: -7800 } },
  { className: 'Shadow', startNodeId: 58604, coordinates: { x: 7800, y: -7800 } },
];
