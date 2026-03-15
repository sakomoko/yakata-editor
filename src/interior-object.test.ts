import { describe, it, expect } from 'vitest';
import type { Room } from './types.ts';
import {
  createStraightStairs,
  createFoldingStairs,
  interiorObjectToPixelRect,
  hitInteriorObject,
  hitInteriorObjectInRooms,
  clampInteriorObject,
  clampAllInteriorObjects,
  computeInteriorObjectMove,
  computeInteriorObjectResize,
} from './interior-object.ts';
import { GRID } from './grid.ts';

function makeRoom(overrides: Partial<Room> = {}): Room {
  return { id: 'room-1', x: 5, y: 5, w: 10, h: 10, label: '', ...overrides };
}

describe('createStraightStairs', () => {
  it('デフォルト値で階段を生成する', () => {
    const stairs = createStraightStairs(1, 2);
    expect(stairs.type).toBe('stairs');
    expect(stairs.stairsType).toBe('straight');
    expect(stairs.x).toBe(1);
    expect(stairs.y).toBe(2);
    expect(stairs.w).toBe(2);
    expect(stairs.h).toBe(3);
    expect(stairs.direction).toBe('n');
    expect(stairs.id).toBeTruthy();
  });

  it('カスタムサイズと方向で生成する', () => {
    const stairs = createStraightStairs(0, 0, 3, 4, 'e');
    expect(stairs.w).toBe(3);
    expect(stairs.h).toBe(4);
    expect(stairs.direction).toBe('e');
  });
});

describe('createFoldingStairs', () => {
  it('デフォルト値で折り返し階段を生成する', () => {
    const stairs = createFoldingStairs(1, 2);
    expect(stairs.type).toBe('stairs');
    expect(stairs.stairsType).toBe('folding');
    expect(stairs.x).toBe(1);
    expect(stairs.y).toBe(2);
    expect(stairs.w).toBe(4);
    expect(stairs.h).toBe(3);
    expect(stairs.direction).toBe('n');
    expect(stairs.id).toBeTruthy();
  });

  it('カスタムサイズと方向で生成する', () => {
    const stairs = createFoldingStairs(0, 0, 6, 4, 'w');
    expect(stairs.w).toBe(6);
    expect(stairs.h).toBe(4);
    expect(stairs.direction).toBe('w');
    expect(stairs.stairsType).toBe('folding');
  });
});

describe('interiorObjectToPixelRect', () => {
  it('部屋座標を考慮してピクセル座標に変換する', () => {
    const room = makeRoom({ x: 5, y: 10 });
    const obj = createStraightStairs(2, 3, 2, 3);
    const rect = interiorObjectToPixelRect(room, obj);
    expect(rect.x).toBe((5 + 2) * GRID);
    expect(rect.y).toBe((10 + 3) * GRID);
    expect(rect.w).toBe(2 * GRID);
    expect(rect.h).toBe(3 * GRID);
  });
});

describe('hitInteriorObject', () => {
  it('オブジェクト内部をヒットする', () => {
    const room = makeRoom();
    const stairs = createStraightStairs(1, 1, 2, 3);
    room.interiorObjects = [stairs];
    const px = (room.x + 2) * GRID;
    const py = (room.y + 2) * GRID;
    expect(hitInteriorObject(room, px, py)).toBe(stairs);
  });

  it('オブジェクト外部はヒットしない', () => {
    const room = makeRoom();
    const stairs = createStraightStairs(1, 1, 2, 3);
    room.interiorObjects = [stairs];
    const px = (room.x + 0) * GRID;
    const py = (room.y + 0) * GRID;
    expect(hitInteriorObject(room, px, py)).toBeNull();
  });

  it('interiorObjectsがない場合はnull', () => {
    const room = makeRoom();
    expect(hitInteriorObject(room, 0, 0)).toBeNull();
  });
});

describe('hitInteriorObjectInRooms', () => {
  it('z-order考慮で後の部屋を優先する', () => {
    const room1 = makeRoom({ id: 'r1', x: 0, y: 0 });
    const room2 = makeRoom({ id: 'r2', x: 0, y: 0 });
    const s1 = createStraightStairs(0, 0, 2, 2);
    const s2 = createStraightStairs(0, 0, 2, 2);
    room1.interiorObjects = [s1];
    room2.interiorObjects = [s2];
    const hit = hitInteriorObjectInRooms([room1, room2], GRID, GRID);
    expect(hit?.room.id).toBe('r2');
    expect(hit?.obj.id).toBe(s2.id);
  });
});

describe('clampInteriorObject', () => {
  it('部屋の右端を超えるオブジェクトをクランプする', () => {
    const room = makeRoom({ w: 5, h: 5 });
    const obj = createStraightStairs(4, 0, 2, 3);
    clampInteriorObject(room, obj);
    expect(obj.x).toBe(3); // 5 - 2
  });

  it('部屋の下端を超えるオブジェクトをクランプする', () => {
    const room = makeRoom({ w: 5, h: 5 });
    const obj = createStraightStairs(0, 4, 2, 3);
    clampInteriorObject(room, obj);
    expect(obj.y).toBe(2); // 5 - 3
  });

  it('部屋より大きいオブジェクトを縮小する', () => {
    const room = makeRoom({ w: 3, h: 3 });
    const obj = createStraightStairs(0, 0, 5, 5);
    clampInteriorObject(room, obj);
    expect(obj.w).toBe(3);
    expect(obj.h).toBe(3);
    expect(obj.x).toBe(0);
    expect(obj.y).toBe(0);
  });
});

describe('clampAllInteriorObjects', () => {
  it('全オブジェクトをクランプする', () => {
    const room = makeRoom({ w: 5, h: 5 });
    const s1 = createStraightStairs(4, 0, 2, 3);
    const s2 = createStraightStairs(0, 4, 2, 3);
    room.interiorObjects = [s1, s2];
    clampAllInteriorObjects(room);
    expect(s1.x).toBe(3);
    expect(s2.y).toBe(2);
  });
});

describe('computeInteriorObjectMove', () => {
  it('移動座標を計算する', () => {
    const room = makeRoom({ x: 5, y: 5, w: 10, h: 10 });
    const obj = createStraightStairs(1, 1, 2, 3);
    const result = computeInteriorObjectMove(room, obj, 8, 9, 1, 1);
    expect(result.x).toBe(2); // 8 - 5 - 1
    expect(result.y).toBe(3); // 9 - 5 - 1
  });

  it('部屋境界内に制約する', () => {
    const room = makeRoom({ x: 0, y: 0, w: 5, h: 5 });
    const obj = createStraightStairs(0, 0, 2, 3);
    const result = computeInteriorObjectMove(room, obj, -1, -1, 0, 0);
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
  });

  it('右下端でも制約する', () => {
    const room = makeRoom({ x: 0, y: 0, w: 5, h: 5 });
    const obj = createStraightStairs(0, 0, 2, 3);
    const result = computeInteriorObjectMove(room, obj, 10, 10, 0, 0);
    expect(result.x).toBe(3); // 5 - 2
    expect(result.y).toBe(2); // 5 - 3
  });
});

describe('computeInteriorObjectResize', () => {
  it('SE方向にリサイズする', () => {
    const room = makeRoom({ x: 0, y: 0, w: 10, h: 10 });
    const orig = { x: 1, y: 1, w: 2, h: 3 };
    const result = computeInteriorObjectResize(room, 'se', orig, 5, 6);
    expect(result.x).toBe(1);
    expect(result.y).toBe(1);
    expect(result.w).toBe(4); // 5 - 1
    expect(result.h).toBe(5); // 6 - 1
  });

  it('NW方向にリサイズする', () => {
    const room = makeRoom({ x: 0, y: 0, w: 10, h: 10 });
    const orig = { x: 3, y: 3, w: 3, h: 3 };
    const result = computeInteriorObjectResize(room, 'nw', orig, 1, 1);
    expect(result.x).toBe(1);
    expect(result.y).toBe(1);
    expect(result.w).toBe(5); // 3 + 3 - 1
    expect(result.h).toBe(5); // 3 + 3 - 1
  });

  it('最小サイズ1×1を保つ', () => {
    const room = makeRoom({ x: 0, y: 0, w: 10, h: 10 });
    const orig = { x: 3, y: 3, w: 2, h: 2 };
    const result = computeInteriorObjectResize(room, 'nw', orig, 10, 10);
    expect(result.w).toBeGreaterThanOrEqual(1);
    expect(result.h).toBeGreaterThanOrEqual(1);
  });

  it('部屋境界を超えない', () => {
    const room = makeRoom({ x: 0, y: 0, w: 5, h: 5 });
    const orig = { x: 2, y: 2, w: 2, h: 2 };
    const result = computeInteriorObjectResize(room, 'se', orig, 10, 10);
    expect(result.x + result.w).toBeLessThanOrEqual(5);
    expect(result.y + result.h).toBeLessThanOrEqual(5);
  });
});
