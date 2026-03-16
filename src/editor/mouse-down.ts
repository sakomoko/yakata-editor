import type { FreeText } from '../types.ts';
import { GRID } from '../grid.ts';
import { hitHandle, hitRoom } from '../room.ts';
import { toggleSelection, selectSingle, clearSelection } from '../selection.ts';
import { pushUndo } from '../history.ts';
import {
  hitWallObjectInRooms,
  hitWallObjectEdgeInRooms,
} from '../wall-object.ts';
import {
  hitInteriorObjectInRooms,
  hitInteriorObjectHandleInRooms,
} from '../interior-object.ts';
import { hitCameraHandleInRooms } from '../camera.ts';
import { hitFreeText, hitFreeTextHandle } from '../free-text.ts';
import { expandWithLinked } from '../link.ts';
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

  // Check wall object edge hit (resize) FIRST — on narrow walls, room handles overlap
  const selectedRooms = state.rooms.filter((r) => state.selection.has(r.id));
  const edgeHit = hitWallObjectEdgeInRooms(selectedRooms, m.px, m.py, viewport.zoom, true);
  if (edgeHit) {
    pushUndo(state.history, state.rooms, state.freeTexts);
    flags.activeInteriorObjectId = undefined;
    const horiz = edgeHit.obj.side === 'n' || edgeHit.obj.side === 's';
    state.drag = {
      type: 'resizeWallObject',
      roomId: edgeHit.room.id,
      objectId: edgeHit.obj.id,
      edge: edgeHit.edge,
      origOffset: edgeHit.obj.offset,
      origWidth: edgeHit.obj.width,
    };
    canvas.style.cursor = horiz ? 'ew-resize' : 'ns-resize';
    ec.render();
    return;
  }

  // Check FreeText handle hit (resize) — only for active FreeText
  if (flags.activeFreeTextId) {
    const activeFt = state.freeTexts.find((ft) => ft.id === flags.activeFreeTextId);
    if (activeFt) {
      const ftHandleDir = hitFreeTextHandle(activeFt, m.px, m.py, viewport.zoom);
      if (ftHandleDir) {
        pushUndo(state.history, state.rooms, state.freeTexts);
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
    pushUndo(state.history, state.rooms, state.freeTexts);
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
    pushUndo(state.history, state.rooms, state.freeTexts);
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
    pushUndo(state.history, state.rooms, state.freeTexts);
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

  // Check wall object hit (window drag) — skip auto-generated openings
  const wallHit = hitWallObjectInRooms(state.rooms, m.px, m.py, viewport.zoom, true);
  if (wallHit) {
    pushUndo(state.history, state.rooms, state.freeTexts);
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
    pushUndo(state.history, state.rooms, state.freeTexts);
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
    pushUndo(state.history, state.rooms, state.freeTexts);
    state.drag = {
      type: 'moveFreeText',
      freeTextId: ft.id,
      offsetGx: m.gx - ft.gx,
      offsetGy: m.gy - ft.gy,
    };
    canvas.style.cursor = 'grabbing';
    ec.render();
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
    } else {
      if (!state.selection.has(r.id)) {
        selectSingle(state.selection, r.id);
      }
    }
    if (state.selection.size === 0) {
      ec.render();
      return;
    }
    pushUndo(state.history, state.rooms, state.freeTexts);
    const expanded = expandWithLinked(state.rooms, state.selection);
    const originals = new Map<string, { x: number; y: number }>();
    for (const room of state.rooms) {
      if (expanded.has(room.id)) {
        originals.set(room.id, { x: room.x, y: room.y });
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
