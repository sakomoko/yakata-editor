import type {
  Arrow,
  FreeStroke,
  FreeText,
  Room,
  RoomInteriorObject,
  StickyNote,
  WallObject,
} from './types.ts';

export function findRoomById(rooms: Room[], roomId: string): Room | undefined {
  return rooms.find((r) => r.id === roomId);
}

export function findRoomIndexById(rooms: Room[], roomId: string): number {
  return rooms.findIndex((r) => r.id === roomId);
}

export function findFreeTextById(freeTexts: FreeText[], ftId: string): FreeText | undefined {
  return freeTexts.find((f) => f.id === ftId);
}

export function findWallObjectById(room: Room, objectId: string): WallObject | undefined {
  return room.wallObjects?.find((o) => o.id === objectId);
}

export function findInteriorObjectById(
  room: Room,
  objectId: string,
): RoomInteriorObject | undefined {
  return room.interiorObjects?.find((o) => o.id === objectId);
}

export function findFreeStrokeById(
  strokes: FreeStroke[],
  strokeId: string,
): FreeStroke | undefined {
  return strokes.find((s) => s.id === strokeId);
}

export function findArrowById(arrows: Arrow[], arrowId: string): Arrow | undefined {
  return arrows.find((a) => a.id === arrowId);
}

export function findStickyNoteById(
  stickyNotes: StickyNote[],
  noteId: string,
): StickyNote | undefined {
  return stickyNotes.find((n) => n.id === noteId);
}
