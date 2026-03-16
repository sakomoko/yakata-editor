import { describe, it, expect } from 'vitest';
import {
  createFreeText,
  hitFreeText,
  hitFreeTextHandle,
  findFreeTextsInArea,
  computeFreeTextResize,
} from './free-text.ts';
import { GRID } from './grid.ts';

describe('createFreeText', () => {
  it('should create a FreeText with default values', () => {
    const ft = createFreeText(5, 10, 'Hello');
    expect(ft.gx).toBe(5);
    expect(ft.gy).toBe(10);
    expect(ft.label).toBe('Hello');
    expect(ft.fontSize).toBe(14);
    expect(ft.zLayer).toBe('front');
    expect(ft.w).toBe(3);
    expect(ft.h).toBe(2);
    expect(ft.id).toBeTruthy();
  });

  it('should create a FreeText with custom values', () => {
    const ft = createFreeText(0, 0, 'Test', 20, 'back');
    expect(ft.fontSize).toBe(20);
    expect(ft.zLayer).toBe('back');
  });
});

describe('hitFreeText', () => {
  it('should return the FreeText at the given pixel position', () => {
    const ft = createFreeText(5, 5, 'Hello');
    const result = hitFreeText([ft], 5 * GRID + 5, 5 * GRID + 5);
    expect(result).toBe(ft);
  });

  it('should return null when no FreeText is hit', () => {
    const ft = createFreeText(5, 5, 'Hello');
    const result = hitFreeText([ft], 0, 0);
    expect(result).toBeNull();
  });

  it('should return the last (topmost) FreeText when overlapping', () => {
    const ft1 = createFreeText(5, 5, 'First');
    const ft2 = createFreeText(5, 5, 'Second');
    const result = hitFreeText([ft1, ft2], 5 * GRID + 5, 5 * GRID + 5);
    expect(result).toBe(ft2);
  });

  it('should filter by layer', () => {
    const ftFront = createFreeText(5, 5, 'Front', 14, 'front');
    const ftBack = createFreeText(5, 5, 'Back', 14, 'back');
    expect(hitFreeText([ftFront, ftBack], 5 * GRID + 5, 5 * GRID + 5, 'front')).toBe(ftFront);
    expect(hitFreeText([ftFront, ftBack], 5 * GRID + 5, 5 * GRID + 5, 'back')).toBe(ftBack);
  });
});

describe('hitFreeTextHandle', () => {
  it('should detect corner handles', () => {
    const ft = createFreeText(5, 5, 'Hello');
    ft.w = 4;
    ft.h = 3;
    // Top-left corner
    expect(hitFreeTextHandle(ft, 5 * GRID, 5 * GRID, 1)).toBe('nw');
    // Top-right corner
    expect(hitFreeTextHandle(ft, 9 * GRID, 5 * GRID, 1)).toBe('ne');
    // Bottom-right corner
    expect(hitFreeTextHandle(ft, 9 * GRID, 8 * GRID, 1)).toBe('se');
    // Bottom-left corner
    expect(hitFreeTextHandle(ft, 5 * GRID, 8 * GRID, 1)).toBe('sw');
  });

  it('should return null when not near a handle', () => {
    const ft = createFreeText(5, 5, 'Hello');
    expect(hitFreeTextHandle(ft, 6 * GRID, 6 * GRID, 1)).toBeNull();
  });
});

describe('findFreeTextsInArea', () => {
  it('should find FreeTexts fully contained in the area', () => {
    const ft1 = createFreeText(2, 2, 'A');
    ft1.w = 2;
    ft1.h = 2;
    const ft2 = createFreeText(10, 10, 'B');
    ft2.w = 2;
    ft2.h = 2;
    const result = findFreeTextsInArea([ft1, ft2], { x: 1, y: 1, w: 5, h: 5 });
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(ft1);
  });

  it('should return empty array when no FreeTexts are in the area', () => {
    const ft = createFreeText(10, 10, 'Far');
    const result = findFreeTextsInArea([ft], { x: 0, y: 0, w: 5, h: 5 });
    expect(result).toHaveLength(0);
  });
});

describe('computeFreeTextResize', () => {
  const orig = { gx: 5, gy: 5, w: 4, h: 3 };

  it('should resize from SE corner', () => {
    const result = computeFreeTextResize('se', orig, 12, 10);
    expect(result).toEqual({ gx: 5, gy: 5, w: 7, h: 5 });
  });

  it('should resize from NW corner', () => {
    const result = computeFreeTextResize('nw', orig, 3, 3);
    expect(result).toEqual({ gx: 3, gy: 3, w: 6, h: 5 });
  });

  it('should enforce minimum size of 1', () => {
    const result = computeFreeTextResize('se', orig, 5, 5);
    expect(result.w).toBeGreaterThanOrEqual(1);
    expect(result.h).toBeGreaterThanOrEqual(1);
  });

  it('should not allow NW resize past the opposite corner', () => {
    const result = computeFreeTextResize('nw', orig, 20, 20);
    expect(result.gx).toBe(orig.gx + orig.w - 1);
    expect(result.gy).toBe(orig.gy + orig.h - 1);
    expect(result.w).toBe(1);
    expect(result.h).toBe(1);
  });
});
