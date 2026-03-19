import type { Room, FreeText, FreeStroke } from '../types.ts';
import { GRID } from '../grid.ts';
import { pushUndo, popUndo } from '../history.ts';
import { clearSelection } from '../selection.ts';
import { exportPng, saveAsJson } from '../persistence.ts';
import { getStrokeBounds } from '../free-stroke.ts';
import { computeRoomsBoundingBox, calcAutoFontSize } from '../room.ts';
import { syncAllPairedOpenings } from '../adjacency.ts';
import { findRoomById } from '../lookup.ts';
import type { EditorContext } from './context.ts';

export function commitChange(ec: EditorContext, fn: () => void): void {
  pushUndo(ec.state.history, ec.state.rooms, ec.state.freeTexts, ec.state.freeStrokes);
  fn();
  ec.render();
  ec.callbacks.onAutoSave();
}

export function undo(ec: EditorContext): void {
  const restored = popUndo(ec.state.history);
  if (!restored) return;
  ec.state.rooms = restored.rooms;
  ec.state.freeTexts = restored.freeTexts;
  ec.state.freeStrokes = restored.freeStrokes;
  ec.state.drag = null;
  clearSelection(ec.state.selection);
  ec.flags.activeInteriorObjectId = undefined;
  ec.flags.activeFreeTextId = undefined;
  ec.render();
  ec.callbacks.onAutoSave();
}

export function newProject(ec: EditorContext): void {
  if (
    (ec.state.rooms.length || ec.state.freeTexts.length || ec.state.freeStrokes.length) &&
    !confirm('現在の間取り図をクリアしますか？')
  )
    return;
  commitChange(ec, () => {
    ec.state.rooms = [];
    ec.state.freeTexts = [];
    ec.state.freeStrokes = [];
    clearSelection(ec.state.selection);
  });
  ec.flags.activeInteriorObjectId = undefined;
  ec.flags.activeFreeTextId = undefined;
}

export function loadProjectData(
  ec: EditorContext,
  data: { rooms: Room[]; freeTexts: FreeText[]; freeStrokes?: FreeStroke[] },
): void {
  commitChange(ec, () => {
    ec.state.rooms = data.rooms;
    ec.state.freeTexts = data.freeTexts;
    ec.state.freeStrokes = data.freeStrokes ?? [];
    clearSelection(ec.state.selection);
    syncAllPairedOpenings(ec.state.rooms);
  });
  ec.flags.activeInteriorObjectId = undefined;
  ec.flags.activeFreeTextId = undefined;
}

export async function saveProject(ec: EditorContext): Promise<void> {
  await saveAsJson(ec.state.rooms, ec.state.freeTexts, ec.state.freeStrokes);
}

export function exportAsPng(ec: EditorContext): void {
  const { canvas, state, viewport, flags } = ec;
  const prevSelection = new Set(state.selection);
  clearSelection(state.selection);
  const savedActiveFreeTextId = flags.activeFreeTextId;
  flags.activeFreeTextId = undefined;

  const savedViewport = { ...viewport };
  const savedW = canvas.width;
  const savedH = canvas.height;

  try {
    // rooms と FreeText の両方を含むバウンディングボックスを計算
    const bbox =
      state.rooms.length > 0
        ? computeRoomsBoundingBox(state.rooms)
        : { x: Infinity, y: Infinity, w: 0, h: 0 };
    let maxX = bbox.x === Infinity ? -Infinity : bbox.x + bbox.w;
    let maxY = bbox.y === Infinity ? -Infinity : bbox.y + bbox.h;
    let minX = bbox.x === Infinity ? Infinity : bbox.x;
    let minY = bbox.y === Infinity ? Infinity : bbox.y;

    for (const ft of state.freeTexts) {
      const ftX = ft.gx * GRID;
      const ftY = ft.gy * GRID;
      const ftR = ftX + ft.w * GRID;
      const ftB = ftY + ft.h * GRID;
      if (ftX < minX) minX = ftX;
      if (ftY < minY) minY = ftY;
      if (ftR > maxX) maxX = ftR;
      if (ftB > maxY) maxY = ftB;
    }

    for (const stroke of state.freeStrokes) {
      const bounds = getStrokeBounds(stroke);
      if (bounds) {
        if (bounds.x < minX) minX = bounds.x;
        if (bounds.y < minY) minY = bounds.y;
        if (bounds.x + bounds.w > maxX) maxX = bounds.x + bounds.w;
        if (bounds.y + bounds.h > maxY) maxY = bounds.y + bounds.h;
      }
    }

    // rooms も FreeText もない場合のフォールバック
    if (minX === Infinity) {
      minX = 0;
      minY = 0;
      maxX = 40 * GRID;
      maxY = 30 * GRID;
    }

    const exportBbox = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    const maxDim = Math.max(exportBbox.w, exportBbox.h);
    const MAX_EXPORT_SIZE = 16384;
    const exportScale = maxDim > MAX_EXPORT_SIZE ? MAX_EXPORT_SIZE / maxDim : 1;
    if (exportScale < 1) {
      console.warn(
        `PNG export: サイズが上限を超えたため縮小されます (${Math.round(maxDim)}px → ${MAX_EXPORT_SIZE}px)`,
      );
    }
    viewport.zoom = exportScale;
    viewport.panX = exportBbox.x;
    viewport.panY = exportBbox.y;
    canvas.width = Math.max(1, Math.round(exportBbox.w * exportScale));
    canvas.height = Math.max(1, Math.round(exportBbox.h * exportScale));

    ec.render();
    exportPng(canvas);
  } finally {
    canvas.width = savedW;
    canvas.height = savedH;
    Object.assign(viewport, savedViewport);
    for (const id of prevSelection) state.selection.add(id);
    flags.activeFreeTextId = savedActiveFreeTextId;
    ec.render();
  }
}

/**
 * フォントサイズスライダーのリアルタイムプレビュー共通ヘルパー。
 * スライダー操作中はCanvasに即時反映し、OK/キャンセル時に元の値を復元してからcommit/renderする。
 */
export async function withFontSizePreview<R>(
  ec: EditorContext,
  getCurrentFontSize: () => number | undefined,
  setCurrentFontSize: (fs: number | undefined) => void,
  showDialog: (onPreview: (fontSize: number | undefined) => void) => Promise<R | null>,
  applyResult: (result: R) => void,
): Promise<void> {
  const originalFontSize = getCurrentFontSize();
  const result = await showDialog((fontSize) => {
    setCurrentFontSize(fontSize);
    ec.render();
  });
  setCurrentFontSize(originalFontSize);
  if (result !== null) {
    commitChange(ec, () => applyResult(result));
  } else {
    ec.render();
  }
}

export async function applyRoomEdit(ec: EditorContext, room: Room): Promise<void> {
  const roomId = room.id;
  const findRoom = () => findRoomById(ec.state.rooms, roomId);
  await withFontSizePreview(
    ec,
    () => findRoom()?.fontSize,
    (fs) => {
      const r = findRoom();
      if (r) r.fontSize = fs;
    },
    (onPreview) =>
      ec.callbacks.onRoomEdit({
        label: room.label || '',
        fontSize: room.fontSize,
        autoFontSize: Math.round(calcAutoFontSize(room)),
        onFontSizePreview: onPreview,
      }),
    (result) => {
      const r = findRoom();
      if (r) {
        r.label = result.label;
        r.fontSize = result.fontSize;
      }
    },
  );
}
