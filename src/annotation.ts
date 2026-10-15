import type { Annotatable, EditorState } from './types.ts';

/** 現在の表示設定でオブジェクトが見えるか */
export function isVisible(obj: Annotatable, showAnnotations: boolean): boolean {
  return showAnnotations || !obj.annotation;
}

/** 非表示の注釈を除いたリストを返す。全表示時は元の配列をそのまま返す */
export function filterVisible<T extends Annotatable>(list: T[], showAnnotations: boolean): T[] {
  return showAnnotations ? list : list.filter((o) => !o.annotation);
}

/** 注釈フラグを設定する。解除時はプロパティごと削除して保存データを汚さない */
export function setAnnotation(obj: Annotatable, on: boolean): void {
  if (on) {
    obj.annotation = true;
  } else {
    delete obj.annotation;
  }
}

/** 非表示中の注釈オブジェクトのIDを集める（選択解除用） */
export function collectHiddenIds(
  state: Pick<EditorState, 'rooms' | 'freeTexts' | 'freeStrokes' | 'arrows' | 'showAnnotations'>,
): Set<string> {
  const ids = new Set<string>();
  if (state.showAnnotations) return ids;
  for (const list of [state.freeTexts, state.freeStrokes, state.arrows]) {
    for (const o of list) {
      if (o.annotation) ids.add(o.id);
    }
  }
  for (const r of state.rooms) {
    for (const o of r.interiorObjects ?? []) {
      if (o.annotation) ids.add(o.id);
    }
  }
  return ids;
}
