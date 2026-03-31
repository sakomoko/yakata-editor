export const GRID = 20;
export const WALL = 2;
export const WALL_SEL = 2.5;
export const HANDLE_SIZE = 8;
export const HANDLE_HIT = 7;
export const FONT_SIZE_MIN = 4;
export const FONT_SIZE_MAX = 80;

export function drawGrid(
  ctx: CanvasRenderingContext2D,
  viewMinX: number,
  viewMinY: number,
  viewMaxX: number,
  viewMaxY: number,
): void {
  const startCol = Math.floor(viewMinX / GRID);
  const endCol = Math.ceil(viewMaxX / GRID);
  const startRow = Math.floor(viewMinY / GRID);
  const endRow = Math.ceil(viewMaxY / GRID);

  // minor lines (batched)
  ctx.strokeStyle = '#eee';
  ctx.lineWidth = 0.3;
  ctx.beginPath();
  for (let i = startCol; i <= endCol; i++) {
    if (((i % 5) + 5) % 5 !== 0) {
      ctx.moveTo(i * GRID, startRow * GRID);
      ctx.lineTo(i * GRID, endRow * GRID);
    }
  }
  for (let i = startRow; i <= endRow; i++) {
    if (((i % 5) + 5) % 5 !== 0) {
      ctx.moveTo(startCol * GRID, i * GRID);
      ctx.lineTo(endCol * GRID, i * GRID);
    }
  }
  ctx.stroke();

  // major lines (batched)
  ctx.strokeStyle = '#ccc';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  for (let i = startCol; i <= endCol; i++) {
    if (((i % 5) + 5) % 5 === 0) {
      ctx.moveTo(i * GRID, startRow * GRID);
      ctx.lineTo(i * GRID, endRow * GRID);
    }
  }
  for (let i = startRow; i <= endRow; i++) {
    if (((i % 5) + 5) % 5 === 0) {
      ctx.moveTo(startCol * GRID, i * GRID);
      ctx.lineTo(endCol * GRID, i * GRID);
    }
  }
  ctx.stroke();
}
