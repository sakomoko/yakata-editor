export interface Room {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  floor?: number;
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
  | null;

export interface EditorState {
  rooms: Room[];
  selection: Set<string>;
  history: string[];
  drag: DragState;
  mouse: MouseCoord;
}
