import type { EditorState, ProjectData } from '../types.ts';
import { syncAllPairedOpenings } from '../adjacency.ts';
import { clearSelection } from '../selection.ts';
import type {
  EditorCallbacks,
  EditorAPI,
  EditorContext,
  RoomEditData,
  MarkerEditData,
  ContextMenuRequest,
} from './context.ts';
import { createMousePos, switchToRoomMode } from './utils.ts';
import { render } from './render.ts';
import {
  commitChange as commitChangeFn,
  undo,
  newProject,
  loadProjectData,
  saveProject,
  exportAsPng,
} from './project.ts';
import { onWheel } from './wheel.ts';
import { onKeyDown, onKeyUp } from './keyboard.ts';
import { onDblClick } from './dblclick.ts';
import { onMouseDown } from './mouse-down.ts';
import { onMouseMove } from './mouse-move.ts';
import { onMouseUp } from './mouse-up.ts';
import { onContextMenu } from './context-menu-handler.ts';
import { initGestures } from './gesture.ts';

export type { EditorAPI, RoomEditData, MarkerEditData, ContextMenuRequest };

export function initEditor(
  canvas: HTMLCanvasElement,
  container: HTMLElement,
  callbacks: EditorCallbacks,
  initialData?: ProjectData,
): EditorAPI {
  const ctx = canvas.getContext('2d')!;

  const state: EditorState = {
    rooms: initialData?.rooms ?? [],
    freeTexts: initialData?.freeTexts ?? [],
    freeStrokes: initialData?.freeStrokes ?? [],
    arrows: initialData?.arrows ?? [],
    selection: new Set(),
    history: initialData?.history ?? [],
    redoHistory: initialData?.redoHistory ?? [],
    drag: null,
    mouse: { px: 0, py: 0, gx: 0, gy: 0 },
    paintMode: false,
    paintColor: '#ff0000',
    paintLineWidth: 3,
    paintOpacity: 1.0,
    arrowMode: false,
    arrowColor: '#cc0000',
    arrowLineWidth: 2,
  };

  const viewport = initialData?.viewport
    ? { ...initialData.viewport }
    : { zoom: 1, panX: 0, panY: 0 };
  const flags: EditorContext['flags'] = {
    isPanning: false,
    activeInteriorObjectId: undefined,
    activeFreeTextId: undefined,
    snapIndicator: null,
    clipboard: null,
    savedRedo: null,
    drawArrowPreview: null,
  };

  const mousePos = createMousePos(canvas, viewport);

  const ec: EditorContext = {
    canvas,
    ctx,
    container,
    state,
    viewport,
    callbacks,
    flags,
    render: () => render(ec),
    commitChange: (fn) => commitChangeFn(ec, fn),
    mousePos,
  };

  function resizeCanvas(): void {
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    ec.render();
  }

  // Initialize
  resizeCanvas();
  syncAllPairedOpenings(state.rooms);

  // Disable browser default touch gestures (scroll, zoom) on canvas
  canvas.style.touchAction = 'none';
  // Prevent iOS Safari elastic overscroll.
  // On some iOS versions this only works on body/html; container-level is sufficient here
  // because App.tsx renders the container as a full-viewport element.
  container.style.overscrollBehavior = 'none';

  // Single-pointer handlers bound to ec (passed to gesture layer, not registered directly)
  const handlePointerDown = (e: PointerEvent) => onMouseDown(ec, e);
  const handlePointerMove = (e: PointerEvent) => onMouseMove(ec, e);
  const handlePointerUp = (e: PointerEvent) => onMouseUp(ec, e);
  const handleDblClick = (e: MouseEvent) => {
    onDblClick(ec, e).catch(console.error);
  };
  const handleContextMenu = (e: MouseEvent) => onContextMenu(ec, e);
  const handleKeyDown = (e: KeyboardEvent) => onKeyDown(ec, e);
  const handleKeyUp = (e: KeyboardEvent) => onKeyUp(ec, e);
  const handleWheel = (e: WheelEvent) => onWheel(ec, e);

  // Gesture layer registers pointer events and delegates single-pointer events to handlers above.
  // pointer{down,move,up} are NOT registered directly — initGestures owns them entirely.
  const destroyGestures = initGestures(ec, handlePointerDown, handlePointerMove, handlePointerUp);

  canvas.addEventListener('dblclick', handleDblClick);
  canvas.addEventListener('contextmenu', handleContextMenu);
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('keyup', handleKeyUp);
  canvas.addEventListener('wheel', handleWheel, { passive: false });

  ec.render();

  return {
    undo: () => undo(ec),
    newProject: () => newProject(ec),
    loadProject: (data) => loadProjectData(ec, data),
    saveProject: () => saveProject(ec),
    exportAsPng: () => exportAsPng(ec),
    resize: resizeCanvas,
    destroy() {
      destroyGestures();
      canvas.removeEventListener('dblclick', handleDblClick);
      canvas.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      canvas.removeEventListener('wheel', handleWheel);
    },
    getState: () => ({
      rooms: state.rooms,
      freeTexts: state.freeTexts,
      freeStrokes: state.freeStrokes,
      arrows: state.arrows,
      history: state.history,
      redoHistory: state.redoHistory,
    }),
    getViewport: () => ({ ...viewport }),
    setPaintMode: (on: boolean) => {
      state.paintMode = on;
      if (on) {
        state.arrowMode = false;
        clearSelection(state.selection);
        flags.activeInteriorObjectId = undefined;
        flags.activeFreeTextId = undefined;
        ec.callbacks.onArrowModeChange?.(false);
      }
      canvas.style.cursor = on ? 'crosshair' : 'default';
      ec.render();
      ec.callbacks.onPaintModeChange?.(on);
    },
    setPaintColor: (color: string) => {
      state.paintColor = color;
    },
    setPaintLineWidth: (width: number) => {
      state.paintLineWidth = width;
    },
    setPaintOpacity: (opacity: number) => {
      state.paintOpacity = opacity;
    },
    getPaintState: () => ({
      paintMode: state.paintMode,
      paintColor: state.paintColor,
      paintLineWidth: state.paintLineWidth,
      paintOpacity: state.paintOpacity,
    }),
    setArrowMode: (on: boolean) => {
      state.arrowMode = on;
      if (on) {
        state.paintMode = false;
        clearSelection(state.selection);
        flags.activeInteriorObjectId = undefined;
        flags.activeFreeTextId = undefined;
        ec.callbacks.onPaintModeChange?.(false);
      }
      canvas.style.cursor = on ? 'crosshair' : 'default';
      ec.render();
      ec.callbacks.onArrowModeChange?.(on);
    },
    setRoomMode: () => {
      switchToRoomMode(ec);
    },
    setArrowColor: (color: string) => {
      state.arrowColor = color;
    },
    setArrowLineWidth: (width: number) => {
      state.arrowLineWidth = width;
    },
    getArrowState: () => ({
      arrowMode: state.arrowMode,
      arrowColor: state.arrowColor,
      arrowLineWidth: state.arrowLineWidth,
    }),
    loadProjectState: (data: ProjectData) => {
      state.rooms = data.rooms;
      state.freeTexts = data.freeTexts;
      state.freeStrokes = data.freeStrokes;
      state.arrows = data.arrows ?? [];
      state.history = data.history;
      state.redoHistory = data.redoHistory ?? [];
      state.drag = null;
      state.paintMode = false;
      state.arrowMode = false;
      clearSelection(state.selection);
      flags.isPanning = false;
      flags.activeInteriorObjectId = undefined;
      flags.activeFreeTextId = undefined;
      flags.snapIndicator = null;
      flags.drawArrowPreview = null;
      viewport.zoom = data.viewport.zoom;
      viewport.panX = data.viewport.panX;
      viewport.panY = data.viewport.panY;
      syncAllPairedOpenings(state.rooms);
      ec.render();
    },
  };
}
