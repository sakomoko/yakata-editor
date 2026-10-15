import { describe, it, expect } from 'vitest';
import { isVisible, filterVisible, setAnnotation, collectHiddenIds } from './annotation.ts';
import type { Annotatable, Arrow, FreeText, Room } from './types.ts';

describe('isVisible', () => {
  it('全表示時は注釈も見える', () => {
    expect(isVisible({ annotation: true }, true)).toBe(true);
  });

  it('非表示時は注釈だけ見えない', () => {
    expect(isVisible({ annotation: true }, false)).toBe(false);
    expect(isVisible({}, false)).toBe(true);
  });
});

describe('filterVisible', () => {
  const list: (Annotatable & { id: string })[] = [
    { id: 'a' },
    { id: 'b', annotation: true },
    { id: 'c', annotation: false },
  ];

  it('全表示時は同じ配列を返す', () => {
    expect(filterVisible(list, true)).toBe(list);
  });

  it('非表示時は注釈を除外する', () => {
    expect(filterVisible(list, false).map((o) => o.id)).toEqual(['a', 'c']);
  });
});

describe('setAnnotation', () => {
  it('ONでtrue、OFFでプロパティを削除する', () => {
    const obj: Annotatable = {};
    setAnnotation(obj, true);
    expect(obj.annotation).toBe(true);
    setAnnotation(obj, false);
    expect('annotation' in obj).toBe(false);
  });
});

describe('collectHiddenIds', () => {
  const ft: FreeText = {
    id: 'ft1',
    gx: 0,
    gy: 0,
    w: 1,
    h: 1,
    label: 'メモ',
    fontSize: 14,
    zLayer: 'front',
    annotation: true,
  };
  const arrow: Arrow = {
    id: 'ar1',
    points: [
      { gx: 0, gy: 0 },
      { gx: 1, gy: 1 },
    ],
    color: '#cc0000',
    lineWidth: 2,
  };
  const room: Room = {
    id: 'r1',
    x: 0,
    y: 0,
    w: 5,
    h: 5,
    label: 'ホール',
    interiorObjects: [
      {
        id: 'cam1',
        type: 'camera',
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        angle: 0,
        fovAngle: Math.PI / 6,
        fovRange: 5,
        fovColor: 'rgba(0,150,255,0.15)',
        fovStrokeColor: 'rgba(0,150,255,0.4)',
        annotation: true,
      },
    ],
  };

  it('全表示時は空', () => {
    const ids = collectHiddenIds({
      rooms: [room],
      freeTexts: [ft],
      freeStrokes: [],
      arrows: [arrow],
      showAnnotations: true,
    });
    expect(ids.size).toBe(0);
  });

  it('非表示時は注釈のIDだけを集める（部屋内オブジェクト含む）', () => {
    const ids = collectHiddenIds({
      rooms: [room],
      freeTexts: [ft],
      freeStrokes: [],
      arrows: [arrow],
      showAnnotations: false,
    });
    expect([...ids].sort()).toEqual(['cam1', 'ft1']);
  });
});
