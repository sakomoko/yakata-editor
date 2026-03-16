import { GRID } from '../grid.ts';
import {
  findFreeTextById,
  findInteriorObjectById,
  findRoomById,
  findWallObjectById,
} from '../lookup.ts';
import {
  hitHandle,
  hitRoom,
  findRoomsInArea,
  normalizeArea,
  computeGroupBoundingBox,
  hitGroupHandle,
  computeGroupScale,
  applyGroupScale,
} from '../room.ts';
import {
  hitWallObjectInRooms,
  hitWallObjectEdgeInRooms,
  computeWallObjectPosition,
  computeWallObjectResize,
  clampWallObjects,
} from '../wall-object.ts';
import {
  hitInteriorObjectInRooms,
  hitInteriorObjectHandleInRooms,
  computeInteriorObjectMove,
  computeInteriorObjectResize,
  clampAllInteriorObjects,
} from '../interior-object.ts';
import {
  findCameraInRoom,
  computeCameraAngle,
  computeCameraFovAngle,
  computeCameraFovRange,
  hitCameraHandleInRooms,
} from '../camera.ts';
import { hitFreeText, hitFreeTextHandle, computeFreeTextResize } from '../free-text.ts';
import { syncPairedOpening } from '../adjacency.ts';
import type { EditorContext } from './context.ts';
import { updateStatus } from './render.ts';

import type { MouseCoord } from '../types.ts';

/** 壁オブジェクト・インテリア・FreeText・部屋のヒット判定に基づくデフォルトカーソルを返す */
function resolveDefaultCursor(ec: EditorContext, m: MouseCoord): string {
  const { state, viewport } = ec;
  if (hitWallObjectInRooms(state.rooms, m.px, m.py, viewport.zoom, true)) return 'grab';
  if (hitInteriorObjectInRooms(state.rooms, m.px, m.py)) return 'grab';
  if (hitFreeText(state.freeTexts, m.px, m.py)) return 'grab';
  if (hitRoom(state.rooms, m.px, m.py)) return 'move';
  return 'crosshair';
}

export function onMouseMove(ec: EditorContext, e: MouseEvent): void {
  const { canvas, state, viewport, flags } = ec;

  if (state.drag && state.drag.type === 'pan') {
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    viewport.panX = state.drag.startPanX - (sx - state.drag.startScreenX) / viewport.zoom;
    viewport.panY = state.drag.startPanY - (sy - state.drag.startScreenY) / viewport.zoom;
    state.mouse = ec.mousePos(e);
    ec.render();
    return;
  }

  const m = ec.mousePos(e);
  state.mouse = m;

  if (!state.drag) {
    if (flags.isPanning) {
      canvas.style.cursor = 'grab';
      updateStatus(ec);
      return;
    }
    const selectedRooms = state.rooms.filter((r) => state.selection.has(r.id));
    const edgeHover = hitWallObjectEdgeInRooms(selectedRooms, m.px, m.py, viewport.zoom, true);
    if (edgeHover) {
      const horiz = edgeHover.obj.side === 'n' || edgeHover.obj.side === 's';
      canvas.style.cursor = horiz ? 'ew-resize' : 'ns-resize';
    } else {
      // FreeText handle hover
      if (flags.activeFreeTextId) {
        const activeFt = findFreeTextById(state.freeTexts, flags.activeFreeTextId);
        if (activeFt) {
          const ftDir = hitFreeTextHandle(activeFt, m.px, m.py, viewport.zoom);
          if (ftDir) {
            canvas.style.cursor = ftDir + '-resize';
            updateStatus(ec);
            return;
          }
        }
      }
      // Camera handle hover
      const camHandleHover = hitCameraHandleInRooms(
        selectedRooms,
        m.px,
        m.py,
        viewport.zoom,
        flags.activeInteriorObjectId,
      );
      if (camHandleHover) {
        canvas.style.cursor = 'grab';
        updateStatus(ec);
        return;
      }
      const intHandleHover = hitInteriorObjectHandleInRooms(
        selectedRooms,
        m.px,
        m.py,
        viewport.zoom,
      );
      if (intHandleHover) {
        canvas.style.cursor = intHandleHover.dir + '-resize';
      } else {
        const h = hitHandle(state.rooms, state.selection, m.px, m.py, viewport.zoom);
        if (h) {
          canvas.style.cursor = h.handle.dir + '-resize';
        } else if (state.selection.size >= 2) {
          const selRooms = state.rooms.filter((r) => state.selection.has(r.id));
          const bb = computeGroupBoundingBox(selRooms);
          const gh = hitGroupHandle(bb, m.px, m.py, viewport.zoom);
          if (gh) {
            canvas.style.cursor = gh.dir + '-resize';
          } else {
            canvas.style.cursor = resolveDefaultCursor(ec, m);
          }
        } else {
          canvas.style.cursor = resolveDefaultCursor(ec, m);
        }
      }
    }
    updateStatus(ec);
    return;
  }

  if (state.drag.type === 'create' || state.drag.type === 'areaSelect') {
    state.drag.cur = m;
    // ドラッグ矩形が既存の部屋を完全に包含するかチェックしてモード切替
    const area = normalizeArea(state.drag.start, m);
    const contained = findRoomsInArea(state.rooms, area);
    if (contained.length > 0 && state.drag.type === 'create') {
      state.drag = { type: 'areaSelect', start: state.drag.start, cur: m };
    } else if (contained.length === 0 && state.drag.type === 'areaSelect') {
      state.drag = { type: 'create', start: state.drag.start, cur: m };
    }
  } else if (state.drag.type === 'move') {
    const dx = m.gx - state.drag.start.gx;
    const dy = m.gy - state.drag.start.gy;
    for (const [id, orig] of state.drag.originals) {
      const room = findRoomById(state.rooms, id);
      if (room) {
        room.x = orig.x + dx;
        room.y = orig.y + dy;
      }
    }
  } else if (state.drag.type === 'resize') {
    const o = state.drag.orig;
    const d = state.drag.dir;
    const targetId = state.drag.targetId;
    const target = findRoomById(state.rooms, targetId);
    if (target) {
      if (d.includes('w')) {
        target.x = Math.min(m.gx, o.x + o.w - 1);
        target.w = Math.max(1, o.x + o.w - target.x);
      }
      if (d.includes('e')) {
        target.w = Math.max(1, m.gx - o.x);
      }
      if (d.includes('n')) {
        target.y = Math.min(m.gy, o.y + o.h - 1);
        target.h = Math.max(1, o.y + o.h - target.y);
      }
      if (d.includes('s')) {
        target.h = Math.max(1, m.gy - o.y);
      }
      clampWallObjects(target);
      clampAllInteriorObjects(target);
    }
  } else if (state.drag.type === 'groupResize') {
    const { anchor, origBB, originals } = state.drag;

    const rawW = Math.abs(m.gx - anchor.gx);
    const rawH = Math.abs(m.gy - anchor.gy);
    const scale = computeGroupScale(origBB, rawW, rawH, originals.values());
    if (scale === null) {
      ec.render();
      return;
    }

    for (const [id, orig] of originals) {
      const room = findRoomById(state.rooms, id);
      if (!room) continue;

      const scaled = applyGroupScale(anchor, orig, scale);
      room.x = scaled.x;
      room.y = scaled.y;
      room.w = scaled.w;
      room.h = scaled.h;

      if (orig.fontSize !== undefined) {
        room.fontSize = Math.max(1, Math.round(orig.fontSize * scale));
      }

      if (orig.wallObjects && room.wallObjects) {
        for (const origWo of orig.wallObjects) {
          const wo = room.wallObjects.find((w) => w.id === origWo.id);
          if (wo) {
            wo.offset = origWo.offset * scale;
            wo.width = origWo.width * scale;
          }
        }
        clampWallObjects(room);
      }

      if (orig.interiorObjects && room.interiorObjects) {
        for (const origIo of orig.interiorObjects) {
          const io = room.interiorObjects.find((i) => i.id === origIo.id);
          if (io) {
            io.x = origIo.x * scale;
            io.y = origIo.y * scale;
            io.w = origIo.w * scale;
            io.h = origIo.h * scale;
            if (io.type === 'camera' && origIo.fovRange !== undefined) {
              io.fovRange = origIo.fovRange * scale;
            }
          }
        }
        clampAllInteriorObjects(room);
      }
    }
  } else if (state.drag.type === 'moveWallObject') {
    const drag = state.drag;
    const targetRoom = findRoomById(state.rooms, drag.roomId);
    if (targetRoom) {
      const obj = findWallObjectById(targetRoom, drag.objectId);
      if (obj) {
        const pos = computeWallObjectPosition(targetRoom, m.px, m.py, obj.width);
        obj.side = pos.side;
        obj.offset = pos.offset;
        // NOTE: 毎mousemoveで呼ぶためパフォーマンスコストがある。
        // 部屋数が非常に多い間取りでは、デバウンスやmouseup時のみの同期を検討。
        syncPairedOpening(state.rooms, targetRoom, obj);
      }
    }
  } else if (state.drag.type === 'resizeWallObject') {
    const drag = state.drag;
    const targetRoom = findRoomById(state.rooms, drag.roomId);
    if (targetRoom) {
      const obj = findWallObjectById(targetRoom, drag.objectId);
      if (obj) {
        const result = computeWallObjectResize(
          targetRoom,
          obj,
          drag.edge,
          m.px,
          m.py,
          drag.origOffset,
          drag.origWidth,
        );
        obj.offset = result.offset;
        obj.width = result.width;
        // NOTE: 毎mousemoveで呼ぶためパフォーマンスコストがある。
        // 部屋数が非常に多い間取りでは、デバウンスやmouseup時のみの同期を検討。
        syncPairedOpening(state.rooms, targetRoom, obj);
      }
    }
  } else if (state.drag.type === 'moveInteriorObject') {
    const drag = state.drag;
    const targetRoom = findRoomById(state.rooms, drag.roomId);
    if (targetRoom) {
      const obj = findInteriorObjectById(targetRoom, drag.objectId);
      if (obj) {
        const gxF = drag.snapToGrid ? m.gx : m.px / GRID;
        const gyF = drag.snapToGrid ? m.gy : m.py / GRID;
        const pos = computeInteriorObjectMove(
          targetRoom,
          obj,
          gxF,
          gyF,
          drag.offsetX,
          drag.offsetY,
        );
        obj.x = pos.x;
        obj.y = pos.y;
      }
    }
  } else if (state.drag.type === 'resizeInteriorObject') {
    const drag = state.drag;
    const targetRoom = findRoomById(state.rooms, drag.roomId);
    if (targetRoom) {
      const obj = findInteriorObjectById(targetRoom, drag.objectId);
      if (obj) {
        const gxF = drag.snapToGrid ? m.gx : m.px / GRID;
        const gyF = drag.snapToGrid ? m.gy : m.py / GRID;
        const minSize = drag.snapToGrid ? 1 : 0.25;
        const result = computeInteriorObjectResize(
          targetRoom,
          drag.dir,
          drag.orig,
          gxF,
          gyF,
          minSize,
        );
        obj.x = result.x;
        obj.y = result.y;
        obj.w = result.w;
        obj.h = result.h;
      }
    }
  } else if (
    state.drag.type === 'rotateCameraAngle' ||
    state.drag.type === 'adjustCameraFovAngle' ||
    state.drag.type === 'adjustCameraFovRange'
  ) {
    const drag = state.drag;
    const found = findCameraInRoom(state.rooms, drag.roomId, drag.objectId);
    if (found) {
      if (drag.type === 'rotateCameraAngle') {
        found.cam.angle = computeCameraAngle(found.room, found.cam, m.px, m.py);
      } else if (drag.type === 'adjustCameraFovAngle') {
        found.cam.fovAngle = computeCameraFovAngle(found.room, found.cam, m.px, m.py);
      } else {
        found.cam.fovRange = computeCameraFovRange(found.room, found.cam, m.px, m.py);
      }
    }
  } else if (state.drag.type === 'moveFreeText') {
    const drag = state.drag;
    const ft = findFreeTextById(state.freeTexts, drag.freeTextId);
    if (ft) {
      ft.gx = m.gx - drag.offsetGx;
      ft.gy = m.gy - drag.offsetGy;
    }
  } else if (state.drag.type === 'resizeFreeText') {
    const drag = state.drag;
    const ft = findFreeTextById(state.freeTexts, drag.freeTextId);
    if (ft) {
      const result = computeFreeTextResize(drag.dir, drag.orig, m.gx, m.gy);
      ft.gx = result.gx;
      ft.gy = result.gy;
      ft.w = result.w;
      ft.h = result.h;
    }
  }

  ec.render();
}
