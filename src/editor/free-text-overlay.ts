import { GRID } from '../grid.ts';
import type { EditorContext } from './context.ts';
import { escapeHtml } from './utils.ts';

/** FreeText ID → overlay div のマップ */
const overlayMap = new Map<string, HTMLDivElement>();

/** 全FreeTextオーバーレイを現在の状態に合わせて更新する。render() の最後に呼ぶ。 */
export function updateFreeTextOverlays(ec: EditorContext): void {
  const { state, viewport, container } = ec;

  if (state.freeTexts.length === 0 && overlayMap.size === 0) return;

  const containerRect = container.getBoundingClientRect();
  const activeIds = new Set(state.freeTexts.map((ft) => ft.id));

  // 削除されたFreeTextのオーバーレイを除去
  for (const [id, el] of overlayMap) {
    if (!activeIds.has(id)) {
      el.remove();
      overlayMap.delete(id);
    }
  }

  for (const ft of state.freeTexts) {
    let el = overlayMap.get(ft.id);
    if (!el) {
      el = document.createElement('div');
      el.style.position = 'absolute';
      el.style.pointerEvents = 'none';
      el.style.overflow = 'hidden';
      el.style.boxSizing = 'border-box';
      el.style.fontFamily = 'sans-serif';
      container.appendChild(el);
      overlayMap.set(ft.id, el);
    }

    // zLayerに応じたz-index (back: 50, front: 150 — Canvasと付箋の間)
    el.style.zIndex = ft.zLayer === 'back' ? '50' : '150';

    // ワールド座標 → コンテナ内相対座標
    const worldX = ft.gx * GRID;
    const worldY = ft.gy * GRID;
    const worldW = ft.w * GRID;
    const worldH = ft.h * GRID;

    const localX = (worldX - viewport.panX) * viewport.zoom;
    const localY = (worldY - viewport.panY) * viewport.zoom;
    const screenW = worldW * viewport.zoom;
    const screenH = worldH * viewport.zoom;

    // コンテナ可視範囲外なら非表示
    if (
      localX + screenW < 0 ||
      localX > containerRect.width ||
      localY + screenH < 0 ||
      localY > containerRect.height
    ) {
      el.style.display = 'none';
      continue;
    }

    el.style.display = '';
    el.style.left = `${localX}px`;
    el.style.top = `${localY}px`;
    el.style.width = `${screenW}px`;
    el.style.height = `${screenH}px`;

    const padding = 2 * viewport.zoom;
    el.style.padding = `${padding}px`;

    const fontSize = ft.fontSize * viewport.zoom;
    const cacheKey = `${ft.label}|${ft.fontSize}|${fontSize}`;
    if (el.dataset.cacheKey !== cacheKey) {
      el.innerHTML = renderFreeText(ft.label, fontSize);
      el.dataset.cacheKey = cacheKey;
    }
  }
}

/** オーバーレイを全て破棄する（エディタ破棄時用） */
export function destroyFreeTextOverlays(): void {
  for (const el of overlayMap.values()) {
    el.remove();
  }
  overlayMap.clear();
}

function renderFreeText(label: string, fontSize: number): string {
  const lineHeight = 1.2;
  const lines = label.split('\n');
  const parts: string[] = [];

  for (const line of lines) {
    if (line === '') {
      parts.push(`<div style="font-size:${fontSize}px;line-height:${lineHeight}">&nbsp;</div>`);
    } else {
      parts.push(
        `<div style="font-size:${fontSize}px;line-height:${lineHeight};color:#000;word-wrap:break-word;overflow-wrap:break-word">${escapeHtml(line)}</div>`,
      );
    }
  }

  return parts.join('');
}
