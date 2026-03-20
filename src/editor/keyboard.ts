import { zoomAtCenter as zoomAtCenterFn } from '../viewport.ts';
import { saveUndoPoint, cancelLastUndo } from '../history.ts';
import { clearSelection } from '../selection.ts';
import { bringToFront, sendToBack, bringForward, sendBackward } from '../z-order.ts';
import type { EditorContext } from './context.ts';
import { commitChange, undo, redo, deleteSelectedEntities } from './project.ts';
import { copySelection, pasteClipboard, duplicateSelection } from './clipboard.ts';

export function onKeyDown(ec: EditorContext, e: KeyboardEvent): void {
  if (e.isComposing) return;

  const { canvas, state, viewport, flags } = ec;

  // P キーでペイントモードトグル
  if (
    e.key.toLowerCase() === 'p' &&
    !e.metaKey &&
    !e.ctrlKey &&
    document.activeElement === document.body
  ) {
    e.preventDefault();
    state.paintMode = !state.paintMode;
    if (state.paintMode) {
      state.arrowMode = false;
      flags.pendingArrow = null;
      clearSelection(state.selection);
      flags.activeInteriorObjectId = undefined;
      flags.activeFreeTextId = undefined;
      ec.callbacks.onArrowModeChange?.(false);
    }
    canvas.style.cursor = state.paintMode ? 'crosshair' : 'default';
    ec.render();
    ec.callbacks.onPaintModeChange?.(state.paintMode);
    return;
  }

  // A キーでアローモードトグル
  if (
    e.key.toLowerCase() === 'a' &&
    !e.metaKey &&
    !e.ctrlKey &&
    document.activeElement === document.body
  ) {
    e.preventDefault();
    state.arrowMode = !state.arrowMode;
    if (state.arrowMode) {
      state.paintMode = false;
      clearSelection(state.selection);
      flags.activeInteriorObjectId = undefined;
      flags.activeFreeTextId = undefined;
      ec.callbacks.onPaintModeChange?.(false);
    } else {
      flags.pendingArrow = null;
    }
    canvas.style.cursor = state.arrowMode ? 'crosshair' : 'default';
    ec.render();
    ec.callbacks.onArrowModeChange?.(state.arrowMode);
    return;
  }

  // Arrow mode: Escape to cancel, Backspace to remove last point
  if (state.arrowMode && flags.pendingArrow) {
    if (e.key === 'Escape') {
      e.preventDefault();
      flags.pendingArrow = null;
      ec.render();
      return;
    }
    if (e.key === 'Backspace' && document.activeElement === document.body) {
      e.preventDefault();
      flags.pendingArrow.points.pop();
      if (flags.pendingArrow.points.length === 0) {
        flags.pendingArrow = null;
      }
      ec.render();
      return;
    }
  }

  if (e.code === 'Space' && !flags.isPanning && document.activeElement === document.body) {
    e.preventDefault();
    flags.isPanning = true;
    canvas.style.cursor = 'grab';
    return;
  }

  if ((e.metaKey || e.ctrlKey) && (e.key === '=' || e.key === '+')) {
    e.preventDefault();
    const newVp = zoomAtCenterFn(viewport, canvas.width, canvas.height, viewport.zoom * 1.25);
    Object.assign(viewport, newVp);
    ec.render();
    ec.callbacks.onViewportChange();
    return;
  }
  if ((e.metaKey || e.ctrlKey) && e.key === '-') {
    e.preventDefault();
    const newVp = zoomAtCenterFn(viewport, canvas.width, canvas.height, viewport.zoom / 1.25);
    Object.assign(viewport, newVp);
    ec.render();
    ec.callbacks.onViewportChange();
    return;
  }
  if ((e.metaKey || e.ctrlKey) && e.key === '0') {
    e.preventDefault();
    viewport.zoom = 1;
    viewport.panX = 0;
    viewport.panY = 0;
    ec.render();
    ec.callbacks.onViewportChange();
    return;
  }

  if ((e.metaKey || e.ctrlKey) && (e.key === ']' || e.key === '[') && state.selection.size === 1) {
    e.preventDefault();
    const roomId = [...state.selection][0];
    const forward = e.key === ']';
    const fn = e.shiftKey
      ? forward
        ? bringToFront
        : sendToBack
      : forward
        ? bringForward
        : sendBackward;
    flags.savedRedo = saveUndoPoint(
      state.history,
      state.redoHistory,
      state.rooms,
      state.freeTexts,
      state.freeStrokes,
      state.arrows,
    );
    const changed = fn(state.rooms, roomId);
    if (changed) {
      ec.render();
      ec.callbacks.onAutoSave();
    } else {
      cancelLastUndo(state.history, state.redoHistory, flags.savedRedo);
    }
    return;
  }

  if ((e.key === 'Delete' || e.key === 'Backspace') && document.activeElement === document.body) {
    // Delete active FreeText first
    if (flags.activeFreeTextId) {
      e.preventDefault();
      const activeId = flags.activeFreeTextId;
      commitChange(ec, () => {
        state.freeTexts = state.freeTexts.filter((f) => f.id !== activeId);
      });
      flags.activeFreeTextId = undefined;
      return;
    }
    // Delete active interior object
    if (flags.activeInteriorObjectId) {
      e.preventDefault();
      const activeId = flags.activeInteriorObjectId;
      commitChange(ec, () => {
        for (const room of state.rooms) {
          if (room.interiorObjects?.some((o) => o.id === activeId)) {
            room.interiorObjects = room.interiorObjects?.filter((o) => o.id !== activeId);
            if (room.interiorObjects?.length === 0) room.interiorObjects = undefined;
            break;
          }
        }
      });
      flags.activeInteriorObjectId = undefined;
      return;
    }
    if (state.selection.size > 0) {
      e.preventDefault();
      deleteSelectedEntities(ec);
    }
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
    e.preventDefault();
    copySelection(ec);
    return;
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
    e.preventDefault();
    pasteClipboard(ec, 'none');
    return;
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
    e.preventDefault();
    duplicateSelection(ec);
    return;
  }

  if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
    e.preventDefault();
    redo(ec);
    return;
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
    e.preventDefault();
    undo(ec);
  }
}

export function onKeyUp(ec: EditorContext, e: KeyboardEvent): void {
  if (e.code === 'Space') {
    ec.flags.isPanning = false;
    if (!ec.state.drag || ec.state.drag.type !== 'pan') {
      ec.canvas.style.cursor = ec.state.paintMode ? 'crosshair' : 'default';
    }
  }
}
