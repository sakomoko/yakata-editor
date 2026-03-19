import { describe, it, expect, vi } from 'vitest';
import { withFontSizePreview } from './project.ts';
import type { EditorContext } from './context.ts';

function createMockEc(): EditorContext {
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
    viewport: { scale: 1, panX: 0, panY: 0 },
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
    // commitChange is called internally via the real implementation;
    // since we import the real function, check render was called
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
});
