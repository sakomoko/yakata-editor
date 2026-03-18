import type {
  Room,
  RoomInteriorObject,
  StraightStairs,
  FoldingStairs,
  Marker,
  StairsDirection,
  MarkerKind,
  ResizeDirection,
} from './types.ts';
import { GRID, HANDLE_SIZE, HANDLE_HIT } from './grid.ts';
import { drawCameraIcon } from './camera.ts';
import { isPolygonRoom, getRoomVertices, getQuadCentroid, pointInQuad } from './polygon.ts';

const STAIRS_DEFAULT_W = 2;
const STAIRS_DEFAULT_H = 3;
const FOLDING_STAIRS_DEFAULT_W = 4;
const FOLDING_STAIRS_DEFAULT_H = 3;
const MARKER_DEFAULT_W = 2;
const MARKER_DEFAULT_H = 1;
const MIN_INTERIOR_SIZE = 1;

export function createStraightStairs(
  x: number,
  y: number,
  w = STAIRS_DEFAULT_W,
  h = STAIRS_DEFAULT_H,
  direction: StairsDirection = 'n',
): StraightStairs {
  return {
    id: crypto.randomUUID(),
    type: 'stairs',
    stairsType: 'straight',
    x,
    y,
    w,
    h,
    direction,
  };
}

export function createFoldingStairs(
  x: number,
  y: number,
  w = FOLDING_STAIRS_DEFAULT_W,
  h = FOLDING_STAIRS_DEFAULT_H,
  direction: StairsDirection = 'n',
): FoldingStairs {
  return {
    id: crypto.randomUUID(),
    type: 'stairs',
    stairsType: 'folding',
    x,
    y,
    w,
    h,
    direction,
  };
}

export function createMarker(
  x: number,
  y: number,
  w = MARKER_DEFAULT_W,
  h = MARKER_DEFAULT_H,
  direction: StairsDirection = 'e',
  markerKind: MarkerKind = 'body',
  label?: string,
): Marker {
  const m: Marker = {
    id: crypto.randomUUID(),
    type: 'marker',
    markerKind,
    x,
    y,
    w,
    h,
    direction,
  };
  if (label) m.label = label;
  return m;
}

export function interiorObjectToPixelRect(
  room: Room,
  obj: RoomInteriorObject,
): { x: number; y: number; w: number; h: number } {
  return {
    x: (room.x + obj.x) * GRID,
    y: (room.y + obj.y) * GRID,
    w: obj.w * GRID,
    h: obj.h * GRID,
  };
}

function getInteriorObjectStyle(
  isSelected: boolean,
  isActive: boolean,
  zoom: number,
): { color: string; lineWidth: number } {
  const color = isActive ? '#FF9800' : isSelected ? '#2196F3' : '#000';
  const lineWidth = isActive ? 2.5 / zoom : 1.5 / zoom;
  return { color, lineWidth };
}

export function drawInteriorObjects(
  ctx: CanvasRenderingContext2D,
  room: Room,
  isSelected: boolean,
  zoom = 1,
  activeId?: string,
): void {
  if (!room.interiorObjects?.length) return;

  for (const obj of room.interiorObjects) {
    const isActive = obj.id === activeId;
    const style = getInteriorObjectStyle(isSelected, isActive, zoom);
    const rect = interiorObjectToPixelRect(room, obj);

    ctx.strokeStyle = style.color;
    ctx.lineWidth = style.lineWidth;

    // Draw outer rectangle (skip for markers and cameras — they have custom rendering)
    if (obj.type !== 'marker' && obj.type !== 'camera') {
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    }

    // Draw tread lines and arrow based on stairs type
    if (obj.type === 'stairs') {
      if (obj.stairsType === 'folding') {
        drawFoldingStairsTreads(ctx, rect, obj.direction, style);
        drawFoldingStairsArrow(ctx, rect, obj.direction, style);
      } else {
        drawStairsTreads(ctx, rect, obj.direction, style);
        drawStairsArrow(ctx, rect, obj.direction, style);
      }
    } else if (obj.type === 'marker') {
      if (obj.markerKind === 'body') {
        drawMarkerBody(ctx, rect, obj.direction, style);
      } else if (obj.markerKind === 'pin') {
        drawMarkerPin(ctx, rect, style);
      }
      if (obj.label) {
        drawMarkerLabel(ctx, rect, obj.label, style, obj.markerKind);
      }
    } else if (obj.type === 'camera') {
      drawCameraIcon(ctx, room, obj, isSelected, isActive, zoom);
    }
  }
}

function drawStairsTreads(
  ctx: CanvasRenderingContext2D,
  rect: { x: number; y: number; w: number; h: number },
  direction: StairsDirection,
  style: { color: string; lineWidth: number },
): void {
  ctx.strokeStyle = style.color;
  ctx.lineWidth = style.lineWidth * 0.6;

  const isVertical = direction === 'n' || direction === 's';

  const step = GRID / 2;

  ctx.beginPath();
  if (isVertical) {
    const count = Math.floor(rect.h / step);
    for (let i = 1; i < count; i++) {
      const y = rect.y + i * step;
      ctx.moveTo(rect.x, y);
      ctx.lineTo(rect.x + rect.w, y);
    }
  } else {
    const count = Math.floor(rect.w / step);
    for (let i = 1; i < count; i++) {
      const x = rect.x + i * step;
      ctx.moveTo(x, rect.y);
      ctx.lineTo(x, rect.y + rect.h);
    }
  }
  ctx.stroke();
}

function drawStairsArrow(
  ctx: CanvasRenderingContext2D,
  rect: { x: number; y: number; w: number; h: number },
  direction: StairsDirection,
  style: { color: string; lineWidth: number },
): void {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const arrowSize = Math.min(rect.w, rect.h) * 0.2;

  ctx.strokeStyle = style.color;
  ctx.lineWidth = style.lineWidth;
  ctx.fillStyle = style.color;

  let tipX: number, tipY: number;
  let tailX: number, tailY: number;

  const margin = Math.min(rect.w, rect.h) * 0.15;

  switch (direction) {
    case 'n':
      tipX = cx;
      tipY = rect.y + margin;
      tailX = cx;
      tailY = rect.y + rect.h - margin;
      break;
    case 's':
      tipX = cx;
      tipY = rect.y + rect.h - margin;
      tailX = cx;
      tailY = rect.y + margin;
      break;
    case 'e':
      tipX = rect.x + rect.w - margin;
      tipY = cy;
      tailX = rect.x + margin;
      tailY = cy;
      break;
    case 'w':
      tipX = rect.x + margin;
      tipY = cy;
      tailX = rect.x + rect.w - margin;
      tailY = cy;
      break;
  }

  // Arrow shaft
  ctx.beginPath();
  ctx.moveTo(tailX, tailY);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();

  // Arrowhead
  const angle = Math.atan2(tipY - tailY, tipX - tailX);
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(
    tipX - arrowSize * Math.cos(angle - Math.PI / 6),
    tipY - arrowSize * Math.sin(angle - Math.PI / 6),
  );
  ctx.lineTo(
    tipX - arrowSize * Math.cos(angle + Math.PI / 6),
    tipY - arrowSize * Math.sin(angle + Math.PI / 6),
  );
  ctx.closePath();
  ctx.fill();
}

function drawFoldingStairsTreads(
  ctx: CanvasRenderingContext2D,
  rect: { x: number; y: number; w: number; h: number },
  direction: StairsDirection,
  style: { color: string; lineWidth: number },
): void {
  ctx.strokeStyle = style.color;
  ctx.lineWidth = style.lineWidth * 0.6;

  const isVertical = direction === 'n' || direction === 's';
  const step = GRID / 2;
  const landingSize = GRID; // 1グリッド分のランディング

  ctx.beginPath();

  if (isVertical) {
    // 左右に分割、中央に仕切り線
    const midX = rect.x + rect.w / 2;

    // 中央仕切り線
    ctx.moveTo(midX, rect.y);
    ctx.lineTo(midX, rect.y + rect.h);

    // ランディング側（direction='n'なら上端、's'なら下端）
    const landingY = direction === 'n' ? rect.y : rect.y + rect.h - landingSize;
    const treadStartY = direction === 'n' ? rect.y + landingSize : rect.y;
    const treadH = rect.h - landingSize;

    // 左右それぞれの踏み板線（ランディング部分は除く）
    const count = Math.floor(treadH / step);
    for (let i = 1; i < count; i++) {
      const y = treadStartY + i * step;
      // 左半分
      ctx.moveTo(rect.x, y);
      ctx.lineTo(midX, y);
      // 右半分
      ctx.moveTo(midX, y);
      ctx.lineTo(rect.x + rect.w, y);
    }

    // ランディング境界線
    ctx.moveTo(rect.x, landingY + (direction === 'n' ? landingSize : 0));
    ctx.lineTo(rect.x + rect.w, landingY + (direction === 'n' ? landingSize : 0));
  } else {
    // 上下に分割、中央に仕切り線
    const midY = rect.y + rect.h / 2;

    // 中央仕切り線
    ctx.moveTo(rect.x, midY);
    ctx.lineTo(rect.x + rect.w, midY);

    // ランディング側（direction='e'なら右端、'w'なら左端）
    const landingX = direction === 'e' ? rect.x + rect.w - landingSize : rect.x;
    const treadStartX = direction === 'e' ? rect.x : rect.x + landingSize;
    const treadW = rect.w - landingSize;

    // 上下それぞれの踏み板線
    const count = Math.floor(treadW / step);
    for (let i = 1; i < count; i++) {
      const x = treadStartX + i * step;
      // 上半分
      ctx.moveTo(x, rect.y);
      ctx.lineTo(x, midY);
      // 下半分
      ctx.moveTo(x, midY);
      ctx.lineTo(x, rect.y + rect.h);
    }

    // ランディング境界線
    ctx.moveTo(landingX + (direction === 'e' ? 0 : landingSize), rect.y);
    ctx.lineTo(landingX + (direction === 'e' ? 0 : landingSize), rect.y + rect.h);
  }

  ctx.stroke();
}

function drawFoldingStairsArrow(
  ctx: CanvasRenderingContext2D,
  rect: { x: number; y: number; w: number; h: number },
  direction: StairsDirection,
  style: { color: string; lineWidth: number },
): void {
  ctx.strokeStyle = style.color;
  ctx.lineWidth = style.lineWidth;
  ctx.fillStyle = style.color;

  const arrowSize = Math.min(rect.w, rect.h) * 0.15;
  const margin = Math.min(rect.w, rect.h) * 0.15;

  // U字型矢印: tail → corner1 → corner2 → tip
  let tailX: number, tailY: number;
  let c1X: number, c1Y: number;
  let c2X: number, c2Y: number;
  let tipX: number, tipY: number;

  const isVertical = direction === 'n' || direction === 's';

  if (isVertical) {
    const leftCx = rect.x + rect.w / 4;
    const rightCx = rect.x + (rect.w * 3) / 4;

    if (direction === 'n') {
      // 左側を上って、上で折り返して、右側を下る
      tailX = leftCx;
      tailY = rect.y + rect.h - margin;
      c1X = leftCx;
      c1Y = rect.y + margin;
      c2X = rightCx;
      c2Y = rect.y + margin;
      tipX = rightCx;
      tipY = rect.y + rect.h - margin;
    } else {
      // 左側を下って、下で折り返して、右側を上る
      tailX = leftCx;
      tailY = rect.y + margin;
      c1X = leftCx;
      c1Y = rect.y + rect.h - margin;
      c2X = rightCx;
      c2Y = rect.y + rect.h - margin;
      tipX = rightCx;
      tipY = rect.y + margin;
    }
  } else {
    const topCy = rect.y + rect.h / 4;
    const bottomCy = rect.y + (rect.h * 3) / 4;

    if (direction === 'e') {
      // 上側を右へ、右で折り返して、下側を左へ
      tailX = rect.x + margin;
      tailY = topCy;
      c1X = rect.x + rect.w - margin;
      c1Y = topCy;
      c2X = rect.x + rect.w - margin;
      c2Y = bottomCy;
      tipX = rect.x + margin;
      tipY = bottomCy;
    } else {
      // 上側を左へ、左で折り返して、下側を右へ
      tailX = rect.x + rect.w - margin;
      tailY = topCy;
      c1X = rect.x + margin;
      c1Y = topCy;
      c2X = rect.x + margin;
      c2Y = bottomCy;
      tipX = rect.x + rect.w - margin;
      tipY = bottomCy;
    }
  }

  // U字型のパス
  ctx.beginPath();
  ctx.moveTo(tailX, tailY);
  ctx.lineTo(c1X, c1Y);
  ctx.lineTo(c2X, c2Y);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();

  // Arrowhead at tip
  const angle = Math.atan2(tipY - c2Y, tipX - c2X);
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(
    tipX - arrowSize * Math.cos(angle - Math.PI / 6),
    tipY - arrowSize * Math.sin(angle - Math.PI / 6),
  );
  ctx.lineTo(
    tipX - arrowSize * Math.cos(angle + Math.PI / 6),
    tipY - arrowSize * Math.sin(angle + Math.PI / 6),
  );
  ctx.closePath();
  ctx.fill();
}

function drawMarkerBody(
  ctx: CanvasRenderingContext2D,
  rect: { x: number; y: number; w: number; h: number },
  direction: StairsDirection,
  style: { color: string; lineWidth: number },
): void {
  ctx.save();

  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;

  // Rotate based on direction (default 'e' = head right, lying down)
  let angle = 0;
  switch (direction) {
    case 'e':
      angle = 0;
      break;
    case 's':
      angle = Math.PI / 2;
      break;
    case 'w':
      angle = Math.PI;
      break;
    case 'n':
      angle = -Math.PI / 2;
      break;
  }

  ctx.translate(cx, cy);
  ctx.rotate(angle);

  // Draw in local coordinates centered at (0,0), body lying along X axis
  // head on the right (+x), feet on the left (-x)
  const hw = rect.w / 2; // half width
  const hh = rect.h / 2; // half height

  // Scale factor to fit within the rect with some margin
  const margin = 0.1;
  const scaleX = hw * (1 - margin);
  const scaleY = hh * (1 - margin);

  ctx.strokeStyle = style.color;
  ctx.lineWidth = style.lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Head (circle at +x end)
  const headRadius = Math.min(scaleX * 0.18, scaleY * 0.35);
  const headCx = scaleX * 0.7;
  ctx.beginPath();
  ctx.arc(headCx, 0, headRadius, 0, Math.PI * 2);
  ctx.stroke();

  // Torso: from neck to hip
  const neckX = headCx - headRadius;
  const hipX = -scaleX * 0.1;
  ctx.beginPath();
  ctx.moveTo(neckX, 0);
  ctx.lineTo(hipX, 0);
  ctx.stroke();

  // Arms: from shoulder, spread out
  const shoulderX = neckX - (neckX - hipX) * 0.25;
  ctx.beginPath();
  ctx.moveTo(shoulderX, 0);
  ctx.lineTo(shoulderX - scaleX * 0.2, -scaleY * 0.7);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(shoulderX, 0);
  ctx.lineTo(shoulderX + scaleX * 0.15, scaleY * 0.8);
  ctx.stroke();

  // Legs: from hip, spread out
  ctx.beginPath();
  ctx.moveTo(hipX, 0);
  ctx.lineTo(-scaleX * 0.75, -scaleY * 0.55);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(hipX, 0);
  ctx.lineTo(-scaleX * 0.85, scaleY * 0.45);
  ctx.stroke();

  ctx.restore();
}

function drawMarkerPin(
  ctx: CanvasRenderingContext2D,
  rect: { x: number; y: number; w: number; h: number },
  style: { color: string; lineWidth: number },
): void {
  const h = rect.h;
  const radius = h * 0.2;
  const cx = rect.x + h * 0.35;
  const cy = rect.y + h * 0.35;

  ctx.fillStyle = style.color;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  // Pin tail
  ctx.strokeStyle = style.color;
  ctx.lineWidth = style.lineWidth;
  ctx.beginPath();
  ctx.moveTo(cx, cy + radius);
  ctx.lineTo(cx, cy + radius + h * 0.2);
  ctx.stroke();
}

function drawMarkerLabel(
  ctx: CanvasRenderingContext2D,
  rect: { x: number; y: number; w: number; h: number },
  label: string,
  style: { color: string; lineWidth: number },
  markerKind: MarkerKind,
): void {
  if (!label) return;
  ctx.save();

  // Pin: テキスト領域はアイコン右横。Body: 矩形全体。
  let textX: number;
  let textY: number;
  let textW: number;
  let textH: number;

  if (markerKind === 'pin') {
    const iconW = rect.h * 0.7;
    textX = rect.x + iconW;
    textY = rect.y;
    textW = rect.w - iconW;
    textH = rect.h;
  } else {
    textX = rect.x;
    textY = rect.y;
    textW = rect.w;
    textH = rect.h;
  }

  if (textW <= 0 || textH <= 0) {
    ctx.restore();
    return;
  }

  // Auto font size: fit text using measureText for accurate CJK support
  const maxW = textW * 0.95;
  const baseFontSize = textH * 0.8;
  ctx.font = `${baseFontSize}px sans-serif`;
  const measured = ctx.measureText(label);
  const fontSize = measured.width > maxW ? baseFontSize * (maxW / measured.width) : baseFontSize;

  ctx.fillStyle = style.color;
  ctx.font = `${fontSize}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, textX + textW / 2, textY + textH / 2, maxW);

  ctx.restore();
}

export function drawInteriorObjectHandles(
  ctx: CanvasRenderingContext2D,
  room: Room,
  zoom: number,
  activeId?: string,
): void {
  if (!room.interiorObjects?.length) return;
  const size = HANDLE_SIZE / zoom;

  // Only draw handles for the active object to reduce visual noise
  if (!activeId) return;
  const targets = room.interiorObjects.filter((o) => o.id === activeId);

  for (const obj of targets) {
    const rect = interiorObjectToPixelRect(room, obj);
    const corners = [
      { x: rect.x, y: rect.y },
      { x: rect.x + rect.w, y: rect.y },
      { x: rect.x + rect.w, y: rect.y + rect.h },
      { x: rect.x, y: rect.y + rect.h },
    ];
    ctx.fillStyle = '#FF9800';
    for (const c of corners) {
      ctx.fillRect(c.x - size / 2, c.y - size / 2, size, size);
    }
  }
}

export function hitInteriorObject(room: Room, px: number, py: number): RoomInteriorObject | null {
  if (!room.interiorObjects?.length) return null;
  for (let i = room.interiorObjects.length - 1; i >= 0; i--) {
    const obj = room.interiorObjects[i];
    const rect = interiorObjectToPixelRect(room, obj);
    if (px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h) {
      return obj;
    }
  }
  return null;
}

export function hitInteriorObjectInRooms(
  rooms: Room[],
  px: number,
  py: number,
): { room: Room; obj: RoomInteriorObject } | null {
  for (let i = rooms.length - 1; i >= 0; i--) {
    const room = rooms[i];
    const obj = hitInteriorObject(room, px, py);
    if (obj) return { room, obj };
  }
  return null;
}

interface InteriorHandleHit {
  room: Room;
  obj: RoomInteriorObject;
  dir: ResizeDirection;
}

export function hitInteriorObjectHandle(
  room: Room,
  px: number,
  py: number,
  zoom: number,
): { obj: RoomInteriorObject; dir: ResizeDirection } | null {
  if (!room.interiorObjects?.length) return null;
  const tolerance = HANDLE_HIT / zoom;

  for (let i = room.interiorObjects.length - 1; i >= 0; i--) {
    const obj = room.interiorObjects[i];
    const rect = interiorObjectToPixelRect(room, obj);
    const handles: { x: number; y: number; dir: ResizeDirection }[] = [
      { x: rect.x, y: rect.y, dir: 'nw' },
      { x: rect.x + rect.w, y: rect.y, dir: 'ne' },
      { x: rect.x + rect.w, y: rect.y + rect.h, dir: 'se' },
      { x: rect.x, y: rect.y + rect.h, dir: 'sw' },
    ];
    for (const h of handles) {
      if (Math.abs(px - h.x) < tolerance && Math.abs(py - h.y) < tolerance) {
        return { obj, dir: h.dir };
      }
    }
  }
  return null;
}

export function hitInteriorObjectHandleInRooms(
  rooms: Room[],
  px: number,
  py: number,
  zoom: number,
): InteriorHandleHit | null {
  for (let i = rooms.length - 1; i >= 0; i--) {
    const room = rooms[i];
    const hit = hitInteriorObjectHandle(room, px, py, zoom);
    if (hit) return { room, ...hit };
  }
  return null;
}

export function clampInteriorObject(room: Room, obj: RoomInteriorObject): void {
  obj.x = Math.max(0, Math.min(obj.x, room.w - obj.w));
  obj.y = Math.max(0, Math.min(obj.y, room.h - obj.h));
  // If the object is bigger than the room, shrink it
  if (obj.w > room.w) obj.w = room.w;
  if (obj.h > room.h) obj.h = room.h;
  // Re-clamp position after possible resize
  obj.x = Math.max(0, Math.min(obj.x, room.w - obj.w));
  obj.y = Math.max(0, Math.min(obj.y, room.h - obj.h));

  // For polygon rooms, push toward centroid if center is outside the shape
  if (isPolygonRoom(room)) {
    // verts and center* are both in absolute grid coordinates
    const verts = getRoomVertices(room);
    const centroid = getQuadCentroid(verts);
    // Guard: if centroid itself is outside the quad (e.g. concave shape), skip clamp
    if (!pointInQuad(verts, centroid.gx, centroid.gy)) return;
    const centerGx = room.x + obj.x + obj.w / 2;
    const centerGy = room.y + obj.y + obj.h / 2;
    if (!pointInQuad(verts, centerGx, centerGy)) {
      // Invariant: t=0 (original position) is outside, t=1 (centroid) is inside (guaranteed by guard above)
      let lo = 0,
        hi = 1;
      // 16 iterations -> ~1.5e-5 grid unit precision (sufficient for display)
      for (let i = 0; i < 16; i++) {
        const mid = (lo + hi) / 2;
        const mx = centerGx + (centroid.gx - centerGx) * mid;
        const my = centerGy + (centroid.gy - centerGy) * mid;
        if (pointInQuad(verts, mx, my)) {
          hi = mid;
        } else {
          lo = mid;
        }
      }
      const t = hi;
      // NOTE: center point is guaranteed inside, but corners of obj may still
      // extend outside the polygon for large objects in narrow polygon rooms.
      obj.x = centerGx + (centroid.gx - centerGx) * t - obj.w / 2 - room.x;
      obj.y = centerGy + (centroid.gy - centerGy) * t - obj.h / 2 - room.y;
    }
  }
}

export function clampAllInteriorObjects(room: Room): void {
  if (!room.interiorObjects) return;
  for (const obj of room.interiorObjects) {
    clampInteriorObject(room, obj);
  }
}

export function computeInteriorObjectMove(
  room: Room,
  obj: RoomInteriorObject,
  gx: number,
  gy: number,
  offsetX: number,
  offsetY: number,
): { x: number; y: number } {
  const relX = gx - room.x - offsetX;
  const relY = gy - room.y - offsetY;
  return {
    x: Math.max(0, Math.min(relX, room.w - obj.w)),
    y: Math.max(0, Math.min(relY, room.h - obj.h)),
  };
}

export function computeInteriorObjectResize(
  room: Room,
  dir: ResizeDirection,
  orig: { x: number; y: number; w: number; h: number },
  gx: number,
  gy: number,
  minSize = MIN_INTERIOR_SIZE,
): { x: number; y: number; w: number; h: number } {
  const relGx = gx - room.x;
  const relGy = gy - room.y;

  let x = orig.x;
  let y = orig.y;
  let w = orig.w;
  let h = orig.h;

  if (dir.includes('w')) {
    const newX = Math.max(0, Math.min(relGx, orig.x + orig.w - minSize));
    w = orig.x + orig.w - newX;
    x = newX;
  }
  if (dir.includes('e')) {
    w = Math.max(minSize, Math.min(relGx - orig.x, room.w - orig.x));
  }
  if (dir.includes('n')) {
    const newY = Math.max(0, Math.min(relGy, orig.y + orig.h - minSize));
    h = orig.y + orig.h - newY;
    y = newY;
  }
  if (dir.includes('s')) {
    h = Math.max(minSize, Math.min(relGy - orig.y, room.h - orig.y));
  }

  // Final boundary safety: ensure object stays within room bounds
  w = Math.min(w, room.w - x);
  h = Math.min(h, room.h - y);

  return { x, y, w, h };
}
