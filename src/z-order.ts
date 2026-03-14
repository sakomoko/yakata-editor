import type { Room } from './types.ts';

export function bringToFront(rooms: Room[], roomId: string): boolean {
  const idx = rooms.findIndex((r) => r.id === roomId);
  if (idx === -1 || idx === rooms.length - 1) return false;
  const [room] = rooms.splice(idx, 1);
  rooms.push(room);
  return true;
}

export function sendToBack(rooms: Room[], roomId: string): boolean {
  const idx = rooms.findIndex((r) => r.id === roomId);
  if (idx === -1 || idx === 0) return false;
  const [room] = rooms.splice(idx, 1);
  rooms.unshift(room);
  return true;
}

export function bringForward(rooms: Room[], roomId: string): boolean {
  const idx = rooms.findIndex((r) => r.id === roomId);
  if (idx === -1 || idx === rooms.length - 1) return false;
  [rooms[idx], rooms[idx + 1]] = [rooms[idx + 1], rooms[idx]];
  return true;
}

export function sendBackward(rooms: Room[], roomId: string): boolean {
  const idx = rooms.findIndex((r) => r.id === roomId);
  if (idx === -1 || idx === 0) return false;
  [rooms[idx - 1], rooms[idx]] = [rooms[idx], rooms[idx - 1]];
  return true;
}
