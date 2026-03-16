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
import { createMousePos } from './utils.ts';
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
    selection: new Set(),
    history: initialData?.history ?? [],
    drag: null,
    mouse: { px: 0, py: 0, gx: 0, gy: 0 },
    paintMode: false,
    paintColor: '#ff0000',
    paintLineWidth: 3,
    paintOpacity: 1.0,
  };

  const viewport = initialData?.viewport
    ? { ...initialData.viewport }
    : { zoom: 1, panX: 0, panY: 0 };
  const flags: EditorContext['flags'] = {
    isPanning: false,
    activeInteriorObjectId: undefined,
    activeFreeTextId: undefined,
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

  // Event handlers bound to ec
  const handleMouseDown = (e: MouseEvent) => onMouseDown(ec, e);
  const handleMouseMove = (e: MouseEvent) => onMouseMove(ec, e);
  const handleMouseUp = (e: MouseEvent) => onMouseUp(ec, e);
  const handleDblClick = (e: MouseEvent) => {
    onDblClick(ec, e).catch(console.error);
  };
  const handleContextMenu = (e: MouseEvent) => onContextMenu(ec, e);
  const handleKeyDown = (e: KeyboardEvent) => onKeyDown(ec, e);
  const handleKeyUp = (e: KeyboardEvent) => onKeyUp(ec, e);
  const handleWheel = (e: WheelEvent) => onWheel(ec, e);

  canvas.addEventListener('mousedown', handleMouseDown);
  canvas.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
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
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
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
      history: state.history,
    }),
    getViewport: () => ({ ...viewport }),
    setPaintMode: (on: boolean) => {
      state.paintMode = on;
      if (on) {
        clearSelection(state.selection);
        flags.activeInteriorObjectId = undefined;
        flags.activeFreeTextId = undefined;
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
    loadProjectState: (data: ProjectData) => {
      state.rooms = data.rooms;
      state.freeTexts = data.freeTexts;
      state.freeStrokes = data.freeStrokes;
      state.history = data.history;
      state.drag = null;
      state.paintMode = false;
      clearSelection(state.selection);
      flags.isPanning = false;
      flags.activeInteriorObjectId = undefined;
      flags.activeFreeTextId = undefined;
      viewport.zoom = data.viewport.zoom;
      viewport.panX = data.viewport.panX;
      viewport.panY = data.viewport.panY;
      syncAllPairedOpenings(state.rooms);
      ec.render();
    },
  };
}
