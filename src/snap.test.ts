import { describe, it, expect } from 'vitest';
import { findVertexSnap } from './snap.ts';
import type { Room } from './types.ts';

function makeRoom(id: string, x: number, y: number, w: number, h: number): Room {
  return { id, x, y, w, h, label: '' };
}

function makePolygonRoom(
  id: string,
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
    id,
    x: Math.min(...xs),
    y: Math.min(...ys),
    w: Math.max(...xs) - Math.min(...xs),
    h: Math.max(...ys) - Math.min(...ys),
    label: '',
    vertices: v,
  };
}

describe('findVertexSnap', () => {
  const rooms = [makeRoom('A', 0, 0, 5, 5), makeRoom('B', 10, 10, 5, 5)];

  it('頂点スナップ: 他部屋の角に近い場合にスナップ', () => {
    const result = findVertexSnap(rooms, 'C', 5.1, 0.1, 0.5);
    expect(result.type).toBe('vertex');
    expect(result).toMatchObject({ gx: 5, gy: 0 });
  });

  it('辺スナップ: 他部屋の辺上にスナップ', () => {
    const result = findVertexSnap(rooms, 'C', 2.5, 0.3, 0.5);
    expect(result.type).toBe('edge');
    expect(result).toMatchObject({ gx: 2.5, gy: 0 });
  });

  it('優先度: 頂点 > 辺', () => {
    const result = findVertexSnap(rooms, 'C', 4.8, 0.1, 0.5);
    expect(result.type).toBe('vertex');
    expect(result).toMatchObject({ gx: 5, gy: 0 });
  });

  it('threshold外はスナップなし', () => {
    const result = findVertexSnap(rooms, 'C', 7, 7, 0.5);
    expect(result.type).toBe('none');
    expect(result).not.toHaveProperty('gx');
  });

  it('編集中の部屋は除外', () => {
    const result = findVertexSnap(rooms, 'A', 5.1, 0.1, 0.5);
    expect(result.type).toBe('none');
  });

  it('polygon部屋の頂点にもスナップ', () => {
    const polyRoom = makePolygonRoom('P', [
      { gx: 0, gy: 0 },
      { gx: 3, gy: 1 },
      { gx: 4, gy: 4 },
      { gx: 1, gy: 3 },
    ]);
    const result = findVertexSnap([polyRoom], 'X', 3.1, 1.1, 0.5);
    expect(result.type).toBe('vertex');
    expect(result).toMatchObject({ gx: 3, gy: 1 });
  });

  it('polygon部屋の辺にもスナップ', () => {
    const polyRoom = makePolygonRoom('P', [
      { gx: 0, gy: 0 },
      { gx: 4, gy: 0 },
      { gx: 4, gy: 4 },
      { gx: 0, gy: 4 },
    ]);
    const result = findVertexSnap([polyRoom], 'X', 3.7, 2, 0.5);
    expect(result.type).toBe('edge');
    expect(result).toMatchObject({ gx: 4, gy: 2 });
  });

  it('rooms が空配列のときスナップなし', () => {
    const result = findVertexSnap([], 'X', 1, 1, 0.5);
    expect(result.type).toBe('none');
  });

  it('threshold ちょうどの距離はスナップしない (< threshold)', () => {
    // room A の全辺・頂点からちょうど 0.5 以上離れた位置
    const result = findVertexSnap(rooms, 'C', 2.5, -0.5, 0.5);
    expect(result.type).toBe('none');
  });

  it('threshold 未満の距離はスナップする', () => {
    // room A の辺 y=0 から 0.499 離れた位置 → 辺スナップされるはず
    const result = findVertexSnap(rooms, 'C', 2.5, -0.499, 0.5);
    expect(result.type).toBe('edge');
    expect(result).toMatchObject({ gx: 2.5, gy: 0 });
  });

  it('複数部屋の頂点が近い場合、最も近いものにスナップ', () => {
    const closeRooms = [makeRoom('A', 0, 0, 5, 5), makeRoom('B', 5, 0, 5, 5)];
    // (5, 0) は両部屋が共有する頂点。(4.9, 0.1) は A の (5,0) に最も近い
    const result = findVertexSnap(closeRooms, 'C', 4.9, 0.1, 0.5);
    expect(result.type).toBe('vertex');
    expect(result).toMatchObject({ gx: 5, gy: 0 });
  });

  it('小さい threshold ではスナップしない距離でも、大きい threshold ならスナップする', () => {
    // (5.3, 0.3) は room A の頂点 (5, 0) から約 0.42 の距離
    const small = findVertexSnap(rooms, 'C', 5.3, 0.3, 0.25);
    expect(small.type).toBe('none');

    const large = findVertexSnap(rooms, 'C', 5.3, 0.3, 1.0);
    expect(large.type).toBe('vertex');
    expect(large).toMatchObject({ gx: 5, gy: 0 });
  });
});
