export const GRID = 20;
export const COLS = 100;
export const ROWS = 75;
export const WALL = 2;
export const WALL_SEL = 2.5;
export const HANDLE_SIZE = 8;
export const HANDLE_HIT = 7;

export function drawGrid(ctx: CanvasRenderingContext2D): void {
  const W = COLS * GRID;
  const H = ROWS * GRID;

  for (let i = 0; i <= COLS; i++) {
    ctx.strokeStyle = i % 5 === 0 ? '#ccc' : '#eee';
    ctx.lineWidth = i % 5 === 0 ? 0.7 : 0.3;
    ctx.beginPath();
    ctx.moveTo(i * GRID, 0);
    ctx.lineTo(i * GRID, H);
    ctx.stroke();
  }
  for (let i = 0; i <= ROWS; i++) {
    ctx.strokeStyle = i % 5 === 0 ? '#ccc' : '#eee';
    ctx.lineWidth = i % 5 === 0 ? 0.7 : 0.3;
    ctx.beginPath();
    ctx.moveTo(0, i * GRID);
    ctx.lineTo(W, i * GRID);
    ctx.stroke();
  }
}
