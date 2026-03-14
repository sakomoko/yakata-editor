export type WallSide = 'n' | 'e' | 's' | 'w';

interface WallObjectBase {
  id: string;
  side: WallSide;
  offset: number;
  width: number;
}

export interface WallWindow extends WallObjectBase {
  type: 'window';
}

export type WallObject = WallWindow;

export interface Room {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  fontSize?: number;
  floor?: number;
  wallObjects?: WallObject[];
}

export interface Project {
  version: number;
  name: string;
  gridSize: number;
  rooms: Room[];
}

export interface MouseCoord {
  px: number;
  py: number;
  gx: number;
  gy: number;
}

export type ResizeDirection = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

export interface Handle {
  px: number;
  py: number;
  dir: ResizeDirection;
}

export type DragState =
  | { type: 'create'; start: MouseCoord; cur: MouseCoord }
  | { type: 'move'; originals: Map<string, { x: number; y: number }>; start: MouseCoord }
  | {
      type: 'resize';
      dir: ResizeDirection;
      orig: { x: number; y: number; w: number; h: number };
      targetId: string;
      start: MouseCoord;
    }
  | {
      type: 'pan';
      startScreenX: number;
      startScreenY: number;
      startPanX: number;
      startPanY: number;
    }
  | {
      type: 'moveWallObject';
      roomId: string;
      objectId: string;
      side: WallSide;
      start: MouseCoord;
      originalOffset: number;
    }
  | null;

export interface EditorState {
  rooms: Room[];
  selection: Set<string>;
  history: string[];
  drag: DragState;
  mouse: MouseCoord;
}
