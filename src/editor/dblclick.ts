import { findFreeTextById } from '../lookup.ts';
import { hitRoom } from '../room.ts';
import { hitInteriorObjectInRooms } from '../interior-object.ts';
import { hitFreeText } from '../free-text.ts';
import type { EditorContext } from './context.ts';
import { commitChange, applyRoomEdit } from './project.ts';
import { editMarkerViaDialog } from './marker-edit.ts';

export async function onDblClick(ec: EditorContext, e: MouseEvent): Promise<void> {
  if (ec.state.paintMode) return;
  const m = ec.mousePos(e);

  // FreeText double-click → edit (front layer first, then back)
  const ftHit =
    hitFreeText(ec.state.freeTexts, m.px, m.py, 'front') ||
    hitFreeText(ec.state.freeTexts, m.px, m.py, 'back');
  if (ftHit) {
    const ftId = ftHit.id;
    const result = await ec.callbacks.onFreeTextEdit({
      label: ftHit.label,
      fontSize: ftHit.fontSize,
    });
    if (!result || !result.label) return;
    commitChange(ec, () => {
      const ft = findFreeTextById(ec.state.freeTexts, ftId);
      if (!ft) return;
      ft.label = result.label;
      ft.fontSize = result.fontSize;
    });
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
