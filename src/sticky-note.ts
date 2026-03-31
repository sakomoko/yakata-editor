import type { StickyNote, StickyNoteColor, ResizeDirection } from './types.ts';
import {
  boxPixelRect,
  drawBoxHandles,
  hitBox,
  hitBoxHandle,
  findBoxesInArea,
  computeBoxResize,
  scaleProportionalFontSize,
} from './box-utils.ts';

const DEFAULT_FONT_SIZE = 12;

export const STICKY_NOTE_FONT_FAMILY =
  '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif';

export const STICKY_NOTE_COLORS: Record<StickyNoteColor, { bg: string; border: string }> = {
  yellow: { bg: '#FFF9C4', border: '#F9A825' },
  pink: { bg: '#FCE4EC', border: '#E91E63' },
  green: { bg: '#E8F5E9', border: '#4CAF50' },
  blue: { bg: '#E3F2FD', border: '#2196F3' },
};

export type ParsedLine =
  | { type: 'checkbox'; checked: boolean; text: string }
  | { type: 'bullet'; text: string }
  | { type: 'heading'; text: string }
  | { type: 'text'; text: string };

export function parseStickyNoteLine(line: string): ParsedLine {
  if (/^- \[x\] /.test(line)) {
    return { type: 'checkbox', checked: true, text: line.slice(6) };
  }
  if (/^- \[ \] /.test(line)) {
    return { type: 'checkbox', checked: false, text: line.slice(6) };
  }
  if (/^# /.test(line)) {
    return { type: 'heading', text: line.slice(2) };
  }
  if (/^- /.test(line)) {
    return { type: 'bullet', text: line.slice(2) };
  }
  return { type: 'text', text: line };
}

export function createStickyNote(
  gx: number,
  gy: number,
  label: string,
  fontSize = DEFAULT_FONT_SIZE,
  color: StickyNoteColor = 'yellow',
): StickyNote {
  return {
    id: crypto.randomUUID(),
    gx,
    gy,
    w: 5,
    h: 5,
    label,
    fontSize,
    color,
  };
}

const CHECKBOX_SIZE_RATIO = 0.85;
const CHECKBOX_LEFT_PADDING = 4;
const LINE_PADDING = 4;

export function drawStickyNote(
  ctx: CanvasRenderingContext2D,
  note: StickyNote,
  isSelected: boolean,
  isActive: boolean,
  zoom: number,
): void {
  const rect = boxPixelRect(note);
  const colors = STICKY_NOTE_COLORS[note.color];

  // Background with slight shadow
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.15)';
  ctx.shadowBlur = 6 / zoom;
  ctx.shadowOffsetX = 2 / zoom;
  ctx.shadowOffsetY = 2 / zoom;
  ctx.fillStyle = colors.bg;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();

  // Border
  ctx.save();
  ctx.strokeStyle = colors.border;
  ctx.lineWidth = 1.5 / zoom;
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);

  // Selection / active indicator
  if (isSelected || isActive) {
    ctx.strokeStyle = isActive ? '#FF9800' : '#2196F3';
    ctx.lineWidth = (isActive ? 2.5 : 2) / zoom;
    ctx.setLineDash([4 / zoom, 4 / zoom]);
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    ctx.setLineDash([]);
  }
  ctx.restore();
}

export function drawStickyNoteHandles(
  ctx: CanvasRenderingContext2D,
  note: StickyNote,
  zoom: number,
): void {
  drawBoxHandles(ctx, note, zoom);
}

export function hitStickyNote(
  stickyNotes: StickyNote[],
  px: number,
  py: number,
): StickyNote | null {
  return hitBox(stickyNotes, px, py);
}

export function hitStickyNoteHandle(
  note: StickyNote,
  px: number,
  py: number,
  zoom: number,
): ResizeDirection | null {
  return hitBoxHandle(note, px, py, zoom);
}

/** チェックボックスのヒット判定。該当行インデックスまたは -1。 */
export function hitStickyNoteCheckbox(note: StickyNote, px: number, py: number): number {
  const rect = boxPixelRect(note);

  if (px < rect.x || px > rect.x + rect.w || py < rect.y || py > rect.y + rect.h) {
    return -1;
  }

  const lines = note.label.split('\n');
  const lineHeight = note.fontSize * 1.3;
  let curY = rect.y + LINE_PADDING;

  for (let i = 0; i < lines.length; i++) {
    const parsed = parseStickyNoteLine(lines[i]);

    if (parsed.type === 'heading') {
      curY += Math.round(note.fontSize * 1.3) * 1.3;
      continue;
    }

    if (parsed.type === 'checkbox') {
      const cbSize = note.fontSize * CHECKBOX_SIZE_RATIO;
      const cbX = rect.x + CHECKBOX_LEFT_PADDING;
      const cbY = curY + (lineHeight - cbSize) / 2;

      if (px >= cbX && px <= cbX + cbSize + 4 && py >= cbY && py <= cbY + cbSize) {
        return i;
      }
    }

    curY += lineHeight;
  }
  return -1;
}

export function toggleStickyNoteCheckbox(note: StickyNote, lineIndex: number): string {
  const lines = note.label.split('\n');
  if (lineIndex < 0 || lineIndex >= lines.length) return note.label;

  const line = lines[lineIndex];
  if (/^- \[x\] /.test(line)) {
    lines[lineIndex] = '- [ ] ' + line.slice(6);
  } else if (/^- \[ \] /.test(line)) {
    lines[lineIndex] = '- [x] ' + line.slice(6);
  }
  return lines.join('\n');
}

export function findStickyNotesInArea(
  stickyNotes: StickyNote[],
  area: { x: number; y: number; w: number; h: number },
): StickyNote[] {
  return findBoxesInArea(stickyNotes, area);
}

export function computeStickyNoteResize(
  dir: ResizeDirection,
  orig: { gx: number; gy: number; w: number; h: number },
  gx: number,
  gy: number,
): { gx: number; gy: number; w: number; h: number } {
  return computeBoxResize(dir, orig, gx, gy);
}

export function scaleStickyNoteFontSize(
  origFontSize: number,
  origH: number,
  newH: number,
): number {
  return scaleProportionalFontSize(origFontSize, origH, newH);
}

/**
 * Canvas上に付箋のテキストを描画する（PNGエクスポート用）。
 * 通常の表示ではHTMLオーバーレイが使用されるが、PNGエクスポート時は
 * Canvasに直接描画する必要がある。
 */
export function drawStickyNoteText(
  ctx: CanvasRenderingContext2D,
  note: StickyNote,
  zoom: number,
): void {
  const rect = boxPixelRect(note);
  const colors = STICKY_NOTE_COLORS[note.color];
  const lines = note.label.split('\n');
  const lineHeight = note.fontSize * 1.3;
  const padding = LINE_PADDING;

  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();

  let curY = rect.y + padding;

  for (const line of lines) {
    const parsed = parseStickyNoteLine(line);

    switch (parsed.type) {
      case 'heading': {
        const headingSize = Math.round(note.fontSize * 1.3);
        ctx.font = `bold ${headingSize}px ${STICKY_NOTE_FONT_FAMILY}`;
        ctx.fillStyle = '#333';
        ctx.textBaseline = 'top';
        ctx.fillText(parsed.text, rect.x + padding, curY, rect.w - padding * 2);
        curY += headingSize * 1.3;
        break;
      }
      case 'checkbox': {
        const cbSize = note.fontSize * CHECKBOX_SIZE_RATIO;
        const cbX = rect.x + CHECKBOX_LEFT_PADDING;
        const cbY = curY + (lineHeight - cbSize) / 2;

        // Draw checkbox
        if (parsed.checked) {
          ctx.fillStyle = colors.border;
          ctx.fillRect(cbX, cbY, cbSize, cbSize);
          // Checkmark
          ctx.fillStyle = '#fff';
          ctx.font = `${cbSize * 0.7}px ${STICKY_NOTE_FONT_FAMILY}`;
          ctx.textBaseline = 'middle';
          ctx.textAlign = 'center';
          ctx.fillText('✓', cbX + cbSize / 2, cbY + cbSize / 2);
          ctx.textAlign = 'left';
        } else {
          ctx.strokeStyle = '#555';
          ctx.lineWidth = 1 / zoom;
          ctx.strokeRect(cbX, cbY, cbSize, cbSize);
        }

        // Draw text
        ctx.font = `${note.fontSize}px ${STICKY_NOTE_FONT_FAMILY}`;
        ctx.fillStyle = parsed.checked ? '#888' : '#333';
        ctx.textBaseline = 'top';
        const textX = cbX + cbSize + note.fontSize * 0.3;
        ctx.fillText(parsed.text, textX, curY, rect.w - (textX - rect.x) - padding);
        curY += lineHeight;
        break;
      }
      case 'bullet': {
        const dotSize = Math.round(note.fontSize * 0.3);
        const dotX = rect.x + CHECKBOX_LEFT_PADDING + dotSize / 2;
        const dotY = curY + lineHeight / 2;

        ctx.fillStyle = '#555';
        ctx.beginPath();
        ctx.arc(dotX, dotY, dotSize / 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = `${note.fontSize}px ${STICKY_NOTE_FONT_FAMILY}`;
        ctx.fillStyle = '#333';
        ctx.textBaseline = 'top';
        const bulletTextX = rect.x + CHECKBOX_LEFT_PADDING + dotSize + note.fontSize * 0.3;
        ctx.fillText(parsed.text, bulletTextX, curY, rect.w - (bulletTextX - rect.x) - padding);
        curY += lineHeight;
        break;
      }
      case 'text': {
        ctx.font = `${note.fontSize}px ${STICKY_NOTE_FONT_FAMILY}`;
        ctx.fillStyle = '#333';
        ctx.textBaseline = 'top';
        ctx.fillText(parsed.text, rect.x + padding, curY, rect.w - padding * 2);
        curY += lineHeight;
        break;
      }
    }
  }

  ctx.restore();
}
