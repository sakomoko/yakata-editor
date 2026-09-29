import type { MouseCoord, EditorState, EntitySnapshot } from '../types.ts';
import { GRID } from '../grid.ts';
import { screenToWorld } from '../viewport.ts';
import type { ViewportState } from '../viewport.ts';
import type { EditorContext } from './context.ts';
import { collectHiddenIds } from '../annotation.ts';

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

/** 非表示になった注釈を選択・アクティブ状態から外す。見えないオブジェクトを操作させないため */
export function releaseHiddenAnnotations(ec: EditorContext): void {
  const { state, flags } = ec;
  const hidden = collectHiddenIds(state);
  if (hidden.size === 0) return;
  for (const id of hidden) state.selection.delete(id);
  if (flags.activeInteriorObjectId && hidden.has(flags.activeInteriorObjectId)) {
    flags.activeInteriorObjectId = undefined;
  }
  if (flags.activeFreeTextId && hidden.has(flags.activeFreeTextId)) {
    flags.activeFreeTextId = undefined;
  }
}

/** 注釈の表示/非表示を切り替える。ドラッグ中は操作対象が消えてしまうため無視する */
export function setShowAnnotations(ec: EditorContext, on: boolean): void {
  if (ec.state.drag) return;
  ec.state.showAnnotations = on;
  releaseHiddenAnnotations(ec);
  ec.render();
  ec.callbacks.onShowAnnotationsChange?.(on);
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
