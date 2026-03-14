import { describe, it, expect } from 'vitest';
import type { Room } from './types.ts';
import { bringToFront, sendToBack, bringForward, sendBackward } from './z-order.ts';

function makeRooms(...ids: string[]): Room[] {
  return ids.map((id) => ({ id, x: 0, y: 0, w: 1, h: 1, label: id }));
}

function ids(rooms: Room[]): string[] {
  return rooms.map((r) => r.id);
}

describe('bringToFront', () => {
  it('moves room to end of array', () => {
    const rooms = makeRooms('a', 'b', 'c');
    expect(bringToFront(rooms, 'a')).toBe(true);
    expect(ids(rooms)).toEqual(['b', 'c', 'a']);
  });

  it('returns false when already at front', () => {
    const rooms = makeRooms('a', 'b', 'c');
    expect(bringToFront(rooms, 'c')).toBe(false);
    expect(ids(rooms)).toEqual(['a', 'b', 'c']);
  });

  it('returns false for non-existent id', () => {
    const rooms = makeRooms('a', 'b');
    expect(bringToFront(rooms, 'z')).toBe(false);
    expect(ids(rooms)).toEqual(['a', 'b']);
  });
});

describe('sendToBack', () => {
  it('moves room to start of array', () => {
    const rooms = makeRooms('a', 'b', 'c');
    expect(sendToBack(rooms, 'c')).toBe(true);
    expect(ids(rooms)).toEqual(['c', 'a', 'b']);
  });

  it('returns false when already at back', () => {
    const rooms = makeRooms('a', 'b', 'c');
    expect(sendToBack(rooms, 'a')).toBe(false);
    expect(ids(rooms)).toEqual(['a', 'b', 'c']);
  });

  it('returns false for non-existent id', () => {
    const rooms = makeRooms('a', 'b');
    expect(sendToBack(rooms, 'z')).toBe(false);
    expect(ids(rooms)).toEqual(['a', 'b']);
  });
});

describe('bringForward', () => {
  it('swaps room with the next one', () => {
    const rooms = makeRooms('a', 'b', 'c');
    expect(bringForward(rooms, 'a')).toBe(true);
    expect(ids(rooms)).toEqual(['b', 'a', 'c']);
  });

  it('returns false when already at front', () => {
    const rooms = makeRooms('a', 'b', 'c');
    expect(bringForward(rooms, 'c')).toBe(false);
    expect(ids(rooms)).toEqual(['a', 'b', 'c']);
  });

  it('returns false for non-existent id', () => {
    const rooms = makeRooms('a', 'b');
    expect(bringForward(rooms, 'z')).toBe(false);
    expect(ids(rooms)).toEqual(['a', 'b']);
  });
});

describe('sendBackward', () => {
  it('swaps room with the previous one', () => {
    const rooms = makeRooms('a', 'b', 'c');
    expect(sendBackward(rooms, 'c')).toBe(true);
    expect(ids(rooms)).toEqual(['a', 'c', 'b']);
  });

  it('returns false when already at back', () => {
    const rooms = makeRooms('a', 'b', 'c');
    expect(sendBackward(rooms, 'a')).toBe(false);
    expect(ids(rooms)).toEqual(['a', 'b', 'c']);
  });

  it('returns false for non-existent id', () => {
    const rooms = makeRooms('a', 'b');
    expect(sendBackward(rooms, 'z')).toBe(false);
    expect(ids(rooms)).toEqual(['a', 'b']);
  });
});
