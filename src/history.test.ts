import { describe, it, expect } from 'vitest';
import { pushUndo, popUndo } from './history.ts';
import { createRoom } from './room.ts';

describe('pushUndo / popUndo', () => {
  it('should save and restore rooms', () => {
    const history: string[] = [];
    const rooms = [createRoom(1, 2, 3, 4, 'A')];
    pushUndo(history, rooms);

    const restored = popUndo(history);
    expect(restored).not.toBeNull();
    expect(restored!).toHaveLength(1);
    expect(restored![0].label).toBe('A');
    expect(restored![0].x).toBe(1);
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
    expect(second![0].label).toBe('after');
    const first = popUndo(history);
    expect(first![0].label).toBe('before');
  });
});
