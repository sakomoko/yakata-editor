import type {
  EditorState,
  Room,
  Arrow,
  FreeText,
  FreeStroke,
  FreeTextEditData,
  GridPoint,
  MouseCoord,
  ProjectData,
} from '../types.ts';
import type { ContextMenuItem } from '../context-menu.ts';
import type { ViewportState } from '../viewport.ts';
import type { SnapIndicator } from '../snap.ts';
import type { ClipboardData } from './clipboard.ts';

export interface LabelFontSizeEditData {
  label: string;
  fontSize: number | undefined;
  autoFontSize: number;
  onFontSizePreview?: (fontSize: number | undefined) => void;
}

export type RoomEditData = LabelFontSizeEditData;
export type MarkerEditData = LabelFontSizeEditData;

export interface ContextMenuRequest {
  screenX: number;
  screenY: number;
  items: ContextMenuItem[];
}

export interface EditorCallbacks {
  onStatusChange: (text: string) => void;
  onRoomEdit: (data: RoomEditData) => Promise<{ label: string; fontSize?: number } | null>;
  onMarkerEdit: (data: MarkerEditData) => Promise<{ label: string; fontSize?: number } | null>;
  onFreeTextEdit: (data: FreeTextEditData) => Promise<{ label: string; fontSize: number } | null>;
  onContextMenu: (request: ContextMenuRequest) => void;
  onAutoSave: () => void;
  onViewportChange: () => void;
  onPaintModeChange?: (paintMode: boolean) => void;
  onArrowModeChange?: (arrowMode: boolean) => void;
}

export interface EditorAPI {
  undo: () => void;
  newProject: () => void;
  loadProject: (data: {
    rooms: Room[];
    freeTexts: FreeText[];
    freeStrokes?: FreeStroke[];
    arrows?: Arrow[];
  }) => void;
  saveProject: () => Promise<void>;
  exportAsPng: () => void;
  resize: () => void;
  destroy: () => void;
  getState: () => {
    rooms: Room[];
    freeTexts: FreeText[];
    freeStrokes: FreeStroke[];
    arrows: Arrow[];
    history: string[];
    redoHistory: string[];
  };
  getViewport: () => ViewportState;
  loadProjectState: (data: ProjectData) => void;
  setPaintMode: (on: boolean) => void;
  setPaintColor: (color: string) => void;
  setPaintLineWidth: (width: number) => void;
  setPaintOpacity: (opacity: number) => void;
  getPaintState: () => {
    paintMode: boolean;
    paintColor: string;
    paintLineWidth: number;
    paintOpacity: number;
  };
  setArrowMode: (on: boolean) => void;
  setArrowColor: (color: string) => void;
  setArrowLineWidth: (width: number) => void;
  getArrowState: () => {
    arrowMode: boolean;
    arrowColor: string;
    arrowLineWidth: number;
  };
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
    snapIndicator: SnapIndicator | null;
    clipboard: ClipboardData | null;
    /** saveUndoPoint でクリアされる前のRedoスタックの退避。cancelLastUndoでの復元に使う。 */
    savedRedo: string[] | null;
    /** 矢印作成中の状態。クリック間はボタン非押下のためDragStateではない */
    pendingArrow: { points: GridPoint[]; previewPoint?: GridPoint } | null;
  };
  render: () => void;
  commitChange: (fn: () => void) => void;
  mousePos: (e: MouseEvent) => MouseCoord;
}
