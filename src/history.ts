import type { Room, FreeText, FreeStroke, Arrow } from './types.ts';

const MAX_HISTORY = 50;

interface Snapshot {
  rooms: Room[];
  freeTexts: FreeText[];
  freeStrokes: FreeStroke[];
  arrows: Arrow[];
}

function pushSnapshot(
  stack: string[],
  rooms: Room[],
  freeTexts: FreeText[] = [],
  freeStrokes: FreeStroke[] = [],
  arrows: Arrow[] = [],
): void {
  const snapshot: Snapshot = { rooms, freeTexts, freeStrokes, arrows };
  stack.push(JSON.stringify(snapshot));
  if (stack.length > MAX_HISTORY) stack.shift();
}

function popSnapshot(stack: string[]): Snapshot | null {
  if (stack.length === 0) return null;
  const raw: unknown = JSON.parse(stack.pop()!);
  // 後方互換: 旧形式は配列（rooms only）
  if (Array.isArray(raw)) {
    return { rooms: raw as Room[], freeTexts: [], freeStrokes: [], arrows: [] };
  }
  const obj = raw as Record<string, unknown>;
  return {
    rooms: (obj.rooms as Room[]) ?? [],
    freeTexts: (obj.freeTexts as FreeText[]) ?? [],
    freeStrokes: (obj.freeStrokes as FreeStroke[]) ?? [],
    arrows: (obj.arrows as Arrow[]) ?? [],
  };
}

export function pushUndo(
  history: string[],
  rooms: Room[],
  freeTexts: FreeText[] = [],
  freeStrokes: FreeStroke[] = [],
  arrows: Arrow[] = [],
): void {
  pushSnapshot(history, rooms, freeTexts, freeStrokes, arrows);
}

export function popUndo(history: string[]): Snapshot | null {
  return popSnapshot(history);
}

/** undoスタックの最後のエントリを破棄する（状態は復元しない）。
 * 操作が実際には変化をもたらさなかった場合にスタックを汚さないよう呼び出す。
 * savedRedo を渡すと、saveUndoPoint でクリアされたRedoスタックを復元する。 */
export function cancelLastUndo(
  history: string[],
  redoHistory?: string[] | null,
  savedRedo?: string[] | null,
): void {
  history.pop();
  if (redoHistory && savedRedo) {
    redoHistory.length = 0;
    for (const entry of savedRedo) {
      redoHistory.push(entry);
    }
  }
}

export function pushRedo(
  redoHistory: string[],
  rooms: Room[],
  freeTexts: FreeText[] = [],
  freeStrokes: FreeStroke[] = [],
  arrows: Arrow[] = [],
): void {
  pushSnapshot(redoHistory, rooms, freeTexts, freeStrokes, arrows);
}

export function popRedo(redoHistory: string[]): Snapshot | null {
  return popSnapshot(redoHistory);
}

export function clearRedo(redoHistory: string[]): void {
  redoHistory.length = 0;
}

/** Undoスタックにpushし、Redoスタックをクリアする。
 * 新しいユーザー操作の開始時に使う。redo()内のpushUndoでは使わないこと。
 * 戻り値はクリア前のRedoスタックのコピー。cancelLastUndoでの復元に使える。 */
export function saveUndoPoint(
  history: string[],
  redoHistory: string[],
  rooms: Room[],
  freeTexts: FreeText[] = [],
  freeStrokes: FreeStroke[] = [],
  arrows: Arrow[] = [],
): string[] {
  const savedRedo = [...redoHistory];
  pushSnapshot(history, rooms, freeTexts, freeStrokes, arrows);
  clearRedo(redoHistory);
  return savedRedo;
}
