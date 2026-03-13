import { describe, it, expect } from 'vitest';
import { createRoom, getHandles, hitRoom, hitHandle } from './room.ts';
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
