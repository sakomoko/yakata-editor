import { describe, it, expect } from 'vitest';
import {
  pushUndo,
  popUndo,
  cancelLastUndo,
  pushRedo,
  popRedo,
  clearRedo,
  saveUndoPoint,
} from './history.ts';
import { createRoom } from './room.ts';

describe('pushUndo / popUndo', () => {
  it('should save and restore rooms', () => {
    const history: string[] = [];
    const rooms = [createRoom(1, 2, 3, 4, 'A')];
    pushUndo(history, rooms);

    const restored = popUndo(history);
    expect(restored).not.toBeNull();
    expect(restored!.rooms).toHaveLength(1);
    expect(restored!.rooms[0].label).toBe('A');
    expect(restored!.rooms[0].x).toBe(1);
    expect(restored!.freeTexts).toHaveLength(0);
  });

  it('should save and restore freeTexts', () => {
    const history: string[] = [];
    const rooms = [createRoom(0, 0, 1, 1)];
    const freeTexts = [
      {
        id: 'ft1',
        gx: 5,
        gy: 5,
        w: 3,
        h: 2,
        label: 'Hello',
        fontSize: 14,
        zLayer: 'front' as const,
      },
    ];
    pushUndo(history, rooms, freeTexts);

    const restored = popUndo(history);
    expect(restored).not.toBeNull();
    expect(restored!.freeTexts).toHaveLength(1);
    expect(restored!.freeTexts[0].label).toBe('Hello');
  });

  it('should return null when history is empty', () => {
    expect(popUndo([])).toBeNull();
  });

  it('should limit history to 50 entries', () => {
    const history: string[] = [];
    const rooms = [createRoom(0, 0, 1, 1)];
    for (let i = 0; i < 55; i++) {
      pushUndo(history, rooms);
    }
    expect(history).toHaveLength(50);
  });

  it('should restore independent snapshots', () => {
    const history: string[] = [];
    const rooms = [createRoom(0, 0, 1, 1, 'before')];
    pushUndo(history, rooms);
    rooms[0].label = 'after';
    pushUndo(history, rooms);

    const second = popUndo(history);
    expect(second!.rooms[0].label).toBe('after');
    const first = popUndo(history);
    expect(first!.rooms[0].label).toBe('before');
  });

  it('cancelLastUndo on empty history should be a no-op', () => {
    const history: string[] = [];
    expect(() => cancelLastUndo(history)).not.toThrow();
    expect(history).toHaveLength(0);
  });

  it('cancelLastUndo should remove the last entry', () => {
    const history: string[] = [];
    const rooms = [createRoom(0, 0, 1, 1, 'first')];
    pushUndo(history, rooms);
    rooms[0].label = 'second';
    pushUndo(history, rooms);
    expect(history).toHaveLength(2);

    cancelLastUndo(history);
    expect(history).toHaveLength(1);

    const restored = popUndo(history);
    expect(restored!.rooms[0].label).toBe('first');
  });

  it('cancelLastUndo with savedRedo should restore redo stack', () => {
    const history: string[] = [];
    const redoHistory: string[] = [];
    const rooms = [createRoom(0, 0, 1, 1, 'A')];

    // Redoスタックにエントリを入れる
    pushRedo(redoHistory, rooms);
    pushRedo(redoHistory, rooms);
    expect(redoHistory).toHaveLength(2);

    // saveUndoPoint でRedoがクリアされる（savedRedoに退避）
    const savedRedo = saveUndoPoint(history, redoHistory, rooms);
    expect(redoHistory).toHaveLength(0);
    expect(savedRedo).toHaveLength(2);

    // cancelLastUndo で Undo を取り消し、Redo を復元
    cancelLastUndo(history, redoHistory, savedRedo);
    expect(history).toHaveLength(0);
    expect(redoHistory).toHaveLength(2);
  });

  it('cancelLastUndo with null savedRedo should not touch redo stack', () => {
    const history: string[] = [];
    const redoHistory: string[] = [];
    const rooms = [createRoom(0, 0, 1, 1)];

    pushUndo(history, rooms);
    pushRedo(redoHistory, rooms);
    expect(history).toHaveLength(1);
    expect(redoHistory).toHaveLength(1);

    cancelLastUndo(history, redoHistory, null);
    expect(history).toHaveLength(0);
    expect(redoHistory).toHaveLength(1);
  });

  it('should handle legacy format (array of rooms)', () => {
    const history: string[] = [];
    // Simulate old format: just an array
    history.push(JSON.stringify([{ id: 'r1', x: 0, y: 0, w: 5, h: 5, label: 'old' }]));

    const restored = popUndo(history);
    expect(restored).not.toBeNull();
    expect(restored!.rooms).toHaveLength(1);
    expect(restored!.rooms[0].label).toBe('old');
    expect(restored!.freeTexts).toHaveLength(0);
  });
});

describe('pushRedo / popRedo / clearRedo', () => {
  it('should save and restore via redo stack', () => {
    const redoHistory: string[] = [];
    const rooms = [createRoom(1, 2, 3, 4, 'A')];
    pushRedo(redoHistory, rooms);

    const restored = popRedo(redoHistory);
    expect(restored).not.toBeNull();
    expect(restored!.rooms).toHaveLength(1);
    expect(restored!.rooms[0].label).toBe('A');
  });

  it('should return null when redo history is empty', () => {
    expect(popRedo([])).toBeNull();
  });

  it('should limit redo history to 50 entries', () => {
    const redoHistory: string[] = [];
    const rooms = [createRoom(0, 0, 1, 1)];
    for (let i = 0; i < 55; i++) {
      pushRedo(redoHistory, rooms);
    }
    expect(redoHistory).toHaveLength(50);
  });

  it('clearRedo should empty the stack', () => {
    const redoHistory: string[] = [];
    const rooms = [createRoom(0, 0, 1, 1)];
    pushRedo(redoHistory, rooms);
    pushRedo(redoHistory, rooms);
    expect(redoHistory).toHaveLength(2);

    clearRedo(redoHistory);
    expect(redoHistory).toHaveLength(0);
  });

  it('undo then redo should restore state symmetrically', () => {
    const history: string[] = [];
    const redoHistory: string[] = [];

    // Initial state: room 'before'
    const rooms = [createRoom(0, 0, 1, 1, 'before')];
    pushUndo(history, rooms);

    // Change to 'after'
    rooms[0].label = 'after';

    // Simulate undo: save current to redo, restore from undo
    pushRedo(redoHistory, rooms);
    const undone = popUndo(history);
    expect(undone!.rooms[0].label).toBe('before');

    // Simulate redo: save current (undone) to undo, restore from redo
    pushUndo(history, undone!.rooms, undone!.freeTexts, undone!.freeStrokes);
    const redone = popRedo(redoHistory);
    expect(redone!.rooms[0].label).toBe('after');
  });
});

describe('saveUndoPoint', () => {
  it('should push to undo and clear redo in one call', () => {
    const history: string[] = [];
    const redoHistory: string[] = [];
    const rooms = [createRoom(0, 0, 1, 1, 'A')];

    // Redoスタックに何か入れておく
    pushRedo(redoHistory, rooms);
    pushRedo(redoHistory, rooms);
    expect(redoHistory).toHaveLength(2);

    saveUndoPoint(history, redoHistory, rooms);

    expect(history).toHaveLength(1);
    expect(redoHistory).toHaveLength(0);

    const restored = popUndo(history);
    expect(restored!.rooms[0].label).toBe('A');
  });
});
