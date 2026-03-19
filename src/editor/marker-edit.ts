import type { Room, Marker } from '../types.ts';
import { interiorObjectToPixelRect, computeMarkerAutoFontSize } from '../interior-object.ts';
import { findRoomById, findInteriorObjectById } from '../lookup.ts';
import type { EditorContext } from './context.ts';
import { commitChange } from './project.ts';

/**
 * 既存マーカーの編集ダイアログを表示し、結果を適用する。
 * dblclick と context-menu-handler の共通処理。
 */
export async function editMarkerViaDialog(
  ec: EditorContext,
  room: Room,
  marker: Marker,
): Promise<void> {
  const roomId = room.id;
  const objId = marker.id;
  const rect = interiorObjectToPixelRect(room, marker);
  const autoFontSize = Math.round(
    computeMarkerAutoFontSize(ec.ctx, rect, marker.label ?? '', marker.markerKind),
  );
  const result = await ec.callbacks.onMarkerEdit({
    label: marker.label ?? '',
    fontSize: marker.fontSize,
    autoFontSize,
  });
  if (!result) return;
  const currentRoom = findRoomById(ec.state.rooms, roomId);
  if (!currentRoom) return;
  const obj = findInteriorObjectById(currentRoom, objId);
  if (!obj || obj.type !== 'marker') return;
  commitChange(ec, () => {
    obj.label = result.label || undefined;
    obj.fontSize = result.fontSize;
  });
}
