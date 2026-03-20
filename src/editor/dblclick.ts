import { findFreeTextById, findArrowById } from '../lookup.ts';
import { hitRoom } from '../room.ts';
import { hitInteriorObjectInRooms } from '../interior-object.ts';
import { hitFreeText } from '../free-text.ts';
import { createArrow, hitArrowInList, hitArrowSegment } from '../arrow.ts';
import { GRID } from '../grid.ts';
import { selectSingle } from '../selection.ts';
import type { EditorContext } from './context.ts';
import { applyRoomEdit, withFontSizePreview, commitChange } from './project.ts';
import { editMarkerViaDialog } from './marker-edit.ts';

export async function onDblClick(ec: EditorContext, e: MouseEvent): Promise<void> {
  if (ec.state.paintMode) return;
  const { state, flags } = ec;
  const m = ec.mousePos(e);

  // Arrow mode: finalize pending arrow on double click
  if (state.arrowMode && flags.pendingArrow) {
    const pts = flags.pendingArrow.points;
    // dblclick は click→click→dblclick の順で発火されるため、
    // 最後のclickで追加されたポイントが終点と重複している可能性がある。
    // 重複を除去してから確定する。
    while (pts.length > 2) {
      const last = pts[pts.length - 1];
      const prev = pts[pts.length - 2];
      if (last.gx === prev.gx && last.gy === prev.gy) {
        pts.pop();
      } else {
        break;
      }
    }
    if (pts.length >= 2) {
      const arrow = createArrow(pts, state.arrowColor, state.arrowLineWidth);
      commitChange(ec, () => {
        state.arrows.push(arrow);
      });
      selectSingle(state.selection, arrow.id);
    }
    flags.pendingArrow = null;
    ec.render();
    return;
  }

  // Arrow segment double click: insert waypoint
  {
    const arrowGx = m.px / GRID;
    const arrowGy = m.py / GRID;
    // Selected arrows only
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
    // Arrow label edit on double click
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
