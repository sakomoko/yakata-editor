import { findFreeTextById } from '../lookup.ts';
import { hitRoom } from '../room.ts';
import { hitInteriorObjectInRooms } from '../interior-object.ts';
import { hitFreeText } from '../free-text.ts';
import type { EditorContext } from './context.ts';
import { applyRoomEdit, withFontSizePreview } from './project.ts';
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
