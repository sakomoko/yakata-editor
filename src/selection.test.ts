import { describe, it, expect } from 'vitest';
import {
  toggleSelection,
  selectSingle,
  clearSelection,
  getSingleSelected,
  getSelectedRooms,
} from './selection.ts';
import { createRoom } from './room.ts';

describe('toggleSelection', () => {
  it('should add to selection', () => {
    const sel = new Set<string>();
    toggleSelection(sel, 'a');
    expect(sel.has('a')).toBe(true);
  });

  it('should remove from selection', () => {
    const sel = new Set(['a']);
    toggleSelection(sel, 'a');
    expect(sel.has('a')).toBe(false);
  });
});

describe('selectSingle', () => {
  it('should clear and add single item', () => {
    const sel = new Set(['a', 'b']);
    selectSingle(sel, 'c');
    expect(sel.size).toBe(1);
    expect(sel.has('c')).toBe(true);
  });
});

describe('clearSelection', () => {
  it('should empty the set', () => {
    const sel = new Set(['a', 'b']);
    clearSelection(sel);
    expect(sel.size).toBe(0);
  });
});

describe('getSingleSelected', () => {
  it('should return the room when exactly one selected', () => {
    const room = createRoom(0, 0, 1, 1);
    const result = getSingleSelected([room], new Set([room.id]));
    expect(result).toBe(room);
  });

  it('should return null when none selected', () => {
    const room = createRoom(0, 0, 1, 1);
    expect(getSingleSelected([room], new Set())).toBeNull();
  });

  it('should return null when multiple selected', () => {
    const a = createRoom(0, 0, 1, 1);
    const b = createRoom(1, 1, 1, 1);
    expect(getSingleSelected([a, b], new Set([a.id, b.id]))).toBeNull();
  });
});

describe('getSelectedRooms', () => {
  it('should return only selected rooms', () => {
    const a = createRoom(0, 0, 1, 1);
    const b = createRoom(1, 1, 1, 1);
    const c = createRoom(2, 2, 1, 1);
    const result = getSelectedRooms([a, b, c], new Set([a.id, c.id]));
    expect(result).toEqual([a, c]);
  });
});
