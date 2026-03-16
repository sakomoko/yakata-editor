import { zoomAtCenter as zoomAtCenterFn } from '../viewport.ts';
import { pushUndo } from '../history.ts';
import { clearSelection } from '../selection.ts';
import { persistToStorage, persistViewport } from '../persistence.ts';
import { bringToFront, sendToBack, bringForward, sendBackward } from '../z-order.ts';
import { cleanupSingletonGroups } from '../link.ts';
import { syncAllPairedOpenings } from '../adjacency.ts';
import type { EditorContext } from './context.ts';
import { commitChange, undo } from './project.ts';

export function onKeyDown(ec: EditorContext, e: KeyboardEvent): void {
  if (e.isComposing) return;

  const { canvas, state, viewport, flags } = ec;

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
    persistViewport(viewport);
    return;
  }
  if ((e.metaKey || e.ctrlKey) && e.key === '-') {
    e.preventDefault();
    const newVp = zoomAtCenterFn(viewport, canvas.width, canvas.height, viewport.zoom / 1.25);
    Object.assign(viewport, newVp);
    ec.render();
    persistViewport(viewport);
    return;
  }
  if ((e.metaKey || e.ctrlKey) && e.key === '0') {
    e.preventDefault();
    viewport.zoom = 1;
    viewport.panX = 0;
    viewport.panY = 0;
    ec.render();
    persistViewport(viewport);
    return;
  }

  if (
    (e.metaKey || e.ctrlKey) &&
    (e.key === ']' || e.key === '[') &&
    state.selection.size === 1
  ) {
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
    pushUndo(state.history, state.rooms, state.freeTexts);
    const changed = fn(state.rooms, roomId);
    if (changed) {
      ec.render();
      persistToStorage(state.rooms, state.freeTexts);
    } else {
      state.history.pop();
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
      commitChange(ec, () => {
        // 選択中のFreeTextも削除
        state.freeTexts = state.freeTexts.filter((f) => !state.selection.has(f.id));
        state.rooms = state.rooms.filter((r) => !state.selection.has(r.id));
        cleanupSingletonGroups(state.rooms);
        syncAllPairedOpenings(state.rooms);
        clearSelection(state.selection);
      });
    }
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
      ec.canvas.style.cursor = 'crosshair';
    }
  }
}
