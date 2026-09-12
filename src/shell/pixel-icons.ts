export type Cell = [number, number];

/** Fill the run of pixels x∈[a,b] on row y */
const row = (a: number, b: number, y: number): Cell[] => {
  const out: Cell[] = [];
  for (let x = a; x <= b; x++) out.push([x, y]);
  return out;
};

const g2048Cells: Cell[] = [];
for (const [ox, oy] of [[0, 0], [4, 0], [0, 4], [4, 4]] as const) {
  for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) g2048Cells.push([ox + x, oy + y]);
}

const sudokuCells: Cell[] = [];
for (let y = 0; y < 8; y++) sudokuCells.push([2, y], [5, y]);
for (let x = 0; x < 8; x++) if (x !== 2 && x !== 5) sudokuCells.push([x, 2], [x, 5]);

/** 8×8 single-colour pixel icons, keyed by game id from the registry */
export const PIXELS: Record<string, Cell[]> = {
  snake: [...row(1, 6, 0), [6, 1], ...row(1, 6, 2), [1, 3], ...row(1, 6, 4), [6, 5], ...row(1, 6, 6)],
  tetris: [...row(1, 6, 1), ...row(1, 6, 2), ...row(3, 4, 3), ...row(3, 4, 4), ...row(3, 4, 5), ...row(3, 4, 6)],
  breakout: [
    ...row(0, 1, 0), ...row(3, 4, 0), ...row(6, 7, 0),
    ...row(0, 1, 1), ...row(3, 4, 1), ...row(6, 7, 1),
    [3, 4], ...row(2, 5, 7),
  ],
  flappy: [
    ...row(2, 5, 1), ...row(1, 6, 2).filter(([x]) => x !== 4),
    ...row(1, 7, 3), ...row(1, 6, 4), ...row(2, 4, 5),
  ],
  g2048: g2048Cells,
  minesweeper: [
    [3, 0], [4, 0], ...row(2, 5, 1), ...row(1, 6, 2).filter(([x]) => x !== 2),
    ...row(0, 7, 3), ...row(1, 6, 4), ...row(2, 5, 5), [3, 6], [4, 6],
  ],
  sudoku: sudokuCells,
  gomoku: [
    ...row(2, 5, 1), ...row(1, 6, 2).filter(([x]) => x !== 2),
    ...row(1, 6, 3), ...row(1, 6, 4), ...row(2, 5, 5),
  ],
};

/** Render as inline SVG; the colour comes from the parent's `color` */
export function pixelIconSvg(id: string): string {
  const rects = (PIXELS[id] ?? [])
    .map(([x, y]) => `<rect x="${x}" y="${y}" width="1" height="1"/>`)
    .join('');
  return `<svg viewBox="0 0 8 8" fill="currentColor" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
}
