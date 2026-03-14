export const GRID = 20;
export const WALL = 2;
export const WALL_SEL = 2.5;
export const HANDLE_SIZE = 8;
export const HANDLE_HIT = 7;

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

  for (let i = startCol; i <= endCol; i++) {
    const major = ((i % 5) + 5) % 5 === 0;
    ctx.strokeStyle = major ? '#ccc' : '#eee';
    ctx.lineWidth = major ? 0.7 : 0.3;
    ctx.beginPath();
    ctx.moveTo(i * GRID, startRow * GRID);
    ctx.lineTo(i * GRID, endRow * GRID);
    ctx.stroke();
  }
  for (let i = startRow; i <= endRow; i++) {
    const major = ((i % 5) + 5) % 5 === 0;
    ctx.strokeStyle = major ? '#ccc' : '#eee';
    ctx.lineWidth = major ? 0.7 : 0.3;
    ctx.beginPath();
    ctx.moveTo(startCol * GRID, i * GRID);
    ctx.lineTo(endCol * GRID, i * GRID);
    ctx.stroke();
  }
}
