export interface ViewportState {
  zoom: number;
  panX: number;
  panY: number;
}

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 4.0;
export const ZOOM_STEP = 1.1;

export function clampZoom(z: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
}

export function screenToWorld(
  sx: number,
  sy: number,
  vp: ViewportState,
): { px: number; py: number } {
  return {
    px: sx / vp.zoom + vp.panX,
    py: sy / vp.zoom + vp.panY,
  };
}

export function zoomAtPoint(
  vp: ViewportState,
  sx: number,
  sy: number,
  newZoom: number,
): ViewportState {
  newZoom = clampZoom(newZoom);
  const wx = sx / vp.zoom + vp.panX;
  const wy = sy / vp.zoom + vp.panY;
  return {
    zoom: newZoom,
    panX: wx - sx / newZoom,
    panY: wy - sy / newZoom,
  };
}

export function zoomAtCenter(
  vp: ViewportState,
  canvasW: number,
  canvasH: number,
  newZoom: number,
): ViewportState {
  return zoomAtPoint(vp, canvasW / 2, canvasH / 2, newZoom);
}
