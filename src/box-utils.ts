import type { ResizeDirection } from './types.ts';
import { GRID, HANDLE_SIZE, HANDLE_HIT, FONT_SIZE_MIN, FONT_SIZE_MAX } from './grid.ts';

/** gx/gy/w/h を持つボックス型エンティティの共通インターフェース */
export interface GridBox {
  gx: number;
  gy: number;
  w: number;
  h: number;
}

const MIN_SIZE = 1;

export function boxPixelRect(box: GridBox): { x: number; y: number; w: number; h: number } {
  return { x: box.gx * GRID, y: box.gy * GRID, w: box.w * GRID, h: box.h * GRID };
}

export function boxCorners(rect: { x: number; y: number; w: number; h: number }): {
  x: number;
  y: number;
  dir: ResizeDirection;
}[] {
  return [
    { x: rect.x, y: rect.y, dir: 'nw' },
    { x: rect.x + rect.w, y: rect.y, dir: 'ne' },
    { x: rect.x + rect.w, y: rect.y + rect.h, dir: 'se' },
    { x: rect.x, y: rect.y + rect.h, dir: 'sw' },
  ];
}

export function drawBoxHandles(
  ctx: CanvasRenderingContext2D,
  box: GridBox,
  zoom: number,
  color = '#FF9800',
): void {
  const size = HANDLE_SIZE / zoom;
  const corners = boxCorners(boxPixelRect(box));
  ctx.fillStyle = color;
  for (const c of corners) {
    ctx.fillRect(c.x - size / 2, c.y - size / 2, size, size);
  }
}

export function hitBoxHandle(
  box: GridBox,
  px: number,
  py: number,
  zoom: number,
): ResizeDirection | null {
  const tolerance = HANDLE_HIT / zoom;
  const corners = boxCorners(boxPixelRect(box));
  for (const handle of corners) {
    if (Math.abs(px - handle.x) < tolerance && Math.abs(py - handle.y) < tolerance) {
      return handle.dir;
    }
  }
  return null;
}

export function hitBox(boxes: GridBox[], px: number, py: number): GridBox | null {
  for (let i = boxes.length - 1; i >= 0; i--) {
    const box = boxes[i];
    const rect = boxPixelRect(box);
    if (px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h) {
      return box;
    }
  }
  return null;
}

export function findBoxesInArea<T extends GridBox>(
  boxes: T[],
  area: { x: number; y: number; w: number; h: number },
): T[] {
  return boxes.filter(
    (b) =>
      b.gx >= area.x &&
      b.gy >= area.y &&
      b.gx + b.w <= area.x + area.w &&
      b.gy + b.h <= area.y + area.h,
  );
}

export function computeBoxResize(
  dir: ResizeDirection,
  orig: { gx: number; gy: number; w: number; h: number },
  gx: number,
  gy: number,
): { gx: number; gy: number; w: number; h: number } {
  let newGx = orig.gx;
  let newGy = orig.gy;
  let newW = orig.w;
  let newH = orig.h;

  if (dir.includes('w')) {
    const right = orig.gx + orig.w;
    newGx = Math.min(gx, right - MIN_SIZE);
    newW = right - newGx;
  }
  if (dir.includes('e')) {
    newW = Math.max(MIN_SIZE, gx - orig.gx);
  }
  if (dir.includes('n')) {
    const bottom = orig.gy + orig.h;
    newGy = Math.min(gy, bottom - MIN_SIZE);
    newH = bottom - newGy;
  }
  if (dir.includes('s')) {
    newH = Math.max(MIN_SIZE, gy - orig.gy);
  }

  return { gx: newGx, gy: newGy, w: newW, h: newH };
}

export function scaleProportionalFontSize(
  origFontSize: number,
  origH: number,
  newH: number,
): number {
  if (origH <= 0) return origFontSize;
  return Math.min(
    FONT_SIZE_MAX,
    Math.max(FONT_SIZE_MIN, Math.round(origFontSize * (newH / origH))),
  );
}
