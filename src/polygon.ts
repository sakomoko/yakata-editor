import type { Room, WallSide, GridPoint } from './types.ts';
import { GRID } from './grid.ts';

export interface VertexHandle {
  px: number;
  py: number;
  vertexIndex: number;
}

export interface EdgeEndpoints {
  start: { px: number; py: number };
  end: { px: number; py: number };
  angle: number;
  length: number;
}

/** vertices の有無で四角形かどうかを判定 */
export function isPolygonRoom(room: Room): boolean {
  return room.vertices !== undefined;
}

/** polygon→vertices / rect→4隅を統一的に返す（グリッド座標） */
export function getRoomVertices(room: Room): [GridPoint, GridPoint, GridPoint, GridPoint] {
  if (room.vertices) return room.vertices;
  // 矩形→4隅 [NW, NE, SE, SW]
  return [
    { gx: room.x, gy: room.y },
    { gx: room.x + room.w, gy: room.y },
    { gx: room.x + room.w, gy: room.y + room.h },
    { gx: room.x, gy: room.y + room.h },
  ];
}

/** Ray casting法による四角形内部判定（グリッド座標） */
export function pointInQuad(
  vertices: [GridPoint, GridPoint, GridPoint, GridPoint],
  gx: number,
  gy: number,
): boolean {
  let inside = false;
  const n = vertices.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = vertices[i].gx,
      yi = vertices[i].gy;
    const xj = vertices[j].gx,
      yj = vertices[j].gy;
    if (yi > gy !== yj > gy && gx < ((xj - xi) * (gy - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * 頂点座標の平均を返す（グリッド座標）。
 * 注: 一般四角形の幾何学的重心（面積重心）とは異なるが、
 * ラベル配置用の近似的な中心点として十分な精度を持つ。
 */
export function getQuadCentroid(vertices: [GridPoint, GridPoint, GridPoint, GridPoint]): {
  gx: number;
  gy: number;
} {
  const gx = (vertices[0].gx + vertices[1].gx + vertices[2].gx + vertices[3].gx) / 4;
  const gy = (vertices[0].gy + vertices[1].gy + vertices[2].gy + vertices[3].gy) / 4;
  return { gx, gy };
}

/** 4頂点からバウンディングボックス(x,y,w,h)を再計算して room に適用 */
export function updateBoundingBox(room: Room): void {
  if (!room.vertices) return;
  const v = room.vertices;
  const xs = [v[0].gx, v[1].gx, v[2].gx, v[3].gx];
  const ys = [v[0].gy, v[1].gy, v[2].gy, v[3].gy];
  room.x = Math.min(...xs);
  room.y = Math.min(...ys);
  room.w = Math.max(...xs) - room.x;
  room.h = Math.max(...ys) - room.y;
}

/** 4頂点のハンドル座標を返す（ピクセル座標） */
export function getVertexHandles(room: Room): VertexHandle[] {
  if (!room.vertices) return [];
  return room.vertices.map((v, i) => ({
    px: v.gx * GRID,
    py: v.gy * GRID,
    vertexIndex: i,
  }));
}

/** 頂点ハンドルのヒット判定 */
export function hitVertexHandle(
  room: Room,
  px: number,
  py: number,
  zoom: number,
  tolerance = 7,
): VertexHandle | null {
  if (!room.vertices) return null;
  const tol = tolerance / zoom;
  for (const handle of getVertexHandles(room)) {
    if (Math.hypot(px - handle.px, py - handle.py) < tol) {
      return handle;
    }
  }
  return null;
}

/** 矩形→4頂点変換（getRoomVertices の矩形フォールバックと同等） */
export function rectToVertices(room: Room): [GridPoint, GridPoint, GridPoint, GridPoint] {
  return getRoomVertices({ ...room, vertices: undefined });
}

/** side マッピング: n=v[0]→v[1], e=v[1]→v[2], s=v[2]→v[3], w=v[3]→v[0] */
const SIDE_INDICES: Record<WallSide, [number, number]> = {
  n: [0, 1],
  e: [1, 2],
  s: [2, 3],
  w: [3, 0],
};

/** 辺の両端ピクセル座標と角度・長さ（グリッド単位）を返す */
export function getEdgeEndpoints(room: Room, side: WallSide): EdgeEndpoints {
  const verts = getRoomVertices(room);
  const [i0, i1] = SIDE_INDICES[side];
  const start = { px: verts[i0].gx * GRID, py: verts[i0].gy * GRID };
  const end = { px: verts[i1].gx * GRID, py: verts[i1].gy * GRID };
  const dx = end.px - start.px;
  const dy = end.py - start.py;
  const angle = Math.atan2(dy, dx);
  const lengthPx = Math.hypot(dx, dy);
  return { start, end, angle, length: lengthPx / GRID };
}

/** 辺の長さ（グリッド単位） */
export function edgeLength(room: Room, side: WallSide): number {
  return getEdgeEndpoints(room, side).length;
}

/** 点から線分への最短距離を計算 */
export function pointToSegmentDistance(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.hypot(px - projX, py - projY);
}

/** 辺の角度に基づいてリサイズカーソル方向を返す */
export function edgeResizeCursor(room: Room, side: WallSide): string {
  const { angle } = getEdgeEndpoints(room, side);
  // 角度を [0, π) に正規化（反対方向は同じカーソル）
  const a = ((angle % Math.PI) + Math.PI) % Math.PI;
  // 辺に沿った方向のカーソルを返す
  if (a < Math.PI / 8 || a >= (7 * Math.PI) / 8) return 'ew-resize';
  if (a < (3 * Math.PI) / 8) return 'nwse-resize';
  if (a < (5 * Math.PI) / 8) return 'ns-resize';
  return 'nesw-resize';
}

/** 点を線分に射影した際のパラメータ t (0〜1) を返す */
export function projectPointOnSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return 0;
  return Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
}
