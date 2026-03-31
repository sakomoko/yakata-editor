import { GRID, FONT_SIZE_MIN, FONT_SIZE_MAX } from '../grid.ts';
import { STICKY_NOTE_COLORS, STICKY_NOTE_FONT_FAMILY } from '../sticky-note.ts';
import type { StickyNote, StickyNoteColor } from '../types.ts';
import type { EditorContext } from './context.ts';
import { commitChange } from './project.ts';

let activeContainer: HTMLDivElement | null = null;
let activeCleanup: (() => void) | null = null;

/** インライン編集中かどうか */
export function isInlineEditing(): boolean {
  return activeContainer !== null;
}

/** インライン編集を強制終了（キャンセル扱い） */
export function cancelInlineEdit(): void {
  if (activeCleanup) {
    activeCleanup();
    activeCleanup = null;
  }
  if (activeContainer) {
    activeContainer.remove();
    activeContainer = null;
  }
}

/**
 * 付箋の上にtextarea + ツールバー（フォントサイズスライダー・色選択）を
 * オーバーレイしてインライン編集を開始する。
 * 外側クリックで確定、Escapeでキャンセル。
 */
export function startInlineEdit(ec: EditorContext, note: StickyNote): void {
  cancelInlineEdit();

  const { canvas, viewport } = ec;
  const canvasRect = canvas.getBoundingClientRect();

  const worldX = note.gx * GRID;
  const worldY = note.gy * GRID;
  const worldW = note.w * GRID;
  const worldH = note.h * GRID;

  const screenX = (worldX - viewport.panX) * viewport.zoom + canvasRect.left;
  const screenY = (worldY - viewport.panY) * viewport.zoom + canvasRect.top;
  const screenW = worldW * viewport.zoom;
  const screenH = worldH * viewport.zoom;

  const noteId = note.id;
  let currentFontSize = note.fontSize;
  let currentColor: StickyNoteColor = note.color;
  const origLabel = note.label;
  const origFontSize = note.fontSize;
  const origColor = note.color;

  // --- Container ---
  const container = document.createElement('div');
  container.style.cssText = `
    position: fixed;
    left: ${screenX}px;
    top: ${screenY}px;
    width: ${Math.max(screenW, 180)}px;
    z-index: 10000;
  `;

  // --- Textarea ---
  const colors = STICKY_NOTE_COLORS[currentColor];
  const textarea = document.createElement('textarea');
  textarea.value = note.label;
  textarea.style.cssText = `
    display: block;
    width: 100%;
    height: ${screenH}px;
    background: ${colors.bg};
    border: 2px solid ${colors.border};
    border-bottom: none;
    border-radius: 4px 4px 0 0;
    color: #333;
    font-size: ${currentFontSize * viewport.zoom}px;
    font-family: ${STICKY_NOTE_FONT_FAMILY};
    line-height: 1.3;
    padding: 4px;
    margin: 0;
    resize: none;
    outline: none;
    overflow: auto;
    box-sizing: border-box;
    white-space: pre-wrap;
    word-wrap: break-word;
  `;

  // --- Toolbar ---
  const toolbar = document.createElement('div');
  toolbar.style.cssText = `
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 6px;
    background: ${colors.bg};
    border: 2px solid ${colors.border};
    border-top: 1px solid ${colors.border};
    border-radius: 0 0 4px 4px;
    box-sizing: border-box;
    width: 100%;
  `;

  // Font size label
  const fontLabel = document.createElement('span');
  fontLabel.style.cssText = 'font-size: 11px; color: #555; white-space: nowrap; min-width: 32px;';
  fontLabel.textContent = `${currentFontSize}px`;

  // Font size slider
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = String(FONT_SIZE_MIN);
  slider.max = String(FONT_SIZE_MAX);
  slider.value = String(currentFontSize);
  slider.style.cssText = 'flex: 1; min-width: 60px; accent-color: #888;';

  slider.addEventListener('input', () => {
    currentFontSize = Number(slider.value);
    fontLabel.textContent = `${currentFontSize}px`;
    textarea.style.fontSize = `${currentFontSize * viewport.zoom}px`;
    // リアルタイムプレビュー
    const target = ec.state.stickyNotes.find((n) => n.id === noteId);
    if (target) {
      target.fontSize = currentFontSize;
      ec.render();
    }
  });

  // Color buttons
  const colorContainer = document.createElement('div');
  colorContainer.style.cssText = 'display: flex; gap: 3px; margin-left: 4px;';

  function updateColors(newColor: StickyNoteColor): void {
    currentColor = newColor;
    const c = STICKY_NOTE_COLORS[newColor];
    textarea.style.background = c.bg;
    textarea.style.borderColor = c.border;
    toolbar.style.background = c.bg;
    toolbar.style.borderColor = c.border;
    // Update button selection indicators
    for (const btn of colorContainer.children) {
      const el = btn as HTMLElement;
      const key = el.dataset.color as StickyNoteColor;
      el.style.outline = key === newColor ? `2px solid ${STICKY_NOTE_COLORS[key].border}` : 'none';
      el.style.outlineOffset = '1px';
    }
    // リアルタイムプレビュー
    const target = ec.state.stickyNotes.find((n) => n.id === noteId);
    if (target) {
      target.color = newColor;
      ec.render();
    }
  }

  for (const key of Object.keys(STICKY_NOTE_COLORS) as StickyNoteColor[]) {
    const btn = document.createElement('div');
    btn.dataset.color = key;
    btn.title = key;
    btn.style.cssText = `
      width: 16px; height: 16px;
      background: ${STICKY_NOTE_COLORS[key].bg};
      border: 1px solid ${STICKY_NOTE_COLORS[key].border};
      border-radius: 2px;
      cursor: pointer;
    `;
    if (key === currentColor) {
      btn.style.outline = `2px solid ${STICKY_NOTE_COLORS[key].border}`;
      btn.style.outlineOffset = '1px';
    }
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault(); // textareaからfocusを奪わない
      updateColors(key);
    });
    colorContainer.appendChild(btn);
  }

  toolbar.appendChild(fontLabel);
  toolbar.appendChild(slider);
  toolbar.appendChild(colorContainer);

  container.appendChild(textarea);
  container.appendChild(toolbar);

  // --- Finish logic ---
  let committed = false;

  function finish(save: boolean): void {
    if (committed) return;
    committed = true;
    const newLabel = textarea.value;
    container.remove();
    activeContainer = null;
    activeCleanup = null;
    document.removeEventListener('mousedown', onOutsideClick, true);

    const target = ec.state.stickyNotes.find((n) => n.id === noteId);
    if (!target) return;

    const changed =
      save && (newLabel !== origLabel || currentFontSize !== origFontSize || currentColor !== origColor);

    if (changed) {
      // スライダーのリアルタイムプレビューで既に値が変わっているので、
      // undo用にまず元の値に戻してからcommitChangeで新しい値を設定
      target.label = origLabel;
      target.fontSize = origFontSize;
      target.color = origColor;
      commitChange(ec, () => {
        target.label = newLabel;
        target.fontSize = currentFontSize;
        target.color = currentColor;
      });
    } else {
      // キャンセル: 元に戻す
      target.fontSize = origFontSize;
      target.color = origColor;
      ec.render();
    }
  }

  // 外側クリックで確定
  function onOutsideClick(e: MouseEvent): void {
    if (container.contains(e.target as Node)) return;
    finish(true);
  }
  // 次のフレームで登録（配置直後のclickで即閉じるのを防止）
  requestAnimationFrame(() => {
    document.addEventListener('mousedown', onOutsideClick, true);
  });
  // cancelInlineEdit から呼べるようにクリーンアップ関数を登録
  activeCleanup = () => {
    document.removeEventListener('mousedown', onOutsideClick, true);
  };

  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      finish(false);
    }
    e.stopPropagation();
  });

  // スライダーやボタンからのキーイベントも遮断
  toolbar.addEventListener('keydown', (e) => e.stopPropagation());

  document.body.appendChild(container);
  activeContainer = container;

  textarea.focus();
  textarea.setSelectionRange(textarea.value.length, textarea.value.length);
}
