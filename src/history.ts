import type { Room, FreeText, FreeStroke, Arrow, StickyNote, EntitySnapshot } from './types.ts';

const MAX_HISTORY = 50;

function pushSnapshot(stack: string[], entities: EntitySnapshot): void {
  stack.push(JSON.stringify(entities));
  if (stack.length > MAX_HISTORY) stack.shift();
}

function popSnapshot(stack: string[]): EntitySnapshot | null {
  if (stack.length === 0) return null;
  const raw: unknown = JSON.parse(stack.pop()!);
  // 後方互換: 旧形式は配列（rooms only）
  if (Array.isArray(raw)) {
    return { rooms: raw as Room[], freeTexts: [], freeStrokes: [], arrows: [], stickyNotes: [] };
  }
  const obj = raw as Record<string, unknown>;
  return {
    rooms: (obj.rooms as Room[]) ?? [],
    freeTexts: (obj.freeTexts as FreeText[]) ?? [],
    freeStrokes: (obj.freeStrokes as FreeStroke[]) ?? [],
    arrows: (obj.arrows as Arrow[]) ?? [],
    stickyNotes: (obj.stickyNotes as StickyNote[]) ?? [],
  };
}

export function pushUndo(history: string[], entities: EntitySnapshot): void {
  pushSnapshot(history, entities);
}

export function popUndo(history: string[]): EntitySnapshot | null {
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

export function pushRedo(redoHistory: string[], entities: EntitySnapshot): void {
  pushSnapshot(redoHistory, entities);
}

export function popRedo(redoHistory: string[]): EntitySnapshot | null {
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
  entities: EntitySnapshot,
): string[] {
  const savedRedo = [...redoHistory];
  pushSnapshot(history, entities);
  clearRedo(redoHistory);
  return savedRedo;
}
