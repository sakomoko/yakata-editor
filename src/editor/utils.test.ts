import { describe, it, expect, vi } from 'vitest';
import type { EditorContext } from './context.ts';
import { switchToRoomMode, setShowAnnotations } from './utils.ts';

function makeMockContext(
  overrides: { paintMode?: boolean; arrowMode?: boolean } = {},
): EditorContext {
  return {
    canvas: { style: { cursor: 'crosshair' } } as unknown as HTMLCanvasElement,
    ctx: {} as unknown as CanvasRenderingContext2D,
    container: {} as unknown as HTMLElement,
    state: {
      paintMode: overrides.paintMode ?? false,
      arrowMode: overrides.arrowMode ?? false,
    } as unknown as EditorContext['state'],
    viewport: {} as unknown as EditorContext['viewport'],
    callbacks: {
      onPaintModeChange: vi.fn(),
      onArrowModeChange: vi.fn(),
    } as unknown as EditorContext['callbacks'],
    flags: {
      isPanning: false,
      activeInteriorObjectId: 'some-interior-id',
      activeFreeTextId: 'some-text-id',
      snapIndicator: null,
      clipboard: null,
      savedRedo: null,
      drawArrowPreview: null,
    },
    render: vi.fn(),
    commitChange: vi.fn(),
    mousePos: vi.fn(),
  } as unknown as EditorContext;
}

describe('switchToRoomMode', () => {
  it('ペイントモード時に呼ぶと部屋モードに戻りコールバックが発火する', () => {
    const ec = makeMockContext({ paintMode: true });
    switchToRoomMode(ec);
    expect(ec.state.paintMode).toBe(false);
    expect(ec.state.arrowMode).toBe(false);
    expect(ec.canvas.style.cursor).toBe('default');
    expect(ec.render).toHaveBeenCalledOnce();
    expect(ec.callbacks.onPaintModeChange).toHaveBeenCalledWith(false);
    expect(ec.callbacks.onArrowModeChange).not.toHaveBeenCalled();
  });

  it('アローモード時に呼ぶと部屋モードに戻りコールバックが発火する', () => {
    const ec = makeMockContext({ arrowMode: true });
    switchToRoomMode(ec);
    expect(ec.state.paintMode).toBe(false);
    expect(ec.state.arrowMode).toBe(false);
    expect(ec.canvas.style.cursor).toBe('default');
    expect(ec.render).toHaveBeenCalledOnce();
    expect(ec.callbacks.onArrowModeChange).toHaveBeenCalledWith(false);
    expect(ec.callbacks.onPaintModeChange).not.toHaveBeenCalled();
  });

  it('すでに部屋モード時は何もしない', () => {
    const ec = makeMockContext({ paintMode: false, arrowMode: false });
    ec.canvas.style.cursor = 'crosshair';
    switchToRoomMode(ec);
    expect(ec.canvas.style.cursor).toBe('crosshair');
    expect(ec.render).not.toHaveBeenCalled();
    expect(ec.callbacks.onPaintModeChange).not.toHaveBeenCalled();
    expect(ec.callbacks.onArrowModeChange).not.toHaveBeenCalled();
  });

  it('activeInteriorObjectId と activeFreeTextId をクリアする', () => {
    const ec = makeMockContext({ paintMode: true });
    expect(ec.flags.activeInteriorObjectId).toBe('some-interior-id');
    expect(ec.flags.activeFreeTextId).toBe('some-text-id');
    switchToRoomMode(ec);
    expect(ec.flags.activeInteriorObjectId).toBeUndefined();
    expect(ec.flags.activeFreeTextId).toBeUndefined();
  });
});

describe('setShowAnnotations', () => {
  function makeAnnotationContext(drag: EditorContext['state']['drag'] = null): EditorContext {
    return {
      state: {
        rooms: [],
        freeTexts: [
          {
            id: 'memo',
            gx: 0,
            gy: 0,
            w: 3,
            h: 2,
            label: 'メモ',
            fontSize: 14,
            zLayer: 'front',
            annotation: true,
          },
          { id: 'label', gx: 0, gy: 5, w: 3, h: 2, label: '一階', fontSize: 14, zLayer: 'front' },
        ],
        freeStrokes: [],
        arrows: [],
        selection: new Set(['memo', 'label']),
        drag,
        showAnnotations: true,
      } as unknown as EditorContext['state'],
      callbacks: { onShowAnnotationsChange: vi.fn() } as unknown as EditorContext['callbacks'],
      flags: { activeFreeTextId: 'memo', activeInteriorObjectId: undefined },
      render: vi.fn(),
    } as unknown as EditorContext;
  }

  it('非表示にすると注釈だけ選択・アクティブ状態から外れる', () => {
    const ec = makeAnnotationContext();
    setShowAnnotations(ec, false);
    expect(ec.state.showAnnotations).toBe(false);
    expect([...ec.state.selection]).toEqual(['label']);
    expect(ec.flags.activeFreeTextId).toBeUndefined();
    expect(ec.callbacks.onShowAnnotationsChange).toHaveBeenCalledWith(false);
  });

  it('ドラッグ中は切り替えを無視する', () => {
    const ec = makeAnnotationContext({
      type: 'moveFreeText',
    } as unknown as EditorContext['state']['drag']);
    setShowAnnotations(ec, false);
    expect(ec.state.showAnnotations).toBe(true);
    expect(ec.state.selection.has('memo')).toBe(true);
    expect(ec.callbacks.onShowAnnotationsChange).not.toHaveBeenCalled();
  });
});
