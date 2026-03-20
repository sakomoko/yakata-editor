import { describe, it, expect } from 'vitest';
import {
  createArrow,
  hitArrow,
  hitArrowInList,
  hitArrowPoint,
  hitArrowSegment,
  moveArrow,
  getArrowBounds,
  constrainToAxis,
} from './arrow.ts';
import type { Arrow } from './types.ts';

function makeArrow(overrides: Partial<Arrow> = {}): Arrow {
  return {
    id: 'arrow-1',
    points: [
      { gx: 0, gy: 0 },
      { gx: 5, gy: 0 },
    ],
    color: '#cc0000',
    lineWidth: 2,
    ...overrides,
  };
}

describe('createArrow', () => {
  it('generates an ID and copies points', () => {
    const arrow = createArrow(
      [
        { gx: 1, gy: 2 },
        { gx: 3, gy: 4 },
      ],
      '#cc0000',
      2,
    );
    expect(arrow.id).toBeTruthy();
    expect(arrow.points).toEqual([
      { gx: 1, gy: 2 },
      { gx: 3, gy: 4 },
    ]);
    expect(arrow.color).toBe('#cc0000');
    expect(arrow.lineWidth).toBe(2);
    expect(arrow.label).toBeUndefined();
  });

  it('includes label when provided', () => {
    const arrow = createArrow(
      [
        { gx: 0, gy: 0 },
        { gx: 1, gy: 1 },
      ],
      '#000',
      1,
      'test',
    );
    expect(arrow.label).toBe('test');
  });
});

describe('hitArrow', () => {
  it('returns true when point is on a segment', () => {
    const arrow = makeArrow();
    // Point on the segment (gx=2.5, gy=0)
    expect(hitArrow(arrow, 2.5, 0)).toBe(true);
  });

  it('returns true when point is near a segment', () => {
    const arrow = makeArrow();
    // Point slightly off the segment
    expect(hitArrow(arrow, 2.5, 0.2)).toBe(true);
  });

  it('returns false when point is far from all segments', () => {
    const arrow = makeArrow();
    expect(hitArrow(arrow, 2.5, 5)).toBe(false);
  });

  it('handles multi-segment arrows', () => {
    const arrow = makeArrow({
      points: [
        { gx: 0, gy: 0 },
        { gx: 5, gy: 0 },
        { gx: 5, gy: 5 },
      ],
    });
    // On first segment
    expect(hitArrow(arrow, 2.5, 0)).toBe(true);
    // On second segment
    expect(hitArrow(arrow, 5, 2.5)).toBe(true);
    // Far from both
    expect(hitArrow(arrow, 2.5, 2.5)).toBe(false);
  });
});

describe('hitArrowInList', () => {
  it('returns the last matching arrow (z-order)', () => {
    const a1 = makeArrow({ id: 'a1' });
    const a2 = makeArrow({ id: 'a2' });
    const result = hitArrowInList([a1, a2], 2.5, 0);
    expect(result?.id).toBe('a2');
  });

  it('returns undefined when no arrow is hit', () => {
    const a1 = makeArrow();
    expect(hitArrowInList([a1], 2.5, 5)).toBeUndefined();
  });
});

describe('hitArrowPoint', () => {
  it('returns point index when hit', () => {
    const arrow = makeArrow();
    expect(hitArrowPoint(arrow, 0, 0)).toBe(0);
    expect(hitArrowPoint(arrow, 5, 0)).toBe(1);
  });

  it('returns undefined when no point is hit', () => {
    const arrow = makeArrow();
    expect(hitArrowPoint(arrow, 2.5, 0)).toBeUndefined();
  });
});

describe('hitArrowSegment', () => {
  it('returns insertion index for hit segment', () => {
    const arrow = makeArrow({
      points: [
        { gx: 0, gy: 0 },
        { gx: 5, gy: 0 },
        { gx: 5, gy: 5 },
      ],
    });
    // Hit on first segment → insert at index 1
    expect(hitArrowSegment(arrow, 2.5, 0)).toBe(1);
    // Hit on second segment → insert at index 2
    expect(hitArrowSegment(arrow, 5, 2.5)).toBe(2);
  });

  it('returns undefined when no segment is hit', () => {
    const arrow = makeArrow();
    expect(hitArrowSegment(arrow, 2.5, 5)).toBeUndefined();
  });
});

describe('moveArrow', () => {
  it('offsets all points', () => {
    const arrow = makeArrow({
      points: [
        { gx: 1, gy: 2 },
        { gx: 3, gy: 4 },
      ],
    });
    moveArrow(arrow, 10, 20);
    expect(arrow.points).toEqual([
      { gx: 11, gy: 22 },
      { gx: 13, gy: 24 },
    ]);
  });
});

describe('getArrowBounds', () => {
  it('returns bounding box of all points', () => {
    const arrow = makeArrow({
      points: [
        { gx: 1, gy: 3 },
        { gx: 5, gy: 1 },
        { gx: 3, gy: 7 },
      ],
    });
    const bounds = getArrowBounds(arrow);
    expect(bounds).toEqual({
      minGx: 1,
      minGy: 1,
      maxGx: 5,
      maxGy: 7,
    });
  });
});

describe('constrainToAxis', () => {
  it('constrains to horizontal when dx > dy', () => {
    const result = constrainToAxis({ gx: 0, gy: 0 }, { gx: 5, gy: 2 });
    expect(result).toEqual({ gx: 5, gy: 0 });
  });

  it('constrains to vertical when dy > dx', () => {
    const result = constrainToAxis({ gx: 0, gy: 0 }, { gx: 2, gy: 5 });
    expect(result).toEqual({ gx: 0, gy: 5 });
  });

  it('constrains to horizontal when dx == dy', () => {
    const result = constrainToAxis({ gx: 0, gy: 0 }, { gx: 3, gy: 3 });
    expect(result).toEqual({ gx: 3, gy: 0 });
  });
});
