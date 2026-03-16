import { describe, expect, it } from 'vitest';
import {
  findFreeTextById,
  findInteriorObjectById,
  findRoomById,
  findRoomIndexById,
  findWallObjectById,
} from './lookup';
import type { FreeText, Room } from './types';

const rooms: Room[] = [
  { id: 'r1', x: 0, y: 0, w: 5, h: 5, label: 'Room 1' },
  {
    id: 'r2',
    x: 5,
    y: 0,
    w: 5,
    h: 5,
    label: 'Room 2',
    wallObjects: [
      { id: 'wo1', type: 'window', side: 'n', offset: 1, width: 2 },
      { id: 'wo2', type: 'door', side: 's', offset: 0, width: 1, swing: 'inward', hinge: 'start' },
    ],
    interiorObjects: [
      { id: 'io1', type: 'stairs', stairsType: 'straight', direction: 'n', x: 1, y: 1, w: 2, h: 3 },
      {
        id: 'io2',
        type: 'camera',
        x: 3,
        y: 3,
        w: 1,
        h: 1,
        angle: 0,
        fovAngle: Math.PI / 6,
        fovRange: 5,
        fovColor: 'rgba(0,150,255,0.15)',
        fovStrokeColor: 'rgba(0,150,255,0.4)',
      },
    ],
  },
];

const freeTexts: FreeText[] = [
  { id: 'ft1', gx: 0, gy: 0, w: 3, h: 1, label: 'Hello', fontSize: 14, zLayer: 'front' },
  { id: 'ft2', gx: 5, gy: 5, w: 2, h: 1, label: 'World', fontSize: 12, zLayer: 'back' },
];

describe('findRoomById', () => {
  it('returns the room when found', () => {
    expect(findRoomById(rooms, 'r1')).toBe(rooms[0]);
    expect(findRoomById(rooms, 'r2')).toBe(rooms[1]);
  });

  it('returns undefined when not found', () => {
    expect(findRoomById(rooms, 'r999')).toBeUndefined();
  });

  it('returns undefined for empty array', () => {
    expect(findRoomById([], 'r1')).toBeUndefined();
  });
});

describe('findRoomIndexById', () => {
  it('returns the index when found', () => {
    expect(findRoomIndexById(rooms, 'r1')).toBe(0);
    expect(findRoomIndexById(rooms, 'r2')).toBe(1);
  });

  it('returns -1 when not found', () => {
    expect(findRoomIndexById(rooms, 'r999')).toBe(-1);
  });
});

describe('findFreeTextById', () => {
  it('returns the free text when found', () => {
    expect(findFreeTextById(freeTexts, 'ft1')).toBe(freeTexts[0]);
    expect(findFreeTextById(freeTexts, 'ft2')).toBe(freeTexts[1]);
  });

  it('returns undefined when not found', () => {
    expect(findFreeTextById(freeTexts, 'ft999')).toBeUndefined();
  });
});

describe('findWallObjectById', () => {
  it('returns the wall object when found', () => {
    expect(findWallObjectById(rooms[1], 'wo1')).toBe(rooms[1].wallObjects![0]);
  });

  it('returns undefined when not found', () => {
    expect(findWallObjectById(rooms[1], 'wo999')).toBeUndefined();
  });

  it('returns undefined when room has no wallObjects', () => {
    expect(findWallObjectById(rooms[0], 'wo1')).toBeUndefined();
  });
});

describe('findInteriorObjectById', () => {
  it('returns the interior object when found', () => {
    expect(findInteriorObjectById(rooms[1], 'io1')).toBe(rooms[1].interiorObjects![0]);
  });

  it('returns undefined when not found', () => {
    expect(findInteriorObjectById(rooms[1], 'io999')).toBeUndefined();
  });

  it('returns undefined when room has no interiorObjects', () => {
    expect(findInteriorObjectById(rooms[0], 'io1')).toBeUndefined();
  });
});
