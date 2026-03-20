import type { FreeText, GroupScaleOriginal, Room } from '../types.ts';
import { findFreeTextById, findRoomById } from '../lookup.ts';
import { GRID } from '../grid.ts';
import {
  hitHandle,
  hitRoom,
  computeGroupBoundingBox,
  hitGroupHandle,
  getAnchorForDir,
} from '../room.ts';
import { toggleSelection, selectSingle, clearSelection, getSelectedRooms } from '../selection.ts';
import { saveUndoPoint } from '../history.ts';
import { hitWallObjectInRooms, hitWallObjectEdgeInRooms } from '../wall-object.ts';
import { hitInteriorObjectInRooms, hitInteriorObjectHandleInRooms } from '../interior-object.ts';
import { hitCameraHandleInRooms } from '../camera.ts';
import { hitFreeText, hitFreeTextHandle } from '../free-text.ts';
import { createFreeStroke, hitFreeStrokeInList, STROKE_HIT_TOLERANCE_PX } from '../free-stroke.ts';
import { hitArrowInList, hitArrowPoint, constrainToAxis } from '../arrow.ts';
import { expandWithLinked } from '../link.ts';
import { hitVertexHandle, edgeResizeCursor } from '../polygon.ts';
import type { EditorContext } from './context.ts';

export function onMouseDown(ec: EditorContext, e: MouseEvent): void {
  const { canvas, state, viewport, flags } = ec;

  if (e.button === 1 || (e.button === 0 && flags.isPanning)) {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    state.drag = {
      type: 'pan',
      startScreenX: e.clientX - rect.left,
      startScreenY: e.clientY - rect.top,
      startPanX: viewport.panX,
      startPanY: viewport.panY,
    };
    canvas.style.cursor = 'grabbing';
    return;
  }

  const m = ec.mousePos(e);
  const shift = e.shiftKey;

  // Paint mode: start new stroke
  if (state.paintMode && e.button === 0) {
    flags.savedRedo = saveUndoPoint(
      state.history,
      state.redoHistory,
      state.rooms,
      state.freeTexts,
      state.freeStrokes,
      state.arrows,
    );
    const stroke = createFreeStroke(
      [{ px: m.px, py: m.py }],
      state.paintColor,
      state.paintLineWidth,
      state.paintOpacity,
    );
    state.freeStrokes.push(stroke);
    state.drag = { type: 'paint', strokeId: stroke.id };
    canvas.style.cursor = 'crosshair';
    ec.render();
    return;
  }

  // Arrow mode: add point to pending arrow
  if (state.arrowMode && e.button === 0) {
    let point = { gx: m.gx, gy: m.gy };
    if (flags.pendingArrow && flags.pendingArrow.points.length > 0 && shift) {
      const lastPt = flags.pendingArrow.points[flags.pendingArrow.points.length - 1];
      point = constrainToAxis(lastPt, point);
    }
    if (!flags.pendingArrow) {
      flags.pendingArrow = { points: [point] };
    } else {
      flags.pendingArrow.points.push(point);
    }
    flags.pendingArrow.previewPoint = undefined;
    ec.render();
    return;
  }

  // Check wall object edge hit (resize) FIRST — on narrow walls, room handles overlap
  const selectedRooms = state.rooms.filter((r) => state.selection.has(r.id));
  const edgeHit = hitWallObjectEdgeInRooms(selectedRooms, m.px, m.py, viewport.zoom, true);
  if (edgeHit) {
    flags.savedRedo = saveUndoPoint(
      state.history,
      state.redoHistory,
      state.rooms,
      state.freeTexts,
      state.freeStrokes,
      state.arrows,
    );
    flags.activeInteriorObjectId = undefined;
    state.drag = {
      type: 'resizeWallObject',
      roomId: edgeHit.room.id,
      objectId: edgeHit.obj.id,
      edge: edgeHit.edge,
      origOffset: edgeHit.obj.offset,
      origWidth: edgeHit.obj.width,
    };
    canvas.style.cursor = edgeResizeCursor(edgeHit.room, edgeHit.obj.side);
    ec.render();
    return;
  }

  // Check vertex handle hit (polygon room) — before room resize handles
  if (state.selection.size === 1) {
    const selId = state.selection.values().next().value;
    const selRoom = selId ? findRoomById(state.rooms, selId) : null;
    if (selRoom?.vertices) {
      const vHit = hitVertexHandle(selRoom, m.px, m.py, viewport.zoom);
      if (vHit) {
        flags.savedRedo = saveUndoPoint(
          state.history,
          state.redoHistory,
          state.rooms,
          state.freeTexts,
          state.freeStrokes,
          state.arrows,
        );
        state.drag = {
          type: 'moveVertex',
          roomId: selRoom.id,
          vertexIndex: vHit.vertexIndex,
        };
        canvas.style.cursor = 'move';
        ec.render();
        return;
      }
    }
  }

  // Check FreeText handle hit (resize) — only for active FreeText
  if (flags.activeFreeTextId) {
    const activeFt = findFreeTextById(state.freeTexts, flags.activeFreeTextId);
    if (activeFt) {
      const ftHandleDir = hitFreeTextHandle(activeFt, m.px, m.py, viewport.zoom);
      if (ftHandleDir) {
        flags.savedRedo = saveUndoPoint(
          state.history,
          state.redoHistory,
          state.rooms,
          state.freeTexts,
          state.freeStrokes,
          state.arrows,
        );
        state.drag = {
          type: 'resizeFreeText',
          freeTextId: activeFt.id,
          dir: ftHandleDir,
          orig: { gx: activeFt.gx, gy: activeFt.gy, w: activeFt.w, h: activeFt.h },
        };
        canvas.style.cursor = ftHandleDir + '-resize';
        ec.render();
        return;
      }
    }
  }

  // Check camera handle hit (rotate/fov)
  const camHandleHit = hitCameraHandleInRooms(
    selectedRooms,
    m.px,
    m.py,
    viewport.zoom,
    flags.activeInteriorObjectId,
  );
  if (camHandleHit) {
    flags.savedRedo = saveUndoPoint(
      state.history,
      state.redoHistory,
      state.rooms,
      state.freeTexts,
      state.freeStrokes,
      state.arrows,
    );
    flags.activeInteriorObjectId = camHandleHit.cam.id;
    const dragType =
      camHandleHit.hit.type === 'rotate'
        ? ('rotateCameraAngle' as const)
        : camHandleHit.hit.type === 'fovRange'
          ? ('adjustCameraFovRange' as const)
          : ('adjustCameraFovAngle' as const);
    state.drag = {
      type: dragType,
      roomId: camHandleHit.room.id,
      objectId: camHandleHit.cam.id,
    };
    canvas.style.cursor = 'grabbing';
    ec.render();
    return;
  }

  // Check interior object handle hit (resize)
  const intHandleHit = hitInteriorObjectHandleInRooms(selectedRooms, m.px, m.py, viewport.zoom);
  if (intHandleHit) {
    flags.savedRedo = saveUndoPoint(
      state.history,
      state.redoHistory,
      state.rooms,
      state.freeTexts,
      state.freeStrokes,
      state.arrows,
    );
    flags.activeInteriorObjectId = intHandleHit.obj.id;
    state.drag = {
      type: 'resizeInteriorObject',
      roomId: intHandleHit.room.id,
      objectId: intHandleHit.obj.id,
      dir: intHandleHit.dir,
      snapToGrid: intHandleHit.obj.type === 'stairs',
      orig: {
        x: intHandleHit.obj.x,
        y: intHandleHit.obj.y,
        w: intHandleHit.obj.w,
        h: intHandleHit.obj.h,
      },
    };
    canvas.style.cursor = intHandleHit.dir + '-resize';
    ec.render();
    return;
  }

  const handleHit = hitHandle(state.rooms, state.selection, m.px, m.py, viewport.zoom);
  if (handleHit) {
    flags.savedRedo = saveUndoPoint(
      state.history,
      state.redoHistory,
      state.rooms,
      state.freeTexts,
      state.freeStrokes,
      state.arrows,
    );
    const { handle, room } = handleHit;
    state.drag = {
      type: 'resize',
      dir: handle.dir,
      orig: { x: room.x, y: room.y, w: room.w, h: room.h },
      targetId: room.id,
      start: m,
    };
    return;
  }

  // Group resize: multiple rooms selected → check group bounding box handles
  // selection にはFreeTextのIDも含まれるため、部屋が2つ以上あるか確認
  {
    const selRooms = getSelectedRooms(state.rooms, state.selection);
    if (selRooms.length >= 2) {
      const selBB = computeGroupBoundingBox(selRooms);
      const groupHandle = hitGroupHandle(selBB, m.px, m.py, viewport.zoom);
      if (groupHandle) {
        flags.savedRedo = saveUndoPoint(
          state.history,
          state.redoHistory,
          state.rooms,
          state.freeTexts,
          state.freeStrokes,
          state.arrows,
        );
        const expanded = expandWithLinked(state.rooms, state.selection);
        const expandedRooms = state.rooms.filter((r) => expanded.has(r.id));
        // origBB/anchor は表示BBと一致する selBB を使用（ハンドル位置とスケール基準を統一）
        const originals = new Map<string, GroupScaleOriginal>();
        for (const room of expandedRooms) {
          originals.set(room.id, {
            x: room.x,
            y: room.y,
            w: room.w,
            h: room.h,
            fontSize: room.fontSize,
            vertices: room.vertices
              ? (room.vertices.map((v) => ({ gx: v.gx, gy: v.gy })) as Room['vertices'])
              : undefined,
            wallObjects: room.wallObjects?.map((wo) => ({
              id: wo.id,
              offset: wo.offset,
              width: wo.width,
            })),
            interiorObjects: room.interiorObjects?.map((io) => ({
              id: io.id,
              x: io.x,
              y: io.y,
              w: io.w,
              h: io.h,
              fovRange: io.type === 'camera' ? io.fovRange : undefined,
            })),
          });
        }
        const anchor = getAnchorForDir(selBB, groupHandle.dir);
        state.drag = {
          type: 'groupResize',
          dir: groupHandle.dir,
          origBB: selBB,
          anchor,
          originals,
        };
        canvas.style.cursor = groupHandle.dir + '-resize';
        ec.render();
        return;
      }
    }
  }

  // Check wall object hit (window drag) — skip auto-generated openings
  const wallHit = hitWallObjectInRooms(state.rooms, m.px, m.py, viewport.zoom, true);
  if (wallHit) {
    flags.savedRedo = saveUndoPoint(
      state.history,
      state.redoHistory,
      state.rooms,
      state.freeTexts,
      state.freeStrokes,
      state.arrows,
    );
    flags.activeInteriorObjectId = undefined;
    state.drag = {
      type: 'moveWallObject',
      roomId: wallHit.room.id,
      objectId: wallHit.obj.id,
    };
    canvas.style.cursor = 'grabbing';
    ec.render();
    return;
  }

  // Check interior object hit (move)
  const intHit = hitInteriorObjectInRooms(state.rooms, m.px, m.py);
  if (intHit) {
    flags.savedRedo = saveUndoPoint(
      state.history,
      state.redoHistory,
      state.rooms,
      state.freeTexts,
      state.freeStrokes,
      state.arrows,
    );
    selectSingle(state.selection, intHit.room.id);
    flags.activeInteriorObjectId = intHit.obj.id;
    const snapToGrid = intHit.obj.type === 'stairs';
    const curGx = snapToGrid ? m.gx : m.px / GRID;
    const curGy = snapToGrid ? m.gy : m.py / GRID;
    const offsetX = curGx - intHit.room.x - intHit.obj.x;
    const offsetY = curGy - intHit.room.y - intHit.obj.y;
    state.drag = {
      type: 'moveInteriorObject',
      roomId: intHit.room.id,
      objectId: intHit.obj.id,
      offsetX,
      offsetY,
      snapToGrid,
    };
    canvas.style.cursor = 'grabbing';
    ec.render();
    return;
  }

  flags.activeInteriorObjectId = undefined;

  function startFreeTextDrag(ft: FreeText): void {
    flags.activeFreeTextId = ft.id;
    if (shift) {
      toggleSelection(state.selection, ft.id);
    } else {
      selectSingle(state.selection, ft.id);
    }
    flags.savedRedo = saveUndoPoint(
      state.history,
      state.redoHistory,
      state.rooms,
      state.freeTexts,
      state.freeStrokes,
      state.arrows,
    );
    state.drag = {
      type: 'moveFreeText',
      freeTextId: ft.id,
      offsetGx: m.gx - ft.gx,
      offsetGy: m.gy - ft.gy,
    };
    canvas.style.cursor = 'grabbing';
    ec.render();
  }

  // Check arrow hit (select/move)
  {
    const arrowGx = m.px / GRID;
    const arrowGy = m.py / GRID;
    // First check if we hit a point handle on a selected arrow
    for (const arrow of state.arrows) {
      if (!state.selection.has(arrow.id)) continue;
      const ptIdx = hitArrowPoint(arrow, arrowGx, arrowGy);
      if (ptIdx !== undefined) {
        flags.savedRedo = saveUndoPoint(
          state.history,
          state.redoHistory,
          state.rooms,
          state.freeTexts,
          state.freeStrokes,
          state.arrows,
        );
        state.drag = {
          type: 'moveArrowPoint',
          arrowId: arrow.id,
          pointIndex: ptIdx,
        };
        flags.activeFreeTextId = undefined;
        canvas.style.cursor = 'grabbing';
        ec.render();
        return;
      }
    }
    // Then check segment hit
    const arrowHit = hitArrowInList(state.arrows, arrowGx, arrowGy);
    if (arrowHit) {
      if (shift) {
        toggleSelection(state.selection, arrowHit.id);
      } else {
        selectSingle(state.selection, arrowHit.id);
      }
      flags.savedRedo = saveUndoPoint(
        state.history,
        state.redoHistory,
        state.rooms,
        state.freeTexts,
        state.freeStrokes,
        state.arrows,
      );
      state.drag = {
        type: 'moveArrow',
        arrowId: arrowHit.id,
        startGx: m.gx,
        startGy: m.gy,
        origPoints: arrowHit.points.map((p) => ({ gx: p.gx, gy: p.gy })),
      };
      flags.activeFreeTextId = undefined;
      canvas.style.cursor = 'grabbing';
      ec.render();
      return;
    }
  }

  // Check free stroke hit (select/move)
  const strokeHitTolerance = STROKE_HIT_TOLERANCE_PX / viewport.zoom;
  const strokeHit = hitFreeStrokeInList(state.freeStrokes, m.px, m.py, strokeHitTolerance);
  if (strokeHit) {
    if (shift) {
      toggleSelection(state.selection, strokeHit.id);
    } else {
      selectSingle(state.selection, strokeHit.id);
    }
    flags.savedRedo = saveUndoPoint(
      state.history,
      state.redoHistory,
      state.rooms,
      state.freeTexts,
      state.freeStrokes,
      state.arrows,
    );
    state.drag = {
      type: 'moveStroke',
      id: strokeHit.id,
      offsetPx: m.px,
      offsetPy: m.py,
    };
    flags.activeFreeTextId = undefined;
    canvas.style.cursor = 'grabbing';
    ec.render();
    return;
  }

  // Check front-layer FreeText hit
  const frontFtHit = hitFreeText(state.freeTexts, m.px, m.py, 'front');
  if (frontFtHit) {
    startFreeTextDrag(frontFtHit);
    return;
  }

  flags.activeFreeTextId = undefined;
  const r = hitRoom(state.rooms, m.px, m.py);
  if (r) {
    if (shift) {
      toggleSelection(state.selection, r.id);
      // Shift+トグルで選択が空になった場合は再選択してドラッグを開始可能にする
      if (state.selection.size === 0) {
        state.selection.add(r.id);
      }
    } else {
      if (!state.selection.has(r.id)) {
        selectSingle(state.selection, r.id);
      }
    }
    flags.savedRedo = saveUndoPoint(
      state.history,
      state.redoHistory,
      state.rooms,
      state.freeTexts,
      state.freeStrokes,
      state.arrows,
    );
    const expanded = expandWithLinked(state.rooms, state.selection);
    const originals = new Map<string, { x: number; y: number; vertices?: Room['vertices'] }>();
    for (const room of state.rooms) {
      if (expanded.has(room.id)) {
        originals.set(room.id, {
          x: room.x,
          y: room.y,
          vertices: room.vertices
            ? (room.vertices.map((v) => ({ gx: v.gx, gy: v.gy })) as Room['vertices'])
            : undefined,
        });
      }
    }
    state.drag = { type: 'move', originals, start: m };
    ec.render();
    return;
  }

  // Check back-layer FreeText hit
  const backFtHit = hitFreeText(state.freeTexts, m.px, m.py, 'back');
  if (backFtHit) {
    startFreeTextDrag(backFtHit);
    return;
  }

  if (!shift) clearSelection(state.selection);
  state.drag = { type: 'create', start: m, cur: m };
  ec.render();
}
