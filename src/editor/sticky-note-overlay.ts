import { GRID } from '../grid.ts';
import { STICKY_NOTE_COLORS, STICKY_NOTE_FONT_FAMILY, parseStickyNoteLine } from '../sticky-note.ts';
import type { StickyNote } from '../types.ts';
import type { EditorContext } from './context.ts';

/** 付箋ID → overlay div のマップ */
const overlayMap = new Map<string, HTMLDivElement>();

/** 全付箋オーバーレイを現在の状態に合わせて更新する。render() の最後に呼ぶ。 */
export function updateStickyNoteOverlays(ec: EditorContext): void {
  const { state, viewport, canvas } = ec;
  const canvasRect = canvas.getBoundingClientRect();

  const activeIds = new Set(state.stickyNotes.map((n) => n.id));

  // 削除された付箋のオーバーレイを除去
  for (const [id, el] of overlayMap) {
    if (!activeIds.has(id)) {
      el.remove();
      overlayMap.delete(id);
    }
  }

  for (const note of state.stickyNotes) {
    let el = overlayMap.get(note.id);
    if (!el) {
      el = document.createElement('div');
      el.style.position = 'fixed';
      el.style.pointerEvents = 'none';
      el.style.overflow = 'hidden';
      el.style.boxSizing = 'border-box';
      el.style.fontFamily = STICKY_NOTE_FONT_FAMILY;
      el.style.zIndex = '100';
      document.body.appendChild(el);
      overlayMap.set(note.id, el);
    }

    // ワールド座標 → スクリーン座標
    const worldX = note.gx * GRID;
    const worldY = note.gy * GRID;
    const worldW = note.w * GRID;
    const worldH = note.h * GRID;

    const screenX = (worldX - viewport.panX) * viewport.zoom + canvasRect.left;
    const screenY = (worldY - viewport.panY) * viewport.zoom + canvasRect.top;
    const screenW = worldW * viewport.zoom;
    const screenH = worldH * viewport.zoom;

    // Canvas可視範囲外なら非表示
    if (
      screenX + screenW < canvasRect.left ||
      screenX > canvasRect.right ||
      screenY + screenH < canvasRect.top ||
      screenY > canvasRect.bottom
    ) {
      el.style.display = 'none';
      continue;
    }

    el.style.display = '';
    el.style.left = `${screenX}px`;
    el.style.top = `${screenY}px`;
    el.style.width = `${screenW}px`;
    el.style.height = `${screenH}px`;
    el.style.padding = `${4 * viewport.zoom}px`;

    // HTMLコンテンツを生成（変更がない場合はDOM再構築をスキップ）
    const fontSize = note.fontSize * viewport.zoom;
    const colors = STICKY_NOTE_COLORS[note.color];
    const cacheKey = `${note.label}|${note.fontSize}|${note.color}|${fontSize}`;
    if (el.dataset.cacheKey !== cacheKey) {
      el.innerHTML = renderMarkdown(note, fontSize, colors.border);
      el.dataset.cacheKey = cacheKey;
    }
  }
}

/** オーバーレイを全て破棄する（エディタ破棄時用） */
export function destroyStickyNoteOverlays(): void {
  for (const el of overlayMap.values()) {
    el.remove();
  }
  overlayMap.clear();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderMarkdown(
  note: StickyNote,
  fontSize: number,
  accentColor: string,
): string {
  const lines = note.label.split('\n');
  const lineHeight = 1.3;
  const parts: string[] = [];

  for (const line of lines) {
    const parsed = parseStickyNoteLine(line);
    switch (parsed.type) {
      case 'heading': {
        const size = Math.round(fontSize * 1.3);
        parts.push(
          `<div style="font-weight:bold;font-size:${size}px;line-height:${lineHeight};color:#333">${escapeHtml(parsed.text)}</div>`,
        );
        break;
      }
      case 'checkbox': {
        const cbSize = Math.round(fontSize * 0.85);
        const checked = parsed.checked;
        const checkboxStyle = checked
          ? `width:${cbSize}px;height:${cbSize}px;background:${accentColor};border:1px solid #555;border-radius:2px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;color:#fff;font-size:${cbSize * 0.7}px`
          : `width:${cbSize}px;height:${cbSize}px;border:1px solid #555;border-radius:2px;display:inline-flex;flex-shrink:0`;
        const textStyle = checked
          ? `color:#888;text-decoration:line-through`
          : `color:#333`;
        parts.push(
          `<div style="display:flex;align-items:center;gap:${fontSize * 0.3}px;font-size:${fontSize}px;line-height:${lineHeight}">` +
            `<span style="${checkboxStyle}">${checked ? '✓' : ''}</span>` +
            `<span style="${textStyle}">${escapeHtml(parsed.text)}</span>` +
            `</div>`,
        );
        break;
      }
      case 'bullet': {
        const dotSize = Math.round(fontSize * 0.3);
        parts.push(
          `<div style="display:flex;align-items:center;gap:${fontSize * 0.3}px;font-size:${fontSize}px;line-height:${lineHeight};color:#333">` +
            `<span style="width:${dotSize}px;height:${dotSize}px;background:#555;border-radius:50%;flex-shrink:0"></span>` +
            `<span>${escapeHtml(parsed.text)}</span>` +
            `</div>`,
        );
        break;
      }
      case 'text': {
        if (parsed.text === '') {
          parts.push(`<div style="font-size:${fontSize}px;line-height:${lineHeight}">&nbsp;</div>`);
        } else {
          parts.push(
            `<div style="font-size:${fontSize}px;line-height:${lineHeight};color:#333">${escapeHtml(parsed.text)}</div>`,
          );
        }
        break;
      }
    }
  }

  return parts.join('');
}
