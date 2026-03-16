import type { Room, FreeText } from './types.ts';

export function toggleSelection(selection: Set<string>, roomId: string): void {
  if (selection.has(roomId)) {
    selection.delete(roomId);
  } else {
    selection.add(roomId);
  }
}

export function selectSingle(selection: Set<string>, roomId: string): void {
  selection.clear();
  selection.add(roomId);
}

export function clearSelection(selection: Set<string>): void {
  selection.clear();
}

export function getSingleSelected(rooms: Room[], selection: Set<string>): Room | null {
  if (selection.size !== 1) return null;
  const id = [...selection][0];
  return rooms.find((r) => r.id === id) ?? null;
}

export function getSelectedRooms(rooms: Room[], selection: Set<string>): Room[] {
  return rooms.filter((r) => selection.has(r.id));
}

export function getSelectedFreeTexts(freeTexts: FreeText[], selection: Set<string>): FreeText[] {
  return freeTexts.filter((ft) => selection.has(ft.id));
}
