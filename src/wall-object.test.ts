import { describe, it, expect } from 'vitest';
import { createRoom } from './room.ts';
import {
  createWallWindow,
  wallSideLength,
  clampWallObjects,
  wallObjectToPixelRect,
  getWallSegments,
  hitWallObject,
  hitWallObjectInRooms,
  nearestWallSide,
  computeWallObjectPosition,
} from './wall-object.ts';
import { GRID } from './grid.ts';

describe('createWallWindow', () => {
  it('デフォルト幅1の窓を生成する', () => {
    const win = createWallWindow('n', 2);
    expect(win.type).toBe('window');
    expect(win.side).toBe('n');
    expect(win.offset).toBe(2);
    expect(win.width).toBe(1);
    expect(win.id).toBeTruthy();
  });

  it('幅を指定して窓を生成する', () => {
    const win = createWallWindow('e', 0, 3);
    expect(win.width).toBe(3);
  });
});

describe('wallSideLength', () => {
  it('北/南は部屋の幅を返す', () => {
    const room = createRoom(0, 0, 5, 3);
    expect(wallSideLength(room, 'n')).toBe(5);
    expect(wallSideLength(room, 's')).toBe(5);
  });

  it('東/西は部屋の高さを返す', () => {
    const room = createRoom(0, 0, 5, 3);
    expect(wallSideLength(room, 'w')).toBe(3);
    expect(wallSideLength(room, 'e')).toBe(3);
  });
});

describe('clampWallObjects', () => {
  it('はみ出した窓をクランプする', () => {
    const room = createRoom(0, 0, 3, 3);
    const win = createWallWindow('n', 4, 1);
    room.wallObjects = [win];
    clampWallObjects(room);
    expect(win.offset).toBe(2);
  });

  it('収まっている窓はそのまま', () => {
    const room = createRoom(0, 0, 5, 5);
    const win = createWallWindow('n', 2, 1);
    room.wallObjects = [win];
    clampWallObjects(room);
    expect(win.offset).toBe(2);
  });

  it('wallObjectsがundefinedでもエラーにならない', () => {
    const room = createRoom(0, 0, 3, 3);
    expect(() => clampWallObjects(room)).not.toThrow();
  });
});

describe('wallObjectToPixelRect', () => {
  const room = createRoom(5, 10, 4, 3);

  it('北壁の窓のピクセル座標を返す', () => {
    const win = createWallWindow('n', 1, 2);
    const rect = wallObjectToPixelRect(room, win);
    expect(rect).toEqual({
      x: (5 + 1) * GRID,
      y: 10 * GRID,
      length: 2 * GRID,
      horizontal: true,
    });
  });

  it('南壁の窓のピクセル座標を返す', () => {
    const win = createWallWindow('s', 0, 1);
    const rect = wallObjectToPixelRect(room, win);
    expect(rect).toEqual({
      x: 5 * GRID,
      y: (10 + 3) * GRID,
      length: 1 * GRID,
      horizontal: true,
    });
  });

  it('西壁の窓のピクセル座標を返す', () => {
    const win = createWallWindow('w', 1, 1);
    const rect = wallObjectToPixelRect(room, win);
    expect(rect).toEqual({
      x: 5 * GRID,
      y: (10 + 1) * GRID,
      length: 1 * GRID,
      horizontal: false,
    });
  });

  it('東壁の窓のピクセル座標を返す', () => {
    const win = createWallWindow('e', 0, 2);
    const rect = wallObjectToPixelRect(room, win);
    expect(rect).toEqual({
      x: (5 + 4) * GRID,
      y: 10 * GRID,
      length: 2 * GRID,
      horizontal: false,
    });
  });
});

describe('getWallSegments', () => {
  it('窓がない場合は壁全体を1セグメントで返す', () => {
    const room = createRoom(0, 0, 5, 3);
    expect(getWallSegments(room, 'n')).toEqual([{ start: 0, end: 5 * GRID }]);
  });

  it('窓が中央にある場合、両端のセグメントを返す', () => {
    const room = createRoom(0, 0, 5, 3);
    room.wallObjects = [createWallWindow('n', 2, 1)];
    expect(getWallSegments(room, 'n')).toEqual([
      { start: 0, end: 2 * GRID },
      { start: 3 * GRID, end: 5 * GRID },
    ]);
  });

  it('窓が壁の先頭にある場合', () => {
    const room = createRoom(0, 0, 5, 3);
    room.wallObjects = [createWallWindow('n', 0, 1)];
    expect(getWallSegments(room, 'n')).toEqual([{ start: 1 * GRID, end: 5 * GRID }]);
  });

  it('窓が壁の末尾にある場合', () => {
    const room = createRoom(0, 0, 5, 3);
    room.wallObjects = [createWallWindow('n', 4, 1)];
    expect(getWallSegments(room, 'n')).toEqual([{ start: 0, end: 4 * GRID }]);
  });

  it('複数の窓がある場合', () => {
    const room = createRoom(0, 0, 10, 3);
    room.wallObjects = [createWallWindow('n', 1, 1), createWallWindow('n', 5, 2)];
    expect(getWallSegments(room, 'n')).toEqual([
      { start: 0, end: 1 * GRID },
      { start: 2 * GRID, end: 5 * GRID },
      { start: 7 * GRID, end: 10 * GRID },
    ]);
  });

  it('別の辺の窓は無視される', () => {
    const room = createRoom(0, 0, 5, 3);
    room.wallObjects = [createWallWindow('s', 2, 1)];
    expect(getWallSegments(room, 'n')).toEqual([{ start: 0, end: 5 * GRID }]);
  });
});

describe('hitWallObject', () => {
  it('北壁の窓にヒットする', () => {
    const room = createRoom(0, 0, 5, 3);
    const win = createWallWindow('n', 2, 1);
    room.wallObjects = [win];
    const hit = hitWallObject(room, 2.5 * GRID, 0, 1);
    expect(hit).toBe(win);
  });

  it('窓から離れた位置ではヒットしない', () => {
    const room = createRoom(0, 0, 5, 3);
    room.wallObjects = [createWallWindow('n', 2, 1)];
    const hit = hitWallObject(room, 2.5 * GRID, GRID, 1);
    expect(hit).toBeNull();
  });

  it('窓の範囲外のx座標ではヒットしない', () => {
    const room = createRoom(0, 0, 5, 3);
    room.wallObjects = [createWallWindow('n', 2, 1)];
    const hit = hitWallObject(room, 0.5 * GRID, 0, 1);
    expect(hit).toBeNull();
  });

  it('東壁の窓にヒットする', () => {
    const room = createRoom(0, 0, 5, 3);
    const win = createWallWindow('e', 1, 1);
    room.wallObjects = [win];
    const hit = hitWallObject(room, 5 * GRID, 1.5 * GRID, 1);
    expect(hit).toBe(win);
  });

  it('wallObjectsがないとnullを返す', () => {
    const room = createRoom(0, 0, 5, 3);
    expect(hitWallObject(room, 0, 0, 1)).toBeNull();
  });
});

describe('hitWallObjectInRooms', () => {
  it('z-orderで上にある部屋の窓を優先する', () => {
    const room1 = createRoom(0, 0, 5, 5);
    const win1 = createWallWindow('n', 2, 1);
    room1.wallObjects = [win1];

    const room2 = createRoom(0, 0, 5, 5);
    const win2 = createWallWindow('n', 2, 1);
    room2.wallObjects = [win2];

    const result = hitWallObjectInRooms([room1, room2], 2.5 * GRID, 0, 1);
    expect(result?.obj).toBe(win2);
    expect(result?.room).toBe(room2);
  });

  it('ヒットしない場合はnullを返す', () => {
    const room = createRoom(0, 0, 5, 5);
    expect(hitWallObjectInRooms([room], GRID, GRID, 1)).toBeNull();
  });
});

describe('nearestWallSide', () => {
  it('北壁に最も近い場合', () => {
    const room = createRoom(0, 0, 5, 5);
    const result = nearestWallSide(room, 2.5 * GRID, 0.1 * GRID);
    expect(result.side).toBe('n');
  });

  it('南壁に最も近い場合', () => {
    const room = createRoom(0, 0, 5, 5);
    const result = nearestWallSide(room, 2.5 * GRID, 4.9 * GRID);
    expect(result.side).toBe('s');
  });

  it('西壁に最も近い場合', () => {
    const room = createRoom(0, 0, 5, 5);
    const result = nearestWallSide(room, 0.1 * GRID, 2.5 * GRID);
    expect(result.side).toBe('w');
  });

  it('東壁に最も近い場合', () => {
    const room = createRoom(0, 0, 5, 5);
    const result = nearestWallSide(room, 4.9 * GRID, 2.5 * GRID);
    expect(result.side).toBe('e');
  });

  it('オフセットが壁の範囲内にクランプされる', () => {
    const room = createRoom(0, 0, 3, 3);
    const result = nearestWallSide(room, 10 * GRID, 0);
    expect(result.offset).toBeLessThanOrEqual(2);
    expect(result.offset).toBeGreaterThanOrEqual(0);
  });
});

describe('computeWallObjectPosition', () => {
  it('北壁に近い位置ではside=nを返す', () => {
    const room = createRoom(0, 0, 10, 10);
    const result = computeWallObjectPosition(room, 5 * GRID, 0.5 * GRID, 1);
    expect(result.side).toBe('n');
  });

  it('マウス位置に基づいてオフセットを計算する', () => {
    const room = createRoom(0, 0, 10, 10);
    const result = computeWallObjectPosition(room, 5 * GRID, 0.5 * GRID, 1);
    expect(result.offset).toBe(5);
  });

  it('幅2のオブジェクトはマウス位置を中心にオフセットする', () => {
    const room = createRoom(0, 0, 10, 10);
    const result = computeWallObjectPosition(room, 5 * GRID, 0.5 * GRID, 2);
    expect(result.offset).toBe(4);
  });

  it('北壁から東壁へ移動できる', () => {
    const room = createRoom(0, 0, 10, 10);
    const result = computeWallObjectPosition(room, 9.5 * GRID, 5 * GRID, 1);
    expect(result.side).toBe('e');
    expect(result.offset).toBe(5);
  });

  it('西壁から南壁へ移動できる', () => {
    const room = createRoom(0, 0, 10, 10);
    const result = computeWallObjectPosition(room, 5 * GRID, 9.5 * GRID, 1);
    expect(result.side).toBe('s');
    expect(result.offset).toBe(5);
  });

  it('オフセットが0未満にならない', () => {
    const room = createRoom(5, 5, 10, 10);
    const result = computeWallObjectPosition(room, 5.1 * GRID, 5.1 * GRID, 2);
    expect(result.side).toBe('n');
    expect(result.offset).toBe(0);
  });

  it('オフセットが壁の長さ-幅を超えない', () => {
    const room = createRoom(0, 0, 5, 5);
    const result = computeWallObjectPosition(room, 20 * GRID, 0.1 * GRID, 2);
    expect(result.side).toBe('n');
    expect(result.offset).toBe(3);
  });

  it('オフセット付きの部屋でも正しく計算する', () => {
    const room = createRoom(10, 10, 5, 5);
    const result = computeWallObjectPosition(room, 12 * GRID, 10.1 * GRID, 1);
    expect(result.side).toBe('n');
    expect(result.offset).toBe(2);
  });
});
