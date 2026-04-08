import { describe, it, expect, vi } from 'vitest';
import {
  withFontSizePreview,
  deleteSelectedEntities,
  deleteRoom,
  commitChange,
  undo,
  redo,
  exportAsPng,
} from './project.ts';
import { createRoom } from '../room.ts';
import { createFreeText } from '../free-text.ts';
import { createFreeStroke } from '../free-stroke.ts';
import { createStickyNote } from '../sticky-note.ts';
import type { EditorContext } from './context.ts';
import type { ViewportState } from '../viewport.ts';

vi.mock('../persistence.ts', () => ({
  exportPng: vi.fn(),
  saveAsJson: vi.fn(),
}));

function createMockEc(): EditorContext {
  const viewport: ViewportState = { zoom: 1, panX: 0, panY: 0 };
  return {
    canvas: {} as HTMLCanvasElement,
    ctx: {} as CanvasRenderingContext2D,
    container: {} as HTMLElement,
    state: {
      rooms: [],
      freeTexts: [],
      freeStrokes: [],
      arrows: [],
      stickyNotes: [],
      selection: new Set<string>(),
      history: [],
      redoHistory: [],
      drag: null,
      mouse: { px: 0, py: 0, gx: 0, gy: 0 },
      paintMode: false,
      paintColor: '#000000',
      paintLineWidth: 2,
      paintOpacity: 1,
      arrowMode: false,
      arrowColor: '#cc0000',
      arrowLineWidth: 2,
    },
    viewport,
    callbacks: {
      onStatusChange: vi.fn(),
      onRoomEdit: vi.fn(),
      onMarkerEdit: vi.fn(),
      onFreeTextEdit: vi.fn(),
      onContextMenu: vi.fn(),
      onAutoSave: vi.fn(),
      onViewportChange: vi.fn(),
    },
    flags: {
      isPanning: false,
      activeInteriorObjectId: undefined,
      activeFreeTextId: undefined,
      activeStickyNoteId: undefined,
      snapIndicator: null,
      savedRedo: null,
      drawArrowPreview: null,
    },
    render: vi.fn(),
    commitChange: vi.fn((fn: () => void) => fn()),
    mousePos: vi.fn(),
  } as unknown as EditorContext;
}

describe('withFontSizePreview', () => {
  it('OK時: applyResultが呼ばれ、commitChangeが走る', async () => {
    const ec = createMockEc();
    let currentFontSize: number | undefined = 14;
    const applyResult = vi.fn();

    await withFontSizePreview(
      ec,
      () => currentFontSize,
      (fs) => {
        currentFontSize = fs;
      },
      async (_onPreview) => ({ label: 'test', fontSize: 20 }),
      applyResult,
    );

    expect(applyResult).toHaveBeenCalledWith({ label: 'test', fontSize: 20 });
    expect(currentFontSize).toBe(14); // restored to original before apply
  });

  it('キャンセル時: 元のfontSizeに戻され、render()が呼ばれる', async () => {
    const ec = createMockEc();
    let currentFontSize: number | undefined = 14;

    await withFontSizePreview(
      ec,
      () => currentFontSize,
      (fs) => {
        currentFontSize = fs;
      },
      async (_onPreview) => null,
      vi.fn(),
    );

    expect(currentFontSize).toBe(14); // restored to original
    expect(ec.render).toHaveBeenCalled();
  });

  it('プレビュー中: setCurrentFontSize + ec.render()が即時呼ばれる', async () => {
    const ec = createMockEc();
    let currentFontSize: number | undefined = 14;
    let capturedOnPreview: ((fs: number | undefined) => void) | null = null;

    await withFontSizePreview(
      ec,
      () => currentFontSize,
      (fs) => {
        currentFontSize = fs;
      },
      async (onPreview) => {
        capturedOnPreview = onPreview;
        onPreview(24);
        onPreview(30);
        return null;
      },
      vi.fn(),
    );

    // During preview, fontSize was changed
    expect(capturedOnPreview).not.toBeNull();
    // After dialog closes (cancelled), it should be restored
    expect(currentFontSize).toBe(14);
    // render was called for each preview + once for cancel restore
    expect(ec.render).toHaveBeenCalledTimes(3);
  });

  it('例外発生時: フォントサイズが元の値に復元され、例外が再throwされる', async () => {
    const ec = createMockEc();
    let currentFontSize: number | undefined = 14;
    const error = new Error('dialog failed');

    await expect(
      withFontSizePreview(
        ec,
        () => currentFontSize,
        (fs) => {
          currentFontSize = fs;
        },
        async (onPreview) => {
          onPreview(30);
          throw error;
        },
        vi.fn(),
      ),
    ).rejects.toThrow('dialog failed');

    expect(currentFontSize).toBe(14); // restored to original
    // render called once for preview(30) + once for catch recovery
    expect(ec.render).toHaveBeenCalledTimes(2);
  });
});

describe('deleteSelectedEntities', () => {
  it('選択された部屋を削除する', () => {
    const ec = createMockEc();
    const room1 = createRoom(0, 0, 5, 5, 'Room1');
    const room2 = createRoom(5, 0, 5, 5, 'Room2');
    ec.state.rooms = [room1, room2];
    ec.state.selection.add(room1.id);

    deleteSelectedEntities(ec);

    expect(ec.state.rooms).toHaveLength(1);
    expect(ec.state.rooms[0].id).toBe(room2.id);
    expect(ec.state.selection.size).toBe(0);
  });

  it('選択が空の場合は何もしない', () => {
    const ec = createMockEc();
    const room = createRoom(0, 0, 5, 5, 'Room');
    ec.state.rooms = [room];

    deleteSelectedEntities(ec);

    expect(ec.state.rooms).toHaveLength(1);
    expect(ec.callbacks.onAutoSave).not.toHaveBeenCalled();
  });

  it('複数の選択エンティティを一度に削除する', () => {
    const ec = createMockEc();
    const room1 = createRoom(0, 0, 5, 5, 'Room1');
    const room2 = createRoom(5, 0, 5, 5, 'Room2');
    const room3 = createRoom(10, 0, 5, 5, 'Room3');
    ec.state.rooms = [room1, room2, room3];
    ec.state.selection.add(room1.id);
    ec.state.selection.add(room3.id);

    deleteSelectedEntities(ec);

    expect(ec.state.rooms).toHaveLength(1);
    expect(ec.state.rooms[0].id).toBe(room2.id);
  });

  it('選択されたFreeText・FreeStrokeも削除する', () => {
    const ec = createMockEc();
    const ft1 = createFreeText(1, 1, 'text1');
    const ft2 = createFreeText(2, 2, 'text2');
    const fs1 = createFreeStroke([{ px: 0, py: 0 }], '#000', 2, 1);
    const fs2 = createFreeStroke([{ px: 10, py: 10 }], '#f00', 2, 1);
    ec.state.freeTexts = [ft1, ft2];
    ec.state.freeStrokes = [fs1, fs2];
    ec.state.selection.add(ft1.id);
    ec.state.selection.add(fs1.id);

    deleteSelectedEntities(ec);

    expect(ec.state.freeTexts).toHaveLength(1);
    expect(ec.state.freeTexts[0].id).toBe(ft2.id);
    expect(ec.state.freeStrokes).toHaveLength(1);
    expect(ec.state.freeStrokes[0].id).toBe(fs2.id);
  });
});

describe('deleteRoom', () => {
  it('指定IDの部屋を削除する', () => {
    const ec = createMockEc();
    const room1 = createRoom(0, 0, 5, 5, 'Room1');
    const room2 = createRoom(5, 0, 5, 5, 'Room2');
    ec.state.rooms = [room1, room2];

    deleteRoom(ec, room1.id);

    expect(ec.state.rooms).toHaveLength(1);
    expect(ec.state.rooms[0].id).toBe(room2.id);
  });

  it('存在しないroomIdの場合は何もしない', () => {
    const ec = createMockEc();
    const room = createRoom(0, 0, 5, 5, 'Room');
    ec.state.rooms = [room];

    deleteRoom(ec, 'non-existent-id');

    expect(ec.state.rooms).toHaveLength(1);
    expect(ec.callbacks.onAutoSave).not.toHaveBeenCalled();
  });

  it('他の部屋の選択状態を変更しない', () => {
    const ec = createMockEc();
    const room1 = createRoom(0, 0, 5, 5, 'Room1');
    const room2 = createRoom(5, 0, 5, 5, 'Room2');
    ec.state.rooms = [room1, room2];
    ec.state.selection.add(room2.id);

    deleteRoom(ec, room1.id);

    expect(ec.state.rooms).toHaveLength(1);
    expect(ec.state.selection.has(room2.id)).toBe(true);
  });

  it('削除対象の部屋が選択されている場合、選択から除外される', () => {
    const ec = createMockEc();
    const room = createRoom(0, 0, 5, 5, 'Room');
    ec.state.rooms = [room];
    ec.state.selection.add(room.id);

    deleteRoom(ec, room.id);

    expect(ec.state.rooms).toHaveLength(0);
    expect(ec.state.selection.has(room.id)).toBe(false);
  });
});

describe('undo / redo 統合テスト', () => {
  /** commitChange を実際に動かすための EditorContext を生成する */
  function createRealCommitEc(): EditorContext {
    const viewport: ViewportState = { zoom: 1, panX: 0, panY: 0 };
    const ec = {
      canvas: {} as HTMLCanvasElement,
      ctx: {} as CanvasRenderingContext2D,
      container: {} as HTMLElement,
      state: {
        rooms: [],
        freeTexts: [],
        freeStrokes: [],
        arrows: [],
        stickyNotes: [],
        selection: new Set<string>(),
        history: [],
        redoHistory: [],
        drag: null,
        mouse: { px: 0, py: 0, gx: 0, gy: 0 },
        paintMode: false,
        paintColor: '#000000',
        paintLineWidth: 2,
        paintOpacity: 1,
        arrowMode: false,
        arrowColor: '#cc0000',
        arrowLineWidth: 2,
      },
      viewport,
      callbacks: {
        onStatusChange: vi.fn(),
        onRoomEdit: vi.fn(),
        onMarkerEdit: vi.fn(),
        onFreeTextEdit: vi.fn(),
          onContextMenu: vi.fn(),
        onAutoSave: vi.fn(),
        onViewportChange: vi.fn(),
      },
      flags: {
        isPanning: false,
        activeInteriorObjectId: undefined,
        activeFreeTextId: undefined,
        activeStickyNoteId: undefined,
        snapIndicator: null,
        clipboard: null,
        savedRedo: null,
        drawArrowPreview: null,
      },
      render: vi.fn(),
      commitChange: null as unknown as (fn: () => void) => void,
      mousePos: vi.fn(),
    } as unknown as EditorContext;
    // commitChange を実物に差し替え
    ec.commitChange = (fn: () => void) => commitChange(ec, fn);
    return ec;
  }

  it('部屋作成→Undo→Redo で部屋が復元される', () => {
    const ec = createRealCommitEc();

    commitChange(ec, () => {
      ec.state.rooms.push(createRoom(0, 0, 5, 5, 'A'));
    });
    expect(ec.state.rooms).toHaveLength(1);

    undo(ec);
    expect(ec.state.rooms).toHaveLength(0);

    redo(ec);
    expect(ec.state.rooms).toHaveLength(1);
    expect(ec.state.rooms[0].label).toBe('A');
  });

  it('複数Undo→複数Redo で状態が正しく復元される', () => {
    const ec = createRealCommitEc();

    commitChange(ec, () => {
      ec.state.rooms.push(createRoom(0, 0, 5, 5, 'A'));
    });
    commitChange(ec, () => {
      ec.state.rooms.push(createRoom(5, 0, 5, 5, 'B'));
    });
    expect(ec.state.rooms).toHaveLength(2);

    undo(ec);
    expect(ec.state.rooms).toHaveLength(1);
    expect(ec.state.rooms[0].label).toBe('A');

    undo(ec);
    expect(ec.state.rooms).toHaveLength(0);

    redo(ec);
    expect(ec.state.rooms).toHaveLength(1);
    expect(ec.state.rooms[0].label).toBe('A');

    redo(ec);
    expect(ec.state.rooms).toHaveLength(2);
  });

  it('Undo→新しい操作→Redo はできない（Redoスタックがクリアされる）', () => {
    const ec = createRealCommitEc();

    commitChange(ec, () => {
      ec.state.rooms.push(createRoom(0, 0, 5, 5, 'A'));
    });

    undo(ec);
    expect(ec.state.rooms).toHaveLength(0);
    expect(ec.state.redoHistory.length).toBeGreaterThan(0);

    // 新しい操作をするとRedoスタックがクリアされる
    commitChange(ec, () => {
      ec.state.rooms.push(createRoom(5, 0, 5, 5, 'B'));
    });
    expect(ec.state.redoHistory).toHaveLength(0);

    // Redoできない
    redo(ec);
    expect(ec.state.rooms).toHaveLength(1);
    expect(ec.state.rooms[0].label).toBe('B');
  });

  it('Redoスタックが空の場合、redo()は何もしない', () => {
    const ec = createRealCommitEc();

    commitChange(ec, () => {
      ec.state.rooms.push(createRoom(0, 0, 5, 5, 'A'));
    });

    const renderCallCount = (ec.render as ReturnType<typeof vi.fn>).mock.calls.length;
    redo(ec);
    // render は呼ばれない（何も変わらない）
    expect((ec.render as ReturnType<typeof vi.fn>).mock.calls.length).toBe(renderCallCount);
    expect(ec.state.rooms).toHaveLength(1);
  });
});

describe('exportAsPng', () => {
  function createExportEc(): EditorContext {
    const mockCtx2d = new Proxy(
      {},
      { get: (_t, _p) => vi.fn() },
    );
    const canvas = {
      width: 800,
      height: 600,
      getContext: vi.fn(() => mockCtx2d),
      toDataURL: vi.fn(() => 'data:image/png;base64,'),
    };
    const viewport: ViewportState = { zoom: 1, panX: 0, panY: 0 };
    return {
      canvas: canvas as unknown as HTMLCanvasElement,
      ctx: {} as CanvasRenderingContext2D,
      container: {} as HTMLElement,
      state: {
        rooms: [],
        freeTexts: [],
        freeStrokes: [],
        arrows: [],
        stickyNotes: [],
        selection: new Set<string>(),
        history: [],
        redoHistory: [],
        drag: null,
        mouse: { px: 0, py: 0, gx: 0, gy: 0 },
        paintMode: false,
        paintColor: '#000000',
        paintLineWidth: 2,
        paintOpacity: 1,
        arrowMode: false,
        arrowColor: '#cc0000',
        arrowLineWidth: 2,
      },
      viewport,
      callbacks: {
        onStatusChange: vi.fn(),
        onRoomEdit: vi.fn(),
        onMarkerEdit: vi.fn(),
        onFreeTextEdit: vi.fn(),
        onContextMenu: vi.fn(),
        onAutoSave: vi.fn(),
        onViewportChange: vi.fn(),
      },
      flags: {
        isPanning: false,
        activeInteriorObjectId: undefined,
        activeFreeTextId: undefined,
        activeStickyNoteId: undefined,
        snapIndicator: null,
        savedRedo: null,
        drawArrowPreview: null,
      },
      render: vi.fn(),
      commitChange: vi.fn((fn: () => void) => fn()),
      mousePos: vi.fn(),
    } as unknown as EditorContext;
  }

  it('includeStickyNotes: false のとき、render中にstickyNotesが空になる', () => {
    const ec = createExportEc();
    const note = createStickyNote(10, 10, 'テスト付箋');
    ec.state.stickyNotes = [note];

    let stickyNotesDuringRender: unknown[] | undefined;
    (ec.render as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
      stickyNotesDuringRender = [...ec.state.stickyNotes];
    });

    exportAsPng(ec, { includeStickyNotes: false });

    expect(stickyNotesDuringRender).toEqual([]);
  });

  it('includeStickyNotes: true のとき、render中にstickyNotesが保持される', () => {
    const ec = createExportEc();
    const note = createStickyNote(10, 10, 'テスト付箋');
    ec.state.stickyNotes = [note];

    let stickyNotesDuringRender: unknown[] | undefined;
    (ec.render as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
      stickyNotesDuringRender = [...ec.state.stickyNotes];
    });

    exportAsPng(ec, { includeStickyNotes: true });

    expect(stickyNotesDuringRender).toHaveLength(1);
  });

  it('エクスポート後にstickyNotesが復元される', () => {
    const ec = createExportEc();
    const note = createStickyNote(10, 10, 'テスト付箋');
    ec.state.stickyNotes = [note];

    exportAsPng(ec, { includeStickyNotes: false });

    expect(ec.state.stickyNotes).toHaveLength(1);
    expect(ec.state.stickyNotes[0].id).toBe(note.id);
  });

  it('filenameオプションがexportPngに渡される', async () => {
    const ec = createExportEc();
    ec.state.rooms = [createRoom(0, 0, 5, 5, 'Room')];

    const { exportPng } = await import('../persistence.ts');

    exportAsPng(ec, { filename: 'テスト.png' });

    expect(exportPng).toHaveBeenCalledWith(ec.canvas, 'テスト.png');
  });
});
