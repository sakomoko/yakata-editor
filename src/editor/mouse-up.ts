import {
  findRoomById,
  findWallObjectById,
  findFreeStrokeById,
  findInteriorObjectById,
} from '../lookup.ts';
import { selectSingle, clearSelection } from '../selection.ts';
import { pushUndo, cancelLastUndo } from '../history.ts';
import { hitWallObjectInRooms, clampWallObjects } from '../wall-object.ts';
import {
  clampAllInteriorObjects,
  clampInteriorObject,
  transferInteriorObject,
} from '../interior-object.ts';
import { createRoom, hitRoom, findRoomsInArea, normalizeArea } from '../room.ts';
import { findFreeTextsInArea } from '../free-text.ts';
import { simplifyPoints } from '../free-stroke.ts';
import { syncPairedOpening, syncAllPairedOpenings } from '../adjacency.ts';
import type { EditorContext } from './context.ts';

export function onMouseUp(ec: EditorContext, e: MouseEvent): void {
  const { state, canvas, viewport, flags } = ec;

  if (!state.drag) return;

  if (state.drag.type === 'pan') {
    state.drag = null;
    canvas.style.cursor = flags.isPanning ? 'grab' : state.paintMode ? 'crosshair' : 'default';
    ec.callbacks.onViewportChange();
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
    canvas.style.cursor = stillOnWallObj ? 'grab' : state.paintMode ? 'crosshair' : 'default';
    ec.render();
    ec.callbacks.onAutoSave();
    return;
  }

  if (state.drag.type === 'paint') {
    const stroke = findFreeStrokeById(state.freeStrokes, state.drag.strokeId);
    if (stroke) {
      stroke.points = simplifyPoints(stroke.points, 1.5);
      // 点が少ない、または始点≒終点の微小ストロークは削除してUndoを汚さない
      const isTiny =
        stroke.points.length < 2 ||
        (stroke.points.length === 2 &&
          Math.hypot(
            stroke.points[1].px - stroke.points[0].px,
            stroke.points[1].py - stroke.points[0].py,
          ) < 2);
      if (isTiny) {
        state.freeStrokes = state.freeStrokes.filter((s) => s.id !== stroke.id);
        cancelLastUndo(state.history);
      }
    }
    state.drag = null;
    canvas.style.cursor = 'crosshair';
    ec.render();
    ec.callbacks.onAutoSave();
    return;
  }

  if (state.drag.type === 'moveStroke') {
    state.drag = null;
    canvas.style.cursor = state.paintMode ? 'crosshair' : 'default';
    ec.render();
    ec.callbacks.onAutoSave();
    return;
  }

  if (state.drag.type === 'moveVertex') {
    const room = findRoomById(state.rooms, state.drag.roomId);
    if (room) {
      // mousemove でも毎フレーム clamp しているが、最後の mousemove と mouseup の間に
      // 座標が変わる可能性があるため、確定時に再度 clamp して最終状態を保証する
      clampWallObjects(room);
      clampAllInteriorObjects(room);
    }
    // 頂点移動後は常に壁開口ペアの位置同期が必要
    syncAllPairedOpenings(state.rooms);
    flags.snapIndicator = null;
    state.drag = null;
    canvas.style.cursor = state.paintMode ? 'crosshair' : 'default';
    ec.render();
    ec.callbacks.onAutoSave();
    return;
  }

  if (state.drag.type === 'moveInteriorObject') {
    const drag = state.drag;
    const sourceRoom = findRoomById(state.rooms, drag.roomId);
    let changed = false;
    if (sourceRoom) {
      const obj = findInteriorObjectById(sourceRoom, drag.objectId);
      if (obj) {
        const m = ec.mousePos(e);
        const dropRoom = hitRoom(state.rooms, m.px, m.py);
        if (dropRoom && dropRoom.id !== sourceRoom.id) {
          // Transfer to another room
          transferInteriorObject(sourceRoom, dropRoom, obj);
          selectSingle(state.selection, dropRoom.id);
          flags.activeInteriorObjectId = obj.id;
        } else {
          // Same room or no room — clamp back
          clampInteriorObject(sourceRoom, obj);
        }
        changed = true;
      }
    }
    state.drag = null;
    canvas.style.cursor = state.paintMode ? 'crosshair' : 'default';
    ec.render();
    if (changed) ec.callbacks.onAutoSave();
    return;
  }

  if (
    state.drag.type === 'resizeInteriorObject' ||
    state.drag.type === 'rotateCameraAngle' ||
    state.drag.type === 'adjustCameraFovAngle' ||
    state.drag.type === 'adjustCameraFovRange' ||
    state.drag.type === 'moveFreeText' ||
    state.drag.type === 'resizeFreeText'
  ) {
    state.drag = null;
    canvas.style.cursor = state.paintMode ? 'crosshair' : 'default';
    ec.render();
    ec.callbacks.onAutoSave();
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
      pushUndo(state.history, state.rooms, state.freeTexts, state.freeStrokes);
      const snap = e.shiftKey ? (v: number) => v : Math.round;
      const room = createRoom(snap(area.x), snap(area.y), Math.max(1, snap(area.w)), Math.max(1, snap(area.h)));
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
      canvas.style.cursor = state.paintMode ? 'crosshair' : 'default';
    }
  }

  // 共通クリーンアップ: areaSelect / create / move / resize / groupResize すべてここを通る
  state.drag = null;
  ec.render();
  ec.callbacks.onAutoSave();
}
