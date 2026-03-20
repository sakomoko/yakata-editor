import type { Arrow, GridPoint } from './types.ts';
import { GRID } from './grid.ts';

// --- Constants ---

export const ARROW_HEAD_SIZE = 0.4; // グリッド単位
export const ARROW_START_RADIUS = 0.15; // グリッド単位
const ARROW_HIT_TOLERANCE_GRID = 0.3;
const ARROW_POINT_HIT_TOLERANCE_GRID = 0.4;

function calcHeadSize(zoom: number): number {
  return Math.max(ARROW_HEAD_SIZE * GRID, (ARROW_HEAD_SIZE * GRID) / zoom);
}

export const ARROW_COLOR_PRESETS = [
  { label: '赤', value: '#cc0000' },
  { label: '青', value: '#0055cc' },
  { label: '緑', value: '#008800' },
  { label: '黒', value: '#333333' },
  { label: 'オレンジ', value: '#dd6600' },
  { label: '紫', value: '#7700aa' },
];

export const ARROW_LINE_WIDTHS = [
  { label: '細 (1px)', value: 1 },
  { label: '普通 (2px)', value: 2 },
  { label: '太 (4px)', value: 4 },
];

// --- Creation ---

export function createArrow(
  points: GridPoint[],
  color: string,
  lineWidth: number,
  label?: string,
): Arrow {
  return {
    id: crypto.randomUUID(),
    points: points.map((p) => ({ gx: p.gx, gy: p.gy })),
    color,
    lineWidth,
    ...(label ? { label } : {}),
  };
}

// --- Drawing ---

export function drawArrow(ctx: CanvasRenderingContext2D, arrow: Arrow, zoom: number): void {
  if (arrow.points.length < 2) return;

  const lw = arrow.lineWidth / zoom;

  // Draw polyline
  ctx.beginPath();
  ctx.moveTo(arrow.points[0].gx * GRID, arrow.points[0].gy * GRID);
  for (let i = 1; i < arrow.points.length; i++) {
    ctx.lineTo(arrow.points[i].gx * GRID, arrow.points[i].gy * GRID);
  }
  ctx.strokeStyle = arrow.color;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();

  // Draw start circle
  const sp = arrow.points[0];
  const startR = ARROW_START_RADIUS * GRID;
  ctx.beginPath();
  ctx.arc(sp.gx * GRID, sp.gy * GRID, startR, 0, Math.PI * 2);
  ctx.fillStyle = arrow.color;
  ctx.fill();

  // Draw arrowhead at end
  const ep = arrow.points[arrow.points.length - 1];
  const pp = arrow.points[arrow.points.length - 2];
  drawArrowHead(ctx, pp, ep, arrow.color, calcHeadSize(zoom));

  // Draw label at first segment midpoint
  if (arrow.label) {
    const p0 = arrow.points[0];
    const p1 = arrow.points[1];
    const mx = ((p0.gx + p1.gx) / 2) * GRID;
    const my = ((p0.gy + p1.gy) / 2) * GRID;
    const fontSize = (arrow.fontSize ?? 12) / zoom;
    ctx.font = `${fontSize}px sans-serif`;
    ctx.fillStyle = arrow.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(arrow.label, mx, my - 4 / zoom);
  }
}

function drawArrowHead(
  ctx: CanvasRenderingContext2D,
  from: GridPoint,
  to: GridPoint,
  color: string,
  size: number,
): void {
  const dx = to.gx * GRID - from.gx * GRID;
  const dy = to.gy * GRID - from.gy * GRID;
  const angle = Math.atan2(dy, dx);
  const tx = to.gx * GRID;
  const ty = to.gy * GRID;

  ctx.beginPath();
  ctx.moveTo(tx, ty);
  ctx.lineTo(tx - size * Math.cos(angle - Math.PI / 6), ty - size * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(tx - size * Math.cos(angle + Math.PI / 6), ty - size * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

export function drawArrowHandles(ctx: CanvasRenderingContext2D, arrow: Arrow, zoom: number): void {
  const r = 4 / zoom;
  for (const p of arrow.points) {
    ctx.beginPath();
    ctx.arc(p.gx * GRID, p.gy * GRID, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 120, 255, 0.8)';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1 / zoom;
    ctx.stroke();
  }
}

export function drawPendingArrow(
  ctx: CanvasRenderingContext2D,
  points: GridPoint[],
  previewPoint: GridPoint | undefined,
  color: string,
  lineWidth: number,
  zoom: number,
): void {
  const allPoints = previewPoint ? [...points, previewPoint] : points;
  if (allPoints.length < 1) return;

  const lw = lineWidth / zoom;

  // Draw existing segments as solid
  if (points.length >= 2) {
    ctx.beginPath();
    ctx.moveTo(points[0].gx * GRID, points[0].gy * GRID);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].gx * GRID, points[i].gy * GRID);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  // Draw preview segment as dashed
  if (previewPoint && points.length >= 1) {
    const last = points[points.length - 1];
    ctx.beginPath();
    ctx.moveTo(last.gx * GRID, last.gy * GRID);
    ctx.lineTo(previewPoint.gx * GRID, previewPoint.gy * GRID);
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.setLineDash([6 / zoom, 4 / zoom]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Draw start circle
  const sp = allPoints[0];
  const startR = ARROW_START_RADIUS * GRID;
  ctx.beginPath();
  ctx.arc(sp.gx * GRID, sp.gy * GRID, startR, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  // Draw arrowhead at preview end
  if (allPoints.length >= 2) {
    const ep = allPoints[allPoints.length - 1];
    const pp = allPoints[allPoints.length - 2];
    drawArrowHead(ctx, pp, ep, color, calcHeadSize(zoom));
  }

  // Draw waypoint handles
  const r = 3 / zoom;
  for (const p of points) {
    ctx.beginPath();
    ctx.arc(p.gx * GRID, p.gy * GRID, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 120, 255, 0.8)';
    ctx.fill();
  }
}

// --- Hit Testing ---

/** 点(gx,gy)からセグメント(a,b)への最短距離（グリッド単位） */
function distToSegment(gx: number, gy: number, a: GridPoint, b: GridPoint): number {
  const dx = b.gx - a.gx;
  const dy = b.gy - a.gy;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(gx - a.gx, gy - a.gy);
  const t = Math.max(0, Math.min(1, ((gx - a.gx) * dx + (gy - a.gy) * dy) / lenSq));
  const px = a.gx + t * dx;
  const py = a.gy + t * dy;
  return Math.hypot(gx - px, gy - py);
}

export function hitArrow(
  arrow: Arrow,
  gx: number,
  gy: number,
  tolerance: number = ARROW_HIT_TOLERANCE_GRID,
): boolean {
  for (let i = 0; i < arrow.points.length - 1; i++) {
    if (distToSegment(gx, gy, arrow.points[i], arrow.points[i + 1]) <= tolerance) {
      return true;
    }
  }
  return false;
}

export function hitArrowInList(
  arrows: Arrow[],
  gx: number,
  gy: number,
  tolerance: number = ARROW_HIT_TOLERANCE_GRID,
): Arrow | undefined {
  // 後方優先（後から追加されたものが上に描画される）
  for (let i = arrows.length - 1; i >= 0; i--) {
    if (hitArrow(arrows[i], gx, gy, tolerance)) {
      return arrows[i];
    }
  }
  return undefined;
}

/** ポイントハンドルのヒット判定。ヒットしたポイントのインデックスを返す */
export function hitArrowPoint(
  arrow: Arrow,
  gx: number,
  gy: number,
  tolerance: number = ARROW_POINT_HIT_TOLERANCE_GRID,
): number | undefined {
  for (let i = 0; i < arrow.points.length; i++) {
    const d = Math.hypot(gx - arrow.points[i].gx, gy - arrow.points[i].gy);
    if (d <= tolerance) return i;
  }
  return undefined;
}

/** セグメントヒット判定。挿入位置のインデックスを返す（iとi+1の間に挿入） */
export function hitArrowSegment(
  arrow: Arrow,
  gx: number,
  gy: number,
  tolerance: number = ARROW_HIT_TOLERANCE_GRID,
): number | undefined {
  for (let i = 0; i < arrow.points.length - 1; i++) {
    if (distToSegment(gx, gy, arrow.points[i], arrow.points[i + 1]) <= tolerance) {
      return i + 1; // 挿入位置: points[i]とpoints[i+1]の間
    }
  }
  return undefined;
}

// --- Manipulation ---

export function moveArrow(arrow: Arrow, dgx: number, dgy: number): void {
  for (const p of arrow.points) {
    p.gx += dgx;
    p.gy += dgy;
  }
}

export function getArrowBounds(arrow: Arrow): {
  minGx: number;
  minGy: number;
  maxGx: number;
  maxGy: number;
} {
  let minGx = Infinity;
  let minGy = Infinity;
  let maxGx = -Infinity;
  let maxGy = -Infinity;
  for (const p of arrow.points) {
    minGx = Math.min(minGx, p.gx);
    minGy = Math.min(minGy, p.gy);
    maxGx = Math.max(maxGx, p.gx);
    maxGy = Math.max(maxGy, p.gy);
  }
  return { minGx, minGy, maxGx, maxGy };
}

/** Shift制約: 水平/垂直のうち変位が大きい軸に制約する */
export function constrainToAxis(start: GridPoint, end: GridPoint): GridPoint {
  const dx = Math.abs(end.gx - start.gx);
  const dy = Math.abs(end.gy - start.gy);
  if (dx >= dy) {
    return { gx: end.gx, gy: start.gy };
  } else {
    return { gx: start.gx, gy: end.gy };
  }
}
