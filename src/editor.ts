import type { EditorState, MouseCoord, Room } from './types.ts';
import { GRID, COLS, ROWS, drawGrid } from './grid.ts';
import { drawRoom, drawCreationPreview, hitHandle, hitRoom, createRoom } from './room.ts';
import { toggleSelection, selectSingle, clearSelection, getSingleSelected } from './selection.ts';
import { pushUndo, popUndo } from './history.ts';
import { persistToStorage, loadFromStorage, exportPng, saveAsJson } from './persistence.ts';

const state: EditorState = {
  rooms: [],
  selection: new Set(),
  history: [],
  drag: null,
  mouse: { px: 0, py: 0, gx: 0, gy: 0 },
};

let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;

function mousePos(e: MouseEvent): MouseCoord {
  const rect = canvas.getBoundingClientRect();
  const px = e.clientX - rect.left;
  const py = e.clientY - rect.top;
  return { px, py, gx: Math.round(px / GRID), gy: Math.round(py / GRID) };
}

function render(): void {
  const W = canvas.width,
    H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);

  drawGrid(ctx);

  for (const r of state.rooms) {
    const isSelected = state.selection.has(r.id);
    drawRoom(ctx, r, isSelected, isSelected && state.selection.size === 1);
  }

  if (state.drag && state.drag.type === 'create') {
    drawCreationPreview(ctx, state.drag.start, state.drag.cur);
  }

  updateStatus();
}

/* eslint-disable no-irregular-whitespace */
function updateStatus(): void {
  const el = document.getElementById('status');
  if (!el) return;
  let text = `(${state.mouse.gx}, ${state.mouse.gy})　部屋: ${state.rooms.length}`;
  if (state.selection.size === 1) {
    const sel = getSingleSelected(state.rooms, state.selection);
    if (sel) {
      text += `　|　${sel.label || '(名前なし)'}　${sel.w}×${sel.h}`;
    }
  } else if (state.selection.size > 1) {
    text += `　|　${state.selection.size}個選択中`;
  }
  el.textContent = text;
}
/* eslint-enable no-irregular-whitespace */

function commitChange(fn: () => void): void {
  pushUndo(state.history, state.rooms);
  fn();
  render();
  persistToStorage(state.rooms);
}

export function undo(): void {
  const restored = popUndo(state.history);
  if (!restored) return;
  state.rooms = restored;
  clearSelection(state.selection);
  render();
  persistToStorage(state.rooms);
}

export function newProject(): void {
  if (state.rooms.length && !confirm('現在の間取り図をクリアしますか？')) return;
  commitChange(() => {
    state.rooms = [];
    clearSelection(state.selection);
  });
}

export function loadProject(rooms: Room[]): void {
  commitChange(() => {
    state.rooms = rooms;
    clearSelection(state.selection);
  });
}

export function saveProject(): void {
  saveAsJson(state.rooms);
}

export function exportAsPng(): void {
  const prevSelection = new Set(state.selection);
  clearSelection(state.selection);
  render();
  exportPng(canvas);
  for (const id of prevSelection) state.selection.add(id);
  render();
}

function onMouseDown(e: MouseEvent): void {
  const m = mousePos(e);
  const shift = e.shiftKey;

  // Handle hit → resize
  const handleHit = hitHandle(state.rooms, state.selection, m.px, m.py);
  if (handleHit) {
    pushUndo(state.history, state.rooms);
    const { handle, room } = handleHit;
    state.drag = {
      type: 'resize',
      dir: handle.dir,
      orig: { x: room.x, y: room.y, w: room.w, h: room.h },
      targetId: room.id,
      start: m,
    };
    return;
  }

  // Room hit
  const r = hitRoom(state.rooms, m.px, m.py);
  if (r) {
    if (shift) {
      toggleSelection(state.selection, r.id);
    } else {
      if (!state.selection.has(r.id)) {
        selectSingle(state.selection, r.id);
      }
    }
    if (state.selection.size === 0) {
      render();
      return;
    }
    pushUndo(state.history, state.rooms);
    const originals = new Map<string, { x: number; y: number }>();
    for (const room of state.rooms) {
      if (state.selection.has(room.id)) {
        originals.set(room.id, { x: room.x, y: room.y });
      }
    }
    state.drag = { type: 'move', originals, start: m };
    render();
    return;
  }

  // Empty space → create
  if (!shift) clearSelection(state.selection);
  state.drag = { type: 'create', start: m, cur: m };
  render();
}

function onMouseMove(e: MouseEvent): void {
  const m = mousePos(e);
  state.mouse = m;

  if (!state.drag) {
    const h = hitHandle(state.rooms, state.selection, m.px, m.py);
    if (h) {
      canvas.style.cursor = h.handle.dir + '-resize';
    } else if (hitRoom(state.rooms, m.px, m.py)) {
      canvas.style.cursor = 'move';
    } else {
      canvas.style.cursor = 'crosshair';
    }
    updateStatus();
    return;
  }

  if (state.drag.type === 'create') {
    state.drag.cur = m;
  } else if (state.drag.type === 'move') {
    const dx = m.gx - state.drag.start.gx;
    const dy = m.gy - state.drag.start.gy;
    for (const [id, orig] of state.drag.originals) {
      const room = state.rooms.find((r) => r.id === id);
      if (room) {
        room.x = orig.x + dx;
        room.y = orig.y + dy;
      }
    }
  } else if (state.drag.type === 'resize') {
    const o = state.drag.orig;
    const d = state.drag.dir;
    const targetId = state.drag.targetId;
    const target = state.rooms.find((r) => r.id === targetId);
    if (target) {
      if (d.includes('w')) {
        target.x = Math.min(m.gx, o.x + o.w - 1);
        target.w = Math.max(1, o.x + o.w - target.x);
      }
      if (d.includes('e')) {
        target.w = Math.max(1, m.gx - o.x);
      }
      if (d.includes('n')) {
        target.y = Math.min(m.gy, o.y + o.h - 1);
        target.h = Math.max(1, o.y + o.h - target.y);
      }
      if (d.includes('s')) {
        target.h = Math.max(1, m.gy - o.y);
      }
    }
  }

  render();
}

function onMouseUp(e: MouseEvent): void {
  if (!state.drag) return;

  if (state.drag.type === 'create') {
    const m = mousePos(e);
    const x = Math.min(state.drag.start.gx, m.gx);
    const y = Math.min(state.drag.start.gy, m.gy);
    const w = Math.abs(m.gx - state.drag.start.gx);
    const h = Math.abs(m.gy - state.drag.start.gy);
    if (w > 0 && h > 0) {
      pushUndo(state.history, state.rooms);
      const room = createRoom(x, y, w, h);
      state.rooms.push(room);
      clearSelection(state.selection);
      state.selection.add(room.id);
    }
  }

  state.drag = null;
  render();
  persistToStorage(state.rooms);
}

function onDblClick(e: MouseEvent): void {
  const m = mousePos(e);
  const r = hitRoom(state.rooms, m.px, m.py);
  if (r) {
    const name = prompt('部屋名を入力:', r.label || '');
    if (name !== null) {
      commitChange(() => {
        r.label = name;
      });
    }
  }
}

function onKeyDown(e: KeyboardEvent): void {
  if (
    (e.key === 'Delete' || e.key === 'Backspace') &&
    state.selection.size > 0 &&
    document.activeElement === document.body
  ) {
    e.preventDefault();
    commitChange(() => {
      state.rooms = state.rooms.filter((r) => !state.selection.has(r.id));
      clearSelection(state.selection);
    });
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
    e.preventDefault();
    undo();
  }
}

export function initEditor(): void {
  canvas = document.getElementById('canvas') as HTMLCanvasElement;
  ctx = canvas.getContext('2d')!;
  canvas.width = COLS * GRID;
  canvas.height = ROWS * GRID;

  state.rooms = loadFromStorage();

  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('dblclick', onDblClick);
  document.addEventListener('keydown', onKeyDown);

  render();
}
