import { zoomAtPoint } from '../viewport.ts';
import { cancelLastUndo } from '../history.ts';
import type { EditorContext } from './context.ts';
import { onContextMenu } from './context-menu-handler.ts';

interface PointerInfo {
  x: number;
  y: number;
}

interface PinchState {
  prevDist: number;
  prevMidX: number;
  prevMidY: number;
}

const LONG_PRESS_MS = 500;
const LONG_PRESS_MOVE_THRESHOLD = 10;

/**
 * Gesture recognition layer for multitouch input.
 *
 * Registers pointer events on canvas/document and delegates single-pointer
 * events to the provided handlers. Multitouch gestures (pinch-zoom, two-finger
 * pan) and long-press context menu are handled internally.
 *
 * Apple Pencil (`pointerType === 'pen'`) is treated as mouse — it does not
 * participate in multitouch gestures.
 */
export function initGestures(
  ec: EditorContext,
  onPointerDown: (e: PointerEvent) => void,
  onPointerMove: (e: PointerEvent) => void,
  onPointerUp: (e: PointerEvent) => void,
): () => void {
  const { canvas } = ec;
  const pointers = new Map<number, PointerInfo>();
  let pinch: PinchState | null = null;
  let gestureActive = false;

  // Long-press state
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;
  let longPressStartX = 0;
  let longPressStartY = 0;

  function clearLongPress(): void {
    if (longPressTimer !== null) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }

  function dist(a: PointerInfo, b: PointerInfo): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function midpoint(a: PointerInfo, b: PointerInfo): { x: number; y: number } {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  function getTwoPointers(): [PointerInfo, PointerInfo] | null {
    if (pointers.size < 2) return null;
    const iter = pointers.values();
    const a = iter.next().value;
    const b = iter.next().value;
    if (!a || !b) return null;
    return [a, b];
  }

  /** Cancel an ongoing single-finger drag and restore undo state */
  function cancelDrag(): void {
    if (ec.state.drag) {
      cancelLastUndo(ec.state.history, ec.state.redoHistory, ec.flags.savedRedo);
      ec.flags.savedRedo = null;
      ec.state.drag = null;
      ec.render();
    }
  }

  function handlePointerDown(e: PointerEvent): void {
    // Pen is treated like mouse — don't track for gestures
    if (e.pointerType === 'pen') {
      onPointerDown(e);
      return;
    }

    if (e.pointerType === 'touch') {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointers.size === 1) {
        // Start long-press timer for single touch
        longPressStartX = e.clientX;
        longPressStartY = e.clientY;
        longPressTimer = setTimeout(() => {
          longPressTimer = null;
          if (pointers.size !== 1 || gestureActive) return;
          // Fire context menu at the stored position.
          // Uses MouseEvent because onContextMenu accepts MouseEvent (contextmenu is natively MouseEvent).
          gestureActive = true;
          const syntheticEvent = new MouseEvent('contextmenu', {
            clientX: longPressStartX,
            clientY: longPressStartY,
            bubbles: true,
          });
          onContextMenu(ec, syntheticEvent);
        }, LONG_PRESS_MS);
      }

      if (pointers.size >= 2) {
        clearLongPress();
        // Cancel any ongoing single-finger drag and restore undo
        if (!gestureActive) {
          cancelDrag();
        }
        gestureActive = true;
        const pair = getTwoPointers();
        if (pair) {
          const d = dist(pair[0], pair[1]);
          const mid = midpoint(pair[0], pair[1]);
          pinch = { prevDist: d, prevMidX: mid.x, prevMidY: mid.y };
        }
        return;
      }

      // Single touch — delegate to normal handler (unless gesture is active)
      if (!gestureActive) {
        onPointerDown(e);
      }
      return;
    }

    // Mouse — pass through directly
    onPointerDown(e);
  }

  function handlePointerMove(e: PointerEvent): void {
    if (e.pointerType === 'pen') {
      onPointerMove(e);
      return;
    }

    if (e.pointerType === 'touch') {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      // Check long-press move threshold
      if (longPressTimer !== null) {
        const moved = Math.hypot(e.clientX - longPressStartX, e.clientY - longPressStartY);
        if (moved > LONG_PRESS_MOVE_THRESHOLD) {
          clearLongPress();
        }
      }

      if (gestureActive && pinch) {
        const pair = getTwoPointers();
        if (pair) {
          const { viewport } = ec;
          const rect = canvas.getBoundingClientRect();
          const d = dist(pair[0], pair[1]);
          const mid = midpoint(pair[0], pair[1]);

          // Pinch zoom
          if (pinch.prevDist > 0) {
            const scale = d / pinch.prevDist;
            const sx = mid.x - rect.left;
            const sy = mid.y - rect.top;
            const newVp = zoomAtPoint(viewport, sx, sy, viewport.zoom * scale);
            Object.assign(viewport, newVp);
          }

          // Two-finger pan
          const dmx = mid.x - pinch.prevMidX;
          const dmy = mid.y - pinch.prevMidY;
          viewport.panX -= dmx / viewport.zoom;
          viewport.panY -= dmy / viewport.zoom;

          pinch.prevDist = d;
          pinch.prevMidX = mid.x;
          pinch.prevMidY = mid.y;

          ec.render();
          ec.callbacks.onViewportChange();
        }
        return;
      }

      if (!gestureActive) {
        onPointerMove(e);
      }
      return;
    }

    // Mouse
    onPointerMove(e);
  }

  function handlePointerUp(e: PointerEvent): void {
    if (e.pointerType === 'pen') {
      onPointerUp(e);
      return;
    }

    if (e.pointerType === 'touch') {
      pointers.delete(e.pointerId);
      clearLongPress();

      if (pointers.size < 2) {
        pinch = null;
      }

      if (pointers.size === 0) {
        if (gestureActive) {
          gestureActive = false;
          return;
        }
      }

      if (!gestureActive) {
        onPointerUp(e);
      }
      return;
    }

    // Mouse
    onPointerUp(e);
  }

  function handlePointerCancel(e: PointerEvent): void {
    pointers.delete(e.pointerId);
    clearLongPress();
    if (pointers.size < 2) {
      pinch = null;
    }
    if (pointers.size === 0) {
      gestureActive = false;
      // Reset drag state to avoid stale drag from cancelled touch
      cancelDrag();
    }
  }

  // Register gesture-aware handlers — this is the sole owner of pointer event listeners
  canvas.addEventListener('pointerdown', handlePointerDown);
  canvas.addEventListener('pointermove', handlePointerMove);
  document.addEventListener('pointerup', handlePointerUp);
  canvas.addEventListener('pointercancel', handlePointerCancel);

  return () => {
    clearLongPress();
    canvas.removeEventListener('pointerdown', handlePointerDown);
    canvas.removeEventListener('pointermove', handlePointerMove);
    document.removeEventListener('pointerup', handlePointerUp);
    canvas.removeEventListener('pointercancel', handlePointerCancel);
  };
}
