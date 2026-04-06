import { describe, it, expect } from 'vitest';
import {
  parseStickyNoteLine,
  createStickyNote,
  hitStickyNote,
  hitStickyNoteCheckbox,
  toggleStickyNoteCheckbox,
  computeStickyNoteResize,
  findStickyNotesInArea,
  scaleStickyNoteFontSize,
  estimateWrappedLineCount,
} from './sticky-note.ts';
import type { StickyNote } from './types.ts';
import { GRID } from './grid.ts';

describe('parseStickyNoteLine', () => {
  it('parses unchecked checkbox', () => {
    const result = parseStickyNoteLine('- [ ] タスク');
    expect(result).toEqual({ type: 'checkbox', checked: false, text: 'タスク' });
  });

  it('parses checked checkbox', () => {
    const result = parseStickyNoteLine('- [x] 完了');
    expect(result).toEqual({ type: 'checkbox', checked: true, text: '完了' });
  });

  it('parses heading', () => {
    const result = parseStickyNoteLine('# 見出し');
    expect(result).toEqual({ type: 'heading', text: '見出し' });
  });

  it('parses bullet', () => {
    const result = parseStickyNoteLine('- 項目');
    expect(result).toEqual({ type: 'bullet', text: '項目' });
  });

  it('parses plain text', () => {
    const result = parseStickyNoteLine('通常テキスト');
    expect(result).toEqual({ type: 'text', text: '通常テキスト' });
  });

  it('parses empty line as text', () => {
    const result = parseStickyNoteLine('');
    expect(result).toEqual({ type: 'text', text: '' });
  });
});

describe('toggleStickyNoteCheckbox', () => {
  const note: StickyNote = {
    id: 'test-note',
    gx: 0,
    gy: 0,
    w: 5,
    h: 5,
    label: '# 要件\n- [ ] タスクA\n- [x] タスクB\n- 箇条書き',
    fontSize: 12,
    color: 'yellow',
  };

  it('toggles unchecked to checked', () => {
    const result = toggleStickyNoteCheckbox(note, 1);
    expect(result).toBe('# 要件\n- [x] タスクA\n- [x] タスクB\n- 箇条書き');
  });

  it('toggles checked to unchecked', () => {
    const result = toggleStickyNoteCheckbox(note, 2);
    expect(result).toBe('# 要件\n- [ ] タスクA\n- [ ] タスクB\n- 箇条書き');
  });

  it('returns unchanged label for non-checkbox line', () => {
    const result = toggleStickyNoteCheckbox(note, 0);
    expect(result).toBe(note.label);
  });

  it('returns unchanged label for out-of-range index', () => {
    const result = toggleStickyNoteCheckbox(note, 99);
    expect(result).toBe(note.label);
  });
});

describe('hitStickyNote', () => {
  const notes: StickyNote[] = [
    { id: 'a', gx: 0, gy: 0, w: 5, h: 5, label: '', fontSize: 12, color: 'yellow' },
    { id: 'b', gx: 3, gy: 3, w: 5, h: 5, label: '', fontSize: 12, color: 'pink' },
  ];

  it('returns topmost note (last in array)', () => {
    // Overlapping area: (3*GRID, 3*GRID) to (5*GRID, 5*GRID)
    const result = hitStickyNote(notes, 4 * GRID, 4 * GRID);
    expect(result?.id).toBe('b');
  });

  it('returns only hit note when no overlap', () => {
    const result = hitStickyNote(notes, 1 * GRID, 1 * GRID);
    expect(result?.id).toBe('a');
  });

  it('returns null on miss', () => {
    const result = hitStickyNote(notes, 100 * GRID, 100 * GRID);
    expect(result).toBeNull();
  });
});

describe('hitStickyNoteCheckbox', () => {
  const note: StickyNote = {
    id: 'test',
    gx: 0,
    gy: 0,
    w: 10,
    h: 10,
    label: '# 見出し\n- [ ] チェック\n通常',
    fontSize: 12,
    color: 'yellow',
  };

  it('returns -1 when outside note', () => {
    expect(hitStickyNoteCheckbox(note, -10, -10)).toBe(-1);
  });

  it('returns -1 when clicking heading line', () => {
    // First line is heading, clicking at its Y position
    expect(hitStickyNoteCheckbox(note, 6, 8)).toBe(-1);
  });

  it('returns line index when clicking checkbox area', () => {
    // Line 0 is heading (fontSize=12): curY advances by Math.round(12*1.3)*1.3 = 20.8
    // Line 1 is checkbox: cbSize=12*0.85=10.2, lineHeight=12*1.3=15.6
    // cbX=4, cbY=4+20.8+(15.6-10.2)/2 = 27.5
    // Clicking at (10, 32) should be inside the checkbox hit area
    expect(hitStickyNoteCheckbox(note, 10, 32)).toBe(1);
  });

  it('returns -1 when clicking normal text line', () => {
    // Line 2 is normal text, not a checkbox
    // curY after heading + checkbox line = 4 + 20.8 + 15.6 = 40.4
    // Clicking at center of normal text line
    expect(hitStickyNoteCheckbox(note, 10, 48)).toBe(-1);
  });
});

describe('estimateWrappedLineCount', () => {
  const fontFamily = 'sans-serif';

  it('returns 1 for empty text', () => {
    expect(estimateWrappedLineCount('', 12, fontFamily, 100)).toBe(1);
  });

  it('returns 1 for short text that fits', () => {
    expect(estimateWrappedLineCount('短い', 12, fontFamily, 200)).toBe(1);
  });

  it('returns multiple lines for long text', () => {
    // fontSize=12, CJK文字幅≈12 (fallback計算), maxWidth=50
    // 10文字 × 12 = 120 → 120/50 = 3行程度
    const longText = 'あいうえおかきくけこ';
    const result = estimateWrappedLineCount(longText, 12, fontFamily, 50);
    expect(result).toBeGreaterThan(1);
  });

  it('returns 1 when maxWidth is zero or negative', () => {
    expect(estimateWrappedLineCount('テスト', 12, fontFamily, 0)).toBe(1);
    expect(estimateWrappedLineCount('テスト', 12, fontFamily, -10)).toBe(1);
  });
});

describe('hitStickyNoteCheckbox with text wrapping', () => {
  it('correctly detects second checkbox when first has long text', () => {
    // 幅3グリッドの狭い付箋で、最初のチェックボックスに長いテキスト
    const note: StickyNote = {
      id: 'wrap-test',
      gx: 0,
      gy: 0,
      w: 3,
      h: 10,
      label: '- [ ] これは非常に長いタスクの説明文で折り返しが発生する\n- [ ] 短いタスク',
      fontSize: 12,
      color: 'yellow',
    };

    // 2行目のチェックボックスは、1行目の折り返し分だけ下にずれる
    // 折り返しを考慮しない場合は lineHeight (15.6px) 1行分の位置
    // 折り返しを考慮する場合はそれ以上下になる
    const lineHeight = 12 * 1.3; // 15.6

    // 1行分の位置（折り返し無視）→ 2番目のチェックボックスの旧位置
    const oldSecondCbY = 4 + lineHeight + (lineHeight - 12 * 0.85) / 2;

    // 折り返しが発生しているので、旧位置では2番目のチェックボックスに当たらないはず
    expect(hitStickyNoteCheckbox(note, 6, oldSecondCbY + 5)).toBe(-1);

    // 重要なのは、1番目のチェックボックス（行0）は常に正しくヒットすること
    const cbSize = 12 * 0.85;
    const firstCbY = 4 + (lineHeight - cbSize) / 2;
    expect(hitStickyNoteCheckbox(note, 6, firstCbY + cbSize / 2)).toBe(0);
  });
});

describe('computeStickyNoteResize', () => {
  const orig = { gx: 5, gy: 5, w: 10, h: 10 };

  it('resizes east', () => {
    const result = computeStickyNoteResize('se', orig, 20, 20);
    expect(result.w).toBe(15);
    expect(result.h).toBe(15);
  });

  it('resizes west', () => {
    const result = computeStickyNoteResize('nw', orig, 3, 3);
    expect(result.gx).toBe(3);
    expect(result.gy).toBe(3);
    expect(result.w).toBe(12);
    expect(result.h).toBe(12);
  });

  it('enforces minimum size', () => {
    const result = computeStickyNoteResize('se', orig, 5, 5);
    expect(result.w).toBe(1);
    expect(result.h).toBe(1);
  });
});

describe('findStickyNotesInArea', () => {
  const notes: StickyNote[] = [
    { id: 'a', gx: 1, gy: 1, w: 2, h: 2, label: '', fontSize: 12, color: 'yellow' },
    { id: 'b', gx: 5, gy: 5, w: 2, h: 2, label: '', fontSize: 12, color: 'pink' },
  ];

  it('finds notes fully inside area', () => {
    const result = findStickyNotesInArea(notes, { x: 0, y: 0, w: 10, h: 10 });
    expect(result).toHaveLength(2);
  });

  it('finds only contained notes', () => {
    const result = findStickyNotesInArea(notes, { x: 0, y: 0, w: 4, h: 4 });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a');
  });

  it('returns empty when no notes in area', () => {
    const result = findStickyNotesInArea(notes, { x: 20, y: 20, w: 5, h: 5 });
    expect(result).toHaveLength(0);
  });
});

describe('scaleStickyNoteFontSize', () => {
  it('scales proportionally', () => {
    expect(scaleStickyNoteFontSize(12, 5, 10)).toBe(24);
  });

  it('returns original for zero height', () => {
    expect(scaleStickyNoteFontSize(12, 0, 10)).toBe(12);
  });
});

describe('createStickyNote', () => {
  it('creates with defaults', () => {
    const note = createStickyNote(5, 10, 'Hello');
    expect(note.gx).toBe(5);
    expect(note.gy).toBe(10);
    expect(note.w).toBe(5);
    expect(note.h).toBe(5);
    expect(note.label).toBe('Hello');
    expect(note.fontSize).toBe(12);
    expect(note.color).toBe('yellow');
    expect(note.id).toBeTruthy();
  });

  it('accepts custom color', () => {
    const note = createStickyNote(0, 0, '', 14, 'pink');
    expect(note.color).toBe('pink');
    expect(note.fontSize).toBe(14);
  });
});
