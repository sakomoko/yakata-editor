import type { Room, Marker } from '../types.ts';
import { interiorObjectToPixelRect, computeMarkerAutoFontSize } from '../interior-object.ts';
import { findRoomById, findInteriorObjectById } from '../lookup.ts';
import type { EditorContext } from './context.ts';
import { withFontSizePreview } from './project.ts';

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
  const findMarker = () => {
    const r = findRoomById(ec.state.rooms, roomId);
    if (!r) return undefined;
    const obj = findInteriorObjectById(r, objId);
    return obj?.type === 'marker' ? (obj as Marker) : undefined;
  };
  await withFontSizePreview(
    ec,
    () => findMarker()?.fontSize,
    (fs) => {
      const m = findMarker();
      if (!m) return;
      if (fs !== undefined) {
        m.fontSize = fs;
      } else {
        delete m.fontSize;
      }
    },
    (onPreview) =>
      ec.callbacks.onMarkerEdit({
        label: marker.label ?? '',
        fontSize: marker.fontSize,
        autoFontSize,
        onFontSizePreview: onPreview,
      }),
    (result) => {
      const obj = findMarker();
      if (!obj) return;
      obj.label = result.label || undefined;
      if (result.fontSize !== undefined) {
        obj.fontSize = result.fontSize;
      } else {
        delete obj.fontSize;
      }
    },
  );
}
