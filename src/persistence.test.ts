import { describe, it, expect } from 'vitest';
import { ensureWallObjectIds } from './persistence.ts';
import type { WallDoor } from './types.ts';

describe('ensureWallObjectIds', () => {
  it('窓データを正しく復元する', () => {
    const raw = [{ type: 'window', side: 'n', offset: 2, width: 1 }];
    const result = ensureWallObjectIds(raw);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('window');
    expect(result[0].side).toBe('n');
    expect(result[0].offset).toBe(2);
    expect(result[0].width).toBe(1);
    expect(result[0].id).toBeTruthy();
  });

  it('ドアデータを正しく復元する', () => {
    const raw = [{ type: 'door', side: 's', offset: 1, width: 2, swing: 'outward' }];
    const result = ensureWallObjectIds(raw);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('door');
    expect((result[0] as WallDoor).swing).toBe('outward');
  });

  it('swing が欠損したドアデータは inward にフォールバックする', () => {
    const raw = [{ type: 'door', side: 'n', offset: 2, width: 1 }];
    const result = ensureWallObjectIds(raw);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('door');
    expect((result[0] as WallDoor).swing).toBe('inward');
  });

  it('swing が不正な値のドアデータは inward にフォールバックする', () => {
    const raw = [{ type: 'door', side: 'n', offset: 2, width: 1, swing: 'invalid' }];
    const result = ensureWallObjectIds(raw);
    expect(result).toHaveLength(1);
    expect((result[0] as WallDoor).swing).toBe('inward');
  });

  it('不正な type のデータはフィルタで除外される', () => {
    const raw = [{ type: 'unknown', side: 'n', offset: 0, width: 1 }];
    const result = ensureWallObjectIds(raw);
    expect(result).toHaveLength(0);
  });

  it('必須プロパティが欠損したデータはフィルタで除外される', () => {
    const raw = [{ type: 'window', side: 'n' }];
    const result = ensureWallObjectIds(raw);
    expect(result).toHaveLength(0);
  });

  it('既存の id を保持する', () => {
    const raw = [{ id: 'test-id', type: 'window', side: 'n', offset: 0, width: 1 }];
    const result = ensureWallObjectIds(raw);
    expect(result[0].id).toBe('test-id');
  });

  it('窓とドアが混在するデータを正しく復元する', () => {
    const raw = [
      { type: 'window', side: 'n', offset: 0, width: 1 },
      { type: 'door', side: 's', offset: 2, width: 1, swing: 'outward' },
      { type: 'door', side: 'e', offset: 1, width: 1 },
    ];
    const result = ensureWallObjectIds(raw);
    expect(result).toHaveLength(3);
    expect(result[0].type).toBe('window');
    expect(result[1].type).toBe('door');
    expect((result[1] as WallDoor).swing).toBe('outward');
    expect(result[2].type).toBe('door');
    expect((result[2] as WallDoor).swing).toBe('inward');
  });
});
