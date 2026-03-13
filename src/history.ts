import type { Room } from './types.ts';

const MAX_HISTORY = 50;

export function pushUndo(history: string[], rooms: Room[]): void {
  history.push(JSON.stringify(rooms));
  if (history.length > MAX_HISTORY) history.shift();
}

export function popUndo(history: string[]): Room[] | null {
  if (history.length === 0) return null;
  return JSON.parse(history.pop()!) as Room[];
}
