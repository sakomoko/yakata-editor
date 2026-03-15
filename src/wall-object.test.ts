import { describe, it, expect } from 'vitest';
import { createRoom } from './room.ts';
import {
  createWallWindow,
  createWallDoor,
  createWallOpening,
  wallSideLength,
  clampWallObjects,
  wallObjectToPixelRect,
  getWallSegments,
  hitWallObject,
  hitWallObjectInRooms,
  hitWallObjectEdge,
  hitWallObjectEdgeInRooms,
  wouldOverlap,
  computeWallObjectResize,
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

  it('skipAutoGenerated=trueでautoGenerated開口をスキップする', () => {
    const room = createRoom(0, 0, 5, 3);
    const opening = createWallOpening('n', 2, 1);
    opening.autoGenerated = true;
    room.wallObjects = [opening];
    // skipAutoGenerated=false（デフォルト）ではヒットする
    expect(hitWallObject(room, 2.5 * GRID, 0, 1)).toBe(opening);
    // skipAutoGenerated=trueではスキップされる
    expect(hitWallObject(room, 2.5 * GRID, 0, 1, true)).toBeNull();
  });

  it('skipAutoGenerated=trueでも通常の開口はヒットする', () => {
    const room = createRoom(0, 0, 5, 3);
    const opening = createWallOpening('n', 2, 1);
    room.wallObjects = [opening];
    expect(hitWallObject(room, 2.5 * GRID, 0, 1, true)).toBe(opening);
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

  it('東壁から西壁へ移動できる', () => {
    const room = createRoom(0, 0, 10, 10);
    const result = computeWallObjectPosition(room, 0.5 * GRID, 5 * GRID, 1);
    expect(result.side).toBe('w');
    expect(result.offset).toBe(5);
  });

  it('オフセット付きの部屋でも正しく計算する', () => {
    const room = createRoom(10, 10, 5, 5);
    const result = computeWallObjectPosition(room, 12 * GRID, 10.1 * GRID, 1);
    expect(result.side).toBe('n');
    expect(result.offset).toBe(2);
  });
});

describe('createWallDoor', () => {
  it('デフォルト幅1・内開きのドアを生成する', () => {
    const door = createWallDoor('n', 2);
    expect(door.type).toBe('door');
    expect(door.side).toBe('n');
    expect(door.offset).toBe(2);
    expect(door.width).toBe(1);
    expect(door.swing).toBe('inward');
    expect(door.id).toBeTruthy();
  });

  it('幅とswingを指定してドアを生成する', () => {
    const door = createWallDoor('s', 1, 2, 'outward');
    expect(door.width).toBe(2);
    expect(door.swing).toBe('outward');
  });
});

describe('ドアとwindowのオーバーラップ検出', () => {
  it('同じ壁上でドアと窓が重なる場合を検出できる', () => {
    const room = createRoom(0, 0, 10, 10);
    const win = createWallWindow('n', 2, 1);
    const door = createWallDoor('n', 2, 1);
    room.wallObjects = [win];

    const hasOverlap = room.wallObjects.some(
      (o) =>
        o.side === door.side &&
        door.offset < o.offset + o.width &&
        door.offset + door.width > o.offset,
    );
    expect(hasOverlap).toBe(true);
  });

  it('同じ壁上で重ならない場合はfalse', () => {
    const room = createRoom(0, 0, 10, 10);
    const win = createWallWindow('n', 0, 1);
    const door = createWallDoor('n', 5, 1);
    room.wallObjects = [win];

    const hasOverlap = room.wallObjects.some(
      (o) =>
        o.side === door.side &&
        door.offset < o.offset + o.width &&
        door.offset + door.width > o.offset,
    );
    expect(hasOverlap).toBe(false);
  });
});

describe('ドアのヒット判定', () => {
  it('北壁のドアに壁線上でヒットする', () => {
    const room = createRoom(0, 0, 5, 3);
    const door = createWallDoor('n', 2, 1);
    room.wallObjects = [door];
    const hit = hitWallObject(room, 2.5 * GRID, 0, 1);
    expect(hit).toBe(door);
  });

  it('西壁のドアに壁線上でヒットする', () => {
    const room = createRoom(0, 0, 5, 5);
    const door = createWallDoor('w', 2, 1);
    room.wallObjects = [door];
    const hit = hitWallObject(room, 0, 2.5 * GRID, 1);
    expect(hit).toBe(door);
  });

  it('北壁・内開きドアの弧上でヒットする', () => {
    // 北壁 offset=2, width=1 → ヒンジ=(2*GRID, 0), radius=GRID
    // inward: openAngle=π/2 → 弧は右(0)から下(π/2)へ
    // 弧上の点: ヒンジから角度π/4の位置 (右下45度)
    const room = createRoom(0, 0, 5, 5);
    const door = createWallDoor('n', 2, 1, 'inward');
    room.wallObjects = [door];
    const arcX = 2 * GRID + Math.cos(Math.PI / 4) * GRID;
    const arcY = 0 + Math.sin(Math.PI / 4) * GRID;
    const hit = hitWallObject(room, arcX, arcY, 1);
    expect(hit).toBe(door);
  });

  it('北壁・外開きドアの弧上でヒットする', () => {
    // outward: openAngle=-π/2 → 弧は右(0)から上(-π/2)へ
    const room = createRoom(0, 0, 5, 5);
    const door = createWallDoor('n', 2, 1, 'outward');
    room.wallObjects = [door];
    const arcX = 2 * GRID + Math.cos(-Math.PI / 4) * GRID;
    const arcY = 0 + Math.sin(-Math.PI / 4) * GRID;
    const hit = hitWallObject(room, arcX, arcY, 1);
    expect(hit).toBe(door);
  });

  it('ドアのパネル線上でヒットする', () => {
    // 北壁 inward: パネル線はヒンジ(2*GRID, 0)から(2*GRID, GRID)へ (openAngle=π/2)
    const room = createRoom(0, 0, 5, 5);
    const door = createWallDoor('n', 2, 1, 'inward');
    room.wallObjects = [door];
    // パネル線の中間点付近
    const hit = hitWallObject(room, 2 * GRID, 0.5 * GRID, 1);
    expect(hit).toBe(door);
  });

  it('扇形エリアの内側でヒットする', () => {
    // 北壁 inward: 扇形は (2*GRID, 0) を中心に角度0〜π/2, 半径GRID
    // 扇形内部の点 (半径の半分、角度π/4)
    const room = createRoom(0, 0, 5, 5);
    const door = createWallDoor('n', 2, 1, 'inward');
    room.wallObjects = [door];
    const innerX = 2 * GRID + Math.cos(Math.PI / 4) * GRID * 0.5;
    const innerY = 0 + Math.sin(Math.PI / 4) * GRID * 0.5;
    const hit = hitWallObject(room, innerX, innerY, 1);
    expect(hit).toBe(door);
  });

  it('扇形エリアの外側ではヒットしない', () => {
    const room = createRoom(0, 0, 5, 5);
    const door = createWallDoor('n', 2, 1, 'inward');
    room.wallObjects = [door];
    // 半径外 (距離 > radius)
    const hit = hitWallObject(room, 2 * GRID + GRID * 2, GRID * 2, 1);
    expect(hit).toBeNull();
  });

  it('扇形の角度範囲外ではヒットしない', () => {
    // 北壁 inward: 扇形は角度0〜π/2 (右下の象限)
    // 角度3π/4の位置(左下)は範囲外
    const room = createRoom(0, 0, 5, 5);
    const door = createWallDoor('n', 2, 1, 'inward');
    room.wallObjects = [door];
    const outsideX = 2 * GRID + Math.cos((3 * Math.PI) / 4) * GRID * 0.5;
    const outsideY = 0 + Math.sin((3 * Math.PI) / 4) * GRID * 0.5;
    const hit = hitWallObject(room, outsideX, outsideY, 1);
    expect(hit).toBeNull();
  });

  it('西壁・内開きドアの弧上でヒットする', () => {
    // 西壁 offset=2, width=1 → ヒンジ=(0, 2*GRID), radius=GRID
    // inward: openAngle=0 → 弧は下(π/2)から右(0)へ
    const room = createRoom(0, 0, 5, 5);
    const door = createWallDoor('w', 2, 1, 'inward');
    room.wallObjects = [door];
    const arcX = 0 + Math.cos(Math.PI / 4) * GRID;
    const arcY = 2 * GRID + Math.sin(Math.PI / 4) * GRID;
    const hit = hitWallObject(room, arcX, arcY, 1);
    expect(hit).toBe(door);
  });

  it('西壁・外開きドアの扇形内でヒットする', () => {
    // 西壁 outward: openAngle=π(左), closedAngle=π/2(下)
    // 扇形は下→左の範囲。角度3π/4(左下45度)の内部点でヒット
    const room = createRoom(0, 0, 5, 5);
    const door = createWallDoor('w', 2, 1, 'outward');
    room.wallObjects = [door];
    const px = 0 + Math.cos((3 * Math.PI) / 4) * GRID * 0.5;
    const py = 2 * GRID + Math.sin((3 * Math.PI) / 4) * GRID * 0.5;
    const hit = hitWallObject(room, px, py, 1);
    expect(hit).toBe(door);
  });

  it('南壁・内開きドアの扇形内でヒットする', () => {
    // 南壁 inward: closedAngle=0(右), openAngle=-π/2(上=室内)
    // 扇形は右→上の範囲。角度-π/4(右上45度)の内部点でヒット
    const room = createRoom(0, 0, 5, 5);
    const door = createWallDoor('s', 2, 1, 'inward');
    room.wallObjects = [door];
    const hingeX = 2 * GRID;
    const hingeY = 5 * GRID;
    const px = hingeX + Math.cos(-Math.PI / 4) * GRID * 0.5;
    const py = hingeY + Math.sin(-Math.PI / 4) * GRID * 0.5;
    const hit = hitWallObject(room, px, py, 1);
    expect(hit).toBe(door);
  });

  it('南壁・外開きドアの扇形内でヒットする', () => {
    // 南壁 outward: closedAngle=0(右), openAngle=π/2(下=室外)
    // 扇形は右→下の範囲。角度π/4(右下45度)の内部点でヒット
    const room = createRoom(0, 0, 5, 5);
    const door = createWallDoor('s', 2, 1, 'outward');
    room.wallObjects = [door];
    const hingeX = 2 * GRID;
    const hingeY = 5 * GRID;
    const px = hingeX + Math.cos(Math.PI / 4) * GRID * 0.5;
    const py = hingeY + Math.sin(Math.PI / 4) * GRID * 0.5;
    const hit = hitWallObject(room, px, py, 1);
    expect(hit).toBe(door);
  });

  it('東壁・内開きドアの扇形内でヒットする', () => {
    // 東壁 inward: closedAngle=π/2(下), openAngle=π(左=室内)
    // 扇形は下→左の範囲。角度3π/4(左下45度)の内部点でヒット
    const room = createRoom(0, 0, 5, 5);
    const door = createWallDoor('e', 2, 1, 'inward');
    room.wallObjects = [door];
    const hingeX = 5 * GRID;
    const hingeY = 2 * GRID;
    const px = hingeX + Math.cos((3 * Math.PI) / 4) * GRID * 0.5;
    const py = hingeY + Math.sin((3 * Math.PI) / 4) * GRID * 0.5;
    const hit = hitWallObject(room, px, py, 1);
    expect(hit).toBe(door);
  });

  it('東壁・外開きドアの扇形内でヒットする', () => {
    // 東壁 outward: closedAngle=π/2(下), openAngle=0(右=室外)
    // 扇形は下→右の範囲。角度π/4(右下45度)の内部点でヒット
    const room = createRoom(0, 0, 5, 5);
    const door = createWallDoor('e', 2, 1, 'outward');
    room.wallObjects = [door];
    const hingeX = 5 * GRID;
    const hingeY = 2 * GRID;
    const px = hingeX + Math.cos(Math.PI / 4) * GRID * 0.5;
    const py = hingeY + Math.sin(Math.PI / 4) * GRID * 0.5;
    const hit = hitWallObject(room, px, py, 1);
    expect(hit).toBe(door);
  });

  it('ドアの壁セグメント分割が正しく機能する', () => {
    const room = createRoom(0, 0, 5, 3);
    room.wallObjects = [createWallDoor('n', 2, 1)];
    expect(getWallSegments(room, 'n')).toEqual([
      { start: 0, end: 2 * GRID },
      { start: 3 * GRID, end: 5 * GRID },
    ]);
  });

  describe('hinge=end のドアヒット判定', () => {
    it('北壁・hinge=end・内開きの扇形内でヒットする', () => {
      // hinge=end → ヒンジ=(3*GRID, 0), closedAngle=π(左向き)
      // inward mirror: openAngle=π-π/2=π/2(下向き), anticlockwise=true
      // 扇形はπ→π/2の反時計回り（左から下）
      const room = createRoom(0, 0, 5, 5);
      const door = createWallDoor('n', 2, 1, 'inward', 'end');
      room.wallObjects = [door];
      // 角度3π/4(左下45度)の内部点
      const hingeX = 3 * GRID;
      const px = hingeX + Math.cos((3 * Math.PI) / 4) * GRID * 0.5;
      const py = 0 + Math.sin((3 * Math.PI) / 4) * GRID * 0.5;
      const hit = hitWallObject(room, px, py, 1);
      expect(hit).toBe(door);
    });

    it('北壁・hinge=end・外開きの扇形内でヒットする', () => {
      // hinge=end → closedAngle=π(左向き)
      // outward mirror: openAngle=π-(-π/2)=3π/2(上向き), anticlockwise=false
      const room = createRoom(0, 0, 5, 5);
      const door = createWallDoor('n', 2, 1, 'outward', 'end');
      room.wallObjects = [door];
      const hingeX = 3 * GRID;
      // 角度5π/4(左上45度)の内部点
      const px = hingeX + Math.cos((5 * Math.PI) / 4) * GRID * 0.5;
      const py = 0 + Math.sin((5 * Math.PI) / 4) * GRID * 0.5;
      const hit = hitWallObject(room, px, py, 1);
      expect(hit).toBe(door);
    });

    it('西壁・hinge=end・内開きの扇形内でヒットする', () => {
      // hinge=end → ヒンジ=(0, 3*GRID), closedAngle=-π/2(上向き)
      // inward mirror: openAngle=-0=0(右向き), anticlockwise=false
      const room = createRoom(0, 0, 5, 5);
      const door = createWallDoor('w', 2, 1, 'inward', 'end');
      room.wallObjects = [door];
      const hingeY = 3 * GRID;
      // 角度-π/4(右上45度)の内部点
      const px = 0 + Math.cos(-Math.PI / 4) * GRID * 0.5;
      const py = hingeY + Math.sin(-Math.PI / 4) * GRID * 0.5;
      const hit = hitWallObject(room, px, py, 1);
      expect(hit).toBe(door);
    });

    it('南壁・hinge=end・内開きの扇形内でヒットする', () => {
      // 南壁 start: closedAngle=0, inward=-π/2, inwardCCW=true
      // hinge=end → ヒンジ=(3*GRID, 5*GRID), closedAngle=π(左向き)
      // inward mirror: openAngle=π-(-π/2)=3π/2(上向き), anticlockwise=false
      const room = createRoom(0, 0, 5, 5);
      const door = createWallDoor('s', 2, 1, 'inward', 'end');
      room.wallObjects = [door];
      const hingeX = 3 * GRID;
      const hingeY = 5 * GRID;
      // 角度5π/4(左上45度)の内部点
      const px = hingeX + Math.cos((5 * Math.PI) / 4) * GRID * 0.5;
      const py = hingeY + Math.sin((5 * Math.PI) / 4) * GRID * 0.5;
      const hit = hitWallObject(room, px, py, 1);
      expect(hit).toBe(door);
    });

    it('東壁・hinge=end・内開きの扇形内でヒットする', () => {
      // 東壁 start: closedAngle=π/2, inward=π, inwardCCW=false
      // hinge=end → ヒンジ=(5*GRID, 3*GRID), closedAngle=-π/2(上向き)
      // inward mirror: openAngle=-π(左向き), anticlockwise=true
      const room = createRoom(0, 0, 5, 5);
      const door = createWallDoor('e', 2, 1, 'inward', 'end');
      room.wallObjects = [door];
      const hingeX = 5 * GRID;
      const hingeY = 3 * GRID;
      // 角度-3π/4(左上)の内部点
      const px = hingeX + Math.cos((-3 * Math.PI) / 4) * GRID * 0.5;
      const py = hingeY + Math.sin((-3 * Math.PI) / 4) * GRID * 0.5;
      const hit = hitWallObject(room, px, py, 1);
      expect(hit).toBe(door);
    });

    it('hinge=end の扇形範囲外ではヒットしない', () => {
      // 北壁 hinge=end → ヒンジ=(3*GRID, 0)、扇形はπ→π/2(左下方向)
      // 右下方向（角度π/4）はヒンジから見て扇形の外
      const room = createRoom(0, 0, 5, 5);
      const door = createWallDoor('n', 2, 1, 'inward', 'end');
      room.wallObjects = [door];
      const hingeX = 3 * GRID;
      const px = hingeX + Math.cos(Math.PI / 4) * GRID * 0.5;
      const py = 0 + Math.sin(Math.PI / 4) * GRID * 0.5;
      const hit = hitWallObject(room, px, py, 1);
      expect(hit).toBeNull();
    });
  });
});

describe('createWallOpening', () => {
  it('デフォルト幅1の開口を生成する', () => {
    const opening = createWallOpening('n', 2);
    expect(opening.type).toBe('opening');
    expect(opening.side).toBe('n');
    expect(opening.offset).toBe(2);
    expect(opening.width).toBe(1);
    expect(opening.id).toBeTruthy();
  });

  it('幅を指定して開口を生成する', () => {
    const opening = createWallOpening('s', 1, 3);
    expect(opening.width).toBe(3);
  });
});

describe('開口の壁セグメント分割', () => {
  it('開口がある壁は隙間ができる', () => {
    const room = createRoom(0, 0, 5, 3);
    room.wallObjects = [createWallOpening('n', 2, 1)];
    expect(getWallSegments(room, 'n')).toEqual([
      { start: 0, end: 2 * GRID },
      { start: 3 * GRID, end: 5 * GRID },
    ]);
  });

  it('開口と窓が同じ壁にある場合', () => {
    const room = createRoom(0, 0, 10, 3);
    room.wallObjects = [createWallOpening('n', 1, 1), createWallWindow('n', 5, 2)];
    expect(getWallSegments(room, 'n')).toEqual([
      { start: 0, end: 1 * GRID },
      { start: 2 * GRID, end: 5 * GRID },
      { start: 7 * GRID, end: 10 * GRID },
    ]);
  });
});

describe('開口のヒット判定', () => {
  it('北壁の開口のギャップ部分にヒットする', () => {
    const room = createRoom(0, 0, 5, 3);
    const opening = createWallOpening('n', 2, 1);
    room.wallObjects = [opening];
    const hit = hitWallObject(room, 2.5 * GRID, 0, 1);
    expect(hit).toBe(opening);
  });

  it('東壁の開口のギャップ部分にヒットする', () => {
    const room = createRoom(0, 0, 5, 5);
    const opening = createWallOpening('e', 2, 1);
    room.wallObjects = [opening];
    const hit = hitWallObject(room, 5 * GRID, 2.5 * GRID, 1);
    expect(hit).toBe(opening);
  });

  it('開口の範囲外ではヒットしない', () => {
    const room = createRoom(0, 0, 5, 3);
    room.wallObjects = [createWallOpening('n', 2, 1)];
    const hit = hitWallObject(room, 0.5 * GRID, 0, 1);
    expect(hit).toBeNull();
  });

  it('開口から離れた位置ではヒットしない', () => {
    const room = createRoom(0, 0, 5, 3);
    room.wallObjects = [createWallOpening('n', 2, 1)];
    const hit = hitWallObject(room, 2.5 * GRID, GRID, 1);
    expect(hit).toBeNull();
  });
});

describe('hitWallObjectEdge', () => {
  it('水平壁オブジェクトのstart端にヒットする', () => {
    const room = createRoom(0, 0, 10, 5);
    const win = createWallWindow('n', 3, 2);
    room.wallObjects = [win];
    // start edge is at x = 3 * GRID = 60
    const hit = hitWallObjectEdge(room, 3 * GRID, 0, 1);
    expect(hit).not.toBeNull();
    expect(hit!.obj).toBe(win);
    expect(hit!.edge).toBe('start');
  });

  it('水平壁オブジェクトのend端にヒットする', () => {
    const room = createRoom(0, 0, 10, 5);
    const win = createWallWindow('n', 3, 2);
    room.wallObjects = [win];
    // end edge is at x = (3+2) * GRID = 100
    const hit = hitWallObjectEdge(room, 5 * GRID, 0, 1);
    expect(hit).not.toBeNull();
    expect(hit!.obj).toBe(win);
    expect(hit!.edge).toBe('end');
  });

  it('オブジェクトの中央ではエッジヒットしない', () => {
    const room = createRoom(0, 0, 10, 5);
    const win = createWallWindow('n', 3, 3);
    room.wallObjects = [win];
    // center is at x = 4.5 * GRID = 90
    const hit = hitWallObjectEdge(room, 4.5 * GRID, 0, 1);
    expect(hit).toBeNull();
  });

  it('垂直壁オブジェクトのstart端にヒットする', () => {
    const room = createRoom(0, 0, 5, 10);
    const win = createWallWindow('e', 3, 2);
    room.wallObjects = [win];
    // start edge at y = 3 * GRID
    const hit = hitWallObjectEdge(room, 5 * GRID, 3 * GRID, 1);
    expect(hit).not.toBeNull();
    expect(hit!.edge).toBe('start');
  });

  it('垂直壁オブジェクトのend端にヒットする', () => {
    const room = createRoom(0, 0, 5, 10);
    const win = createWallWindow('e', 3, 2);
    room.wallObjects = [win];
    // end edge at y = 5 * GRID
    const hit = hitWallObjectEdge(room, 5 * GRID, 5 * GRID, 1);
    expect(hit).not.toBeNull();
    expect(hit!.edge).toBe('end');
  });

  it('width=1でもstart端にヒットする', () => {
    const room = createRoom(0, 0, 10, 5);
    const win = createWallWindow('n', 3, 1);
    room.wallObjects = [win];
    const hit = hitWallObjectEdge(room, 3 * GRID, 0, 1);
    expect(hit).not.toBeNull();
    expect(hit!.edge).toBe('start');
  });

  it('width=1でもend端にヒットする', () => {
    const room = createRoom(0, 0, 10, 5);
    const win = createWallWindow('n', 3, 1);
    room.wallObjects = [win];
    const hit = hitWallObjectEdge(room, 4 * GRID, 0, 1);
    expect(hit).not.toBeNull();
    expect(hit!.edge).toBe('end');
  });

  it('壁線から離れた位置ではヒットしない', () => {
    const room = createRoom(0, 0, 10, 5);
    const win = createWallWindow('n', 3, 2);
    room.wallObjects = [win];
    const hit = hitWallObjectEdge(room, 3 * GRID, GRID, 1);
    expect(hit).toBeNull();
  });

  it('wallObjectsがない場合はnull', () => {
    const room = createRoom(0, 0, 5, 5);
    expect(hitWallObjectEdge(room, 0, 0, 1)).toBeNull();
  });

  it('zoom=2のときhit toleranceがスケールされる', () => {
    const room = createRoom(0, 0, 10, 5);
    const win = createWallWindow('n', 3, 2);
    room.wallObjects = [win];
    // At zoom=2, tolerance = 5/2 = 2.5px. 3px away from edge should miss.
    const hit = hitWallObjectEdge(room, 3 * GRID + 3, 0, 2);
    expect(hit).toBeNull();
  });

  it('zoom=2のときエッジ近くでヒットする', () => {
    const room = createRoom(0, 0, 10, 5);
    const win = createWallWindow('n', 3, 2);
    room.wallObjects = [win];
    // At zoom=2, tolerance = 5/2 = 2.5px. 2px away from edge should hit.
    const hit = hitWallObjectEdge(room, 3 * GRID + 2, 0, 2);
    expect(hit).not.toBeNull();
    expect(hit!.edge).toBe('start');
  });

  it('ドアのstart端にヒットする', () => {
    const room = createRoom(0, 0, 10, 5);
    const door = createWallDoor('n', 3, 2);
    room.wallObjects = [door];
    const hit = hitWallObjectEdge(room, 3 * GRID, 0, 1);
    expect(hit).not.toBeNull();
    expect(hit!.obj).toBe(door);
    expect(hit!.edge).toBe('start');
  });

  it('ドアのend端にヒットする', () => {
    const room = createRoom(0, 0, 10, 5);
    const door = createWallDoor('n', 3, 2);
    room.wallObjects = [door];
    const hit = hitWallObjectEdge(room, 5 * GRID, 0, 1);
    expect(hit).not.toBeNull();
    expect(hit!.obj).toBe(door);
    expect(hit!.edge).toBe('end');
  });

  it('開口のstart端にヒットする', () => {
    const room = createRoom(0, 0, 10, 5);
    const opening = createWallOpening('n', 3, 2);
    room.wallObjects = [opening];
    const hit = hitWallObjectEdge(room, 3 * GRID, 0, 1);
    expect(hit).not.toBeNull();
    expect(hit!.obj).toBe(opening);
    expect(hit!.edge).toBe('start');
  });

  it('開口のend端にヒットする', () => {
    const room = createRoom(0, 0, 10, 5);
    const opening = createWallOpening('s', 3, 2);
    room.wallObjects = [opening];
    const hit = hitWallObjectEdge(room, 5 * GRID, 5 * GRID, 1);
    expect(hit).not.toBeNull();
    expect(hit!.obj).toBe(opening);
    expect(hit!.edge).toBe('end');
  });

  it('skipAutoGenerated=trueでautoGenerated開口のエッジをスキップする', () => {
    const room = createRoom(0, 0, 10, 5);
    const opening = createWallOpening('n', 3, 2);
    opening.autoGenerated = true;
    room.wallObjects = [opening];
    // skipAutoGenerated=false（デフォルト）ではヒットする
    expect(hitWallObjectEdge(room, 3 * GRID, 0, 1)).not.toBeNull();
    // skipAutoGenerated=trueではスキップされる
    expect(hitWallObjectEdge(room, 3 * GRID, 0, 1, true)).toBeNull();
  });
});

describe('hitWallObjectEdgeInRooms', () => {
  it('z-orderで上の部屋を優先する', () => {
    const room1 = createRoom(0, 0, 10, 5);
    const win1 = createWallWindow('n', 3, 2);
    room1.wallObjects = [win1];

    const room2 = createRoom(0, 0, 10, 5);
    const win2 = createWallWindow('n', 3, 2);
    room2.wallObjects = [win2];

    const hit = hitWallObjectEdgeInRooms([room1, room2], 3 * GRID, 0, 1);
    expect(hit).not.toBeNull();
    expect(hit!.obj).toBe(win2);
    expect(hit!.room).toBe(room2);
  });

  it('ヒットしない場合はnull', () => {
    const room = createRoom(0, 0, 5, 5);
    expect(hitWallObjectEdgeInRooms([room], GRID, GRID, 1)).toBeNull();
  });
});

describe('wouldOverlap', () => {
  it('同じ壁で重なるオブジェクトを検出する', () => {
    const room = createRoom(0, 0, 10, 5);
    const win1 = createWallWindow('n', 2, 1);
    const win2 = createWallWindow('n', 5, 1);
    room.wallObjects = [win1, win2];
    // win1をoffset=4, width=2にリサイズ → win2(offset=5)と重なる
    expect(wouldOverlap(room, win1.id, 'n', 4, 2)).toBe(true);
  });

  it('自身は除外する', () => {
    const room = createRoom(0, 0, 10, 5);
    const win = createWallWindow('n', 2, 2);
    room.wallObjects = [win];
    expect(wouldOverlap(room, win.id, 'n', 2, 3)).toBe(false);
  });

  it('異なる壁のオブジェクトは無視する', () => {
    const room = createRoom(0, 0, 10, 5);
    const win1 = createWallWindow('n', 2, 2);
    const win2 = createWallWindow('s', 3, 2);
    room.wallObjects = [win1, win2];
    expect(wouldOverlap(room, win1.id, 'n', 2, 4)).toBe(false);
  });

  it('重ならない場合はfalse', () => {
    const room = createRoom(0, 0, 10, 5);
    const win1 = createWallWindow('n', 2, 1);
    const win2 = createWallWindow('n', 5, 1);
    room.wallObjects = [win1, win2];
    expect(wouldOverlap(room, win1.id, 'n', 2, 2)).toBe(false);
  });

  it('接触するが重ならない場合はfalse（newOffset + newWidth === other.offset）', () => {
    const room = createRoom(0, 0, 10, 5);
    const win1 = createWallWindow('n', 2, 1);
    const win2 = createWallWindow('n', 5, 1);
    room.wallObjects = [win1, win2];
    // win1をoffset=2, width=3にリサイズ → newOffset+newWidth=5 === win2.offset → 接触のみ
    expect(wouldOverlap(room, win1.id, 'n', 2, 3)).toBe(false);
  });
});

describe('computeWallObjectResize', () => {
  it('endエッジのドラッグで幅が増える', () => {
    const room = createRoom(0, 0, 10, 5);
    const win = createWallWindow('n', 2, 1);
    room.wallObjects = [win];
    // Drag end edge to x = 5*GRID (grid pos 5)
    const result = computeWallObjectResize(room, win, 'end', 5 * GRID, 0, 2, 1);
    expect(result.offset).toBe(2);
    expect(result.width).toBe(3);
  });

  it('startエッジのドラッグでoffsetが減りwidthが増える', () => {
    const room = createRoom(0, 0, 10, 5);
    const win = createWallWindow('n', 3, 2);
    room.wallObjects = [win];
    // Drag start edge to x = 1*GRID (grid pos 1)
    const result = computeWallObjectResize(room, win, 'start', 1 * GRID, 0, 3, 2);
    expect(result.offset).toBe(1);
    expect(result.width).toBe(4); // origEnd=5, newStart=1 → width=4
  });

  it('最小幅1を保証する（endエッジ）', () => {
    const room = createRoom(0, 0, 10, 5);
    const win = createWallWindow('n', 3, 2);
    room.wallObjects = [win];
    // Drag end edge back to x = 2*GRID (before start)
    const result = computeWallObjectResize(room, win, 'end', 2 * GRID, 0, 3, 2);
    expect(result.width).toBe(1);
  });

  it('最小幅1を保証する（startエッジ）', () => {
    const room = createRoom(0, 0, 10, 5);
    const win = createWallWindow('n', 3, 2);
    room.wallObjects = [win];
    // Drag start edge past end to x = 6*GRID
    const result = computeWallObjectResize(room, win, 'start', 6 * GRID, 0, 3, 2);
    expect(result.offset).toBe(4); // origEnd=5, min width=1 → offset=4
    expect(result.width).toBe(1);
  });

  it('壁境界を超えない（endエッジ）', () => {
    const room = createRoom(0, 0, 10, 5);
    const win = createWallWindow('n', 8, 1);
    room.wallObjects = [win];
    // Drag end edge to x = 15*GRID (way past wall end of 10)
    const result = computeWallObjectResize(room, win, 'end', 15 * GRID, 0, 8, 1);
    expect(result.offset).toBe(8);
    expect(result.width).toBe(2); // sideLen=10, offset=8 → max width=2
  });

  it('壁境界を超えない（startエッジ）', () => {
    const room = createRoom(0, 0, 10, 5);
    const win = createWallWindow('n', 1, 2);
    room.wallObjects = [win];
    // Drag start edge to x = -3*GRID
    const result = computeWallObjectResize(room, win, 'start', -3 * GRID, 0, 1, 2);
    expect(result.offset).toBe(0);
    expect(result.width).toBe(3); // origEnd=3, offset clamped to 0
  });

  it('垂直壁のリサイズが正しく動作する', () => {
    const room = createRoom(0, 0, 5, 10);
    const win = createWallWindow('e', 2, 2);
    room.wallObjects = [win];
    // Drag end edge to y = 6*GRID
    const result = computeWallObjectResize(room, win, 'end', 5 * GRID, 6 * GRID, 2, 2);
    expect(result.offset).toBe(2);
    expect(result.width).toBe(4);
  });

  it('startエッジをorigEndより遠くにドラッグしても幅が負にならない', () => {
    const room = createRoom(0, 0, 10, 5);
    const win = createWallWindow('n', 3, 2);
    room.wallObjects = [win];
    // Drag start edge far past origEnd (origEnd=5, snapped=8)
    const result = computeWallObjectResize(room, win, 'start', 8 * GRID, 0, 3, 2);
    expect(result.offset).toBe(4); // origEnd - 1 = 4
    expect(result.width).toBe(1); // min width
  });

  it('オーバーラップ時は元の値を返す', () => {
    const room = createRoom(0, 0, 10, 5);
    const win1 = createWallWindow('n', 2, 1);
    const win2 = createWallWindow('n', 5, 1);
    room.wallObjects = [win1, win2];
    // Drag win1 end to x = 6*GRID → would overlap win2
    const result = computeWallObjectResize(room, win1, 'end', 6 * GRID, 0, 2, 1);
    expect(result.offset).toBe(win1.offset);
    expect(result.width).toBe(win1.width);
  });
});
