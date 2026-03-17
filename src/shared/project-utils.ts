import type { ViewportState } from '../viewport.ts';
import { clampZoom } from '../viewport.ts';
import type { ProjectMeta } from '../types.ts';

// --- Viewport validation ---

export function parseViewport(raw: unknown): ViewportState {
  const fallback: ViewportState = { zoom: 1, panX: 0, panY: 0 };
  if (!raw || typeof raw !== 'object') return fallback;
  const vp = raw as Record<string, unknown>;
  if (
    typeof vp.zoom === 'number' &&
    typeof vp.panX === 'number' &&
    typeof vp.panY === 'number' &&
    Number.isFinite(vp.zoom) &&
    Number.isFinite(vp.panX) &&
    Number.isFinite(vp.panY)
  ) {
    return { zoom: clampZoom(vp.zoom), panX: vp.panX, panY: vp.panY };
  }
  return fallback;
}

// --- Name generation ---

/** baseName が existingNames に含まれていれば末尾に連番を付けてユニークにする */
export function deduplicateName(baseName: string, existingNames: string[]): string {
  if (!existingNames.includes(baseName)) return baseName;
  let n = 2;
  while (existingNames.includes(`${baseName} (${n})`)) n++;
  return `${baseName} (${n})`;
}

export function generateDefaultName(existingNames: string[]): string {
  return deduplicateName('無題のプロジェクト', existingNames);
}

// --- ProjectMeta validation ---

export function isValidProjectMeta(item: unknown): item is ProjectMeta {
  if (!item || typeof item !== 'object') return false;
  const obj = item as Record<string, unknown>;
  if (typeof obj.id !== 'string' || typeof obj.name !== 'string') return false;
  if (obj.createdAt !== undefined && typeof obj.createdAt !== 'number') return false;
  if (obj.updatedAt !== undefined && typeof obj.updatedAt !== 'number') return false;
  return true;
}

// --- CLI file path detection ---

/**
 * 引数がファイルパスかどうかを判定する。
 * path.isAbsolute() が使えない環境（ブラウザ）でも動作する簡易判定。
 */
export function isFilePath(arg: string): boolean {
  if (arg.endsWith('.json')) return true;
  if (arg.includes('/') || arg.includes('\\')) return true;
  // 絶対パスの先頭文字（Unix: /, Windows: C:\, etc.）
  if (/^[a-zA-Z]:/.test(arg)) return true;
  return false;
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
