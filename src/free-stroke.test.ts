import { describe, it, expect } from 'vitest';
import {
  hitFreeStroke,
  hitFreeStrokeInList,
  getStrokeBounds,
  moveStroke,
  simplifyPoints,
  constrainToLine,
  createFreeStroke,
} from './free-stroke.ts';
import type { FreeStroke } from './types.ts';

function makeStroke(
  points: { px: number; py: number }[],
  overrides?: Partial<FreeStroke>,
): FreeStroke {
  return {
    id: 'stroke-1',
    points,
    color: '#ff0000',
    lineWidth: 2,
    opacity: 1,
    ...overrides,
  };
}

describe('hitFreeStroke', () => {
  it('returns true when point is on the line segment', () => {
    const stroke = makeStroke([
      { px: 0, py: 0 },
      { px: 100, py: 0 },
    ]);
    expect(hitFreeStroke(stroke, 50, 0, 5)).toBe(true);
  });

  it('returns true when point is within tolerance + lineWidth/2', () => {
    const stroke = makeStroke(
      [
        { px: 0, py: 0 },
        { px: 100, py: 0 },
      ],
      { lineWidth: 4 },
    );
    // tolerance=5, lineWidth/2=2, total=7. Point at y=6 should hit.
    expect(hitFreeStroke(stroke, 50, 6, 5)).toBe(true);
  });

  it('returns false when point is far away', () => {
    const stroke = makeStroke([
      { px: 0, py: 0 },
      { px: 100, py: 0 },
    ]);
    expect(hitFreeStroke(stroke, 50, 20, 5)).toBe(false);
  });

  it('handles multi-segment strokes', () => {
    const stroke = makeStroke([
      { px: 0, py: 0 },
      { px: 50, py: 50 },
      { px: 100, py: 0 },
    ]);
    // Near the second segment midpoint (75, 25)
    expect(hitFreeStroke(stroke, 75, 25, 5)).toBe(true);
  });

  it('returns false for single-point stroke', () => {
    const stroke = makeStroke([{ px: 50, py: 50 }]);
    expect(hitFreeStroke(stroke, 50, 50, 5)).toBe(false);
  });
});

describe('hitFreeStrokeInList', () => {
  it('returns the last (topmost) matching stroke', () => {
    const s1 = makeStroke(
      [
        { px: 0, py: 0 },
        { px: 100, py: 0 },
      ],
      { id: 's1' },
    );
    const s2 = makeStroke(
      [
        { px: 0, py: 0 },
        { px: 100, py: 0 },
      ],
      { id: 's2' },
    );
    const hit = hitFreeStrokeInList([s1, s2], 50, 0, 5);
    expect(hit?.id).toBe('s2');
  });

  it('returns null when nothing is hit', () => {
    const s1 = makeStroke([
      { px: 0, py: 0 },
      { px: 100, py: 0 },
    ]);
    expect(hitFreeStrokeInList([s1], 50, 100, 5)).toBeNull();
  });
});

describe('getStrokeBounds', () => {
  it('returns bounding box with lineWidth padding', () => {
    const stroke = makeStroke(
      [
        { px: 10, py: 20 },
        { px: 50, py: 60 },
      ],
      { lineWidth: 4 },
    );
    const bounds = getStrokeBounds(stroke);
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBe(8); // 10 - 4/2
    expect(bounds!.y).toBe(18); // 20 - 4/2
    expect(bounds!.w).toBe(44); // (50-10) + 4
    expect(bounds!.h).toBe(44); // (60-20) + 4
  });

  it('returns null for empty points', () => {
    const stroke = makeStroke([]);
    expect(getStrokeBounds(stroke)).toBeNull();
  });
});

describe('moveStroke', () => {
  it('offsets all points', () => {
    const stroke = makeStroke([
      { px: 10, py: 20 },
      { px: 30, py: 40 },
    ]);
    moveStroke(stroke, 5, -3);
    expect(stroke.points[0]).toEqual({ px: 15, py: 17 });
    expect(stroke.points[1]).toEqual({ px: 35, py: 37 });
  });
});

describe('simplifyPoints', () => {
  it('returns same points when only 2', () => {
    const pts = [
      { px: 0, py: 0 },
      { px: 10, py: 10 },
    ];
    expect(simplifyPoints(pts, 1)).toEqual(pts);
  });

  it('removes collinear points', () => {
    const pts = [
      { px: 0, py: 0 },
      { px: 5, py: 0 },
      { px: 10, py: 0 },
    ];
    const result = simplifyPoints(pts, 1);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ px: 0, py: 0 });
    expect(result[1]).toEqual({ px: 10, py: 0 });
  });

  it('keeps points that deviate from line', () => {
    const pts = [
      { px: 0, py: 0 },
      { px: 5, py: 10 },
      { px: 10, py: 0 },
    ];
    const result = simplifyPoints(pts, 1);
    expect(result).toHaveLength(3);
  });

  it('handles single point', () => {
    const pts = [{ px: 5, py: 5 }];
    expect(simplifyPoints(pts, 1)).toEqual(pts);
  });
});

describe('constrainToLine', () => {
  it('snaps to horizontal when close to 0 degrees', () => {
    const result = constrainToLine({ px: 0, py: 0 }, { px: 100, py: 5 });
    expect(result.py).toBeCloseTo(0, 1);
    expect(result.px).toBeCloseTo(100.125, 0);
  });

  it('snaps to 45 degrees', () => {
    const result = constrainToLine({ px: 0, py: 0 }, { px: 100, py: 90 });
    const dist = Math.hypot(100, 90);
    expect(result.px).toBeCloseTo(dist * Math.cos(Math.PI / 4), 0);
    expect(result.py).toBeCloseTo(dist * Math.sin(Math.PI / 4), 0);
  });

  it('snaps to vertical when close to 90 degrees', () => {
    const result = constrainToLine({ px: 0, py: 0 }, { px: 5, py: 100 });
    expect(result.px).toBeCloseTo(0, 0);
    expect(result.py).toBeCloseTo(100.125, 0);
  });
});

describe('createFreeStroke', () => {
  it('creates a stroke with a UUID id', () => {
    const stroke = createFreeStroke([{ px: 0, py: 0 }], '#00ff00', 3, 0.5);
    expect(stroke.id).toBeTruthy();
    expect(stroke.color).toBe('#00ff00');
    expect(stroke.lineWidth).toBe(3);
    expect(stroke.opacity).toBe(0.5);
    expect(stroke.points).toHaveLength(1);
  });
});
