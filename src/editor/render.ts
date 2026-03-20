import { drawGrid } from '../grid.ts';
import { findFreeTextById, findInteriorObjectById } from '../lookup.ts';
import {
  drawRoom,
  drawCreationPreview,
  drawAreaSelectPreview,
  drawGroupBoundingBox,
} from '../room.ts';
import { getSingleSelected, getSelectedRooms } from '../selection.ts';
import { drawOutwardDoorsOverlay } from '../wall-object.ts';
import { drawCameraFovOverlay, drawCameraHandles } from '../camera.ts';
import { drawFreeText, drawFreeTextHandles } from '../free-text.ts';
import { drawFreeStroke, drawFreeStrokeBounds } from '../free-stroke.ts';
import { drawArrow, drawArrowHandles, drawPendingArrow } from '../arrow.ts';
import { drawLinkGroupIndicators } from '../link.ts';
import type { SnapIndicator } from '../snap.ts';
import type { EditorContext } from './context.ts';

export function render(ec: EditorContext): void {
  const { ctx, canvas, state, viewport, flags } = ec;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.setTransform(
    viewport.zoom,
    0,
    0,
    viewport.zoom,
    -viewport.panX * viewport.zoom,
    -viewport.panY * viewport.zoom,
  );

  const viewMinX = viewport.panX;
  const viewMinY = viewport.panY;
  const viewMaxX = viewport.panX + canvas.width / viewport.zoom;
  const viewMaxY = viewport.panY + canvas.height / viewport.zoom;
  drawGrid(ctx, viewMinX, viewMinY, viewMaxX, viewMaxY);

  function drawFreeTextLayer(layer: 'front' | 'back'): void {
    for (const ft of state.freeTexts) {
      if (ft.zLayer !== layer) continue;
      drawFreeText(
        ctx,
        ft,
        state.selection.has(ft.id),
        ft.id === flags.activeFreeTextId,
        viewport.zoom,
      );
    }
  }

  drawFreeTextLayer('back');

  const activeWallObjectId =
    state.drag?.type === 'moveWallObject' || state.drag?.type === 'resizeWallObject'
      ? state.drag.objectId
      : undefined;
  const activeIntObjId =
    state.drag?.type === 'moveInteriorObject' || state.drag?.type === 'resizeInteriorObject'
      ? state.drag.objectId
      : flags.activeInteriorObjectId;
  for (const r of state.rooms) {
    const isSelected = state.selection.has(r.id);
    drawRoom(
      ctx,
      r,
      isSelected,
      isSelected && state.selection.size === 1,
      viewport.zoom,
      activeWallObjectId,
      activeIntObjId,
    );
  }

  // Group bounding box for multi-selection
  {
    const selRooms = getSelectedRooms(state.rooms, state.selection);
    if (selRooms.length >= 2) {
      drawGroupBoundingBox(ctx, selRooms, viewport.zoom);
    }
  }

  // link group indicators
  drawLinkGroupIndicators(ctx, state.rooms, state.selection, viewport.zoom);

  // 2nd pass: redraw outward doors on top of all rooms to prevent occlusion
  for (const r of state.rooms) {
    const isSelected = state.selection.has(r.id);
    drawOutwardDoorsOverlay(ctx, r, isSelected, viewport.zoom, activeWallObjectId);
  }

  // 3rd pass: camera FOV overlay (drawn after doors so it's visible above rooms)
  drawCameraFovOverlay(ctx, state.rooms, viewport.zoom);

  // Camera handles for active camera
  if (activeIntObjId) {
    for (const r of state.rooms) {
      const obj = findInteriorObjectById(r, activeIntObjId);
      const cam = obj?.type === 'camera' ? obj : undefined;
      if (cam) {
        drawCameraHandles(ctx, r, cam, viewport.zoom);
        break;
      }
    }
  }

  drawFreeTextLayer('front');

  // active FreeText handles
  if (flags.activeFreeTextId) {
    const activeFt = findFreeTextById(state.freeTexts, flags.activeFreeTextId);
    if (activeFt) {
      drawFreeTextHandles(ctx, activeFt, viewport.zoom);
    }
  }

  // Arrows
  for (const arrow of state.arrows) {
    drawArrow(ctx, arrow, viewport.zoom);
    if (state.selection.has(arrow.id)) {
      drawArrowHandles(ctx, arrow, viewport.zoom);
    }
  }

  // Pending arrow preview
  if (flags.pendingArrow && flags.pendingArrow.points.length >= 1) {
    drawPendingArrow(
      ctx,
      flags.pendingArrow.points,
      flags.pendingArrow.previewPoint,
      state.arrowColor,
      state.arrowLineWidth,
      viewport.zoom,
    );
  }

  // Free strokes (最前面レイヤー)
  for (const stroke of state.freeStrokes) {
    drawFreeStroke(ctx, stroke, viewport.zoom);
    if (state.selection.has(stroke.id)) {
      drawFreeStrokeBounds(ctx, stroke, viewport.zoom);
    }
  }

  if (state.drag && state.drag.type === 'create') {
    drawCreationPreview(ctx, state.drag.start, state.drag.cur, viewport.zoom);
  }

  if (state.drag && state.drag.type === 'areaSelect') {
    drawAreaSelectPreview(ctx, state.drag.start, state.drag.cur, viewport.zoom, state.rooms);
  }

  if (flags.snapIndicator) {
    drawSnapIndicator(ctx, flags.snapIndicator, viewport.zoom);
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  updateStatus(ec);
}

function drawSnapIndicator(ctx: CanvasRenderingContext2D, si: SnapIndicator, zoom: number): void {
  ctx.lineWidth = 2 / zoom;
  if (si.type === 'vertex') {
    ctx.beginPath();
    ctx.arc(si.px, si.py, 6 / zoom, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 140, 0, 0.7)';
    ctx.fill();
    ctx.strokeStyle = '#ff8c00';
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(si.px, si.py, 4 / zoom, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 180, 80, 0.7)';
    ctx.fill();
    ctx.strokeStyle = '#00b450';
    ctx.stroke();
    const cr = 6 / zoom;
    ctx.beginPath();
    ctx.moveTo(si.px - cr, si.py);
    ctx.lineTo(si.px + cr, si.py);
    ctx.moveTo(si.px, si.py - cr);
    ctx.lineTo(si.px, si.py + cr);
    ctx.stroke();
  }
}

export function updateStatus(ec: EditorContext): void {
  const { state, viewport, callbacks } = ec;
  const zoomPct = Math.round(viewport.zoom * 100);
  const gx = String(state.mouse.gx).padStart(5);
  const gy = String(state.mouse.gy).padStart(5);
  const zoom = String(zoomPct).padStart(5);
  const rooms = String(state.rooms.length).padStart(3);
  let text = `(${gx},${gy}) |${rooms} |${zoom}%`;
  if (state.paintMode) {
    text += ' | pen';
  }
  if (state.arrowMode) {
    text += ' | arrow';
  }
  if (state.selection.size === 1) {
    const sel = getSingleSelected(state.rooms, state.selection);
    if (sel) {
      text += ` | ${sel.label || '(?)'} ${sel.w}x${sel.h}`;
    }
  } else if (state.selection.size > 1) {
    text += ` | ${state.selection.size} sel`;
  }
  callbacks.onStatusChange(text);
}
