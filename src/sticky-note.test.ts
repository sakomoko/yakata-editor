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
