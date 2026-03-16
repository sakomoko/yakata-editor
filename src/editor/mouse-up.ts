import { findRoomById, findWallObjectById } from '../lookup.ts';
import { selectSingle, clearSelection } from '../selection.ts';
import { pushUndo } from '../history.ts';
import {
  hitWallObjectInRooms,
} from '../wall-object.ts';
import { createRoom, findRoomsInArea, normalizeArea } from '../room.ts';
import { findFreeTextsInArea } from '../free-text.ts';
import { syncPairedOpening, syncAllPairedOpenings } from '../adjacency.ts';
import type { EditorContext } from './context.ts';

export function onMouseUp(ec: EditorContext, e: MouseEvent): void {
  const { state, canvas, viewport, flags } = ec;

  if (!state.drag) return;

  if (state.drag.type === 'pan') {
    state.drag = null;
    canvas.style.cursor = flags.isPanning ? 'grab' : 'crosshair';
    ec.callbacks.onViewportChange(viewport);
    return;
  }

  if (state.drag.type === 'moveWallObject' || state.drag.type === 'resizeWallObject') {
    const dragRoomId = state.drag.roomId;
    const dragObjId = state.drag.objectId;
    selectSingle(state.selection, dragRoomId);
    state.drag = null;
    // 壁オブジェクトの同期
    const dragRoom = findRoomById(state.rooms, dragRoomId);
    const dragObj = dragRoom ? findWallObjectById(dragRoom, dragObjId) : undefined;
    if (dragRoom && dragObj) {
      syncPairedOpening(state.rooms, dragRoom, dragObj);
    }
    // Cursor will be recalculated on next mousemove; set a reasonable default
    const m = ec.mousePos(e);
    const stillOnWallObj = hitWallObjectInRooms(state.rooms, m.px, m.py, viewport.zoom, true);
    canvas.style.cursor = stillOnWallObj ? 'grab' : 'crosshair';
    ec.render();
    ec.callbacks.onAutoSave(state.rooms, state.freeTexts);
    return;
  }

  if (
    state.drag.type === 'moveInteriorObject' ||
    state.drag.type === 'resizeInteriorObject' ||
    state.drag.type === 'rotateCameraAngle' ||
    state.drag.type === 'adjustCameraFovAngle' ||
    state.drag.type === 'adjustCameraFovRange' ||
    state.drag.type === 'moveFreeText' ||
    state.drag.type === 'resizeFreeText'
  ) {
    state.drag = null;
    canvas.style.cursor = 'crosshair';
    ec.render();
    ec.callbacks.onAutoSave(state.rooms, state.freeTexts);
    return;
  }

  if (state.drag.type === 'areaSelect' || state.drag.type === 'create') {
    // mouseup 時点の最終座標で判定する。ドラッグ中のプレビューモード（areaSelect/create）
    // と mouseup 時の包含判定が異なる場合があるが、最終座標での判定を優先する。
    const m = ec.mousePos(e);
    const area = normalizeArea(state.drag.start, m);
    const contained = findRoomsInArea(state.rooms, area);
    const containedFt = findFreeTextsInArea(state.freeTexts, area);
    if (contained.length > 0 || containedFt.length > 0) {
      // 範囲選択: 包含された部屋・FreeTextを選択
      flags.activeFreeTextId = undefined;
      flags.activeInteriorObjectId = undefined;
      if (!e.shiftKey) {
        clearSelection(state.selection);
      }
      for (const r of contained) {
        state.selection.add(r.id);
      }
      for (const ft of containedFt) {
        state.selection.add(ft.id);
      }
    } else if (area.w > 0 && area.h > 0) {
      // 部屋作成: 包含する部屋がなければ新規作成にフォールバック
      pushUndo(state.history, state.rooms, state.freeTexts);
      const room = createRoom(area.x, area.y, area.w, area.h);
      state.rooms.push(room);
      clearSelection(state.selection);
      state.selection.add(room.id);
    }
  } else if (
    state.drag.type === 'move' ||
    state.drag.type === 'resize' ||
    state.drag.type === 'groupResize'
  ) {
    // 部屋の移動・リサイズ後にペア開口を再同期
    syncAllPairedOpenings(state.rooms);
    if (state.drag.type === 'groupResize') {
      canvas.style.cursor = 'crosshair';
    }
  }

  // 共通クリーンアップ: areaSelect / create / move / resize / groupResize すべてここを通る
  state.drag = null;
  ec.render();
  ec.callbacks.onAutoSave(state.rooms, state.freeTexts);
}
