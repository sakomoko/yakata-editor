import { zoomAtPoint, ZOOM_STEP } from '../viewport.ts';
import type { EditorContext } from './context.ts';

export function onWheel(ec: EditorContext, e: WheelEvent): void {
  e.preventDefault();
  if (ec.state.drag && ec.state.drag.type !== 'pan') return;

  const { viewport, canvas } = ec;

  if (e.ctrlKey) {
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
    const newVp = zoomAtPoint(viewport, sx, sy, viewport.zoom * factor);

    if (newVp.zoom === viewport.zoom) return;

    Object.assign(viewport, newVp);
  } else {
    viewport.panX += e.deltaX / viewport.zoom;
    viewport.panY += e.deltaY / viewport.zoom;
  }

  ec.render();
  ec.callbacks.onViewportChange(viewport);
}
