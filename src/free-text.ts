import type { FreeText, ResizeDirection } from './types.ts';
import { GRID, HANDLE_SIZE, HANDLE_HIT } from './grid.ts';

const MIN_SIZE = 1;
const DEFAULT_FONT_SIZE = 14;

export function createFreeText(
  gx: number,
  gy: number,
  label: string,
  fontSize = DEFAULT_FONT_SIZE,
  zLayer: 'front' | 'back' = 'front',
): FreeText {
  return {
    id: crypto.randomUUID(),
    gx,
    gy,
    w: 3,
    h: 2,
    label,
    fontSize,
    zLayer,
  };
}

export function drawFreeText(
  ctx: CanvasRenderingContext2D,
  ft: FreeText,
  isSelected: boolean,
  isActive: boolean,
  zoom: number,
): void {
  const px = ft.gx * GRID;
  const py = ft.gy * GRID;
  const pw = ft.w * GRID;
  const ph = ft.h * GRID;

  if (isSelected || isActive) {
    ctx.save();
    ctx.strokeStyle = isActive ? '#FF9800' : '#2196F3';
    ctx.lineWidth = (isActive ? 2 : 1.5) / zoom;
    ctx.setLineDash([4 / zoom, 4 / zoom]);
    ctx.strokeRect(px, py, pw, ph);
    ctx.restore();
  }

  ctx.save();
  ctx.fillStyle = '#000';
  ctx.font = `${ft.fontSize}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  const padding = 2;
  const lines = ft.label.split('\n');
  let curY = py + padding;
  for (const line of lines) {
    ctx.fillText(line, px + padding, curY, pw - padding * 2);
    curY += ft.fontSize * 1.2;
  }

  ctx.restore();
}

function freeTextPixelRect(ft: FreeText): { x: number; y: number; w: number; h: number } {
  return { x: ft.gx * GRID, y: ft.gy * GRID, w: ft.w * GRID, h: ft.h * GRID };
}

function freeTextCorners(rect: { x: number; y: number; w: number; h: number }): {
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

export function drawFreeTextHandles(
  ctx: CanvasRenderingContext2D,
  ft: FreeText,
  zoom: number,
): void {
  const size = HANDLE_SIZE / zoom;
  const corners = freeTextCorners(freeTextPixelRect(ft));

  ctx.fillStyle = '#FF9800';
  for (const c of corners) {
    ctx.fillRect(c.x - size / 2, c.y - size / 2, size, size);
  }
}

export function hitFreeText(
  freeTexts: FreeText[],
  px: number,
  py: number,
  layer?: 'front' | 'back',
): FreeText | null {
  for (let i = freeTexts.length - 1; i >= 0; i--) {
    const ft = freeTexts[i];
    if (layer && ft.zLayer !== layer) continue;
    const rect = freeTextPixelRect(ft);
    if (px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h) {
      return ft;
    }
  }
  return null;
}

export function hitFreeTextHandle(
  ft: FreeText,
  px: number,
  py: number,
  zoom: number,
): ResizeDirection | null {
  const tolerance = HANDLE_HIT / zoom;
  const corners = freeTextCorners(freeTextPixelRect(ft));

  for (const handle of corners) {
    if (Math.abs(px - handle.x) < tolerance && Math.abs(py - handle.y) < tolerance) {
      return handle.dir;
    }
  }
  return null;
}

export function findFreeTextsInArea(
  freeTexts: FreeText[],
  area: { x: number; y: number; w: number; h: number },
): FreeText[] {
  return freeTexts.filter((ft) => {
    return (
      ft.gx >= area.x &&
      ft.gy >= area.y &&
      ft.gx + ft.w <= area.x + area.w &&
      ft.gy + ft.h <= area.y + area.h
    );
  });
}

export function computeFreeTextResize(
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
