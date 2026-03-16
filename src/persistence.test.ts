import { describe, it, expect } from 'vitest';
import { ensureWallObjectIds, ensureInteriorObjectIds, ensureFreeTextIds } from './persistence.ts';
import type { WallDoor, StraightStairs, FoldingStairs, Marker } from './types.ts';

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

  it('hinge=end のドアがシリアライズ後も復元される', () => {
    const raw = [{ type: 'door', side: 'n', offset: 1, width: 1, swing: 'inward', hinge: 'end' }];
    const json = JSON.parse(JSON.stringify(raw));
    const result = ensureWallObjectIds(json);
    expect(result).toHaveLength(1);
    expect((result[0] as WallDoor).hinge).toBe('end');
  });

  it('hinge が欠損したドアデータは start にフォールバックする', () => {
    const raw = [{ type: 'door', side: 'n', offset: 2, width: 1, swing: 'inward' }];
    const result = ensureWallObjectIds(raw);
    expect(result).toHaveLength(1);
    expect((result[0] as WallDoor).hinge).toBe('start');
  });

  it('hinge が不正な値のドアデータは start にフォールバックする', () => {
    const raw = [
      { type: 'door', side: 'n', offset: 2, width: 1, swing: 'inward', hinge: 'middle' },
    ];
    const result = ensureWallObjectIds(raw);
    expect(result).toHaveLength(1);
    expect((result[0] as WallDoor).hinge).toBe('start');
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

describe('ensureInteriorObjectIds', () => {
  it('階段データを正しく復元する', () => {
    const raw = [
      { type: 'stairs', stairsType: 'straight', direction: 'n', x: 1, y: 2, w: 2, h: 3 },
    ];
    const result = ensureInteriorObjectIds(raw);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('stairs');
    const stairs = result[0] as StraightStairs;
    expect(stairs.stairsType).toBe('straight');
    expect(stairs.direction).toBe('n');
    expect(stairs.x).toBe(1);
    expect(stairs.y).toBe(2);
    expect(stairs.w).toBe(2);
    expect(stairs.h).toBe(3);
    expect(stairs.id).toBeTruthy();
  });

  it('既存のidを保持する', () => {
    const raw = [
      {
        id: 'test-id',
        type: 'stairs',
        stairsType: 'straight',
        direction: 's',
        x: 0,
        y: 0,
        w: 2,
        h: 3,
      },
    ];
    const result = ensureInteriorObjectIds(raw);
    expect(result[0].id).toBe('test-id');
  });

  it('不正なtypeのデータはフィルタで除外される', () => {
    const raw = [{ type: 'unknown', x: 0, y: 0, w: 2, h: 3 }];
    const result = ensureInteriorObjectIds(raw);
    expect(result).toHaveLength(0);
  });

  it('必須プロパティが欠損したデータはフィルタで除外される', () => {
    const raw = [{ type: 'stairs', x: 0, y: 0 }];
    const result = ensureInteriorObjectIds(raw);
    expect(result).toHaveLength(0);
  });

  it('stairsTypeが欠損した場合straightにフォールバックする', () => {
    const raw = [{ type: 'stairs', direction: 'e', x: 0, y: 0, w: 2, h: 3 }];
    const result = ensureInteriorObjectIds(raw);
    expect(result).toHaveLength(1);
    expect((result[0] as StraightStairs).stairsType).toBe('straight');
  });

  it('directionが欠損した場合nにフォールバックする', () => {
    const raw = [{ type: 'stairs', stairsType: 'straight', x: 0, y: 0, w: 2, h: 3 }];
    const result = ensureInteriorObjectIds(raw);
    expect(result).toHaveLength(1);
    expect((result[0] as StraightStairs).direction).toBe('n');
  });

  it('directionが不正な値の場合nにフォールバックする', () => {
    const raw = [
      { type: 'stairs', stairsType: 'straight', direction: 'invalid', x: 0, y: 0, w: 2, h: 3 },
    ];
    const result = ensureInteriorObjectIds(raw);
    expect((result[0] as StraightStairs).direction).toBe('n');
  });

  it('折り返し階段データを正しく復元する', () => {
    const raw = [{ type: 'stairs', stairsType: 'folding', direction: 'e', x: 0, y: 0, w: 4, h: 3 }];
    const result = ensureInteriorObjectIds(raw);
    expect(result).toHaveLength(1);
    const stairs = result[0] as FoldingStairs;
    expect(stairs.stairsType).toBe('folding');
    expect(stairs.direction).toBe('e');
    expect(stairs.w).toBe(4);
  });

  it('stairsTypeが不正な値の場合straightにフォールバックする', () => {
    const raw = [{ type: 'stairs', stairsType: 'unknown', direction: 'n', x: 0, y: 0, w: 2, h: 3 }];
    const result = ensureInteriorObjectIds(raw);
    expect((result[0] as StraightStairs).stairsType).toBe('straight');
  });

  it('bodyマーカーを正しく復元する', () => {
    const raw = [{ type: 'marker', markerKind: 'body', direction: 'e', x: 1, y: 2, w: 2, h: 1 }];
    const result = ensureInteriorObjectIds(raw);
    expect(result).toHaveLength(1);
    const marker = result[0] as Marker;
    expect(marker.type).toBe('marker');
    expect(marker.markerKind).toBe('body');
    expect(marker.direction).toBe('e');
    expect(marker.label).toBeUndefined();
  });

  it('pinマーカーをラベル付きで復元する', () => {
    const raw = [
      {
        type: 'marker',
        markerKind: 'pin',
        direction: 'n',
        x: 0,
        y: 0,
        w: 3,
        h: 1,
        label: '証拠品',
      },
    ];
    const result = ensureInteriorObjectIds(raw);
    const marker = result[0] as Marker;
    expect(marker.markerKind).toBe('pin');
    expect(marker.label).toBe('証拠品');
  });

  it('textマーカーを復元する', () => {
    const raw = [
      { type: 'marker', markerKind: 'text', direction: 'e', x: 0, y: 0, w: 2, h: 1, label: 'メモ' },
    ];
    const result = ensureInteriorObjectIds(raw);
    const marker = result[0] as Marker;
    expect(marker.markerKind).toBe('text');
    expect(marker.label).toBe('メモ');
  });

  it('markerKindが不正な値の場合bodyにフォールバックする', () => {
    const raw = [{ type: 'marker', markerKind: 'unknown', direction: 'e', x: 0, y: 0, w: 2, h: 1 }];
    const result = ensureInteriorObjectIds(raw);
    expect((result[0] as Marker).markerKind).toBe('body');
  });

  it('マーカーのdirectionが不正な値の場合eにフォールバックする', () => {
    const raw = [
      { type: 'marker', markerKind: 'body', direction: 'invalid', x: 0, y: 0, w: 2, h: 1 },
    ];
    const result = ensureInteriorObjectIds(raw);
    expect((result[0] as Marker).direction).toBe('e');
  });

  it('空文字のラベルは復元しない', () => {
    const raw = [
      { type: 'marker', markerKind: 'pin', direction: 'e', x: 0, y: 0, w: 2, h: 1, label: '' },
    ];
    const result = ensureInteriorObjectIds(raw);
    expect((result[0] as Marker).label).toBeUndefined();
  });
});

describe('ensureFreeTextIds', () => {
  it('FreeTextデータを正しく復元する', () => {
    const raw = [{ gx: 5, gy: 10, w: 3, h: 2, label: 'Hello', fontSize: 20, zLayer: 'back' }];
    const result = ensureFreeTextIds(raw);
    expect(result).toHaveLength(1);
    expect(result[0].gx).toBe(5);
    expect(result[0].gy).toBe(10);
    expect(result[0].label).toBe('Hello');
    expect(result[0].fontSize).toBe(20);
    expect(result[0].zLayer).toBe('back');
    expect(result[0].id).toBeTruthy();
  });

  it('既存のidを保持する', () => {
    const raw = [{ id: 'ft-id', gx: 0, gy: 0, w: 3, h: 2, label: 'Test' }];
    const result = ensureFreeTextIds(raw);
    expect(result[0].id).toBe('ft-id');
  });

  it('fontSizeが欠損した場合14にフォールバックする', () => {
    const raw = [{ gx: 0, gy: 0, w: 3, h: 2, label: 'Test' }];
    const result = ensureFreeTextIds(raw);
    expect(result[0].fontSize).toBe(14);
  });

  it('zLayerが欠損した場合frontにフォールバックする', () => {
    const raw = [{ gx: 0, gy: 0, w: 3, h: 2, label: 'Test' }];
    const result = ensureFreeTextIds(raw);
    expect(result[0].zLayer).toBe('front');
  });

  it('zLayerが不正な値の場合frontにフォールバックする', () => {
    const raw = [{ gx: 0, gy: 0, w: 3, h: 2, label: 'Test', zLayer: 'invalid' }];
    const result = ensureFreeTextIds(raw);
    expect(result[0].zLayer).toBe('front');
  });

  it('必須プロパティが欠損したデータはフィルタで除外される', () => {
    const raw = [{ gx: 0, gy: 0 }];
    const result = ensureFreeTextIds(raw);
    expect(result).toHaveLength(0);
  });

  it('labelがstring以外のデータはフィルタで除外される', () => {
    const raw = [{ gx: 0, gy: 0, w: 3, h: 2, label: 123 }];
    const result = ensureFreeTextIds(raw);
    expect(result).toHaveLength(0);
  });
});
