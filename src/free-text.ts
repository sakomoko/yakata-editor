import type { FreeText, ResizeDirection } from './types.ts';
import { GRID } from './grid.ts';
import {
  boxPixelRect,
  drawBoxHandles,
  hitBoxHandle,
  findBoxesInArea,
  computeBoxResize,
  scaleProportionalFontSize,
} from './box-utils.ts';

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

  // Clip text to bounding box to prevent overflow
  ctx.beginPath();
  ctx.rect(px, py, pw, ph);
  ctx.clip();

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

export function drawFreeTextHandles(
  ctx: CanvasRenderingContext2D,
  ft: FreeText,
  zoom: number,
): void {
  drawBoxHandles(ctx, ft, zoom);
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
    const rect = boxPixelRect(ft);
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
  return hitBoxHandle(ft, px, py, zoom);
}

export function findFreeTextsInArea(
  freeTexts: FreeText[],
  area: { x: number; y: number; w: number; h: number },
): FreeText[] {
  return findBoxesInArea(freeTexts, area);
}

export function computeFreeTextResize(
  dir: ResizeDirection,
  orig: { gx: number; gy: number; w: number; h: number },
  gx: number,
  gy: number,
): { gx: number; gy: number; w: number; h: number } {
  return computeBoxResize(dir, orig, gx, gy);
}

export function scaleFontSize(origFontSize: number, origH: number, newH: number): number {
  return scaleProportionalFontSize(origFontSize, origH, newH);
}
