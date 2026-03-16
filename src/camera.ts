import type { Room, SecurityCamera } from './types.ts';
import { CAMERA_COLOR_PRESETS } from './types.ts';
import { GRID, HANDLE_SIZE, HANDLE_HIT } from './grid.ts';

const CAMERA_DEFAULT_W = 1;
const CAMERA_DEFAULT_H = 1;
const DEFAULT_FOV_ANGLE = Math.PI / 6; // 30° half-angle
const DEFAULT_FOV_RANGE = 5; // grids
const DEFAULT_COLORS = CAMERA_COLOR_PRESETS.blue;

export function createSecurityCamera(
  x: number,
  y: number,
  angle = 0,
  w = CAMERA_DEFAULT_W,
  h = CAMERA_DEFAULT_H,
): SecurityCamera {
  return {
    id: crypto.randomUUID(),
    type: 'camera',
    x,
    y,
    w,
    h,
    angle,
    fovAngle: DEFAULT_FOV_ANGLE,
    fovRange: DEFAULT_FOV_RANGE,
    fovColor: DEFAULT_COLORS.fovColor,
    fovStrokeColor: DEFAULT_COLORS.fovStrokeColor,
  };
}

/** カメラアイコンのピクセル中心座標を計算 */
export function cameraCenter(
  room: Room,
  cam: SecurityCamera,
): { cx: number; cy: number } {
  return {
    cx: (room.x + cam.x + cam.w / 2) * GRID,
    cy: (room.y + cam.y + cam.h / 2) * GRID,
  };
}

/** カメラ本体アイコンを描画（四角い本体 + レンズ突起） */
export function drawCameraIcon(
  ctx: CanvasRenderingContext2D,
  room: Room,
  cam: SecurityCamera,
  isSelected: boolean,
  isActive: boolean,
  zoom: number,
): void {
  const { cx, cy } = cameraCenter(room, cam);
  const size = Math.min(cam.w, cam.h) * GRID * 0.4;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(cam.angle);

  const color = isActive ? '#FF9800' : isSelected ? '#2196F3' : '#555';
  const lineWidth = isActive ? 2.5 / zoom : 1.5 / zoom;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lineWidth;

  // 本体（四角）
  const bodyW = size * 1.2;
  const bodyH = size * 0.8;
  ctx.strokeRect(-bodyW / 2, -bodyH / 2, bodyW, bodyH);

  // レンズ突起（右方向に向いた台形）
  const lensLen = size * 0.5;
  const lensW = bodyH * 0.4;
  ctx.beginPath();
  ctx.moveTo(bodyW / 2, -lensW / 2);
  ctx.lineTo(bodyW / 2 + lensLen, -lensW * 0.2);
  ctx.lineTo(bodyW / 2 + lensLen, lensW * 0.2);
  ctx.lineTo(bodyW / 2, lensW / 2);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

/** 全カメラの視野コーンをオーバーレイ描画 */
export function drawCameraFovOverlay(
  ctx: CanvasRenderingContext2D,
  rooms: Room[],
  zoom: number,
): void {
  for (const room of rooms) {
    if (!room.interiorObjects?.length) continue;
    for (const obj of room.interiorObjects) {
      if (obj.type !== 'camera') continue;
      const { cx, cy } = cameraCenter(room, obj);
      const rangePx = obj.fovRange * GRID;

      ctx.save();
      ctx.fillStyle = obj.fovColor;
      ctx.strokeStyle = obj.fovStrokeColor;
      ctx.lineWidth = 1 / zoom;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, rangePx, obj.angle - obj.fovAngle, obj.angle + obj.fovAngle);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }
}

export interface CameraHandleHit {
  type: 'rotate' | 'fovRange' | 'fovAngle';
}

/** カメラのハンドル座標を計算（描画・ヒット判定で共用） */
export function getCameraHandlePositions(
  room: Room,
  cam: SecurityCamera,
): {
  rotate: { x: number; y: number };
  fovRange: { x: number; y: number };
  fovAngleLeft: { x: number; y: number };
  fovAngleRight: { x: number; y: number };
} {
  const { cx, cy } = cameraCenter(room, cam);
  const rangePx = cam.fovRange * GRID;

  const rotDist = rangePx * 0.7;
  const leftAngle = cam.angle - cam.fovAngle;
  const rightAngle = cam.angle + cam.fovAngle;

  return {
    rotate: {
      x: cx + Math.cos(cam.angle) * rotDist,
      y: cy + Math.sin(cam.angle) * rotDist,
    },
    fovRange: {
      x: cx + Math.cos(cam.angle) * rangePx,
      y: cy + Math.sin(cam.angle) * rangePx,
    },
    fovAngleLeft: {
      x: cx + Math.cos(leftAngle) * rangePx,
      y: cy + Math.sin(leftAngle) * rangePx,
    },
    fovAngleRight: {
      x: cx + Math.cos(rightAngle) * rangePx,
      y: cy + Math.sin(rightAngle) * rangePx,
    },
  };
}

/** カメラのFOVハンドルを描画 */
export function drawCameraHandles(
  ctx: CanvasRenderingContext2D,
  room: Room,
  cam: SecurityCamera,
  zoom: number,
): void {
  const handles = getCameraHandlePositions(room, cam);
  const size = HANDLE_SIZE / zoom;

  // 1. 回転ハンドル（丸）
  ctx.fillStyle = '#FF9800';
  ctx.beginPath();
  ctx.arc(handles.rotate.x, handles.rotate.y, size / 2, 0, Math.PI * 2);
  ctx.fill();

  // 2. 距離ハンドル（四角）
  ctx.fillStyle = '#4CAF50';
  ctx.fillRect(handles.fovRange.x - size / 2, handles.fovRange.y - size / 2, size, size);

  // 3. 広がりハンドル×2（ダイヤ）
  ctx.fillStyle = '#2196F3';
  drawDiamond(ctx, handles.fovAngleLeft.x, handles.fovAngleLeft.y, size);
  drawDiamond(ctx, handles.fovAngleRight.x, handles.fovAngleRight.y, size);
}

function drawDiamond(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
): void {
  const hs = size / 2;
  ctx.beginPath();
  ctx.moveTo(x, y - hs);
  ctx.lineTo(x + hs, y);
  ctx.lineTo(x, y + hs);
  ctx.lineTo(x - hs, y);
  ctx.closePath();
  ctx.fill();
}

/** カメラのハンドルのヒット判定 */
export function hitCameraHandle(
  room: Room,
  cam: SecurityCamera,
  px: number,
  py: number,
  zoom: number,
): CameraHandleHit | null {
  const handles = getCameraHandlePositions(room, cam);
  const tolerance = HANDLE_HIT / zoom;

  const isNear = (hx: number, hy: number) =>
    Math.abs(px - hx) < tolerance && Math.abs(py - hy) < tolerance;

  if (isNear(handles.rotate.x, handles.rotate.y)) return { type: 'rotate' };
  if (isNear(handles.fovRange.x, handles.fovRange.y)) return { type: 'fovRange' };
  if (isNear(handles.fovAngleLeft.x, handles.fovAngleLeft.y)) return { type: 'fovAngle' };
  if (isNear(handles.fovAngleRight.x, handles.fovAngleRight.y)) return { type: 'fovAngle' };

  return null;
}

/** 全部屋のカメラに対してハンドルヒット判定 */
export function hitCameraHandleInRooms(
  rooms: Room[],
  px: number,
  py: number,
  zoom: number,
  activeId?: string,
): { room: Room; cam: SecurityCamera; hit: CameraHandleHit } | null {
  for (let i = rooms.length - 1; i >= 0; i--) {
    const room = rooms[i];
    if (!room.interiorObjects?.length) continue;
    for (let j = room.interiorObjects.length - 1; j >= 0; j--) {
      const obj = room.interiorObjects[j];
      if (obj.type !== 'camera') continue;
      if (activeId && obj.id !== activeId) continue;
      const hit = hitCameraHandle(room, obj, px, py, zoom);
      if (hit) return { room, cam: obj, hit };
    }
  }
  return null;
}

/** カメラの回転計算: マウス位置からカメラ角度を計算 */
export function computeCameraAngle(
  room: Room,
  cam: SecurityCamera,
  px: number,
  py: number,
): number {
  const { cx, cy } = cameraCenter(room, cam);
  return Math.atan2(py - cy, px - cx);
}

/** FOV角度の計算: マウス位置からFOV半角を計算 */
export function computeCameraFovAngle(
  room: Room,
  cam: SecurityCamera,
  px: number,
  py: number,
): number {
  const { cx, cy } = cameraCenter(room, cam);
  const mouseAngle = Math.atan2(py - cy, px - cx);
  let diff = Math.abs(mouseAngle - cam.angle);
  // [-PI, PI] に正規化
  if (diff > Math.PI) diff = 2 * Math.PI - diff;
  // 最小5°、最大90°
  return Math.max(Math.PI / 36, Math.min(Math.PI / 2, diff));
}

/** FOV距離の計算: マウス位置からFOV距離を計算 */
export function computeCameraFovRange(
  room: Room,
  cam: SecurityCamera,
  px: number,
  py: number,
): number {
  const { cx, cy } = cameraCenter(room, cam);
  const dist = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
  // 最小1グリッド、最大20グリッド
  return Math.max(1, Math.min(20, dist / GRID));
}

/** roomId+objectIdからカメラを検索するヘルパー */
export function findCameraInRoom(
  rooms: Room[],
  roomId: string,
  objectId: string,
): { room: Room; cam: SecurityCamera } | null {
  const room = rooms.find((r) => r.id === roomId);
  if (!room) return null;
  const obj = room.interiorObjects?.find((o) => o.id === objectId);
  if (!obj || obj.type !== 'camera') return null;
  return { room, cam: obj };
}
