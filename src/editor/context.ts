import type { EditorState, Room, FreeText, FreeTextEditData, MouseCoord } from '../types.ts';
import type { ContextMenuItem } from '../context-menu.ts';
import type { ViewportState } from '../viewport.ts';

export interface RoomEditData {
  label: string;
  fontSize: number | undefined;
  autoFontSize: number;
}

export interface MarkerEditData {
  label: string;
}

export interface ContextMenuRequest {
  screenX: number;
  screenY: number;
  items: ContextMenuItem[];
}

export interface EditorCallbacks {
  onStatusChange: (text: string) => void;
  onRoomEdit: (data: RoomEditData) => Promise<{ label: string; fontSize?: number } | null>;
  onMarkerEdit: (data: MarkerEditData) => Promise<{ label: string } | null>;
  onFreeTextEdit: (data: FreeTextEditData) => Promise<{ label: string; fontSize: number } | null>;
  onContextMenu: (request: ContextMenuRequest) => void;
}

export interface EditorAPI {
  undo: () => void;
  newProject: () => void;
  loadProject: (data: { rooms: Room[]; freeTexts: FreeText[] }) => void;
  saveProject: () => Promise<void>;
  exportAsPng: () => void;
  resize: () => void;
  destroy: () => void;
}

export interface EditorContext {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  container: HTMLElement;
  state: EditorState;
  viewport: ViewportState;
  callbacks: EditorCallbacks;
  flags: {
    isPanning: boolean;
    activeInteriorObjectId: string | undefined;
    activeFreeTextId: string | undefined;
  };
  render: () => void;
  commitChange: (fn: () => void) => void;
  mousePos: (e: MouseEvent) => MouseCoord;
}
