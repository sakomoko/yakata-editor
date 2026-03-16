import type { FreeText, Room, RoomInteriorObject, WallObject } from './types';

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
