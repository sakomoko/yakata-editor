import type { MouseCoord, EditorState, EntitySnapshot } from '../types.ts';
import { GRID } from '../grid.ts';
import { screenToWorld } from '../viewport.ts';
import type { ViewportState } from '../viewport.ts';
import type { EditorContext } from './context.ts';

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 参照のみ収集。クローンは呼び出し側が必要に応じて行う */
export function getEntitySnapshot(state: EditorState): EntitySnapshot {
  return {
    rooms: state.rooms,
    freeTexts: state.freeTexts,
    freeStrokes: state.freeStrokes,
    arrows: state.arrows,
    stickyNotes: state.stickyNotes,
  };
}

/** ペイント・アローモードを解除して部屋モード（デフォルト）に戻す。
 * NOTE: 他モードへの切替と異なり、activeInteriorObjectId / activeFreeTextId もクリアする
 * （部屋モードはクリーンな初期状態として扱う）。 */
export function switchToRoomMode(ec: EditorContext): void {
  const { state, canvas, flags } = ec;
  if (!state.paintMode && !state.arrowMode) return;
  const wasPaint = state.paintMode;
  const wasArrow = state.arrowMode;
  state.paintMode = false;
  state.arrowMode = false;
  flags.activeInteriorObjectId = undefined;
  flags.activeFreeTextId = undefined;
  flags.activeStickyNoteId = undefined;
  canvas.style.cursor = 'default';
  ec.render();
  if (wasPaint) ec.callbacks.onPaintModeChange?.(false);
  if (wasArrow) ec.callbacks.onArrowModeChange?.(false);
}

/** CJK文字を2カラム換算した表示幅をグリッド単位で返す */
export function labelDisplayWidth(label: string): number {
  const cols = [...label].reduce((n, c) => n + (/[\u3000-\u9fff\uff00-\uffef]/.test(c) ? 2 : 1), 0);
  return Math.ceil(cols / 2) + 1;
}

/** MouseEvent のサブセット。PointerEvent も MouseEvent もこれを満たす */
type MouseLikeEvent = Pick<MouseEvent, 'clientX' | 'clientY' | 'shiftKey'>;

export function createMousePos(
  canvas: HTMLCanvasElement,
  viewport: ViewportState,
): (e: MouseLikeEvent) => MouseCoord {
  return (e: MouseLikeEvent): MouseCoord => {
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const { px, py } = screenToWorld(sx, sy, viewport);
    return {
      px,
      py,
      gx: e.shiftKey ? px / GRID : Math.round(px / GRID),
      gy: e.shiftKey ? py / GRID : Math.round(py / GRID),
    };
  };
}
