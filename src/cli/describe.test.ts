import { describe, it, expect } from 'vitest';
import {
  describeWallObject,
  describeInterior,
  describeArrow,
  describeProject,
  sideLabel,
} from './describe.ts';
import type { ProjectFile } from './describe.ts';
import type { WallObject, RoomInteriorObject, Arrow } from '../types.ts';

describe('sideLabel', () => {
  it('returns correct labels', () => {
    expect(sideLabel('n')).toBe('北壁');
    expect(sideLabel('e')).toBe('東壁');
    expect(sideLabel('s')).toBe('南壁');
    expect(sideLabel('w')).toBe('西壁');
  });
});

describe('describeWallObject', () => {
  it('describes a window', () => {
    const obj: WallObject = { id: 'w1', type: 'window', side: 'n', offset: 2, width: 3 };
    const result = describeWallObject(obj);
    expect(result).toContain('北壁');
    expect(result).toContain('窓');
    expect(result).toContain('offset: 2');
    expect(result).toContain('幅: 3');
  });

  it('describes a door with swing and hinge', () => {
    const obj: WallObject = {
      id: 'd1',
      type: 'door',
      side: 'e',
      offset: 1,
      width: 2,
      swing: 'inward',
      hinge: 'start',
    };
    const result = describeWallObject(obj);
    expect(result).toContain('東壁');
    expect(result).toContain('ドア');
    expect(result).toContain('swing: inward');
    expect(result).toContain('hinge: start');
  });

  it('describes an opening', () => {
    const obj: WallObject = { id: 'o1', type: 'opening', side: 's', offset: 0, width: 5 };
    const result = describeWallObject(obj);
    expect(result).toContain('南壁');
    expect(result).toContain('開口');
  });
});

describe('describeInterior', () => {
  it('describes straight stairs', () => {
    const obj: RoomInteriorObject = {
      id: 's1',
      type: 'stairs',
      stairsType: 'straight',
      direction: 'n',
      x: 1,
      y: 2,
      w: 3,
      h: 4,
    };
    const result = describeInterior(obj);
    expect(result).toContain('直線階段');
    expect(result).toContain('(1, 2)');
    expect(result).toContain('3×4');
    expect(result).toContain('方向: 北');
  });

  it('describes folding stairs', () => {
    const obj: RoomInteriorObject = {
      id: 's2',
      type: 'stairs',
      stairsType: 'folding',
      direction: 'e',
      x: 0,
      y: 0,
      w: 4,
      h: 4,
    };
    const result = describeInterior(obj);
    expect(result).toContain('折り返し階段');
    expect(result).toContain('方向: 東');
  });

  it('describes marker with label', () => {
    const obj: RoomInteriorObject = {
      id: 'm1',
      type: 'marker',
      markerKind: 'body',
      direction: 'e',
      x: 2,
      y: 3,
      w: 1,
      h: 1,
      label: '被害者',
    };
    const result = describeInterior(obj);
    expect(result).toContain('マーカー(body)');
    expect(result).toContain('"被害者"');
    expect(result).toContain('(2, 3)');
  });

  it('describes marker without label', () => {
    const obj: RoomInteriorObject = {
      id: 'm2',
      type: 'marker',
      markerKind: 'pin',
      direction: 'e',
      x: 0,
      y: 0,
      w: 1,
      h: 1,
    };
    const result = describeInterior(obj);
    expect(result).toContain('マーカー(pin)');
    expect(result).not.toContain('"');
  });

  it('describes security camera', () => {
    const obj: RoomInteriorObject = {
      id: 'c1',
      type: 'camera',
      x: 1,
      y: 1,
      w: 1,
      h: 1,
      angle: Math.PI / 2,
      fovAngle: Math.PI / 6,
      fovRange: 5,
      fovColor: 'rgba(0,150,255,0.15)',
      fovStrokeColor: 'rgba(0,150,255,0.4)',
    };
    const result = describeInterior(obj);
    expect(result).toContain('防犯カメラ');
    expect(result).toContain('角度: 90°');
    expect(result).toContain('視野: 5グリッド');
  });
});

describe('describeProject', () => {
  it('describes an empty project', () => {
    const project: ProjectFile = {
      rooms: [],
      freeTexts: [],
      freeStrokes: [],
      arrows: [],
      stickyNotes: [],
    };
    const result = describeProject(project);
    expect(result).toContain('# プロジェクト構造');
    expect(result).toContain('## 部屋一覧 (0部屋)');
  });

  it('describes rooms with wall objects and interiors', () => {
    const project: ProjectFile = {
      rooms: [
        {
          id: 'r1',
          x: 0,
          y: 0,
          w: 10,
          h: 8,
          label: 'リビング',
          floor: 1,
          wallObjects: [{ id: 'w1', type: 'window', side: 'n', offset: 2, width: 3 }],
          interiorObjects: [
            {
              id: 's1',
              type: 'stairs',
              stairsType: 'straight',
              direction: 'n',
              x: 0,
              y: 0,
              w: 2,
              h: 4,
            },
          ],
        },
      ],
      freeTexts: [],
      freeStrokes: [],
      arrows: [],
      stickyNotes: [],
    };
    const result = describeProject(project);
    expect(result).toContain('## 部屋一覧 (1部屋)');
    expect(result).toContain('### リビング');
    expect(result).toContain('位置: (0, 0), サイズ: 10×8 グリッド');
    expect(result).toContain('1F');
    expect(result).toContain('壁オブジェクト:');
    expect(result).toContain('窓');
    expect(result).toContain('インテリア:');
    expect(result).toContain('直線階段');
  });

  it('describes free texts', () => {
    const project: ProjectFile = {
      rooms: [],
      freeTexts: [
        { id: 'ft1', gx: 5, gy: 10, w: 3, h: 2, label: 'メモ', fontSize: 14, zLayer: 'front' },
      ],
      freeStrokes: [],
      arrows: [],
      stickyNotes: [],
    };
    const result = describeProject(project);
    expect(result).toContain('## フリーテキスト (1個)');
    expect(result).toContain('"メモ"');
    expect(result).toContain('(5, 10)');
  });

  it('describes free strokes', () => {
    const project: ProjectFile = {
      rooms: [],
      freeTexts: [],
      freeStrokes: [
        {
          id: 'fs1',
          points: [
            { px: 0, py: 0 },
            { px: 10, py: 10 },
          ],
          color: '#ff0000',
          lineWidth: 2,
          opacity: 1,
        },
      ],
      arrows: [],
      stickyNotes: [],
    };
    const result = describeProject(project);
    expect(result).toContain('## フリーストローク (1本)');
    expect(result).toContain('#ff0000');
    expect(result).toContain('2点');
  });

  it('describes room without label as (名前なし)', () => {
    const project: ProjectFile = {
      rooms: [{ id: 'r1', x: 0, y: 0, w: 5, h: 5, label: '' }],
      freeTexts: [],
      freeStrokes: [],
      arrows: [],
      stickyNotes: [],
    };
    const result = describeProject(project);
    expect(result).toContain('(名前なし)');
  });

  it('defaults floor to 1F', () => {
    const project: ProjectFile = {
      rooms: [{ id: 'r1', x: 0, y: 0, w: 5, h: 5, label: 'テスト' }],
      freeTexts: [],
      freeStrokes: [],
      arrows: [],
      stickyNotes: [],
    };
    const result = describeProject(project);
    expect(result).toContain('1F');
  });

  it('describes arrows with label', () => {
    const project: ProjectFile = {
      rooms: [],
      freeTexts: [],
      freeStrokes: [],
      arrows: [
        {
          id: 'a1',
          points: [
            { gx: 2, gy: 3 },
            { gx: 5, gy: 3 },
            { gx: 5, gy: 7 },
          ],
          color: '#cc0000',
          lineWidth: 2,
          label: '犯人の動線',
        },
      ],
      stickyNotes: [],
    };
    const result = describeProject(project);
    expect(result).toContain('## 矢印 (1本)');
    expect(result).toContain('矢印1: (2, 3) → (5, 3) → (5, 7)');
    expect(result).toContain('[#cc0000, 2px]');
    expect(result).toContain('ラベル: 犯人の動線');
  });

  it('describes arrows without label', () => {
    const project: ProjectFile = {
      rooms: [],
      freeTexts: [],
      freeStrokes: [],
      arrows: [
        {
          id: 'a2',
          points: [
            { gx: 0, gy: 0 },
            { gx: 4, gy: 0 },
          ],
          color: '#0055cc',
          lineWidth: 1,
        },
      ],
      stickyNotes: [],
    };
    const result = describeProject(project);
    expect(result).toContain('矢印1: (0, 0) → (4, 0) [#0055cc, 1px]');
    expect(result).not.toContain('ラベル:');
  });
});

describe('describeArrow', () => {
  it('formats arrow with label', () => {
    const arrow: Arrow = {
      id: 'a1',
      points: [
        { gx: 1, gy: 2 },
        { gx: 3, gy: 4 },
      ],
      color: '#ff0000',
      lineWidth: 2,
      label: 'テスト',
    };
    expect(describeArrow(arrow, 0)).toBe('矢印1: (1, 2) → (3, 4) [#ff0000, 2px] ラベル: テスト');
  });

  it('handles empty points array', () => {
    const arrow: Arrow = {
      id: 'a0',
      points: [],
      color: '#cc0000',
      lineWidth: 1,
    };
    expect(describeArrow(arrow, 0)).toBe('矢印1: (点なし) [#cc0000, 1px]');
  });

  it('formats arrow without label', () => {
    const arrow: Arrow = {
      id: 'a2',
      points: [
        { gx: 0, gy: 0 },
        { gx: 5, gy: 5 },
      ],
      color: '#0000ff',
      lineWidth: 1,
    };
    expect(describeArrow(arrow, 2)).toBe('矢印3: (0, 0) → (5, 5) [#0000ff, 1px]');
  });
});
