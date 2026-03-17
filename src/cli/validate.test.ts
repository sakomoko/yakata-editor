import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { validate, wallLength } from './validate.ts';
import type { Room } from '../types.ts';

describe('wallLength', () => {
  const room: Room = { id: 'r1', x: 0, y: 0, w: 10, h: 5, label: 'テスト' };

  it('returns width for north wall', () => {
    expect(wallLength(room, 'n')).toBe(10);
  });

  it('returns width for south wall', () => {
    expect(wallLength(room, 's')).toBe(10);
  });

  it('returns height for east wall', () => {
    expect(wallLength(room, 'e')).toBe(5);
  });

  it('returns height for west wall', () => {
    expect(wallLength(room, 'w')).toBe(5);
  });
});

describe('validate', () => {
  let tmpDir: string;

  function writeTmp(filename: string, data: unknown): string {
    const filePath = path.join(tmpDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(data), 'utf-8');
    return filePath;
  }

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yakata-validate-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns error for missing file', () => {
    const result = validate(path.join(tmpDir, 'nonexistent.json'));
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('ファイルを読み込めません');
  });

  it('returns error for invalid JSON', () => {
    const filePath = path.join(tmpDir, 'bad.json');
    fs.writeFileSync(filePath, '{invalid json', 'utf-8');
    const result = validate(filePath);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('JSONの解析に失敗しました');
  });

  it('returns error for non-object top-level', () => {
    const filePath = writeTmp('string.json', 'hello');
    const result = validate(filePath);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('トップレベルがオブジェクトではありません');
  });

  it('returns error when rooms is missing', () => {
    const filePath = writeTmp('no-rooms.json', { freeTexts: [] });
    const result = validate(filePath);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('rooms配列が存在しません');
  });

  it('returns OK for valid empty project', () => {
    const filePath = writeTmp('empty.json', { rooms: [] });
    const result = validate(filePath);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('returns OK for valid rooms', () => {
    const filePath = writeTmp('valid.json', {
      rooms: [{ id: 'r1', x: 0, y: 0, w: 5, h: 5, label: 'テスト' }],
    });
    const result = validate(filePath);
    expect(result.errors).toHaveLength(0);
  });

  it('detects room with non-positive size', () => {
    const filePath = writeTmp('bad-size.json', {
      rooms: [{ id: 'r1', x: 0, y: 0, w: 0, h: 5, label: '部屋' }],
    });
    const result = validate(filePath);
    expect(result.errors.some((e) => e.includes('サイズが正でありません'))).toBe(true);
  });

  it('detects wall object with negative offset', () => {
    const filePath = writeTmp('neg-offset.json', {
      rooms: [
        {
          id: 'r1',
          x: 0,
          y: 0,
          w: 10,
          h: 5,
          label: '部屋',
          wallObjects: [{ id: 'w1', type: 'window', side: 'n', offset: -1, width: 2 }],
        },
      ],
    });
    const result = validate(filePath);
    expect(result.errors.some((e) => e.includes('offset') && e.includes('負です'))).toBe(true);
  });

  it('detects wall object exceeding wall length', () => {
    const filePath = writeTmp('overflow.json', {
      rooms: [
        {
          id: 'r1',
          x: 0,
          y: 0,
          w: 5,
          h: 5,
          label: '部屋',
          wallObjects: [{ id: 'w1', type: 'window', side: 'n', offset: 4, width: 3 }],
        },
      ],
    });
    const result = validate(filePath);
    expect(result.errors.some((e) => e.includes('壁の長さ') && e.includes('超えています'))).toBe(
      true,
    );
  });

  it('detects interior object out of room bounds', () => {
    const filePath = writeTmp('interior-oob.json', {
      rooms: [
        {
          id: 'r1',
          x: 0,
          y: 0,
          w: 5,
          h: 5,
          label: '部屋',
          interiorObjects: [
            {
              id: 'i1',
              type: 'stairs',
              stairsType: 'straight',
              direction: 'n',
              x: 4,
              y: 0,
              w: 3,
              h: 2,
            },
          ],
        },
      ],
    });
    const result = validate(filePath);
    expect(result.warnings.some((w) => w.includes('範囲外'))).toBe(true);
  });

  it('detects invalid pairedWith roomId', () => {
    const filePath = writeTmp('bad-pair-room.json', {
      rooms: [
        {
          id: 'r1',
          x: 0,
          y: 0,
          w: 10,
          h: 5,
          label: '部屋A',
          wallObjects: [
            {
              id: 'w1',
              type: 'window',
              side: 'e',
              offset: 1,
              width: 2,
              pairedWith: [{ roomId: 'nonexistent', objectId: 'w2' }],
            },
          ],
        },
      ],
    });
    const result = validate(filePath);
    expect(
      result.errors.some((e) => e.includes('pairedWith.roomId') && e.includes('存在しません')),
    ).toBe(true);
  });

  it('detects invalid pairedWith objectId', () => {
    const filePath = writeTmp('bad-pair-obj.json', {
      rooms: [
        {
          id: 'r1',
          x: 0,
          y: 0,
          w: 10,
          h: 5,
          label: '部屋A',
          wallObjects: [
            {
              id: 'w1',
              type: 'window',
              side: 'e',
              offset: 1,
              width: 2,
              pairedWith: [{ roomId: 'r2', objectId: 'nonexistent' }],
            },
          ],
        },
        {
          id: 'r2',
          x: 10,
          y: 0,
          w: 5,
          h: 5,
          label: '部屋B',
          wallObjects: [],
        },
      ],
    });
    const result = validate(filePath);
    expect(
      result.errors.some((e) => e.includes('pairedWith.objectId') && e.includes('存在しません')),
    ).toBe(true);
  });

  it('detects overlapping rooms', () => {
    const filePath = writeTmp('overlap.json', {
      rooms: [
        { id: 'r1', x: 0, y: 0, w: 5, h: 5, label: '部屋A' },
        { id: 'r2', x: 3, y: 3, w: 5, h: 5, label: '部屋B' },
      ],
    });
    const result = validate(filePath);
    expect(result.warnings.some((w) => w.includes('重なっています'))).toBe(true);
  });

  it('does not report overlap for non-overlapping rooms', () => {
    const filePath = writeTmp('no-overlap.json', {
      rooms: [
        { id: 'r1', x: 0, y: 0, w: 5, h: 5, label: '部屋A' },
        { id: 'r2', x: 5, y: 0, w: 5, h: 5, label: '部屋B' },
      ],
    });
    const result = validate(filePath);
    expect(result.warnings.filter((w) => w.includes('重なっています'))).toHaveLength(0);
  });
});
