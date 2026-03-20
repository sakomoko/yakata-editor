import type { Room, FreeText, FreeStroke } from './types.ts';

const MAX_HISTORY = 50;

interface Snapshot {
  rooms: Room[];
  freeTexts: FreeText[];
  freeStrokes: FreeStroke[];
}

function pushSnapshot(
  stack: string[],
  rooms: Room[],
  freeTexts: FreeText[] = [],
  freeStrokes: FreeStroke[] = [],
): void {
  const snapshot: Snapshot = { rooms, freeTexts, freeStrokes };
  stack.push(JSON.stringify(snapshot));
  if (stack.length > MAX_HISTORY) stack.shift();
}

function popSnapshot(stack: string[]): Snapshot | null {
  if (stack.length === 0) return null;
  const raw: unknown = JSON.parse(stack.pop()!);
  // 後方互換: 旧形式は配列（rooms only）
  if (Array.isArray(raw)) {
    return { rooms: raw as Room[], freeTexts: [], freeStrokes: [] };
  }
  const obj = raw as Record<string, unknown>;
  return {
    rooms: (obj.rooms as Room[]) ?? [],
    freeTexts: (obj.freeTexts as FreeText[]) ?? [],
    freeStrokes: (obj.freeStrokes as FreeStroke[]) ?? [],
  };
}

export function pushUndo(
  history: string[],
  rooms: Room[],
  freeTexts: FreeText[] = [],
  freeStrokes: FreeStroke[] = [],
): void {
  pushSnapshot(history, rooms, freeTexts, freeStrokes);
}

export function popUndo(history: string[]): Snapshot | null {
  return popSnapshot(history);
}

/** undoスタックの最後のエントリを破棄する（状態は復元しない）。
 * 操作が実際には変化をもたらさなかった場合にスタックを汚さないよう呼び出す。 */
export function cancelLastUndo(history: string[]): void {
  history.pop();
}

export function pushRedo(
  redoHistory: string[],
  rooms: Room[],
  freeTexts: FreeText[] = [],
  freeStrokes: FreeStroke[] = [],
): void {
  pushSnapshot(redoHistory, rooms, freeTexts, freeStrokes);
}

export function popRedo(redoHistory: string[]): Snapshot | null {
  return popSnapshot(redoHistory);
}

export function clearRedo(redoHistory: string[]): void {
  redoHistory.length = 0;
}

/** Undoスタックにpushし、Redoスタックをクリアする。
 * 新しいユーザー操作の開始時に使う。redo()内のpushUndoでは使わないこと。 */
export function saveUndoPoint(
  history: string[],
  redoHistory: string[],
  rooms: Room[],
  freeTexts: FreeText[] = [],
  freeStrokes: FreeStroke[] = [],
): void {
  pushSnapshot(history, rooms, freeTexts, freeStrokes);
  clearRedo(redoHistory);
}
