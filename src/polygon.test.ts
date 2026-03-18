import { describe, it, expect } from 'vitest';
import type { Room } from './types.ts';
import {
  isPolygonRoom,
  getRoomVertices,
  pointInQuad,
  getQuadCentroid,
  updateBoundingBox,
  getVertexHandles,
  hitVertexHandle,
  rectToVertices,
  getEdgeEndpoints,
  edgeLength,
  pointToSegmentDistance,
  projectPointOnSegment,
  edgeResizeCursor,
} from './polygon.ts';
import { GRID } from './grid.ts';

function makeRect(x: number, y: number, w: number, h: number): Room {
  return { id: 'r1', x, y, w, h, label: '' };
}

function makePolygon(
  v: [
    { gx: number; gy: number },
    { gx: number; gy: number },
    { gx: number; gy: number },
    { gx: number; gy: number },
  ],
): Room {
  const xs = v.map((p) => p.gx);
  const ys = v.map((p) => p.gy);
  return {
    id: 'r1',
    x: Math.min(...xs),
    y: Math.min(...ys),
    w: Math.max(...xs) - Math.min(...xs),
    h: Math.max(...ys) - Math.min(...ys),
    label: '',
    vertices: v,
  };
}

describe('isPolygonRoom', () => {
  it('矩形はfalse', () => {
    expect(isPolygonRoom(makeRect(0, 0, 5, 5))).toBe(false);
  });
  it('四角形はtrue', () => {
    const room = makePolygon([
      { gx: 0, gy: 0 },
      { gx: 5, gy: 0 },
      { gx: 5, gy: 5 },
      { gx: 0, gy: 5 },
    ]);
    expect(isPolygonRoom(room)).toBe(true);
  });
});

describe('getRoomVertices', () => {
  it('矩形から4隅を返す', () => {
    const verts = getRoomVertices(makeRect(2, 3, 4, 5));
    expect(verts).toEqual([
      { gx: 2, gy: 3 },
      { gx: 6, gy: 3 },
      { gx: 6, gy: 8 },
      { gx: 2, gy: 8 },
    ]);
  });
  it('四角形はそのまま返す', () => {
    const v: [
      { gx: number; gy: number },
      { gx: number; gy: number },
      { gx: number; gy: number },
      { gx: number; gy: number },
    ] = [
      { gx: 1, gy: 1 },
      { gx: 4, gy: 0 },
      { gx: 5, gy: 4 },
      { gx: 0, gy: 3 },
    ];
    const room = makePolygon(v);
    expect(getRoomVertices(room)).toEqual(v);
  });
});

describe('pointInQuad', () => {
  const square: [
    { gx: number; gy: number },
    { gx: number; gy: number },
    { gx: number; gy: number },
    { gx: number; gy: number },
  ] = [
    { gx: 0, gy: 0 },
    { gx: 10, gy: 0 },
    { gx: 10, gy: 10 },
    { gx: 0, gy: 10 },
  ];

  it('内部の点はtrue', () => {
    expect(pointInQuad(square, 5, 5)).toBe(true);
  });
  it('外部の点はfalse', () => {
    expect(pointInQuad(square, 15, 5)).toBe(false);
  });

  // 菱形テスト
  const diamond: [
    { gx: number; gy: number },
    { gx: number; gy: number },
    { gx: number; gy: number },
    { gx: number; gy: number },
  ] = [
    { gx: 5, gy: 0 },
    { gx: 10, gy: 5 },
    { gx: 5, gy: 10 },
    { gx: 0, gy: 5 },
  ];

  it('菱形内部はtrue', () => {
    expect(pointInQuad(diamond, 5, 5)).toBe(true);
  });
  it('菱形のBB内だが外部はfalse', () => {
    expect(pointInQuad(diamond, 1, 1)).toBe(false);
  });
});

describe('getQuadCentroid', () => {
  it('正方形の重心は中心', () => {
    const verts: [
      { gx: number; gy: number },
      { gx: number; gy: number },
      { gx: number; gy: number },
      { gx: number; gy: number },
    ] = [
      { gx: 0, gy: 0 },
      { gx: 10, gy: 0 },
      { gx: 10, gy: 10 },
      { gx: 0, gy: 10 },
    ];
    expect(getQuadCentroid(verts)).toEqual({ gx: 5, gy: 5 });
  });
});

describe('updateBoundingBox', () => {
  it('頂点からBBを再計算', () => {
    const room = makePolygon([
      { gx: 1, gy: 2 },
      { gx: 8, gy: 1 },
      { gx: 9, gy: 7 },
      { gx: 2, gy: 8 },
    ]);
    updateBoundingBox(room);
    expect(room.x).toBe(1);
    expect(room.y).toBe(1);
    expect(room.w).toBe(8);
    expect(room.h).toBe(7);
  });
  it('矩形は何もしない', () => {
    const room = makeRect(3, 4, 5, 6);
    updateBoundingBox(room);
    expect(room.x).toBe(3);
    expect(room.w).toBe(5);
  });
});

describe('getVertexHandles', () => {
  it('四角形で4ハンドルを返す', () => {
    const room = makePolygon([
      { gx: 0, gy: 0 },
      { gx: 5, gy: 0 },
      { gx: 5, gy: 5 },
      { gx: 0, gy: 5 },
    ]);
    const handles = getVertexHandles(room);
    expect(handles).toHaveLength(4);
    expect(handles[0]).toEqual({ px: 0, py: 0, vertexIndex: 0 });
    expect(handles[1]).toEqual({ px: 5 * GRID, py: 0, vertexIndex: 1 });
  });
  it('矩形は空配列', () => {
    expect(getVertexHandles(makeRect(0, 0, 5, 5))).toEqual([]);
  });
});

describe('hitVertexHandle', () => {
  it('頂点付近をヒット', () => {
    const room = makePolygon([
      { gx: 0, gy: 0 },
      { gx: 5, gy: 0 },
      { gx: 5, gy: 5 },
      { gx: 0, gy: 5 },
    ]);
    const hit = hitVertexHandle(room, 2, 2, 1);
    expect(hit).not.toBeNull();
    expect(hit!.vertexIndex).toBe(0);
  });
  it('遠い位置はnull', () => {
    const room = makePolygon([
      { gx: 0, gy: 0 },
      { gx: 5, gy: 0 },
      { gx: 5, gy: 5 },
      { gx: 0, gy: 5 },
    ]);
    expect(hitVertexHandle(room, 50, 50, 1)).toBeNull();
  });
});

describe('rectToVertices', () => {
  it('矩形を4頂点に変換', () => {
    const room = makeRect(2, 3, 4, 5);
    const verts = rectToVertices(room);
    expect(verts).toEqual([
      { gx: 2, gy: 3 },
      { gx: 6, gy: 3 },
      { gx: 6, gy: 8 },
      { gx: 2, gy: 8 },
    ]);
  });
});

describe('getEdgeEndpoints', () => {
  it('矩形の北辺', () => {
    const room = makeRect(0, 0, 5, 3);
    const edge = getEdgeEndpoints(room, 'n');
    expect(edge.start).toEqual({ px: 0, py: 0 });
    expect(edge.end).toEqual({ px: 5 * GRID, py: 0 });
    expect(edge.length).toBe(5);
    expect(edge.angle).toBe(0);
  });
  it('四角形の斜め辺', () => {
    const room = makePolygon([
      { gx: 0, gy: 0 },
      { gx: 3, gy: 1 },
      { gx: 3, gy: 4 },
      { gx: 0, gy: 3 },
    ]);
    const edge = getEdgeEndpoints(room, 'n');
    expect(edge.start).toEqual({ px: 0, py: 0 });
    expect(edge.end).toEqual({ px: 3 * GRID, py: 1 * GRID });
    expect(edge.length).toBeCloseTo(Math.hypot(3, 1), 5);
  });
});

describe('edgeLength', () => {
  it('矩形の辺長', () => {
    const room = makeRect(0, 0, 5, 3);
    expect(edgeLength(room, 'n')).toBe(5);
    expect(edgeLength(room, 'e')).toBe(3);
  });
});

describe('pointToSegmentDistance', () => {
  it('線分上の点は距離0', () => {
    expect(pointToSegmentDistance(5, 0, 0, 0, 10, 0)).toBe(0);
  });
  it('線分から垂直距離', () => {
    expect(pointToSegmentDistance(5, 3, 0, 0, 10, 0)).toBe(3);
  });
  it('端点より手前', () => {
    expect(pointToSegmentDistance(-1, 0, 0, 0, 10, 0)).toBe(1);
  });
});

describe('projectPointOnSegment', () => {
  it('線分中央は0.5', () => {
    expect(projectPointOnSegment(5, 0, 0, 0, 10, 0)).toBe(0.5);
  });
  it('始点はクランプ0', () => {
    expect(projectPointOnSegment(-5, 0, 0, 0, 10, 0)).toBe(0);
  });
  it('終点はクランプ1', () => {
    expect(projectPointOnSegment(15, 0, 0, 0, 10, 0)).toBe(1);
  });
});

describe('edgeResizeCursor', () => {
  it('矩形の水平辺(n/s) → ew-resize', () => {
    const room = makeRect(0, 0, 5, 3);
    expect(edgeResizeCursor(room, 'n')).toBe('ew-resize');
    expect(edgeResizeCursor(room, 's')).toBe('ew-resize');
  });
  it('矩形の垂直辺(e/w) → ns-resize', () => {
    const room = makeRect(0, 0, 5, 3);
    expect(edgeResizeCursor(room, 'e')).toBe('ns-resize');
    expect(edgeResizeCursor(room, 'w')).toBe('ns-resize');
  });
  it('45度の斜め辺 → nwse-resize', () => {
    // n辺: (0,0)→(5,5) = 45度
    const room = makePolygon([
      { gx: 0, gy: 0 },
      { gx: 5, gy: 5 },
      { gx: 0, gy: 10 },
      { gx: -5, gy: 5 },
    ]);
    expect(edgeResizeCursor(room, 'n')).toBe('nwse-resize');
  });
  it('135度の斜め辺 → nesw-resize', () => {
    // n辺: (5,0)→(0,5) = 135度
    const room = makePolygon([
      { gx: 5, gy: 0 },
      { gx: 0, gy: 5 },
      { gx: 5, gy: 10 },
      { gx: 10, gy: 5 },
    ]);
    expect(edgeResizeCursor(room, 'n')).toBe('nesw-resize');
  });
});
