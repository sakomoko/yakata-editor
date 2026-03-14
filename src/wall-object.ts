import type { Room, WallSide, WallObject, WallWindow } from './types.ts';
import { GRID, WALL, WALL_SEL } from './grid.ts';

const WINDOW_DRAW_OFFSET = 4;
const WINDOW_HIT_TOLERANCE = 6;

export function createWallWindow(side: WallSide, offset: number, width = 1): WallWindow {
  return { id: crypto.randomUUID(), type: 'window', side, offset, width };
}

export function wallSideLength(room: Room, side: WallSide): number {
  return side === 'n' || side === 's' ? room.w : room.h;
}

export function clampWallObjects(room: Room): void {
  if (!room.wallObjects) return;
  for (const obj of room.wallObjects) {
    const len = wallSideLength(room, obj.side);
    obj.offset = Math.max(0, Math.min(obj.offset, len - obj.width));
  }
}

export function wallObjectToPixelRect(
  room: Room,
  obj: WallObject,
): { x: number; y: number; length: number; horizontal: boolean } {
  const rx = room.x * GRID;
  const ry = room.y * GRID;
  const rw = room.w * GRID;
  const rh = room.h * GRID;
  const off = obj.offset * GRID;
  const len = obj.width * GRID;

  switch (obj.side) {
    case 'n':
      return { x: rx + off, y: ry, length: len, horizontal: true };
    case 's':
      return { x: rx + off, y: ry + rh, length: len, horizontal: true };
    case 'w':
      return { x: rx, y: ry + off, length: len, horizontal: false };
    case 'e':
      return { x: rx + rw, y: ry + off, length: len, horizontal: false };
  }
}

/** Returns wall segments for a given side, with gaps cut out for wall objects. */
export function getWallSegments(
  room: Room,
  side: WallSide,
): { start: number; end: number }[] {
  const sideLen = wallSideLength(room, side) * GRID;
  if (!room.wallObjects?.length) return [{ start: 0, end: sideLen }];

  const gaps: { start: number; end: number }[] = [];
  for (const obj of room.wallObjects) {
    if (obj.side !== side) continue;
    gaps.push({ start: obj.offset * GRID, end: (obj.offset + obj.width) * GRID });
  }
  gaps.sort((a, b) => a.start - b.start);

  const segments: { start: number; end: number }[] = [];
  let cursor = 0;
  for (const gap of gaps) {
    if (gap.start > cursor) {
      segments.push({ start: cursor, end: gap.start });
    }
    cursor = Math.max(cursor, gap.end);
  }
  if (cursor < sideLen) {
    segments.push({ start: cursor, end: sideLen });
  }
  return segments;
}

/** Draw wall segments for a room, skipping where wall objects are placed. */
export function drawWallSegments(
  ctx: CanvasRenderingContext2D,
  room: Room,
  isSelected: boolean,
  zoom = 1,
): void {
  const rx = room.x * GRID;
  const ry = room.y * GRID;
  const rw = room.w * GRID;
  const rh = room.h * GRID;

  ctx.strokeStyle = isSelected ? '#2196F3' : '#000';
  ctx.lineWidth = (isSelected ? WALL_SEL : WALL) / zoom;

  ctx.beginPath();
  for (const seg of getWallSegments(room, 'n')) {
    ctx.moveTo(rx + seg.start, ry);
    ctx.lineTo(rx + seg.end, ry);
  }
  for (const seg of getWallSegments(room, 's')) {
    ctx.moveTo(rx + seg.start, ry + rh);
    ctx.lineTo(rx + seg.end, ry + rh);
  }
  for (const seg of getWallSegments(room, 'w')) {
    ctx.moveTo(rx, ry + seg.start);
    ctx.lineTo(rx, ry + seg.end);
  }
  for (const seg of getWallSegments(room, 'e')) {
    ctx.moveTo(rx + rw, ry + seg.start);
    ctx.lineTo(rx + rw, ry + seg.end);
  }
  ctx.stroke();
}

/** Draw window symbols (double parallel lines) on wall objects. */
export function drawWallObjects(
  ctx: CanvasRenderingContext2D,
  room: Room,
  isSelected: boolean,
  zoom = 1,
  activeObjectId?: string,
): void {
  if (!room.wallObjects?.length) return;

  const lineWidth = 1.5 / zoom;
  const drawOffset = WINDOW_DRAW_OFFSET / zoom;

  for (const obj of room.wallObjects) {
    if (obj.type !== 'window') continue;

    const isActive = obj.id === activeObjectId;
    const color = isActive ? '#FF9800' : isSelected ? '#2196F3' : '#000';

    const rect = wallObjectToPixelRect(room, obj);

    ctx.strokeStyle = color;
    ctx.lineWidth = isActive ? 2.5 / zoom : lineWidth;
    ctx.beginPath();
    if (rect.horizontal) {
      ctx.moveTo(rect.x, rect.y - drawOffset);
      ctx.lineTo(rect.x + rect.length, rect.y - drawOffset);
      ctx.moveTo(rect.x, rect.y + drawOffset);
      ctx.lineTo(rect.x + rect.length, rect.y + drawOffset);
    } else {
      ctx.moveTo(rect.x - drawOffset, rect.y);
      ctx.lineTo(rect.x - drawOffset, rect.y + rect.length);
      ctx.moveTo(rect.x + drawOffset, rect.y);
      ctx.lineTo(rect.x + drawOffset, rect.y + rect.length);
    }
    ctx.stroke();
  }
}

export function hitWallObject(
  room: Room,
  px: number,
  py: number,
  zoom = 1,
): WallObject | null {
  if (!room.wallObjects?.length) return null;
  const tolerance = WINDOW_HIT_TOLERANCE / zoom;

  for (let i = room.wallObjects.length - 1; i >= 0; i--) {
    const obj = room.wallObjects[i];
    const rect = wallObjectToPixelRect(room, obj);

    if (rect.horizontal) {
      if (
        px >= rect.x &&
        px <= rect.x + rect.length &&
        Math.abs(py - rect.y) < tolerance
      ) {
        return obj;
      }
    } else {
      if (
        py >= rect.y &&
        py <= rect.y + rect.length &&
        Math.abs(px - rect.x) < tolerance
      ) {
        return obj;
      }
    }
  }
  return null;
}

/** Find a wall object hit across all rooms, respecting z-order (last room = top). */
export function hitWallObjectInRooms(
  rooms: Room[],
  px: number,
  py: number,
  zoom = 1,
): { room: Room; obj: WallObject } | null {
  for (let i = rooms.length - 1; i >= 0; i--) {
    const room = rooms[i];
    const obj = hitWallObject(room, px, py, zoom);
    if (obj) return { room, obj };
  }
  return null;
}

/** Compute where a wall object should be placed when dragged to a given pixel position. */
export function computeWallObjectPosition(
  room: Room,
  px: number,
  py: number,
  objWidth: number,
): { side: WallSide; offset: number } {
  const { side } = nearestWallSide(room, px, py);
  const rx = room.x * GRID;
  const ry = room.y * GRID;
  const along = side === 'n' || side === 's' ? px - rx : py - ry;
  const offsetGrid = Math.round(along / GRID - objWidth / 2);
  const sideLen = side === 'n' || side === 's' ? room.w : room.h;
  return { side, offset: Math.max(0, Math.min(offsetGrid, sideLen - objWidth)) };
}

export function nearestWallSide(
  room: Room,
  px: number,
  py: number,
): { side: WallSide; offset: number } {
  const rx = room.x * GRID;
  const ry = room.y * GRID;
  const rw = room.w * GRID;
  const rh = room.h * GRID;

  const distances: { side: WallSide; dist: number; along: number; length: number }[] = [
    { side: 'n', dist: Math.abs(py - ry), along: px - rx, length: rw },
    { side: 's', dist: Math.abs(py - (ry + rh)), along: px - rx, length: rw },
    { side: 'w', dist: Math.abs(px - rx), along: py - ry, length: rh },
    { side: 'e', dist: Math.abs(px - (rx + rw)), along: py - ry, length: rh },
  ];

  distances.sort((a, b) => a.dist - b.dist);
  const nearest = distances[0];

  const offsetGrid = Math.round(nearest.along / GRID);
  const maxOffset = nearest.length / GRID - 1;
  const clampedOffset = Math.max(0, Math.min(offsetGrid, maxOffset));

  return { side: nearest.side, offset: clampedOffset };
}
