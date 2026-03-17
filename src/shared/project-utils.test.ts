import { describe, it, expect } from 'vitest';
import {
  parseViewport,
  deduplicateName,
  generateDefaultName,
  isValidProjectMeta,
  isFilePath,
  UUID_RE,
} from './project-utils.ts';

describe('parseViewport', () => {
  it('returns fallback for null/undefined', () => {
    expect(parseViewport(null)).toEqual({ zoom: 1, panX: 0, panY: 0 });
    expect(parseViewport(undefined)).toEqual({ zoom: 1, panX: 0, panY: 0 });
  });

  it('returns fallback for non-object', () => {
    expect(parseViewport('string')).toEqual({ zoom: 1, panX: 0, panY: 0 });
    expect(parseViewport(42)).toEqual({ zoom: 1, panX: 0, panY: 0 });
  });

  it('returns fallback if required fields are missing', () => {
    expect(parseViewport({ zoom: 1 })).toEqual({ zoom: 1, panX: 0, panY: 0 });
    expect(parseViewport({ zoom: 1, panX: 0 })).toEqual({ zoom: 1, panX: 0, panY: 0 });
  });

  it('returns fallback if zoom is not finite', () => {
    expect(parseViewport({ zoom: NaN, panX: 0, panY: 0 })).toEqual({
      zoom: 1,
      panX: 0,
      panY: 0,
    });
    expect(parseViewport({ zoom: Infinity, panX: 0, panY: 0 })).toEqual({
      zoom: 1,
      panX: 0,
      panY: 0,
    });
  });

  it('returns fallback if panX/panY are not finite', () => {
    expect(parseViewport({ zoom: 1, panX: Infinity, panY: 0 })).toEqual({
      zoom: 1,
      panX: 0,
      panY: 0,
    });
    expect(parseViewport({ zoom: 1, panX: 0, panY: NaN })).toEqual({
      zoom: 1,
      panX: 0,
      panY: 0,
    });
  });

  it('parses valid viewport', () => {
    expect(parseViewport({ zoom: 2, panX: 100, panY: -50 })).toEqual({
      zoom: 2,
      panX: 100,
      panY: -50,
    });
  });

  it('clamps zoom to valid range', () => {
    const result = parseViewport({ zoom: 100, panX: 0, panY: 0 });
    expect(result.zoom).toBe(4); // MAX_ZOOM
    const result2 = parseViewport({ zoom: 0.01, panX: 0, panY: 0 });
    expect(result2.zoom).toBe(0.25); // MIN_ZOOM
  });
});

describe('deduplicateName', () => {
  it('returns baseName if not in existingNames', () => {
    expect(deduplicateName('テスト', ['foo', 'bar'])).toBe('テスト');
  });

  it('appends (2) when baseName exists', () => {
    expect(deduplicateName('テスト', ['テスト'])).toBe('テスト (2)');
  });

  it('increments number when (2) also exists', () => {
    expect(deduplicateName('テスト', ['テスト', 'テスト (2)'])).toBe('テスト (3)');
  });

  it('handles empty existingNames', () => {
    expect(deduplicateName('テスト', [])).toBe('テスト');
  });
});

describe('generateDefaultName', () => {
  it('returns 無題のプロジェクト when no conflicts', () => {
    expect(generateDefaultName([])).toBe('無題のプロジェクト');
  });

  it('returns 無題のプロジェクト (2) when name exists', () => {
    expect(generateDefaultName(['無題のプロジェクト'])).toBe('無題のプロジェクト (2)');
  });
});

describe('isValidProjectMeta', () => {
  it('returns false for null/undefined', () => {
    expect(isValidProjectMeta(null)).toBe(false);
    expect(isValidProjectMeta(undefined)).toBe(false);
  });

  it('returns false for non-object', () => {
    expect(isValidProjectMeta('string')).toBe(false);
    expect(isValidProjectMeta(42)).toBe(false);
  });

  it('returns false if id is not string', () => {
    expect(isValidProjectMeta({ id: 123, name: 'test' })).toBe(false);
  });

  it('returns false if name is not string', () => {
    expect(isValidProjectMeta({ id: 'abc', name: 123 })).toBe(false);
  });

  it('returns true for valid meta with id and name', () => {
    expect(isValidProjectMeta({ id: 'abc', name: 'test' })).toBe(true);
  });

  it('returns true for valid meta with timestamps', () => {
    expect(isValidProjectMeta({ id: 'abc', name: 'test', createdAt: 1000, updatedAt: 2000 })).toBe(
      true,
    );
  });

  it('returns false if createdAt is not a number', () => {
    expect(isValidProjectMeta({ id: 'abc', name: 'test', createdAt: 'bad' })).toBe(false);
  });

  it('returns false if updatedAt is not a number', () => {
    expect(isValidProjectMeta({ id: 'abc', name: 'test', updatedAt: 'bad' })).toBe(false);
  });
});

describe('isFilePath', () => {
  it('detects .json extension', () => {
    expect(isFilePath('project.json')).toBe(true);
  });

  it('detects forward slash', () => {
    expect(isFilePath('path/to/file')).toBe(true);
  });

  it('detects backslash', () => {
    expect(isFilePath('path\\to\\file')).toBe(true);
  });

  it('detects Windows drive letter', () => {
    expect(isFilePath('C:data')).toBe(true);
  });

  it('detects absolute path', () => {
    expect(isFilePath('/absolute/path')).toBe(true);
  });

  it('returns false for UUID-like string', () => {
    expect(isFilePath('550e8400-e29b-41d4-a716-446655440000')).toBe(false);
  });

  it('returns false for plain name', () => {
    expect(isFilePath('myproject')).toBe(false);
  });
});

describe('UUID_RE', () => {
  it('matches valid UUID', () => {
    expect(UUID_RE.test('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('does not match invalid UUID', () => {
    expect(UUID_RE.test('not-a-uuid')).toBe(false);
  });

  it('matches uppercase UUID', () => {
    expect(UUID_RE.test('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
  });
});
