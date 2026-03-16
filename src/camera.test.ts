import { describe, it, expect } from 'vitest';
import type { Room, SecurityCamera } from './types.ts';
import {
  createSecurityCamera,
  computeCameraAngle,
  computeCameraFovAngle,
  computeCameraFovRange,
  hitCameraHandle,
  hitCameraHandleInRooms,
  getCameraHandlePositions,
  findCameraInRoom,
} from './camera.ts';
import { GRID } from './grid.ts';

function makeRoom(x = 0, y = 0, w = 5, h = 5): Room {
  return { id: 'room-1', x, y, w, h, label: '' };
}

function makeCam(overrides: Partial<SecurityCamera> = {}): SecurityCamera {
  return {
    id: 'cam-1',
    type: 'camera',
    x: 2,
    y: 2,
    w: 1,
    h: 1,
    angle: 0,
    fovAngle: Math.PI / 6,
    fovRange: 5,
    fovColor: 'rgba(0,150,255,0.15)',
    fovStrokeColor: 'rgba(0,150,255,0.4)',
    ...overrides,
  };
}

describe('createSecurityCamera', () => {
  it('creates a camera with default properties', () => {
    const cam = createSecurityCamera(1, 2);
    expect(cam.type).toBe('camera');
    expect(cam.x).toBe(1);
    expect(cam.y).toBe(2);
    expect(cam.w).toBe(1);
    expect(cam.h).toBe(1);
    expect(cam.angle).toBe(0);
    expect(cam.fovAngle).toBeCloseTo(Math.PI / 6);
    expect(cam.fovRange).toBe(5);
    expect(cam.fovColor).toBe('rgba(0,150,255,0.15)');
    expect(cam.fovStrokeColor).toBe('rgba(0,150,255,0.4)');
    expect(cam.id).toBeTruthy();
  });

  it('creates a camera with custom angle', () => {
    const cam = createSecurityCamera(0, 0, Math.PI / 2);
    expect(cam.angle).toBeCloseTo(Math.PI / 2);
  });

  it('creates unique IDs', () => {
    const cam1 = createSecurityCamera(0, 0);
    const cam2 = createSecurityCamera(0, 0);
    expect(cam1.id).not.toBe(cam2.id);
  });
});

describe('computeCameraAngle', () => {
  it('returns 0 when mouse is directly to the right', () => {
    const room = makeRoom();
    const cam = makeCam();
    // カメラ中心: (2.5, 2.5) * GRID = (50, 50)
    const angle = computeCameraAngle(room, cam, 50 + 100, 50);
    expect(angle).toBeCloseTo(0);
  });

  it('returns PI/2 when mouse is directly below', () => {
    const room = makeRoom();
    const cam = makeCam();
    const cx = (room.x + cam.x + cam.w / 2) * GRID;
    const cy = (room.y + cam.y + cam.h / 2) * GRID;
    const angle = computeCameraAngle(room, cam, cx, cy + 100);
    expect(angle).toBeCloseTo(Math.PI / 2);
  });

  it('returns -PI/2 when mouse is directly above', () => {
    const room = makeRoom();
    const cam = makeCam();
    const cx = (room.x + cam.x + cam.w / 2) * GRID;
    const cy = (room.y + cam.y + cam.h / 2) * GRID;
    const angle = computeCameraAngle(room, cam, cx, cy - 100);
    expect(angle).toBeCloseTo(-Math.PI / 2);
  });
});

describe('computeCameraFovAngle', () => {
  it('returns angle difference between mouse and camera direction', () => {
    const room = makeRoom();
    const cam = makeCam({ angle: 0 });
    const cx = (room.x + cam.x + cam.w / 2) * GRID;
    const cy = (room.y + cam.y + cam.h / 2) * GRID;
    // マウスを30°の位置に置く
    const dist = 100;
    const result = computeCameraFovAngle(
      room,
      cam,
      cx + dist * Math.cos(Math.PI / 6),
      cy + dist * Math.sin(Math.PI / 6),
    );
    expect(result).toBeCloseTo(Math.PI / 6);
  });

  it('clamps to minimum 5 degrees', () => {
    const room = makeRoom();
    const cam = makeCam({ angle: 0 });
    const cx = (room.x + cam.x + cam.w / 2) * GRID;
    const cy = (room.y + cam.y + cam.h / 2) * GRID;
    // マウスをカメラ角度とほぼ同じ方向に
    const result = computeCameraFovAngle(room, cam, cx + 100, cy);
    expect(result).toBeCloseTo(Math.PI / 36);
  });

  it('clamps to maximum 90 degrees', () => {
    const room = makeRoom();
    const cam = makeCam({ angle: 0 });
    const cx = (room.x + cam.x + cam.w / 2) * GRID;
    const cy = (room.y + cam.y + cam.h / 2) * GRID;
    // マウスを真反対の方向に
    const result = computeCameraFovAngle(room, cam, cx - 100, cy);
    expect(result).toBeCloseTo(Math.PI / 2);
  });

  it('handles angle wrapping around PI correctly', () => {
    const room = makeRoom();
    // カメラ angle が PI 近辺のとき、マウスが -PI 近辺でも正しく差分を計算
    const cam = makeCam({ angle: Math.PI * 0.9 });
    const cx = (room.x + cam.x + cam.w / 2) * GRID;
    const cy = (room.y + cam.y + cam.h / 2) * GRID;
    // マウスを angle + 0.2 ラジアンの位置に（PI をまたぐ）
    const mouseAngle = Math.PI * 0.9 + 0.2;
    const result = computeCameraFovAngle(
      room,
      cam,
      cx + 100 * Math.cos(mouseAngle),
      cy + 100 * Math.sin(mouseAngle),
    );
    expect(result).toBeCloseTo(0.2, 1);
  });
});

describe('computeCameraFovRange', () => {
  it('returns distance in grid units', () => {
    const room = makeRoom();
    const cam = makeCam();
    const cx = (room.x + cam.x + cam.w / 2) * GRID;
    const cy = (room.y + cam.y + cam.h / 2) * GRID;
    // 3グリッド分右
    const result = computeCameraFovRange(room, cam, cx + 3 * GRID, cy);
    expect(result).toBeCloseTo(3);
  });

  it('clamps to minimum 1 grid', () => {
    const room = makeRoom();
    const cam = makeCam();
    const cx = (room.x + cam.x + cam.w / 2) * GRID;
    const cy = (room.y + cam.y + cam.h / 2) * GRID;
    // 距離ほぼ0
    const result = computeCameraFovRange(room, cam, cx + 1, cy);
    expect(result).toBe(1);
  });

  it('clamps to maximum 20 grids', () => {
    const room = makeRoom();
    const cam = makeCam();
    const cx = (room.x + cam.x + cam.w / 2) * GRID;
    const cy = (room.y + cam.y + cam.h / 2) * GRID;
    // 30グリッド分右
    const result = computeCameraFovRange(room, cam, cx + 30 * GRID, cy);
    expect(result).toBe(20);
  });
});

describe('getCameraHandlePositions', () => {
  it('returns handle positions based on camera angle and fov', () => {
    const room = makeRoom();
    const cam = makeCam({ angle: 0, fovAngle: Math.PI / 6, fovRange: 5 });
    const handles = getCameraHandlePositions(room, cam);
    const cx = (room.x + cam.x + cam.w / 2) * GRID;
    const cy = (room.y + cam.y + cam.h / 2) * GRID;
    const rangePx = 5 * GRID;

    // 回転ハンドル: GRID * 2 の固定位置
    expect(handles.rotate.x).toBeCloseTo(cx + GRID * 2);
    expect(handles.rotate.y).toBeCloseTo(cy);

    // 距離ハンドル: range の位置
    expect(handles.fovRange.x).toBeCloseTo(cx + rangePx);
    expect(handles.fovRange.y).toBeCloseTo(cy);
  });
});

describe('hitCameraHandle', () => {
  it('detects rotate handle hit', () => {
    const room = makeRoom();
    const cam = makeCam({ angle: 0, fovRange: 5 });
    const handles = getCameraHandlePositions(room, cam);
    const hit = hitCameraHandle(room, cam, handles.rotate.x, handles.rotate.y, 1);
    expect(hit).toEqual({ type: 'rotate' });
  });

  it('detects fovRange handle hit', () => {
    const room = makeRoom();
    const cam = makeCam({ angle: 0, fovRange: 5 });
    const handles = getCameraHandlePositions(room, cam);
    const hit = hitCameraHandle(room, cam, handles.fovRange.x, handles.fovRange.y, 1);
    expect(hit).toEqual({ type: 'fovRange' });
  });

  it('detects fovAngle handle hit (left)', () => {
    const room = makeRoom();
    const cam = makeCam({ angle: 0, fovAngle: Math.PI / 6, fovRange: 5 });
    const handles = getCameraHandlePositions(room, cam);
    const hit = hitCameraHandle(room, cam, handles.fovAngleLeft.x, handles.fovAngleLeft.y, 1);
    expect(hit).toEqual({ type: 'fovAngle' });
  });

  it('detects fovAngle handle hit (right)', () => {
    const room = makeRoom();
    const cam = makeCam({ angle: 0, fovAngle: Math.PI / 6, fovRange: 5 });
    const handles = getCameraHandlePositions(room, cam);
    const hit = hitCameraHandle(room, cam, handles.fovAngleRight.x, handles.fovAngleRight.y, 1);
    expect(hit).toEqual({ type: 'fovAngle' });
  });

  it('returns null when no handle is hit', () => {
    const room = makeRoom();
    const cam = makeCam();
    const hit = hitCameraHandle(room, cam, 0, 0, 1);
    expect(hit).toBeNull();
  });
});

describe('hitCameraHandleInRooms', () => {
  it('detects handle hit across multiple rooms', () => {
    const cam1 = makeCam({ id: 'cam-1' });
    const cam2 = makeCam({ id: 'cam-2', x: 1, y: 1 });
    const room1: Room = { ...makeRoom(), id: 'room-1', interiorObjects: [cam1] };
    const room2: Room = { ...makeRoom(), id: 'room-2', x: 10, y: 0, interiorObjects: [cam2] };
    const handles = getCameraHandlePositions(room1, cam1);

    const result = hitCameraHandleInRooms([room1, room2], handles.rotate.x, handles.rotate.y, 1);
    expect(result).not.toBeNull();
    expect(result!.cam.id).toBe('cam-1');
    expect(result!.hit.type).toBe('rotate');
  });

  it('filters by activeId when provided', () => {
    const cam1 = makeCam({ id: 'cam-1', x: 0, y: 0 });
    const cam2 = makeCam({ id: 'cam-2', x: 3, y: 3 });
    const room: Room = { ...makeRoom(), interiorObjects: [cam1, cam2] };
    const handles1 = getCameraHandlePositions(room, cam1);

    // cam1のハンドル位置だがactiveIdがcam-2なのでヒットしない
    const result = hitCameraHandleInRooms(
      [room],
      handles1.rotate.x,
      handles1.rotate.y,
      1,
      'cam-2',
    );
    expect(result).toBeNull();
  });

  it('skips rooms with no interiorObjects', () => {
    const emptyRoom: Room = makeRoom();
    const cam = makeCam();
    const roomWithCam: Room = { ...makeRoom(), id: 'room-2', interiorObjects: [cam] };
    const handles = getCameraHandlePositions(roomWithCam, cam);

    const result = hitCameraHandleInRooms(
      [emptyRoom, roomWithCam],
      handles.rotate.x,
      handles.rotate.y,
      1,
    );
    expect(result).not.toBeNull();
    expect(result!.room.id).toBe('room-2');
  });

  it('returns null when no handles are hit', () => {
    const cam = makeCam();
    const room: Room = { ...makeRoom(), interiorObjects: [cam] };
    const result = hitCameraHandleInRooms([room], 9999, 9999, 1);
    expect(result).toBeNull();
  });
});

describe('findCameraInRoom', () => {
  it('finds a camera by roomId and objectId', () => {
    const cam = makeCam();
    const room: Room = { ...makeRoom(), interiorObjects: [cam] };
    const result = findCameraInRoom([room], room.id, cam.id);
    expect(result).not.toBeNull();
    expect(result!.room.id).toBe(room.id);
    expect(result!.cam.id).toBe(cam.id);
  });

  it('returns null for non-existent roomId', () => {
    const cam = makeCam();
    const room: Room = { ...makeRoom(), interiorObjects: [cam] };
    const result = findCameraInRoom([room], 'non-existent', cam.id);
    expect(result).toBeNull();
  });

  it('returns null for non-existent objectId', () => {
    const cam = makeCam();
    const room: Room = { ...makeRoom(), interiorObjects: [cam] };
    const result = findCameraInRoom([room], room.id, 'non-existent');
    expect(result).toBeNull();
  });

  it('returns null when objectId matches a non-camera object', () => {
    const stairs = {
      id: 'stairs-1',
      type: 'stairs' as const,
      stairsType: 'straight' as const,
      direction: 'n' as const,
      x: 0,
      y: 0,
      w: 2,
      h: 2,
    };
    const room: Room = { ...makeRoom(), interiorObjects: [stairs] };
    const result = findCameraInRoom([room], room.id, stairs.id);
    expect(result).toBeNull();
  });

  it('returns null when room has no interiorObjects', () => {
    const room = makeRoom();
    const result = findCameraInRoom([room], room.id, 'any-id');
    expect(result).toBeNull();
  });
});
