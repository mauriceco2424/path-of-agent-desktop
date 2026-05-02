const DOM_DELTA_PIXEL = 0;
const DOM_DELTA_LINE = 1;
const DOM_DELTA_PAGE = 2;

const LINE_HEIGHT_PX = 16;
const MAX_ABS_DELTA_PX = 600;
const ZOOM_SENSITIVITY = 0.0015;

export interface WheelDeltaInput {
  deltaY?: number;
  deltaMode?: number;
  wheelDelta?: number;
  detail?: number;
}

export function normalizeWheelDelta(deltaY: number, deltaMode: number, pageHeight: number): number {
  let normalized = deltaY;

  if (deltaMode === DOM_DELTA_LINE) {
    normalized *= LINE_HEIGHT_PX;
  } else if (deltaMode === DOM_DELTA_PAGE) {
    normalized *= pageHeight;
  }

  return Math.max(-MAX_ABS_DELTA_PX, Math.min(MAX_ABS_DELTA_PX, normalized));
}

export function extractNormalizedWheelDelta(
  input: WheelDeltaInput,
  pageHeight: number
): number {
  if (typeof input.deltaY === 'number' && Number.isFinite(input.deltaY)) {
    return normalizeWheelDelta(input.deltaY, input.deltaMode ?? DOM_DELTA_PIXEL, pageHeight);
  }

  if (typeof input.wheelDelta === 'number' && Number.isFinite(input.wheelDelta)) {
    return normalizeWheelDelta(-input.wheelDelta, DOM_DELTA_PIXEL, pageHeight);
  }

  if (typeof input.detail === 'number' && Number.isFinite(input.detail)) {
    return normalizeWheelDelta(input.detail * LINE_HEIGHT_PX, DOM_DELTA_PIXEL, pageHeight);
  }

  return 0;
}

export function getWheelZoomScale(
  oldScale: number,
  normalizedDeltaY: number,
  minScale: number,
  maxScale: number
): number {
  const zoomMultiplier = Math.exp(-normalizedDeltaY * ZOOM_SENSITIVITY);
  const nextScale = oldScale * zoomMultiplier;

  return Math.max(minScale, Math.min(maxScale, nextScale));
}
