import { GRID } from '../grid.ts';
import {
  STICKY_NOTE_COLORS,
  STICKY_NOTE_FONT_FAMILY,
  parseStickyNoteLine,
  toggleStickyNoteCheckbox,
} from '../sticky-note.ts';
import { findStickyNoteById } from '../lookup.ts';
import { selectSingle } from '../selection.ts';
import type { StickyNote } from '../types.ts';
import type { EditorContext } from './context.ts';
import { escapeHtml } from './utils.ts';

/** 付箋ID → overlay div のマップ */
const overlayMap = new Map<string, HTMLDivElement>();

/** 全付箋オーバーレイを現在の状態に合わせて更新する。render() の最後に呼ぶ。 */
export function updateStickyNoteOverlays(ec: EditorContext): void {
  const { state, viewport, container } = ec;

  // 付箋もオーバーレイも無ければ何もしない（getBoundingClientRect の不要な呼び出しを避ける）
  if (state.stickyNotes.length === 0 && overlayMap.size === 0) return;

  const containerRect = container.getBoundingClientRect();

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
      el.style.position = 'absolute';
      el.style.pointerEvents = 'none';
      el.style.overflow = 'hidden';
      el.style.boxSizing = 'border-box';
      el.style.fontFamily = STICKY_NOTE_FONT_FAMILY;
      el.style.zIndex = '100';
      container.appendChild(el);
      overlayMap.set(note.id, el);

      el.dataset.noteId = note.id;

      // チェックボックスのクリックイベント委譲（ecをクロージャで閉じ込める）
      el.addEventListener('pointerdown', (e) => handleCheckboxClick(e, ec));
    }

    // ワールド座標 → コンテナ内相対座標
    const worldX = note.gx * GRID;
    const worldY = note.gy * GRID;
    const worldW = note.w * GRID;
    const worldH = note.h * GRID;

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

/** チェックボックスクリックのイベントハンドラ（イベント委譲） */
function handleCheckboxClick(e: PointerEvent, ec: EditorContext): void {
  const target = e.target as HTMLElement;
  const cbEl = target.closest('[data-cb-line]') as HTMLElement | null;
  if (!cbEl) return;

  const lineIndex = parseInt(cbEl.dataset.cbLine!, 10);
  const noteId = (cbEl.closest('[data-note-id]') as HTMLElement | null)?.dataset.noteId;
  if (!noteId || isNaN(lineIndex)) return;

  const note = findStickyNoteById(ec.state.stickyNotes, noteId);
  if (!note) return;

  // Canvas側のmousedownイベントを発火させない
  e.stopPropagation();
  e.preventDefault();

  ec.commitChange(() => {
    note.label = toggleStickyNoteCheckbox(note, lineIndex);
  });
  ec.flags.activeStickyNoteId = noteId;
  selectSingle(ec.state.selection, noteId);
  ec.render();
}

function renderMarkdown(note: StickyNote, fontSize: number, accentColor: string): string {
  const lines = note.label.split('\n');
  const lineHeight = 1.3;
  const parts: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const parsed = parseStickyNoteLine(lines[i]);
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
          ? `width:${cbSize}px;height:${cbSize}px;background:${accentColor};border:1px solid #555;border-radius:2px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;color:#fff;font-size:${cbSize * 0.7}px;pointer-events:auto;cursor:pointer`
          : `width:${cbSize}px;height:${cbSize}px;border:1px solid #555;border-radius:2px;display:inline-flex;flex-shrink:0;pointer-events:auto;cursor:pointer`;
        const textStyle = checked ? `color:#888;text-decoration:line-through` : `color:#333`;
        parts.push(
          `<div data-cb-line="${i}" style="display:flex;align-items:flex-start;gap:${fontSize * 0.3}px;font-size:${fontSize}px;line-height:${lineHeight};pointer-events:auto;cursor:pointer">` +
            `<span style="${checkboxStyle};margin-top:${(fontSize * lineHeight - cbSize) / 2}px">${checked ? '✓' : ''}</span>` +
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
