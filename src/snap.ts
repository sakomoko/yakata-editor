import type { Room } from './types.ts';
import { getRoomVertices, projectPointOnSegment } from './polygon.ts';

/** スナップ判定の閾値（グリッド単位） */
export const SNAP_THRESHOLD = 0.5;

export type SnapResult =
  | { type: 'vertex'; gx: number; gy: number }
  | { type: 'edge'; gx: number; gy: number }
  | { type: 'none' };

/** スナップインジケーターの描画情報。座標はワールドピクセル座標。 */
export interface SnapIndicator {
  /** ワールドピクセル X 座標 */
  px: number;
  /** ワールドピクセル Y 座標 */
  py: number;
  /** スナップの種別 */
  type: 'vertex' | 'edge';
}

/**
 * 他の部屋の頂点・辺へのスナップを計算する。
 * 頂点スナップが辺スナップより優先される。
 */
export function findVertexSnap(
  rooms: Room[],
  excludeRoomId: string,
  cursorGx: number,
  cursorGy: number,
  threshold: number,
): SnapResult {
  // 対象部屋の頂点をキャッシュ
  const vertexGroups: ReturnType<typeof getRoomVertices>[] = [];
  for (const room of rooms) {
    if (room.id === excludeRoomId) continue;
    vertexGroups.push(getRoomVertices(room));
  }

  // 1. 頂点スナップ
  let bestDist = Infinity;
  let bestVertex: { gx: number; gy: number } | null = null;

  for (const verts of vertexGroups) {
    for (const v of verts) {
      const dist = Math.hypot(v.gx - cursorGx, v.gy - cursorGy);
      if (dist < threshold && dist < bestDist) {
        bestDist = dist;
        bestVertex = v;
      }
    }
  }

  if (bestVertex) return { gx: bestVertex.gx, gy: bestVertex.gy, type: 'vertex' };

  // 2. 辺スナップ
  bestDist = Infinity;
  let bestEdge: { gx: number; gy: number } | null = null;

  for (const verts of vertexGroups) {
    for (let i = 0; i < verts.length; i++) {
      const j = (i + 1) % verts.length;
      const x1 = verts[i].gx,
        y1 = verts[i].gy;
      const x2 = verts[j].gx,
        y2 = verts[j].gy;
      const t = projectPointOnSegment(cursorGx, cursorGy, x1, y1, x2, y2);
      const projGx = x1 + t * (x2 - x1);
      const projGy = y1 + t * (y2 - y1);
      const dist = Math.hypot(projGx - cursorGx, projGy - cursorGy);
      if (dist < threshold && dist < bestDist) {
        bestDist = dist;
        bestEdge = { gx: projGx, gy: projGy };
      }
    }
  }

  if (bestEdge) return { gx: bestEdge.gx, gy: bestEdge.gy, type: 'edge' };

  return { type: 'none' };
}
