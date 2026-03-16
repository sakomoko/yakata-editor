import { describe, it, expect } from 'vitest';
import {
  createRoom,
  getHandles,
  hitRoom,
  hitHandle,
  computeRoomsBoundingBox,
  computeGroupBoundingBox,
  getAnchorForDir,
  computeGroupScale,
  applyGroupScale,
  findRoomsInArea,
  normalizeArea,
} from './room.ts';
import { GRID } from './grid.ts';

describe('createRoom', () => {
  it('should create a room with UUID', () => {
    const room = createRoom(1, 2, 3, 4, 'Test');
    expect(room.id).toBeTruthy();
    expect(room.x).toBe(1);
    expect(room.y).toBe(2);
    expect(room.w).toBe(3);
    expect(room.h).toBe(4);
    expect(room.label).toBe('Test');
  });

  it('should generate unique IDs', () => {
    const a = createRoom(0, 0, 1, 1);
    const b = createRoom(0, 0, 1, 1);
    expect(a.id).not.toBe(b.id);
  });

  it('should default label to empty string', () => {
    const room = createRoom(0, 0, 1, 1);
    expect(room.label).toBe('');
  });
});

describe('getHandles', () => {
  it('should return 8 handles', () => {
    const room = createRoom(2, 3, 4, 5);
    const handles = getHandles(room);
    expect(handles).toHaveLength(8);
  });

  it('should have correct directions', () => {
    const room = createRoom(0, 0, 2, 2);
    const dirs = getHandles(room).map((h) => h.dir);
    expect(dirs).toEqual(['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']);
  });

  it('should compute correct pixel positions', () => {
    const room = createRoom(1, 1, 2, 2);
    const handles = getHandles(room);
    const nw = handles.find((h) => h.dir === 'nw')!;
    const se = handles.find((h) => h.dir === 'se')!;
    expect(nw.px).toBe(1 * GRID);
    expect(nw.py).toBe(1 * GRID);
    expect(se.px).toBe(3 * GRID);
    expect(se.py).toBe(3 * GRID);
  });
});

describe('hitRoom', () => {
  it('should hit a room at its center', () => {
    const room = createRoom(2, 2, 4, 4);
    const result = hitRoom([room], 4 * GRID, 4 * GRID);
    expect(result).toBe(room);
  });

  it('should return null on empty area', () => {
    const room = createRoom(2, 2, 4, 4);
    const result = hitRoom([room], 0, 0);
    expect(result).toBeNull();
  });

  it('should hit room at edge', () => {
    const room = createRoom(2, 2, 4, 4);
    const result = hitRoom([room], 2 * GRID, 2 * GRID);
    expect(result).toBe(room);
  });

  it('should prefer later rooms (higher z-order)', () => {
    const a = createRoom(0, 0, 5, 5);
    const b = createRoom(1, 1, 3, 3);
    const result = hitRoom([a, b], 2 * GRID, 2 * GRID);
    expect(result).toBe(b);
  });

  it('should return null for empty array', () => {
    expect(hitRoom([], 10, 10)).toBeNull();
  });
});

describe('hitHandle', () => {
  it('should hit a handle when single room is selected', () => {
    const room = createRoom(2, 2, 4, 4);
    const selection = new Set([room.id]);
    const nwPx = 2 * GRID;
    const nwPy = 2 * GRID;
    const result = hitHandle([room], selection, nwPx, nwPy);
    expect(result).not.toBeNull();
    expect(result!.handle.dir).toBe('nw');
  });

  it('should return null when multiple rooms selected', () => {
    const a = createRoom(0, 0, 2, 2);
    const b = createRoom(5, 5, 2, 2);
    const selection = new Set([a.id, b.id]);
    const result = hitHandle([a, b], selection, 0, 0);
    expect(result).toBeNull();
  });

  it('should return null when no rooms selected', () => {
    const room = createRoom(2, 2, 4, 4);
    const result = hitHandle([room], new Set(), 2 * GRID, 2 * GRID);
    expect(result).toBeNull();
  });
});

describe('findRoomsInArea', () => {
  it('should find rooms fully contained in the area', () => {
    const a = createRoom(2, 2, 3, 3);
    const b = createRoom(6, 6, 2, 2);
    const result = findRoomsInArea([a, b], { x: 1, y: 1, w: 10, h: 10 });
    expect(result).toEqual([a, b]);
  });

  it('should not include partially overlapping rooms', () => {
    const a = createRoom(0, 0, 5, 5);
    const result = findRoomsInArea([a], { x: 2, y: 2, w: 6, h: 6 });
    expect(result).toEqual([]);
  });

  it('should not include rooms outside the area', () => {
    const a = createRoom(10, 10, 2, 2);
    const result = findRoomsInArea([a], { x: 0, y: 0, w: 5, h: 5 });
    expect(result).toEqual([]);
  });

  it('should include rooms exactly matching the area boundary', () => {
    const a = createRoom(1, 1, 4, 4);
    const result = findRoomsInArea([a], { x: 1, y: 1, w: 4, h: 4 });
    expect(result).toEqual([a]);
  });

  it('should return empty array when no rooms exist', () => {
    const result = findRoomsInArea([], { x: 0, y: 0, w: 10, h: 10 });
    expect(result).toEqual([]);
  });

  it('should only include fully contained rooms in a mixed set', () => {
    const inside = createRoom(2, 2, 2, 2);
    const partial = createRoom(4, 4, 5, 5);
    const outside = createRoom(20, 20, 1, 1);
    const result = findRoomsInArea([inside, partial, outside], { x: 1, y: 1, w: 6, h: 6 });
    expect(result).toEqual([inside]);
  });
});

describe('normalizeArea', () => {
  it('should normalize when start is top-left of cur', () => {
    const result = normalizeArea({ px: 0, py: 0, gx: 1, gy: 2 }, { px: 0, py: 0, gx: 5, gy: 6 });
    expect(result).toEqual({ x: 1, y: 2, w: 4, h: 4 });
  });

  it('should normalize when dragging right-to-left (cur < start)', () => {
    const result = normalizeArea({ px: 0, py: 0, gx: 5, gy: 6 }, { px: 0, py: 0, gx: 1, gy: 2 });
    expect(result).toEqual({ x: 1, y: 2, w: 4, h: 4 });
  });

  it('should return zero size when start equals cur', () => {
    const result = normalizeArea({ px: 0, py: 0, gx: 3, gy: 4 }, { px: 0, py: 0, gx: 3, gy: 4 });
    expect(result).toEqual({ x: 3, y: 4, w: 0, h: 0 });
  });

  it('should handle negative grid coordinates', () => {
    const result = normalizeArea({ px: 0, py: 0, gx: -2, gy: -3 }, { px: 0, py: 0, gx: 2, gy: 1 });
    expect(result).toEqual({ x: -2, y: -3, w: 4, h: 4 });
  });
});

describe('computeGroupBoundingBox', () => {
  it('should compute bounding box in grid coordinates without padding', () => {
    const a = createRoom(2, 3, 4, 5);
    const b = createRoom(8, 1, 3, 6);
    const bb = computeGroupBoundingBox([a, b]);
    expect(bb).toEqual({ x: 2, y: 1, w: 9, h: 7 });
  });

  it('should handle a single room', () => {
    const a = createRoom(5, 5, 3, 4);
    const bb = computeGroupBoundingBox([a]);
    expect(bb).toEqual({ x: 5, y: 5, w: 3, h: 4 });
  });

  it('should return zero-size for empty array', () => {
    const bb = computeGroupBoundingBox([]);
    expect(bb).toEqual({ x: 0, y: 0, w: 0, h: 0 });
  });

  it('should handle negative coordinates', () => {
    const a = createRoom(-3, -2, 2, 2);
    const b = createRoom(1, 1, 3, 3);
    const bb = computeGroupBoundingBox([a, b]);
    expect(bb).toEqual({ x: -3, y: -2, w: 7, h: 6 });
  });
});

describe('getAnchorForDir', () => {
  const bb = { x: 2, y: 3, w: 6, h: 4 };

  it('nw → opposite is se corner', () => {
    expect(getAnchorForDir(bb, 'nw')).toEqual({ gx: 8, gy: 7 });
  });

  it('ne → opposite is sw corner', () => {
    expect(getAnchorForDir(bb, 'ne')).toEqual({ gx: 2, gy: 7 });
  });

  it('se → opposite is nw corner', () => {
    expect(getAnchorForDir(bb, 'se')).toEqual({ gx: 2, gy: 3 });
  });

  it('sw → opposite is ne corner', () => {
    expect(getAnchorForDir(bb, 'sw')).toEqual({ gx: 8, gy: 3 });
  });
});

describe('computeGroupScale', () => {
  it('should compute aspect-ratio-preserving scale', () => {
    const origBB = { w: 10, h: 8 };
    const originals = [{ x: 0, y: 0, w: 4, h: 3 }];
    // rawW=20, rawH=16 → scale = min(20/10, 16/8) = min(2, 2) = 2
    expect(computeGroupScale(origBB, 20, 16, originals)).toBe(2);
  });

  it('should pick smaller scale to maintain aspect ratio', () => {
    const origBB = { w: 10, h: 8 };
    const originals = [{ x: 0, y: 0, w: 4, h: 3 }];
    // rawW=15, rawH=24 → scale = min(15/10, 24/8) = min(1.5, 3) = 1.5
    expect(computeGroupScale(origBB, 15, 24, originals)).toBe(1.5);
  });

  it('should return null when rawW or rawH < 1', () => {
    const origBB = { w: 10, h: 8 };
    expect(computeGroupScale(origBB, 0.5, 10, [{ x: 0, y: 0, w: 2, h: 2 }])).toBeNull();
    expect(computeGroupScale(origBB, 10, 0, [{ x: 0, y: 0, w: 2, h: 2 }])).toBeNull();
  });

  it('should enforce minScale from room dimensions', () => {
    const origBB = { w: 10, h: 8 };
    // w=2 → minScale >= 0.5, scale from raw = min(1/10, 1/8) = 0.1
    const originals = [
      { x: 0, y: 0, w: 4, h: 3 },
      { x: 5, y: 5, w: 2, h: 5 },
    ];
    const scale = computeGroupScale(origBB, 1, 1, originals);
    expect(scale).toBe(0.5); // clamped to minScale
  });

  it('should return null when origBB has zero dimension', () => {
    expect(computeGroupScale({ w: 0, h: 5 }, 10, 10, [{ x: 0, y: 0, w: 2, h: 2 }])).toBeNull();
    expect(computeGroupScale({ w: 5, h: 0 }, 10, 10, [{ x: 0, y: 0, w: 2, h: 2 }])).toBeNull();
  });
});

describe('applyGroupScale', () => {
  it('should scale room positions and sizes relative to anchor', () => {
    const anchor = { gx: 0, gy: 0 };
    const orig = { x: 2, y: 2, w: 4, h: 3 };
    const result = applyGroupScale(anchor, orig, 2);
    expect(result).toEqual({ x: 4, y: 4, w: 8, h: 6 });
  });

  it('should enforce minimum size of 1', () => {
    const anchor = { gx: 0, gy: 0 };
    const orig = { x: 2, y: 2, w: 4, h: 3 };
    const result = applyGroupScale(anchor, orig, 0.1);
    expect(result.w).toBeGreaterThanOrEqual(1);
    expect(result.h).toBeGreaterThanOrEqual(1);
  });

  it('should preserve adjacency between rooms (no gaps)', () => {
    const anchor = { gx: 0, gy: 0 };
    // Two adjacent rooms: A ends at x=6, B starts at x=6
    const origA = { x: 2, y: 0, w: 4, h: 3 };
    const origB = { x: 6, y: 0, w: 3, h: 3 };
    const scale = 1.5;
    const a = applyGroupScale(anchor, origA, scale);
    const b = applyGroupScale(anchor, origB, scale);
    // A's right edge should equal B's left edge
    expect(a.x + a.w).toBe(b.x);
  });

  it('should work with non-zero anchor', () => {
    const anchor = { gx: 10, gy: 10 };
    const orig = { x: 12, y: 12, w: 4, h: 3 };
    const result = applyGroupScale(anchor, orig, 2);
    expect(result.x).toBe(14); // 10 + (12-10)*2
    expect(result.y).toBe(14);
    expect(result.w).toBe(8);
    expect(result.h).toBe(6);
  });
});

describe('computeRoomsBoundingBox', () => {
  it('should return default area when no rooms', () => {
    const bbox = computeRoomsBoundingBox([]);
    expect(bbox).toEqual({ x: 0, y: 0, w: 40 * GRID, h: 30 * GRID });
  });

  it('should compute bounding box for a single room with padding', () => {
    const room = createRoom(5, 5, 10, 8);
    const bbox = computeRoomsBoundingBox([room]);
    const padding = GRID * 2;
    expect(bbox.x).toBe(5 * GRID - padding);
    expect(bbox.y).toBe(5 * GRID - padding);
    expect(bbox.w).toBe(10 * GRID + padding * 2);
    expect(bbox.h).toBe(8 * GRID + padding * 2);
  });

  it('should encompass multiple rooms', () => {
    const a = createRoom(0, 0, 5, 5);
    const b = createRoom(10, 10, 3, 3);
    const bbox = computeRoomsBoundingBox([a, b]);
    const padding = GRID * 2;
    expect(bbox.x).toBe(0 - padding);
    expect(bbox.y).toBe(0 - padding);
    expect(bbox.w).toBe(13 * GRID + padding * 2);
    expect(bbox.h).toBe(13 * GRID + padding * 2);
  });

  it('should handle rooms at negative coordinates', () => {
    const room = createRoom(-10, -5, 4, 3);
    const bbox = computeRoomsBoundingBox([room]);
    const padding = GRID * 2;
    expect(bbox.x).toBe(-10 * GRID - padding);
    expect(bbox.y).toBe(-5 * GRID - padding);
    expect(bbox.w).toBe(4 * GRID + padding * 2);
    expect(bbox.h).toBe(3 * GRID + padding * 2);
  });
});
