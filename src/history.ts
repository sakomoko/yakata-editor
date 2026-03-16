import type { Room, FreeText } from './types.ts';

const MAX_HISTORY = 50;

interface Snapshot {
  rooms: Room[];
  freeTexts: FreeText[];
}

export function pushUndo(history: string[], rooms: Room[], freeTexts: FreeText[] = []): void {
  const snapshot: Snapshot = { rooms, freeTexts };
  history.push(JSON.stringify(snapshot));
  if (history.length > MAX_HISTORY) history.shift();
}

export function cancelLastUndo(history: string[]): void {
  history.pop();
}

export function popUndo(history: string[]): Snapshot | null {
  if (history.length === 0) return null;
  const raw: unknown = JSON.parse(history.pop()!);
  // 後方互換: 旧形式は配列（rooms only）
  if (Array.isArray(raw)) {
    return { rooms: raw as Room[], freeTexts: [] };
  }
  const obj = raw as Record<string, unknown>;
  return {
    rooms: (obj.rooms as Room[]) ?? [],
    freeTexts: (obj.freeTexts as FreeText[]) ?? [],
  };
}
