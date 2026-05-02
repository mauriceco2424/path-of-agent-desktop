export type ConnectionState = 'Normal' | 'Intermediate' | 'Active';

export interface ConnectorStyle {
  state: ConnectionState;
  alpha: number;
  tint: number;
}

export interface TextureSize {
  width: number;
  height: number;
}

export interface TreeConnectorNodeLike {
  id: number;
  x: number;
  y: number;
  group?: number;
  orbit?: number;
  isClassStart?: boolean;
  isMastery?: boolean;
  ascendancyName?: string;
}

export interface ConnectorCenter {
  x: number;
  y: number;
}

export interface StraightConnectorLayout {
  kind: 'line';
  x: number;
  y: number;
  length: number;
  thickness: number;
  rotation: number;
  repeatWidth: number;
  textureKey: string;
  style: ConnectorStyle;
}

export interface MeshConnectorLayout {
  kind: 'mesh';
  vertices: Float32Array;
  uvs: Float32Array;
  textureKey: string;
  style: ConnectorStyle;
}

export type ConnectorLayout = StraightConnectorLayout | MeshConnectorLayout;

const FULL_CIRCLE = Math.PI * 2;
const HALF_CIRCLE = Math.PI;
const HALF_RIGHT_ANGLE = Math.PI / 2;
const QUARTER_TURN = Math.PI / 4;
const SQRT_TWO = Math.SQRT2;
const DEFAULT_TINT = 0xffffff;
const MUTED_ASCENDANCY_TINT = 0xbfc2c7;
const MUTED_ASCENDANCY_ALPHA = 0.4;

export function getConnectionState(
  isAllocated: boolean,
  isPartiallyAllocated: boolean = false
): ConnectionState {
  if (isAllocated) {
    return 'Active';
  }

  if (isPartiallyAllocated) {
    return 'Intermediate';
  }

  return 'Normal';
}

export function getConnectorStyle(
  state: ConnectionState,
  options: {
    isMuted?: boolean;
  } = {}
): ConnectorStyle {
  return {
    state,
    alpha: options.isMuted ? MUTED_ASCENDANCY_ALPHA : 1,
    tint: options.isMuted ? MUTED_ASCENDANCY_TINT : DEFAULT_TINT,
  };
}

export function getLineConnectorKey(state: ConnectionState): string {
  return `LineConnector${state}`;
}

export function getOrbitConnectorKey(orbit: number, state: ConnectionState): string {
  return `Orbit${orbit}${state}`;
}

export function buildStraightConnectorLayout(
  from: Pick<TreeConnectorNodeLike, 'x' | 'y'>,
  to: Pick<TreeConnectorNodeLike, 'x' | 'y'>,
  texture: TextureSize,
  textureScale: number,
  style: ConnectorStyle
): StraightConnectorLayout | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);

  if (!Number.isFinite(length) || length <= 0) {
    return null;
  }

  const halfThickness = texture.height * textureScale;

  return {
    kind: 'line',
    x: from.x,
    y: from.y,
    length,
    thickness: halfThickness * 2,
    rotation: Math.atan2(dy, dx),
    repeatWidth: texture.width * textureScale,
    textureKey: getLineConnectorKey(style.state),
    style,
  };
}

export function buildOrbitConnectorLayouts(
  from: Pick<TreeConnectorNodeLike, 'x' | 'y'>,
  to: Pick<TreeConnectorNodeLike, 'x' | 'y'>,
  center: ConnectorCenter,
  orbit: number,
  texture: TextureSize,
  textureScale: number,
  style: ConnectorStyle
): MeshConnectorLayout[] {
  if (orbit <= 0) {
    return [];
  }

  let startAngle = getPoBOrbitAngle(from, center);
  let endAngle = getPoBOrbitAngle(to, center);

  if (startAngle > endAngle) {
    [startAngle, endAngle] = [endAngle, startAngle];
  }

  let arcAngle = endAngle - startAngle;
  if (arcAngle >= HALF_CIRCLE) {
    [startAngle, endAngle] = [endAngle, startAngle];
    arcAngle = FULL_CIRCLE - arcAngle;
  }

  if (!Number.isFinite(arcAngle) || arcAngle <= 0 || arcAngle > HALF_CIRCLE) {
    return [];
  }

  const halfArcAngle = arcAngle > HALF_RIGHT_ANGLE
    ? arcAngle / 2
    : arcAngle;

  const textureKey = getOrbitConnectorKey(orbit, style.state);
  const layouts: MeshConnectorLayout[] = [
    buildOrbitConnectorQuad(
      center,
      startAngle,
      halfArcAngle,
      texture,
      textureScale,
      textureKey,
      style,
      false
    ),
  ];

  if (arcAngle > HALF_RIGHT_ANGLE) {
    layouts.push(
      buildOrbitConnectorQuad(
        center,
        startAngle,
        halfArcAngle,
        texture,
        textureScale,
        textureKey,
        style,
        true
      )
    );
  }

  return layouts;
}

function buildOrbitConnectorQuad(
  center: ConnectorCenter,
  startAngle: number,
  arcAngle: number,
  texture: TextureSize,
  textureScale: number,
  textureKey: string,
  style: ConnectorStyle,
  isMirrored: boolean
): MeshConnectorLayout {
  const clipAngle = QUARTER_TURN - arcAngle / 2;
  const p = 1 - Math.max(Math.tan(clipAngle), 0);
  let angle = startAngle - clipAngle;

  if (isMirrored) {
    angle += arcAngle;
  }

  const size = texture.width * textureScale;
  const offsetX = size * SQRT_TWO * Math.sin(angle + QUARTER_TURN);
  const offsetY = size * SQRT_TWO * -Math.cos(angle + QUARTER_TURN);
  const outerX = center.x + offsetX;
  const outerY = center.y + offsetY;

  let cornerAX = outerX + (size * Math.sin(angle) - offsetX) * p;
  let cornerAY = outerY + (size * -Math.cos(angle) - offsetY) * p;
  let cornerBX = outerX + (size * Math.cos(angle) - offsetX) * p;
  let cornerBY = outerY + (size * Math.sin(angle) - offsetY) * p;

  if (isMirrored) {
    [cornerAX, cornerBX] = [cornerBX, cornerAX];
    [cornerAY, cornerBY] = [cornerBY, cornerAY];
  }

  return {
    kind: 'mesh',
    vertices: new Float32Array([
      center.x, center.y,
      cornerAX, cornerAY,
      outerX, outerY,
      cornerBX, cornerBY,
    ]),
    uvs: new Float32Array([
      1, 1,
      0, p,
      0, 0,
      p, 0,
    ]),
    textureKey,
    style,
  };
}

function toCircleAngle(angle: number): number {
  let normalized = angle % FULL_CIRCLE;

  if (normalized < 0) {
    normalized += FULL_CIRCLE;
  }

  return normalized;
}

function getPoBOrbitAngle(
  node: Pick<TreeConnectorNodeLike, 'x' | 'y'>,
  center: ConnectorCenter
): number {
  const dx = node.x - center.x;
  const dy = node.y - center.y;

  // PoB stores orbit angles with 0 at the top of the wheel and increasing clockwise.
  return toCircleAngle(Math.atan2(dx, -dy));
}
