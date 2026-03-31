import { findFreeTextById, findArrowById } from '../lookup.ts';
import { hitRoom } from '../room.ts';
import { hitInteriorObjectInRooms } from '../interior-object.ts';
import { hitFreeText } from '../free-text.ts';
import { hitStickyNote } from '../sticky-note.ts';
import { startInlineEdit } from './inline-edit.ts';
import { hitArrowInList, hitArrowPoint, hitArrowSegment } from '../arrow.ts';
import { GRID } from '../grid.ts';
import { selectSingle } from '../selection.ts';
import type { EditorContext } from './context.ts';
import { applyRoomEdit, withFontSizePreview, commitChange } from './project.ts';
import { editMarkerViaDialog } from './marker-edit.ts';

export async function onDblClick(ec: EditorContext, e: MouseEvent): Promise<void> {
  if (ec.state.paintMode) return;
  const { state } = ec;
  const m = ec.mousePos(e);

  // Arrow double click: point handle hit → label edit, segment hit → waypoint insert
  {
    const arrowGx = m.px / GRID;
    const arrowGy = m.py / GRID;
    // ポイントハンドルをセグメントより先にチェック（エンドポイント付近での誤挿入を防止）
    for (const arrow of state.arrows) {
      if (!state.selection.has(arrow.id)) continue;
      const ptIdx = hitArrowPoint(arrow, arrowGx, arrowGy);
      if (ptIdx !== undefined) {
        // ポイント上のダブルクリック → ラベル編集
        selectSingle(state.selection, arrow.id);
        const arrowId = arrow.id;
        const newLabel = prompt('矢印のラベル', arrow.label ?? '');
        if (newLabel !== null) {
          const a = findArrowById(state.arrows, arrowId);
          if (a) {
            commitChange(ec, () => {
              a.label = newLabel || undefined;
            });
          }
        }
        return;
      }
    }
    // セグメント上のダブルクリック → 中間ウェイポイント挿入
    for (const arrow of state.arrows) {
      if (!state.selection.has(arrow.id)) continue;
      const insertIdx = hitArrowSegment(arrow, arrowGx, arrowGy);
      if (insertIdx !== undefined) {
        commitChange(ec, () => {
          arrow.points.splice(insertIdx, 0, { gx: m.gx, gy: m.gy });
        });
        return;
      }
    }
    // 非選択矢印のダブルクリック → ラベル編集
    const hitA = hitArrowInList(state.arrows, arrowGx, arrowGy);
    if (hitA) {
      selectSingle(state.selection, hitA.id);
      const arrowId = hitA.id;
      const newLabel = prompt('矢印のラベル', hitA.label ?? '');
      if (newLabel !== null) {
        const arrow = findArrowById(state.arrows, arrowId);
        if (arrow) {
          commitChange(ec, () => {
            arrow.label = newLabel || undefined;
          });
        }
      }
      return;
    }
  }

  // StickyNote double-click → inline edit
  const noteHit = hitStickyNote(ec.state.stickyNotes, m.px, m.py);
  if (noteHit) {
    startInlineEdit(ec, noteHit);
    return;
  }

  // FreeText double-click → edit (front layer first, then back)
  const ftHit =
    hitFreeText(ec.state.freeTexts, m.px, m.py, 'front') ||
    hitFreeText(ec.state.freeTexts, m.px, m.py, 'back');
  if (ftHit) {
    const ftId = ftHit.id;
    const findFt = () => findFreeTextById(ec.state.freeTexts, ftId);
    await withFontSizePreview(
      ec,
      () => findFt()?.fontSize,
      (fs) => {
        const ft = findFt();
        if (ft && fs !== undefined) ft.fontSize = fs;
      },
      (onPreview) =>
        ec.callbacks
          .onFreeTextEdit({
            label: ftHit.label,
            fontSize: ftHit.fontSize,
            onFontSizePreview: onPreview,
          })
          .then((r) => (r && r.label ? r : null)),
      (result) => {
        const ft = findFt();
        if (ft) {
          ft.label = result.label;
          ft.fontSize = result.fontSize;
        }
      },
    );
    return;
  }

  const intHit = hitInteriorObjectInRooms(ec.state.rooms, m.px, m.py);
  if (intHit && intHit.obj.type === 'marker') {
    await editMarkerViaDialog(ec, intHit.room, intHit.obj);
    return;
  }

  const r = hitRoom(ec.state.rooms, m.px, m.py);
  if (r) {
    await applyRoomEdit(ec, r);
  }
}
