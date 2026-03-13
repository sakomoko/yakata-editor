import type { Room, Handle, MouseCoord } from './types.ts';
import { GRID, WALL, WALL_SEL, HANDLE_SIZE, HANDLE_HIT } from './grid.ts';

export function createRoom(x: number, y: number, w: number, h: number, label = ''): Room {
  return { id: crypto.randomUUID(), x, y, w, h, label };
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
): void {
  const x = room.x * GRID,
    y = room.y * GRID;
  const w = room.w * GRID,
    h = room.h * GRID;

  ctx.fillStyle = '#fff';
  ctx.fillRect(x, y, w, h);

  ctx.strokeStyle = isSelected ? '#2196F3' : '#000';
  ctx.lineWidth = (isSelected ? WALL_SEL : WALL) / zoom;
  ctx.strokeRect(x, y, w, h);

  if (room.label) {
    ctx.fillStyle = '#222';
    ctx.font = `${13 / zoom}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(room.label, x + w / 2, y + h / 2);
  }

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

export function hitRoom(rooms: Room[], px: number, py: number): Room | null {
  for (let i = rooms.length - 1; i >= 0; i--) {
    const r = rooms[i];
    if (
      px >= r.x * GRID &&
      px <= (r.x + r.w) * GRID &&
      py >= r.y * GRID &&
      py <= (r.y + r.h) * GRID
    ) {
      return r;
    }
  }
  return null;
}
