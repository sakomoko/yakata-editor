import { describe, it, expect, vi } from 'vitest';
import { withFontSizePreview, deleteSelectedEntities, deleteRoom } from './project.ts';
import { createRoom } from '../room.ts';
import type { EditorContext } from './context.ts';
import type { ViewportState } from '../viewport.ts';

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
      selection: new Set<string>(),
      history: [],
      drag: null,
      mouse: { px: 0, py: 0, gx: 0, gy: 0 },
      paintMode: false,
      paintColor: '#000000',
      paintLineWidth: 2,
      paintOpacity: 1,
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
      snapIndicator: null,
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
});
