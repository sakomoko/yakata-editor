import { hitRoom } from '../room.ts';
import { hitInteriorObjectInRooms } from '../interior-object.ts';
import { hitFreeText } from '../free-text.ts';
import type { EditorContext } from './context.ts';
import { commitChange, applyRoomEdit } from './project.ts';

export async function onDblClick(ec: EditorContext, e: MouseEvent): Promise<void> {
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
      const ft = ec.state.freeTexts.find((f) => f.id === ftId);
      if (!ft) return;
      ft.label = result.label;
      ft.fontSize = result.fontSize;
    });
    return;
  }

  const intHit = hitInteriorObjectInRooms(ec.state.rooms, m.px, m.py);
  if (intHit && intHit.obj.type === 'marker') {
    const roomId = intHit.room.id;
    const objId = intHit.obj.id;
    const result = await ec.callbacks.onMarkerEdit({ label: intHit.obj.label ?? '' });
    if (!result) return;
    const room = ec.state.rooms.find((r) => r.id === roomId);
    if (!room) return;
    const obj = room.interiorObjects?.find((o) => o.id === objId);
    if (!obj || obj.type !== 'marker') return;
    commitChange(ec, () => {
      obj.label = result.label || undefined;
    });
    return;
  }

  const r = hitRoom(ec.state.rooms, m.px, m.py);
  if (r) {
    await applyRoomEdit(ec, r);
  }
}
