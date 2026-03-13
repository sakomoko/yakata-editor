import { describe, it, expect } from 'vitest';
import {
  clampZoom,
  screenToWorld,
  zoomAtPoint,
  zoomAtCenter,
  MIN_ZOOM,
  MAX_ZOOM,
  type ViewportState,
} from './viewport.ts';

describe('clampZoom', () => {
  it('clamps below MIN_ZOOM', () => {
    expect(clampZoom(0.1)).toBe(MIN_ZOOM);
  });

  it('clamps above MAX_ZOOM', () => {
    expect(clampZoom(10)).toBe(MAX_ZOOM);
  });

  it('passes through values in range', () => {
    expect(clampZoom(1.5)).toBe(1.5);
  });
});

describe('screenToWorld', () => {
  it('returns identity at zoom=1 pan=0', () => {
    const vp: ViewportState = { zoom: 1, panX: 0, panY: 0 };
    const { px, py } = screenToWorld(100, 200, vp);
    expect(px).toBe(100);
    expect(py).toBe(200);
  });

  it('applies zoom', () => {
    const vp: ViewportState = { zoom: 2, panX: 0, panY: 0 };
    const { px, py } = screenToWorld(100, 200, vp);
    expect(px).toBe(50);
    expect(py).toBe(100);
  });

  it('applies pan offset', () => {
    const vp: ViewportState = { zoom: 1, panX: 50, panY: 30 };
    const { px, py } = screenToWorld(100, 200, vp);
    expect(px).toBe(150);
    expect(py).toBe(230);
  });

  it('applies both zoom and pan', () => {
    const vp: ViewportState = { zoom: 2, panX: 50, panY: 30 };
    const { px, py } = screenToWorld(100, 200, vp);
    expect(px).toBe(100);
    expect(py).toBe(130);
  });
});

describe('zoomAtPoint', () => {
  it('preserves world coordinate under cursor', () => {
    const vp: ViewportState = { zoom: 1, panX: 100, panY: 100 };
    const sx = 300,
      sy = 200;

    const worldBefore = screenToWorld(sx, sy, vp);
    const newVp = zoomAtPoint(vp, sx, sy, 2);
    const worldAfter = screenToWorld(sx, sy, newVp);

    expect(worldAfter.px).toBeCloseTo(worldBefore.px);
    expect(worldAfter.py).toBeCloseTo(worldBefore.py);
  });

  it('clamps zoom to range', () => {
    const vp: ViewportState = { zoom: 1, panX: 0, panY: 0 };
    expect(zoomAtPoint(vp, 0, 0, 0.01).zoom).toBe(MIN_ZOOM);
    expect(zoomAtPoint(vp, 0, 0, 100).zoom).toBe(MAX_ZOOM);
  });

  it('works with zoom out', () => {
    const vp: ViewportState = { zoom: 2, panX: 50, panY: 50 };
    const sx = 400,
      sy = 300;

    const worldBefore = screenToWorld(sx, sy, vp);
    const newVp = zoomAtPoint(vp, sx, sy, 0.5);
    const worldAfter = screenToWorld(sx, sy, newVp);

    expect(worldAfter.px).toBeCloseTo(worldBefore.px);
    expect(worldAfter.py).toBeCloseTo(worldBefore.py);
  });
});

describe('zoomAtCenter', () => {
  it('preserves world coordinate at canvas center', () => {
    const vp: ViewportState = { zoom: 1, panX: 50, panY: 50 };
    const canvasW = 800,
      canvasH = 600;

    const centerWorld = screenToWorld(canvasW / 2, canvasH / 2, vp);
    const newVp = zoomAtCenter(vp, canvasW, canvasH, 2);
    const centerWorldAfter = screenToWorld(canvasW / 2, canvasH / 2, newVp);

    expect(centerWorldAfter.px).toBeCloseTo(centerWorld.px);
    expect(centerWorldAfter.py).toBeCloseTo(centerWorld.py);
  });
});
