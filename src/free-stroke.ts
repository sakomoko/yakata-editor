import type { FreeStroke } from './types.ts';

/** ストロークヒット判定の基本許容距離（ピクセル）。実際の判定では zoom で割って使用する */
export const STROKE_HIT_TOLERANCE_PX = 5;

export function createFreeStroke(
  points: { px: number; py: number }[],
  color: string,
  lineWidth: number,
  opacity: number,
): FreeStroke {
  return {
    id: crypto.randomUUID(),
    points,
    color,
    lineWidth,
    opacity,
  };
}

export function drawFreeStroke(
  ctx: CanvasRenderingContext2D,
  stroke: FreeStroke,
  zoom: number,
): void {
  if (stroke.points.length < 2) return;

  ctx.save();
  ctx.globalAlpha = stroke.opacity;
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.lineWidth / zoom;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(stroke.points[0].px, stroke.points[0].py);
  for (let i = 1; i < stroke.points.length; i++) {
    ctx.lineTo(stroke.points[i].px, stroke.points[i].py);
  }
  ctx.stroke();
  ctx.restore();
}

export function drawFreeStrokeBounds(
  ctx: CanvasRenderingContext2D,
  stroke: FreeStroke,
  zoom: number,
): void {
  const bounds = getStrokeBounds(stroke);
  if (!bounds) return;

  ctx.save();
  ctx.strokeStyle = '#2196F3';
  ctx.lineWidth = 1.5 / zoom;
  ctx.setLineDash([4 / zoom, 4 / zoom]);
  ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
  ctx.restore();
}

/** 点と線分の最短距離 */
function distToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export function hitFreeStroke(
  stroke: FreeStroke,
  px: number,
  py: number,
  tolerance: number,
): boolean {
  const effectiveTol = tolerance + stroke.lineWidth / 2;
  for (let i = 0; i < stroke.points.length - 1; i++) {
    const a = stroke.points[i];
    const b = stroke.points[i + 1];
    if (distToSegment(px, py, a.px, a.py, b.px, b.py) <= effectiveTol) {
      return true;
    }
  }
  return false;
}

export function hitFreeStrokeInList(
  strokes: FreeStroke[],
  px: number,
  py: number,
  tolerance: number,
): FreeStroke | null {
  for (let i = strokes.length - 1; i >= 0; i--) {
    if (hitFreeStroke(strokes[i], px, py, tolerance)) {
      return strokes[i];
    }
  }
  return null;
}

export function getStrokeBounds(
  stroke: FreeStroke,
): { x: number; y: number; w: number; h: number } | null {
  if (stroke.points.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of stroke.points) {
    if (p.px < minX) minX = p.px;
    if (p.py < minY) minY = p.py;
    if (p.px > maxX) maxX = p.px;
    if (p.py > maxY) maxY = p.py;
  }
  const pad = stroke.lineWidth / 2;
  return {
    x: minX - pad,
    y: minY - pad,
    w: maxX - minX + stroke.lineWidth,
    h: maxY - minY + stroke.lineWidth,
  };
}

export function moveStroke(stroke: FreeStroke, dx: number, dy: number): void {
  for (const p of stroke.points) {
    p.px += dx;
    p.py += dy;
  }
}

/** Douglas-Peucker アルゴリズムで点列を間引き */
export function simplifyPoints(
  points: { px: number; py: number }[],
  tolerance: number,
): { px: number; py: number }[] {
  if (points.length <= 2) return points;

  const first = points[0];
  const last = points[points.length - 1];

  let maxDist = 0;
  let maxIdx = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = distToSegment(points[i].px, points[i].py, first.px, first.py, last.px, last.py);
    if (d > maxDist) {
      maxDist = d;
      maxIdx = i;
    }
  }

  if (maxDist > tolerance) {
    const left = simplifyPoints(points.slice(0, maxIdx + 1), tolerance);
    const right = simplifyPoints(points.slice(maxIdx), tolerance);
    return [...left.slice(0, -1), ...right];
  }

  return [first, last];
}

/** Shift 押下時の直線制約: 水平・垂直・45度 */
export function constrainToLine(
  start: { px: number; py: number },
  end: { px: number; py: number },
): { px: number; py: number } {
  const dx = end.px - start.px;
  const dy = end.py - start.py;
  const angle = Math.atan2(dy, dx);
  const dist = Math.hypot(dx, dy);

  // 8方向にスナップ (45度刻み)
  const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
  return {
    px: start.px + Math.cos(snapped) * dist,
    py: start.py + Math.sin(snapped) * dist,
  };
}
