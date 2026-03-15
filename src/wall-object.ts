import type { Room, WallSide, WallObject, WallWindow, WallDoor, WallOpening } from './types.ts';
import { GRID, WALL, WALL_SEL } from './grid.ts';

const WINDOW_DRAW_OFFSET = 4;
const WALL_OBJECT_HIT_TOLERANCE = 6;
/** Resize handle diameter (px). */
const RESIZE_HANDLE_SIZE = 6;
/** Edge hit tolerance (px), derived from handle size + margin for easy targeting. */
const WALL_OBJECT_EDGE_HIT_TOLERANCE = RESIZE_HANDLE_SIZE / 2 + 2; // 5px

export function createWallWindow(side: WallSide, offset: number, width = 1): WallWindow {
  return { id: crypto.randomUUID(), type: 'window', side, offset, width };
}

export function createWallOpening(side: WallSide, offset: number, width = 1): WallOpening {
  return { id: crypto.randomUUID(), type: 'opening', side, offset, width };
}

export function createWallDoor(
  side: WallSide,
  offset: number,
  width = 1,
  swing: 'inward' | 'outward' = 'inward',
): WallDoor {
  return { id: crypto.randomUUID(), type: 'door', side, offset, width, swing };
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
export function getWallSegments(room: Room, side: WallSide): { start: number; end: number }[] {
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

/** Angle lookup table for door swing directions per wall side. */
const DOOR_ANGLES: Record<
  WallSide,
  {
    closedAngle: number;
    inward: number;
    outward: number;
    inwardCCW: boolean;
    outwardCCW: boolean;
  }
> = {
  // 北壁: 壁沿い=右(0), 内開き=下(π/2)時計回り, 外開き=上(-π/2)反時計回り
  n: {
    closedAngle: 0,
    inward: Math.PI / 2,
    outward: -Math.PI / 2,
    inwardCCW: false,
    outwardCCW: true,
  },
  // 南壁: 壁沿い=右(0), 内開き=上(-π/2)反時計回り, 外開き=下(π/2)時計回り
  s: {
    closedAngle: 0,
    inward: -Math.PI / 2,
    outward: Math.PI / 2,
    inwardCCW: true,
    outwardCCW: false,
  },
  // 西壁: 壁沿い=下(π/2), 内開き=右(0)反時計回り, 外開き=左(π)時計回り
  w: {
    closedAngle: Math.PI / 2,
    inward: 0,
    outward: Math.PI,
    inwardCCW: true,
    outwardCCW: false,
  },
  // 東壁: 壁沿い=下(π/2), 内開き=左(π)時計回り, 外開き=右(0)反時計回り
  e: {
    closedAngle: Math.PI / 2,
    inward: Math.PI,
    outward: 0,
    inwardCCW: false,
    outwardCCW: true,
  },
};

interface DoorGeometry {
  hingeX: number;
  hingeY: number;
  radius: number;
  closedAngle: number;
  openAngle: number;
  anticlockwise: boolean;
}

function getDoorGeometry(room: Room, obj: WallDoor): DoorGeometry {
  const rect = wallObjectToPixelRect(room, obj);
  const angles = DOOR_ANGLES[obj.side];
  return {
    hingeX: rect.x,
    hingeY: rect.y,
    radius: rect.length,
    closedAngle: angles.closedAngle,
    openAngle: obj.swing === 'inward' ? angles.inward : angles.outward,
    anticlockwise: obj.swing === 'inward' ? angles.inwardCCW : angles.outwardCCW,
  };
}

function drawDoor(
  ctx: CanvasRenderingContext2D,
  room: Room,
  obj: WallDoor,
  color: string,
  lineWidth: number,
): void {
  const { hingeX, hingeY, radius, closedAngle, openAngle, anticlockwise } = getDoorGeometry(
    room,
    obj,
  );

  // Draw panel line (from hinge to open position)
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.moveTo(hingeX, hingeY);
  ctx.lineTo(hingeX + Math.cos(openAngle) * radius, hingeY + Math.sin(openAngle) * radius);
  ctx.stroke();

  // Draw arc (from closed position to open position)
  ctx.beginPath();
  ctx.arc(hingeX, hingeY, radius, closedAngle, openAngle, anticlockwise);
  ctx.stroke();
}

/** Compute color and line width for a wall object based on selection/active state. */
function getWallObjectStyle(
  isSelected: boolean,
  isActive: boolean,
  zoom: number,
): { color: string; lineWidth: number } {
  const baseLineWidth = 1.5 / zoom;
  const color = isActive ? '#FF9800' : isSelected ? '#2196F3' : '#000';
  const lineWidth = isActive ? 2.5 / zoom : baseLineWidth;
  return { color, lineWidth };
}

/**
 * Draw outward doors overlay on top of all rooms (2nd pass to prevent occlusion).
 * Resize handles are NOT redrawn here because they sit on the wall line and
 * are not occluded by adjacent rooms' fillRect.
 */
export function drawOutwardDoorsOverlay(
  ctx: CanvasRenderingContext2D,
  room: Room,
  isSelected: boolean,
  zoom = 1,
  activeObjectId?: string,
): void {
  if (!room.wallObjects?.length) return;

  const outwardDoors = room.wallObjects.filter(
    (obj): obj is WallDoor => obj.type === 'door' && obj.swing === 'outward',
  );
  if (outwardDoors.length === 0) return;

  for (const obj of outwardDoors) {
    const isActive = obj.id === activeObjectId;
    const style = getWallObjectStyle(isSelected, isActive, zoom);
    drawDoor(ctx, room, obj, style.color, style.lineWidth);
  }
}

/** Draw wall object symbols (windows and doors) on wall objects. */
export function drawWallObjects(
  ctx: CanvasRenderingContext2D,
  room: Room,
  isSelected: boolean,
  zoom = 1,
  activeObjectId?: string,
): void {
  if (!room.wallObjects?.length) return;

  const drawOffset = WINDOW_DRAW_OFFSET / zoom;

  for (const obj of room.wallObjects) {
    const isActive = obj.id === activeObjectId;
    const style = getWallObjectStyle(isSelected, isActive, zoom);

    switch (obj.type) {
      case 'window': {
        const rect = wallObjectToPixelRect(room, obj);
        ctx.strokeStyle = style.color;
        ctx.lineWidth = style.lineWidth;
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
        break;
      }
      case 'door': {
        drawDoor(ctx, room, obj, style.color, style.lineWidth);
        break;
      }
      case 'opening': {
        // 開口は壁の隙間のみで表現される（getWallSegmentsで自動処理）
        break;
      }
    }
  }
}

/** Draw resize handles for all wall objects in a room (called after room handles for correct z-order). */
export function drawWallObjectResizeHandles(
  ctx: CanvasRenderingContext2D,
  room: Room,
  zoom: number,
): void {
  if (!room.wallObjects?.length) return;
  for (const obj of room.wallObjects) {
    drawSingleWallObjectResizeHandle(ctx, room, obj, zoom);
  }
}

/** Draw small diamond-shaped handles at both edges of a wall object. */
function drawSingleWallObjectResizeHandle(
  ctx: CanvasRenderingContext2D,
  room: Room,
  obj: WallObject,
  zoom: number,
): void {
  const rect = wallObjectToPixelRect(room, obj);
  const r = RESIZE_HANDLE_SIZE / 2 / zoom;

  const points: { x: number; y: number }[] = [];
  if (rect.horizontal) {
    points.push({ x: rect.x, y: rect.y });
    points.push({ x: rect.x + rect.length, y: rect.y });
  } else {
    points.push({ x: rect.x, y: rect.y });
    points.push({ x: rect.x, y: rect.y + rect.length });
  }

  ctx.fillStyle = '#FF9800';
  for (const p of points) {
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - r);
    ctx.lineTo(p.x + r, p.y);
    ctx.lineTo(p.x, p.y + r);
    ctx.lineTo(p.x - r, p.y);
    ctx.closePath();
    ctx.fill();
  }
}

/** Normalize angle to [0, 2π) */
function normalizeAngle(a: number): number {
  return ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
}

/** Check if angle is within the arc sweep from startAngle to endAngle (respecting direction). */
function isAngleInSweep(
  angle: number,
  startAngle: number,
  endAngle: number,
  anticlockwise: boolean,
): boolean {
  const a = normalizeAngle(angle);
  const s = normalizeAngle(startAngle);
  const e = normalizeAngle(endAngle);

  if (anticlockwise) {
    // Sweep goes from start counterclockwise to end
    // Angle is in sweep if going clockwise from end to start covers it
    if (s >= e) {
      return a <= s && a >= e;
    } else {
      return a >= e || a <= s;
    }
  } else {
    // Sweep goes from start clockwise to end
    if (e >= s) {
      return a >= s && a <= e;
    } else {
      return a >= s || a <= e;
    }
  }
}

/** Hit test for a door's wedge area (the pie-shaped region bounded by the panel, wall, and arc). */
function hitDoorShape(
  room: Room,
  obj: WallDoor,
  px: number,
  py: number,
  tolerance: number,
): boolean {
  const { hingeX, hingeY, radius, closedAngle, openAngle, anticlockwise } = getDoorGeometry(
    room,
    obj,
  );

  // Check if point is inside the wedge (pie shape) with tolerance:
  // 1. Distance from hinge <= radius + tolerance
  // 2. Angle is within the arc sweep
  const dist = Math.hypot(px - hingeX, py - hingeY);
  if (dist > radius + tolerance) return false;

  const angle = Math.atan2(py - hingeY, px - hingeX);
  return isAngleInSweep(angle, closedAngle, openAngle, anticlockwise);
}

export function hitWallObject(
  room: Room,
  px: number,
  py: number,
  zoom = 1,
  skipAutoGenerated = false,
): WallObject | null {
  if (!room.wallObjects?.length) return null;
  const tolerance = WALL_OBJECT_HIT_TOLERANCE / zoom;

  for (let i = room.wallObjects.length - 1; i >= 0; i--) {
    const obj = room.wallObjects[i];
    if (skipAutoGenerated && obj.type === 'opening' && obj.autoGenerated) continue;
    const rect = wallObjectToPixelRect(room, obj);

    // Wall-line hit (shared by all wall object types)
    let wallLineHit = false;
    if (rect.horizontal) {
      if (px >= rect.x && px <= rect.x + rect.length && Math.abs(py - rect.y) < tolerance) {
        wallLineHit = true;
      }
    } else {
      if (py >= rect.y && py <= rect.y + rect.length && Math.abs(px - rect.x) < tolerance) {
        wallLineHit = true;
      }
    }

    if (wallLineHit) return obj;

    // Door-specific: also check arc and panel line
    if (obj.type === 'door' && hitDoorShape(room, obj, px, py, tolerance)) {
      return obj;
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
  skipAutoGenerated = false,
): { room: Room; obj: WallObject } | null {
  for (let i = rooms.length - 1; i >= 0; i--) {
    const room = rooms[i];
    const obj = hitWallObject(room, px, py, zoom, skipAutoGenerated);
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

/** Hit test for wall object edge (start or end) for resize dragging. */
export function hitWallObjectEdge(
  room: Room,
  px: number,
  py: number,
  zoom = 1,
  skipAutoGenerated = false,
): { obj: WallObject; edge: 'start' | 'end' } | null {
  if (!room.wallObjects?.length) return null;
  const edgeTol = WALL_OBJECT_EDGE_HIT_TOLERANCE / zoom;
  const wallTol = WALL_OBJECT_HIT_TOLERANCE / zoom;

  for (let i = room.wallObjects.length - 1; i >= 0; i--) {
    const obj = room.wallObjects[i];
    if (skipAutoGenerated && obj.type === 'opening' && obj.autoGenerated) continue;
    const rect = wallObjectToPixelRect(room, obj);

    if (rect.horizontal) {
      // Check wall-line proximity first
      if (Math.abs(py - rect.y) > wallTol) continue;
      const startX = rect.x;
      const endX = rect.x + rect.length;
      // Start edge
      if (Math.abs(px - startX) <= edgeTol) return { obj, edge: 'start' };
      // End edge
      if (Math.abs(px - endX) <= edgeTol) return { obj, edge: 'end' };
    } else {
      // Vertical wall
      if (Math.abs(px - rect.x) > wallTol) continue;
      const startY = rect.y;
      const endY = rect.y + rect.length;
      if (Math.abs(py - startY) <= edgeTol) return { obj, edge: 'start' };
      if (Math.abs(py - endY) <= edgeTol) return { obj, edge: 'end' };
    }
  }
  return null;
}

/** Find a wall object edge hit across all rooms, respecting z-order. */
export function hitWallObjectEdgeInRooms(
  rooms: Room[],
  px: number,
  py: number,
  zoom = 1,
  skipAutoGenerated = false,
): { room: Room; obj: WallObject; edge: 'start' | 'end' } | null {
  for (let i = rooms.length - 1; i >= 0; i--) {
    const room = rooms[i];
    const hit = hitWallObjectEdge(room, px, py, zoom, skipAutoGenerated);
    if (hit) return { room, ...hit };
  }
  return null;
}

/** Check if resizing would cause overlap with another object on the same wall. */
export function wouldOverlap(
  room: Room,
  objId: string,
  side: WallSide,
  newOffset: number,
  newWidth: number,
): boolean {
  if (!room.wallObjects) return false;
  for (const other of room.wallObjects) {
    if (other.id === objId || other.side !== side) continue;
    if (newOffset < other.offset + other.width && newOffset + newWidth > other.offset) {
      return true;
    }
  }
  return false;
}

/** Compute new offset and width when resizing a wall object by dragging an edge. */
export function computeWallObjectResize(
  room: Room,
  obj: WallObject,
  edge: 'start' | 'end',
  px: number,
  py: number,
  origOffset: number,
  origWidth: number,
): { offset: number; width: number } {
  const rx = room.x * GRID;
  const ry = room.y * GRID;
  const horizontal = obj.side === 'n' || obj.side === 's';
  const along = horizontal ? px - rx : py - ry;
  const snapped = Math.round(along / GRID);
  const sideLen = wallSideLength(room, obj.side);

  let offset: number;
  let width: number;

  if (edge === 'end') {
    offset = origOffset;
    const rawWidth = snapped - origOffset;
    width = Math.max(1, Math.min(rawWidth, sideLen - origOffset));
  } else {
    // Start edge: move offset, adjust width
    const origEnd = origOffset + origWidth;
    const newStart = Math.min(snapped, origEnd - 1); // min width = 1
    offset = Math.max(0, newStart);
    width = Math.max(1, origEnd - offset);
  }

  // Prevent overlap: return current values (updated each mousemove) so the object
  // stays at its last valid position rather than snapping back to drag-start.
  if (wouldOverlap(room, obj.id, obj.side, offset, width)) {
    return { offset: obj.offset, width: obj.width };
  }

  return { offset, width };
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
