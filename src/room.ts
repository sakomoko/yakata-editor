import type { Room, Handle, MouseCoord, CornerDirection, GroupHandle } from './types.ts';
import { GRID, HANDLE_SIZE, HANDLE_HIT } from './grid.ts';
import { findRoomById } from './lookup.ts';
import { drawWallSegments, drawWallObjects, drawWallObjectResizeHandles } from './wall-object.ts';
import { drawInteriorObjects, drawInteriorObjectHandles } from './interior-object.ts';

export function createRoom(x: number, y: number, w: number, h: number, label = ''): Room {
  return { id: crypto.randomUUID(), x, y, w, h, label };
}

export function calcAutoFontSize(room: Room): number {
  const w = room.w * GRID;
  const h = room.h * GRID;
  const base = Math.min(w, h) * 0.25;
  return Math.max(6, base / Math.max(1, room.label.length * 0.35));
}

export function getHandles(r: Room): Handle[] {
  const x = r.x * GRID,
    y = r.y * GRID,
    w = r.w * GRID,
    h = r.h * GRID;
  return [
    { px: x, py: y, dir: 'nw' },
    { px: x + w / 2, py: y, dir: 'n' },
    { px: x + w, py: y, dir: 'ne' },
    { px: x + w, py: y + h / 2, dir: 'e' },
    { px: x + w, py: y + h, dir: 'se' },
    { px: x + w / 2, py: y + h, dir: 's' },
    { px: x, py: y + h, dir: 'sw' },
    { px: x, py: y + h / 2, dir: 'w' },
  ];
}

export function drawRoom(
  ctx: CanvasRenderingContext2D,
  room: Room,
  isSelected: boolean,
  showHandles: boolean,
  zoom = 1,
  activeWallObjectId?: string,
  activeInteriorObjectId?: string,
): void {
  const x = room.x * GRID,
    y = room.y * GRID;
  const w = room.w * GRID,
    h = room.h * GRID;

  ctx.fillStyle = '#fff';
  ctx.fillRect(x, y, w, h);

  drawWallSegments(ctx, room, isSelected, zoom);

  if (room.label) {
    const autoSize = calcAutoFontSize(room);
    const fontSize = room.fontSize ?? autoSize;
    ctx.fillStyle = '#222';
    ctx.font = `${fontSize}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(room.label, x + w / 2, y + h / 2, w * 0.9);
  }

  // Interior objects drawn before wall objects (wall objects appear on top)
  drawInteriorObjects(ctx, room, isSelected, zoom, activeInteriorObjectId);

  drawWallObjects(ctx, room, isSelected, zoom, activeWallObjectId);

  if (isSelected && showHandles) {
    const size = HANDLE_SIZE / zoom;
    for (const handle of getHandles(room)) {
      ctx.fillStyle = '#2196F3';
      ctx.fillRect(handle.px - size / 2, handle.py - size / 2, size, size);
    }
    // Wall object resize handles drawn AFTER room handles so they appear on top
    drawWallObjectResizeHandles(ctx, room, zoom);
    // Interior object resize handles (only for active object)
    drawInteriorObjectHandles(ctx, room, zoom, activeInteriorObjectId);
  }
}

/** start/cur のMouseCoordペアから正規化された矩形（グリッド座標）を返す */
export function normalizeArea(
  start: MouseCoord,
  cur: MouseCoord,
): { x: number; y: number; w: number; h: number } {
  return {
    x: Math.min(start.gx, cur.gx),
    y: Math.min(start.gy, cur.gy),
    w: Math.abs(cur.gx - start.gx),
    h: Math.abs(cur.gy - start.gy),
  };
}

export function drawCreationPreview(
  ctx: CanvasRenderingContext2D,
  start: MouseCoord,
  cur: MouseCoord,
  zoom = 1,
): void {
  const { x, y, w, h } = normalizeArea(start, cur);
  if (w <= 0 || h <= 0) return;

  ctx.fillStyle = 'rgba(33,150,243,0.08)';
  ctx.fillRect(x * GRID, y * GRID, w * GRID, h * GRID);
  ctx.strokeStyle = '#2196F3';
  ctx.lineWidth = 1.5 / zoom;
  ctx.setLineDash([4 / zoom, 3 / zoom]);
  ctx.strokeRect(x * GRID, y * GRID, w * GRID, h * GRID);
  ctx.setLineDash([]);
}

export function drawAreaSelectPreview(
  ctx: CanvasRenderingContext2D,
  start: MouseCoord,
  cur: MouseCoord,
  zoom: number,
  rooms: Room[],
): void {
  const area = normalizeArea(start, cur);
  if (area.w <= 0 || area.h <= 0) return;

  const px = area.x * GRID,
    py = area.y * GRID,
    pw = area.w * GRID,
    ph = area.h * GRID;

  ctx.fillStyle = 'rgba(51, 153, 255, 0.1)';
  ctx.fillRect(px, py, pw, ph);
  ctx.strokeStyle = 'rgba(51, 153, 255, 0.6)';
  ctx.lineWidth = 1.5 / zoom;
  ctx.setLineDash([4 / zoom, 3 / zoom]);
  ctx.strokeRect(px, py, pw, ph);
  ctx.setLineDash([]);

  for (const r of findRoomsInArea(rooms, area)) {
    ctx.fillStyle = 'rgba(51, 153, 255, 0.15)';
    ctx.fillRect(r.x * GRID, r.y * GRID, r.w * GRID, r.h * GRID);
  }
}

/** ドラッグ矩形に完全に包含される部屋を返す（グリッド座標） */
export function findRoomsInArea(
  rooms: Room[],
  area: { x: number; y: number; w: number; h: number },
): Room[] {
  return rooms.filter(
    (r) =>
      r.x >= area.x &&
      r.y >= area.y &&
      r.x + r.w <= area.x + area.w &&
      r.y + r.h <= area.y + area.h,
  );
}

export function hitHandle(
  rooms: Room[],
  selection: Set<string>,
  px: number,
  py: number,
  zoom = 1,
): { handle: Handle; room: Room } | null {
  if (selection.size !== 1) return null;
  const selId = [...selection][0];
  const room = findRoomById(rooms, selId);
  if (!room) return null;
  const tolerance = HANDLE_HIT / zoom;
  for (const h of getHandles(room)) {
    if (Math.abs(px - h.px) < tolerance && Math.abs(py - h.py) < tolerance) {
      return { handle: h, room };
    }
  }
  return null;
}

export function isInsideRoom(r: Room, px: number, py: number): boolean {
  // prettier-ignore
  return (
    px >= r.x * GRID &&
    px <= (r.x + r.w) * GRID &&
    py >= r.y * GRID &&
    py <= (r.y + r.h) * GRID
  );
}

export function hitRoom(rooms: Room[], px: number, py: number): Room | null {
  for (let i = rooms.length - 1; i >= 0; i--) {
    if (isInsideRoom(rooms[i], px, py)) return rooms[i];
  }
  return null;
}

/** 選択部屋のバウンディングボックスをグリッド座標で返す（paddingなし） */
export function computeGroupBoundingBox(rooms: Room[]): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  if (rooms.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of rooms) {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.w);
    maxY = Math.max(maxY, r.y + r.h);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** グループBBの4隅ハンドルをピクセル座標で返す */
export function getGroupHandles(bb: {
  x: number;
  y: number;
  w: number;
  h: number;
}): GroupHandle[] {
  const x = bb.x * GRID,
    y = bb.y * GRID,
    w = bb.w * GRID,
    h = bb.h * GRID;
  return [
    { px: x, py: y, dir: 'nw' },
    { px: x + w, py: y, dir: 'ne' },
    { px: x + w, py: y + h, dir: 'se' },
    { px: x, py: y + h, dir: 'sw' },
  ];
}

/** グループBBの4隅ハンドルのヒット判定 */
export function hitGroupHandle(
  bb: { x: number; y: number; w: number; h: number },
  px: number,
  py: number,
  zoom: number,
): GroupHandle | null {
  const tolerance = HANDLE_HIT / zoom;
  for (const h of getGroupHandles(bb)) {
    if (Math.abs(px - h.px) < tolerance && Math.abs(py - h.py) < tolerance) {
      return h;
    }
  }
  return null;
}

/** ドラッグ方向の対角コーナーをグリッド座標で返す */
export function getAnchorForDir(
  bb: { x: number; y: number; w: number; h: number },
  dir: CornerDirection,
): { gx: number; gy: number } {
  switch (dir) {
    case 'nw':
      return { gx: bb.x + bb.w, gy: bb.y + bb.h };
    case 'ne':
      return { gx: bb.x, gy: bb.y + bb.h };
    case 'se':
      return { gx: bb.x, gy: bb.y };
    case 'sw':
      return { gx: bb.x + bb.w, gy: bb.y };
  }
}

/** グループスケーリングのスケール値を計算する */
export function computeGroupScale<T extends { w: number; h: number }>(
  origBB: { w: number; h: number },
  rawW: number,
  rawH: number,
  originals: Iterable<T>,
): number | null {
  if (rawW < 1 || rawH < 1) return null;
  if (origBB.w === 0 || origBB.h === 0) return null;
  const scale = Math.min(rawW / origBB.w, rawH / origBB.h);
  let minScale = 0;
  for (const orig of originals) {
    minScale = Math.max(minScale, 1 / orig.w, 1 / orig.h);
  }
  return Math.max(scale, minScale);
}

/** アンカー基準でスケールされた部屋の位置・サイズを計算する（隣接関係を維持する丸め） */
export function applyGroupScale(
  anchor: { gx: number; gy: number },
  orig: { x: number; y: number; w: number; h: number },
  scale: number,
): { x: number; y: number; w: number; h: number } {
  const x = Math.round(anchor.gx + (orig.x - anchor.gx) * scale);
  const y = Math.round(anchor.gy + (orig.y - anchor.gy) * scale);
  // サイズは右端/下端から位置を引くことで、隣接部屋間の隙間/重なりを防ぐ
  const right = Math.round(anchor.gx + (orig.x + orig.w - anchor.gx) * scale);
  const bottom = Math.round(anchor.gy + (orig.y + orig.h - anchor.gy) * scale);
  return {
    x,
    y,
    w: Math.max(1, right - x),
    h: Math.max(1, bottom - y),
  };
}

/** 選択中の複数部屋のバウンディングボックスとハンドルを描画 */
export function drawGroupBoundingBox(
  ctx: CanvasRenderingContext2D,
  rooms: Room[],
  zoom: number,
): void {
  const bb = computeGroupBoundingBox(rooms);
  if (bb.w <= 0 || bb.h <= 0) return;

  const px = bb.x * GRID,
    py = bb.y * GRID,
    pw = bb.w * GRID,
    ph = bb.h * GRID;

  // 破線矩形
  ctx.strokeStyle = '#2196F3';
  ctx.lineWidth = 1.5 / zoom;
  ctx.setLineDash([6 / zoom, 4 / zoom]);
  ctx.strokeRect(px, py, pw, ph);
  ctx.setLineDash([]);

  // 4隅ハンドル
  const size = HANDLE_SIZE / zoom;
  for (const handle of getGroupHandles(bb)) {
    ctx.fillStyle = '#2196F3';
    ctx.fillRect(handle.px - size / 2, handle.py - size / 2, size, size);
  }
}

/** 全部屋を囲むバウンディングボックスをピクセル座標で返す（パディング付き） */
export function computeRoomsBoundingBox(rooms: Room[]): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  if (rooms.length === 0) {
    // デフォルト: 800×600px — 部屋がない場合の初期エクスポート領域
    return { x: 0, y: 0, w: 40 * GRID, h: 30 * GRID };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of rooms) {
    minX = Math.min(minX, r.x * GRID);
    minY = Math.min(minY, r.y * GRID);
    maxX = Math.max(maxX, (r.x + r.w) * GRID);
    maxY = Math.max(maxY, (r.y + r.h) * GRID);
  }
  const padding = GRID * 2;
  return {
    x: minX - padding,
    y: minY - padding,
    w: maxX - minX + padding * 2,
    h: maxY - minY + padding * 2,
  };
}
