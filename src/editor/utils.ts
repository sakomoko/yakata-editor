import type { MouseCoord } from '../types.ts';
import { GRID } from '../grid.ts';
import { screenToWorld } from '../viewport.ts';
import type { ViewportState } from '../viewport.ts';

/** CJK文字を2カラム換算した表示幅をグリッド単位で返す */
export function labelDisplayWidth(label: string): number {
  const cols = [...label].reduce((n, c) => n + (/[\u3000-\u9fff\uff00-\uffef]/.test(c) ? 2 : 1), 0);
  return Math.ceil(cols / 2) + 1;
}

export function createMousePos(
  canvas: HTMLCanvasElement,
  viewport: ViewportState,
): (e: MouseEvent) => MouseCoord {
  return (e: MouseEvent): MouseCoord => {
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const { px, py } = screenToWorld(sx, sy, viewport);
    return {
      px,
      py,
      gx: e.shiftKey ? px / GRID : Math.round(px / GRID),
      gy: e.shiftKey ? py / GRID : Math.round(py / GRID),
    };
  };
}
