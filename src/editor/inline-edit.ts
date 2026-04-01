import { GRID, FONT_SIZE_MIN, FONT_SIZE_MAX } from '../grid.ts';
import { STICKY_NOTE_COLORS, STICKY_NOTE_FONT_FAMILY } from '../sticky-note.ts';
import type { StickyNote, StickyNoteColor, FreeText } from '../types.ts';
import type { EditorContext } from './context.ts';
import { commitChange } from './project.ts';

let activeContainer: HTMLDivElement | null = null;
let activeCleanup: (() => void) | null = null;
let activeRestore: (() => void) | null = null;

/** インライン編集中かどうか */
export function isInlineEditing(): boolean {
  return activeContainer !== null;
}

/** インライン編集を強制終了（キャンセル扱い。プレビュー値を元に戻す） */
export function cancelInlineEdit(): void {
  if (activeRestore) {
    activeRestore();
    activeRestore = null;
  }
  if (activeCleanup) {
    activeCleanup();
    activeCleanup = null;
  }
  if (activeContainer) {
    activeContainer.remove();
    activeContainer = null;
  }
}

// ---------------------------------------------------------------------------
// Shared inline-edit scaffolding
// ---------------------------------------------------------------------------

interface InlineEditConfig {
  ec: EditorContext;
  entityId: string;
  label: string;
  fontSize: number;
  /** グリッド座標 */
  gx: number;
  gy: number;
  w: number;
  h: number;
  /** コンテナの最小幅 (screen px) */
  minWidth: number;
  /** textarea の CSS */
  textareaCss: string;
  /** toolbar の CSS */
  toolbarCss: string;
  /** スライダーのアクセントカラー */
  sliderAccent: string;
  /** ツールバーに追加要素を構築する（色ボタンなど） */
  buildExtraToolbar?: (toolbar: HTMLDivElement, textarea: HTMLTextAreaElement) => void;
  /** エンティティを検索する */
  findTarget: () => { label: string; fontSize: number } | undefined;
  /** フォントサイズプレビューを適用 */
  applyPreview: (fontSize: number) => void;
  /** プレビュー状態を元に戻す */
  restorePreview: () => void;
  /** 変更があったか判定 */
  hasChanged: (newLabel: string, newFontSize: number) => boolean;
  /** undo用に元の値に戻す */
  restoreOriginals: (target: { label: string; fontSize: number }) => void;
  /** 新しい値を適用 */
  applyNewValues: (target: { label: string; fontSize: number }, newLabel: string, newFontSize: number) => void;
}

function startInlineEditBase(config: InlineEditConfig): void {
  cancelInlineEdit();

  const { ec, fontSize: initFontSize } = config;
  const { canvas, viewport } = ec;
  const canvasRect = canvas.getBoundingClientRect();

  const worldX = config.gx * GRID;
  const worldY = config.gy * GRID;
  const worldW = config.w * GRID;
  const worldH = config.h * GRID;

  const screenX = (worldX - viewport.panX) * viewport.zoom + canvasRect.left;
  const screenY = (worldY - viewport.panY) * viewport.zoom + canvasRect.top;
  const screenW = worldW * viewport.zoom;
  const screenH = worldH * viewport.zoom;

  let currentFontSize = initFontSize;

  // --- Container ---
  const container = document.createElement('div');
  container.style.cssText = `
    position: fixed;
    left: ${screenX}px;
    top: ${screenY}px;
    width: ${Math.max(screenW, config.minWidth)}px;
    z-index: 10000;
  `;

  // --- Textarea ---
  const textarea = document.createElement('textarea');
  textarea.value = config.label;
  textarea.style.cssText = config.textareaCss
    .replace('__WIDTH__', '100%')
    .replace('__HEIGHT__', `${screenH}px`)
    .replace('__FONT_SIZE__', `${currentFontSize * viewport.zoom}px`);

  // --- Toolbar ---
  const toolbar = document.createElement('div');
  toolbar.style.cssText = config.toolbarCss;

  const fontLabel = document.createElement('span');
  fontLabel.style.cssText = 'font-size: 11px; color: #555; white-space: nowrap; min-width: 32px;';
  fontLabel.textContent = `${currentFontSize}px`;

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = String(FONT_SIZE_MIN);
  slider.max = String(FONT_SIZE_MAX);
  slider.value = String(currentFontSize);
  slider.style.cssText = `flex: 1; min-width: 60px; accent-color: ${config.sliderAccent};`;

  slider.addEventListener('input', () => {
    currentFontSize = Number(slider.value);
    fontLabel.textContent = `${currentFontSize}px`;
    textarea.style.fontSize = `${currentFontSize * viewport.zoom}px`;
    config.applyPreview(currentFontSize);
    ec.render();
  });

  toolbar.appendChild(fontLabel);
  toolbar.appendChild(slider);
  config.buildExtraToolbar?.(toolbar, textarea);

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
    activeRestore = null;
    document.removeEventListener('mousedown', onOutsideClick, true);

    const target = config.findTarget();
    if (!target) return;

    if (save && config.hasChanged(newLabel, currentFontSize)) {
      // undo用にまず元の値に戻してからcommitChangeで新しい値を設定
      config.restoreOriginals(target);
      commitChange(ec, () => {
        config.applyNewValues(target, newLabel, currentFontSize);
      });
    } else {
      config.restorePreview();
      ec.render();
    }
  }

  function onOutsideClick(e: MouseEvent): void {
    if (container.contains(e.target as Node)) return;
    finish(true);
  }
  // 次のフレームで登録（配置直後のclickで即閉じるのを防止）
  requestAnimationFrame(() => {
    document.addEventListener('mousedown', onOutsideClick, true);
  });
  activeCleanup = () => {
    document.removeEventListener('mousedown', onOutsideClick, true);
  };
  activeRestore = () => config.restorePreview();

  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      finish(false);
    }
    e.stopPropagation();
  });

  toolbar.addEventListener('keydown', (e) => e.stopPropagation());

  document.body.appendChild(container);
  activeContainer = container;

  textarea.focus();
  textarea.setSelectionRange(textarea.value.length, textarea.value.length);
}

// ---------------------------------------------------------------------------
// StickyNote inline edit
// ---------------------------------------------------------------------------

/**
 * 付箋の上にtextarea + ツールバー（フォントサイズスライダー・色選択）を
 * オーバーレイしてインライン編集を開始する。
 * 外側クリックで確定、Escapeでキャンセル。
 */
export function startInlineEdit(ec: EditorContext, note: StickyNote): void {
  const noteId = note.id;
  const origLabel = note.label;
  const origFontSize = note.fontSize;
  const origColor = note.color;
  let currentColor: StickyNoteColor = note.color;
  const colors = STICKY_NOTE_COLORS[currentColor];

  startInlineEditBase({
    ec,
    entityId: noteId,
    label: note.label,
    fontSize: note.fontSize,
    gx: note.gx,
    gy: note.gy,
    w: note.w,
    h: note.h,
    minWidth: 180,
    textareaCss: `
      display: block;
      width: __WIDTH__;
      height: __HEIGHT__;
      background: ${colors.bg};
      border: 2px solid ${colors.border};
      border-bottom: none;
      border-radius: 4px 4px 0 0;
      color: #333;
      font-size: __FONT_SIZE__;
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
    `,
    toolbarCss: `
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
    `,
    sliderAccent: '#888',
    buildExtraToolbar: (toolbar, textarea) => {
      const colorContainer = document.createElement('div');
      colorContainer.style.cssText = 'display: flex; gap: 3px; margin-left: 4px;';

      function updateColors(newColor: StickyNoteColor): void {
        currentColor = newColor;
        const c = STICKY_NOTE_COLORS[newColor];
        textarea.style.background = c.bg;
        textarea.style.borderColor = c.border;
        toolbar.style.background = c.bg;
        toolbar.style.borderColor = c.border;
        for (const btn of colorContainer.children) {
          const el = btn as HTMLElement;
          const key = el.dataset.color as StickyNoteColor;
          el.style.outline = key === newColor ? `2px solid ${STICKY_NOTE_COLORS[key].border}` : 'none';
          el.style.outlineOffset = '1px';
        }
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
          e.preventDefault();
          updateColors(key);
        });
        colorContainer.appendChild(btn);
      }
      toolbar.appendChild(colorContainer);
    },
    findTarget: () => ec.state.stickyNotes.find((n) => n.id === noteId),
    applyPreview: (fontSize) => {
      const target = ec.state.stickyNotes.find((n) => n.id === noteId);
      if (target) target.fontSize = fontSize;
    },
    restorePreview: () => {
      const target = ec.state.stickyNotes.find((n) => n.id === noteId);
      if (target) {
        target.fontSize = origFontSize;
        target.color = origColor;
      }
    },
    hasChanged: (newLabel, newFontSize) =>
      newLabel !== origLabel || newFontSize !== origFontSize || currentColor !== origColor,
    restoreOriginals: (target) => {
      target.label = origLabel;
      target.fontSize = origFontSize;
      (target as StickyNote).color = origColor;
    },
    applyNewValues: (target, newLabel, newFontSize) => {
      target.label = newLabel;
      target.fontSize = newFontSize;
      (target as StickyNote).color = currentColor;
    },
  });
}

// ---------------------------------------------------------------------------
// FreeText inline edit
// ---------------------------------------------------------------------------

/**
 * FreeTextの上にtextarea + ツールバー（フォントサイズスライダー）を
 * オーバーレイしてインライン編集を開始する。
 * 外側クリックで確定、Escapeでキャンセル。
 */
export function startFreeTextInlineEdit(ec: EditorContext, ft: FreeText): void {
  const ftId = ft.id;
  const origLabel = ft.label;
  const origFontSize = ft.fontSize;

  startInlineEditBase({
    ec,
    entityId: ftId,
    label: ft.label,
    fontSize: ft.fontSize,
    gx: ft.gx,
    gy: ft.gy,
    w: ft.w,
    h: ft.h,
    minWidth: 140,
    textareaCss: `
      display: block;
      width: __WIDTH__;
      height: __HEIGHT__;
      background: #fff;
      border: 2px solid #2196F3;
      border-bottom: none;
      border-radius: 4px 4px 0 0;
      color: #000;
      font-size: __FONT_SIZE__;
      font-family: sans-serif;
      line-height: 1.2;
      padding: 2px;
      margin: 0;
      resize: none;
      outline: none;
      overflow: auto;
      box-sizing: border-box;
      white-space: pre-wrap;
      word-wrap: break-word;
    `,
    toolbarCss: `
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 6px;
      background: #f5f5f5;
      border: 2px solid #2196F3;
      border-top: 1px solid #2196F3;
      border-radius: 0 0 4px 4px;
      box-sizing: border-box;
      width: 100%;
    `,
    sliderAccent: '#2196F3',
    findTarget: () => ec.state.freeTexts.find((f) => f.id === ftId),
    applyPreview: (fontSize) => {
      const target = ec.state.freeTexts.find((f) => f.id === ftId);
      if (target) target.fontSize = fontSize;
    },
    restorePreview: () => {
      const target = ec.state.freeTexts.find((f) => f.id === ftId);
      if (target) target.fontSize = origFontSize;
    },
    hasChanged: (newLabel, newFontSize) =>
      newLabel !== origLabel || newFontSize !== origFontSize,
    restoreOriginals: (target) => {
      target.label = origLabel;
      target.fontSize = origFontSize;
    },
    applyNewValues: (target, newLabel, newFontSize) => {
      target.label = newLabel;
      target.fontSize = newFontSize;
    },
  });
}
