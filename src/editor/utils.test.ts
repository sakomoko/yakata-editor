import { describe, it, expect, vi } from 'vitest';
import type { EditorContext } from './context.ts';
import { switchToRoomMode } from './utils.ts';

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
    switchToRoomMode(ec);
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
