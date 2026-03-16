import { describe, it, expect } from 'vitest';
import {
  createRoom,
  getHandles,
  hitRoom,
  hitHandle,
  computeRoomsBoundingBox,
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
