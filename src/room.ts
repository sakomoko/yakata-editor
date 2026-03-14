import type { Room, Handle, MouseCoord } from './types.ts';
import { GRID, HANDLE_SIZE, HANDLE_HIT } from './grid.ts';
import { drawWallSegments, drawWallObjects } from './wall-object.ts';

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

  drawWallObjects(ctx, room, isSelected, zoom, activeWallObjectId);

  if (isSelected && showHandles) {
    const size = HANDLE_SIZE / zoom;
    for (const handle of getHandles(room)) {
      ctx.fillStyle = '#2196F3';
      ctx.fillRect(handle.px - size / 2, handle.py - size / 2, size, size);
    }
  }
}

export function drawCreationPreview(
  ctx: CanvasRenderingContext2D,
  start: MouseCoord,
  cur: MouseCoord,
  zoom = 1,
): void {
  const x = Math.min(start.gx, cur.gx);
  const y = Math.min(start.gy, cur.gy);
  const w = Math.abs(cur.gx - start.gx);
  const h = Math.abs(cur.gy - start.gy);
  if (w <= 0 || h <= 0) return;

  ctx.fillStyle = 'rgba(33,150,243,0.08)';
  ctx.fillRect(x * GRID, y * GRID, w * GRID, h * GRID);
  ctx.strokeStyle = '#2196F3';
  ctx.lineWidth = 1.5 / zoom;
  ctx.setLineDash([4 / zoom, 3 / zoom]);
  ctx.strokeRect(x * GRID, y * GRID, w * GRID, h * GRID);
  ctx.setLineDash([]);
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
  const room = rooms.find((r) => r.id === selId);
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

