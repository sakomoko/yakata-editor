import { describe, it, expect } from 'vitest';
import type { Room } from './types.ts';
import {
  areAdjacent,
  expandWithLinked,
  linkRooms,
  unlinkRooms,
  cleanupSingletonGroups,
  hasAdjacentPair,
  hasLinkedRoom,
} from './link.ts';

function makeRoom(overrides: Partial<Room> & { x: number; y: number; w: number; h: number }): Room {
  return {
    id: crypto.randomUUID(),
    label: '',
    ...overrides,
  };
}

describe('areAdjacent', () => {
  it('水平方向に隣接する部屋を検出', () => {
    const a = makeRoom({ x: 0, y: 0, w: 3, h: 3 });
    const b = makeRoom({ x: 3, y: 0, w: 3, h: 3 });
    expect(areAdjacent(a, b)).toBe(true);
  });

  it('垂直方向に隣接する部屋を検出', () => {
    const a = makeRoom({ x: 0, y: 0, w: 3, h: 3 });
    const b = makeRoom({ x: 0, y: 3, w: 3, h: 3 });
    expect(areAdjacent(a, b)).toBe(true);
  });

  it('離れた部屋は隣接しない', () => {
    const a = makeRoom({ x: 0, y: 0, w: 3, h: 3 });
    const b = makeRoom({ x: 5, y: 0, w: 3, h: 3 });
    expect(areAdjacent(a, b)).toBe(false);
  });

  it('角だけ接触する部屋は隣接しない（重なりが0）', () => {
    const a = makeRoom({ x: 0, y: 0, w: 3, h: 3 });
    const b = makeRoom({ x: 3, y: 3, w: 3, h: 3 });
    expect(areAdjacent(a, b)).toBe(false);
  });

  it('部分的にY方向で重なる水平隣接', () => {
    const a = makeRoom({ x: 0, y: 0, w: 3, h: 3 });
    const b = makeRoom({ x: 3, y: 1, w: 3, h: 3 });
    expect(areAdjacent(a, b)).toBe(true);
  });

  it('B.x + B.w === A.x の方向でも隣接判定', () => {
    const a = makeRoom({ x: 5, y: 0, w: 3, h: 3 });
    const b = makeRoom({ x: 2, y: 0, w: 3, h: 3 });
    expect(areAdjacent(a, b)).toBe(true);
  });
});

describe('expandWithLinked', () => {
  it('linkGroupがない場合は選択そのまま', () => {
    const rooms = [makeRoom({ x: 0, y: 0, w: 3, h: 3 })];
    const sel = new Set([rooms[0].id]);
    expect(expandWithLinked(rooms, sel)).toEqual(sel);
  });

  it('同じlinkGroupの部屋を拡張', () => {
    const group = 'g1';
    const a = makeRoom({ x: 0, y: 0, w: 3, h: 3, linkGroup: group });
    const b = makeRoom({ x: 3, y: 0, w: 3, h: 3, linkGroup: group });
    const c = makeRoom({ x: 10, y: 0, w: 3, h: 3 });
    const rooms = [a, b, c];
    const result = expandWithLinked(rooms, new Set([a.id]));
    expect(result.has(a.id)).toBe(true);
    expect(result.has(b.id)).toBe(true);
    expect(result.has(c.id)).toBe(false);
  });

  it('複数グループを同時に拡張', () => {
    const a = makeRoom({ x: 0, y: 0, w: 3, h: 3, linkGroup: 'g1' });
    const b = makeRoom({ x: 3, y: 0, w: 3, h: 3, linkGroup: 'g1' });
    const c = makeRoom({ x: 10, y: 0, w: 3, h: 3, linkGroup: 'g2' });
    const d = makeRoom({ x: 13, y: 0, w: 3, h: 3, linkGroup: 'g2' });
    const result = expandWithLinked([a, b, c, d], new Set([a.id, c.id]));
    expect(result.has(b.id)).toBe(true);
    expect(result.has(d.id)).toBe(true);
  });
});

describe('linkRooms', () => {
  it('選択した部屋に同一linkGroupを付与', () => {
    const a = makeRoom({ x: 0, y: 0, w: 3, h: 3 });
    const b = makeRoom({ x: 3, y: 0, w: 3, h: 3 });
    const rooms = [a, b];
    linkRooms(rooms, new Set([a.id, b.id]));
    expect(a.linkGroup).toBeDefined();
    expect(a.linkGroup).toBe(b.linkGroup);
  });

  it('既存グループを統合', () => {
    const a = makeRoom({ x: 0, y: 0, w: 3, h: 3, linkGroup: 'g1' });
    const b = makeRoom({ x: 3, y: 0, w: 3, h: 3, linkGroup: 'g2' });
    const c = makeRoom({ x: 6, y: 0, w: 3, h: 3, linkGroup: 'g2' });
    const rooms = [a, b, c];
    linkRooms(rooms, new Set([a.id, b.id]));
    // 全て同じグループになる
    expect(a.linkGroup).toBe(b.linkGroup);
    expect(b.linkGroup).toBe(c.linkGroup);
  });

  it('3グループ以上を統合', () => {
    const a = makeRoom({ x: 0, y: 0, w: 3, h: 3, linkGroup: 'g1' });
    const b = makeRoom({ x: 3, y: 0, w: 3, h: 3, linkGroup: 'g2' });
    const c = makeRoom({ x: 6, y: 0, w: 3, h: 3, linkGroup: 'g3' });
    const d = makeRoom({ x: 9, y: 0, w: 3, h: 3, linkGroup: 'g3' });
    const rooms = [a, b, c, d];
    linkRooms(rooms, new Set([a.id, b.id, c.id]));
    expect(a.linkGroup).toBe(b.linkGroup);
    expect(b.linkGroup).toBe(c.linkGroup);
    expect(c.linkGroup).toBe(d.linkGroup);
  });
});

describe('unlinkRooms', () => {
  it('選択した部屋のlinkGroupを除去', () => {
    const group = 'g1';
    const a = makeRoom({ x: 0, y: 0, w: 3, h: 3, linkGroup: group });
    const b = makeRoom({ x: 3, y: 0, w: 3, h: 3, linkGroup: group });
    const c = makeRoom({ x: 6, y: 0, w: 3, h: 3, linkGroup: group });
    const rooms = [a, b, c];
    unlinkRooms(rooms, new Set([a.id]));
    expect(a.linkGroup).toBeUndefined();
    // b, c はまだグループを維持
    expect(b.linkGroup).toBe(group);
    expect(c.linkGroup).toBe(group);
  });

  it('解除後にグループが1部屋になったら自動クリーンアップ', () => {
    const group = 'g1';
    const a = makeRoom({ x: 0, y: 0, w: 3, h: 3, linkGroup: group });
    const b = makeRoom({ x: 3, y: 0, w: 3, h: 3, linkGroup: group });
    const rooms = [a, b];
    unlinkRooms(rooms, new Set([a.id]));
    expect(a.linkGroup).toBeUndefined();
    expect(b.linkGroup).toBeUndefined();
  });
});

describe('cleanupSingletonGroups', () => {
  it('メンバーが1部屋のグループを除去', () => {
    const a = makeRoom({ x: 0, y: 0, w: 3, h: 3, linkGroup: 'g1' });
    const rooms = [a];
    cleanupSingletonGroups(rooms);
    expect(a.linkGroup).toBeUndefined();
  });

  it('2部屋以上のグループはそのまま', () => {
    const a = makeRoom({ x: 0, y: 0, w: 3, h: 3, linkGroup: 'g1' });
    const b = makeRoom({ x: 3, y: 0, w: 3, h: 3, linkGroup: 'g1' });
    const rooms = [a, b];
    cleanupSingletonGroups(rooms);
    expect(a.linkGroup).toBe('g1');
    expect(b.linkGroup).toBe('g1');
  });
});

describe('hasAdjacentPair', () => {
  it('選択部屋に隣接ペアがある場合true', () => {
    const a = makeRoom({ x: 0, y: 0, w: 3, h: 3 });
    const b = makeRoom({ x: 3, y: 0, w: 3, h: 3 });
    const rooms = [a, b];
    expect(hasAdjacentPair(rooms, new Set([a.id, b.id]))).toBe(true);
  });

  it('選択部屋に隣接ペアがない場合false', () => {
    const a = makeRoom({ x: 0, y: 0, w: 3, h: 3 });
    const b = makeRoom({ x: 10, y: 0, w: 3, h: 3 });
    const rooms = [a, b];
    expect(hasAdjacentPair(rooms, new Set([a.id, b.id]))).toBe(false);
  });
});

describe('hasLinkedRoom', () => {
  it('linkGroupを持つ部屋がある場合true', () => {
    const a = makeRoom({ x: 0, y: 0, w: 3, h: 3, linkGroup: 'g1' });
    const rooms = [a];
    expect(hasLinkedRoom(rooms, new Set([a.id]))).toBe(true);
  });

  it('linkGroupを持つ部屋がない場合false', () => {
    const a = makeRoom({ x: 0, y: 0, w: 3, h: 3 });
    const rooms = [a];
    expect(hasLinkedRoom(rooms, new Set([a.id]))).toBe(false);
  });
});
