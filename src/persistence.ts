import type { Room, WallObject } from './types.ts';
import type { ViewportState } from './viewport.ts';
import { clampZoom } from './viewport.ts';

const STORAGE_KEY = 'madori_data';
const VIEWPORT_KEY = 'madori_viewport';

const VALID_SIDES = new Set(['n', 'e', 's', 'w']);

function ensureWallObjectIds(objects: unknown[]): WallObject[] {
  return objects
    .filter((o) => {
      const obj = o as Record<string, unknown>;
      return (
        typeof obj.offset === 'number' &&
        typeof obj.width === 'number' &&
        VALID_SIDES.has(obj.side as string)
      );
    })
    .map((o) => {
      const obj = o as Record<string, unknown>;
      return {
        id: typeof obj.id === 'string' ? obj.id : crypto.randomUUID(),
        type: 'window',
        side: obj.side as WallObject['side'],
        offset: obj.offset as number,
        width: obj.width as number,
      } as WallObject;
    });
}

function ensureIds(rooms: unknown[]): Room[] {
  return rooms.map((r) => {
    const room = r as Record<string, unknown>;
    const result: Room = {
      ...room,
      id: typeof room.id === 'string' ? room.id : crypto.randomUUID(),
      x: room.x as number,
      y: room.y as number,
      w: room.w as number,
      h: room.h as number,
      label: (room.label as string) ?? '',
    } as Room;
    if (Array.isArray(room.wallObjects) && room.wallObjects.length > 0) {
      result.wallObjects = ensureWallObjectIds(room.wallObjects);
    }
    return result;
  });
}

export function persistToStorage(rooms: Room[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rooms));
  } catch {
    // storage full or unavailable
  }
}

export function loadFromStorage(): Room[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    const parsed: unknown = JSON.parse(data);
    if (Array.isArray(parsed)) {
      return ensureIds(parsed);
    }
  } catch {
    // corrupt data
  }
  return [];
}

export function saveAsJson(rooms: Room[]): void {
  const blob = new Blob([JSON.stringify(rooms, null, 2)], { type: 'application/json' });
  triggerDownload(URL.createObjectURL(blob), '間取り図.json');
}

export function loadFromFile(file: File): Promise<Room[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed: unknown = JSON.parse(ev.target!.result as string);
        if (Array.isArray(parsed)) {
          resolve(ensureIds(parsed));
        } else {
          reject(new Error('Invalid format'));
        }
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export function persistViewport(vp: ViewportState): void {
  try {
    localStorage.setItem(VIEWPORT_KEY, JSON.stringify(vp));
  } catch {
    // storage full or unavailable
  }
}

export function loadViewport(): ViewportState | null {
  try {
    const data = localStorage.getItem(VIEWPORT_KEY);
    if (!data) return null;
    const parsed = JSON.parse(data) as Record<string, unknown>;
    if (
      typeof parsed.zoom === 'number' &&
      typeof parsed.panX === 'number' &&
      typeof parsed.panY === 'number'
    ) {
      if (!Number.isFinite(parsed.panX) || !Number.isFinite(parsed.panY)) return null;
      return { zoom: clampZoom(parsed.zoom), panX: parsed.panX, panY: parsed.panY };
    }
  } catch {
    // corrupt data
  }
  return null;
}

export function exportPng(canvas: HTMLCanvasElement): void {
  triggerDownload(canvas.toDataURL('image/png'), '間取り図.png');
}

function triggerDownload(url: string, filename: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
