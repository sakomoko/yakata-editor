export type WallSide = 'n' | 'e' | 's' | 'w';

export interface WallObjectBase {
  id: string;
  side: WallSide;
  offset: number;
  width: number;
}

export interface WallWindow extends WallObjectBase {
  type: 'window';
}

export interface WallDoor extends WallObjectBase {
  type: 'door';
  swing: 'inward' | 'outward';
}

export interface WallOpening extends WallObjectBase {
  type: 'opening';
}

export type WallObject = WallWindow | WallDoor | WallOpening;

export interface Room {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  fontSize?: number;
  floor?: number;
  linkGroup?: string;
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
    }
  | {
      type: 'resizeWallObject';
      roomId: string;
      objectId: string;
      edge: 'start' | 'end';
      origOffset: number;
      origWidth: number;
    }
  | null;

export interface EditorState {
  rooms: Room[];
  selection: Set<string>;
  history: string[];
  drag: DragState;
  mouse: MouseCoord;
}
