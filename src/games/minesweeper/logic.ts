// Flat row-major grid; mines are placed lazily on the first reveal, avoiding the clicked cell and its neighbours, so the first click is always safe
export interface Difficulty {
  id: 'easy' | 'medium' | 'hard';
  name: string;
  cols: number;
  rows: number;
  mines: number;
  cell: number; // rendered cell size in px (the board is always 288 wide = cols × cell)
}

export const DIFFICULTIES: Difficulty[] = [
  { id: 'easy', name: 'Beginner', cols: 9, rows: 9, mines: 10, cell: 32 },
  { id: 'medium', name: 'Intermediate', cols: 12, rows: 16, mines: 30, cell: 24 },
  { id: 'hard', name: 'Expert', cols: 16, rows: 24, mines: 80, cell: 18 },
];

export interface Cell {
  mine: boolean;
  revealed: boolean;
  flagged: boolean;
  adj: number;
}

export type MineStatus = 'ready' | 'playing' | 'won' | 'lost';

export interface MineState {
  diff: Difficulty;
  grid: Cell[];
  status: MineStatus;
  flags: number;
  revealed: number;
}

export interface MineEvents {
  revealedSome: boolean;
  exploded: boolean;
  won: boolean;
}

export function createState(diff: Difficulty): MineState {
  return {
    diff,
    grid: Array.from({ length: diff.cols * diff.rows }, () => ({
      mine: false,
      revealed: false,
      flagged: false,
      adj: 0,
    })),
    status: 'ready',
    flags: 0,
    revealed: 0,
  };
}

export function neighbors(diff: Difficulty, idx: number): number[] {
  const c = idx % diff.cols;
  const r = Math.floor(idx / diff.cols);
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < diff.rows && nc >= 0 && nc < diff.cols) out.push(nr * diff.cols + nc);
    }
  }
  return out;
}

export function computeAdjacency(s: MineState): void {
  for (let i = 0; i < s.grid.length; i++) {
    s.grid[i].adj = neighbors(s.diff, i).filter((n) => s.grid[n].mine).length;
  }
}

function placeMines(s: MineState, safeIdx: number, rand: () => number): void {
  const banned = new Set([safeIdx, ...neighbors(s.diff, safeIdx)]);
  const candidates: number[] = [];
  for (let i = 0; i < s.grid.length; i++) if (!banned.has(i)) candidates.push(i);
  // Partial Fisher-Yates: shuffle out the first `mines` entries
  for (let i = 0; i < s.diff.mines; i++) {
    const j = i + Math.floor(rand() * (candidates.length - i));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    s.grid[candidates[i]].mine = true;
  }
  computeAdjacency(s);
}

export function reveal(s: MineState, idx: number, rand: () => number = Math.random): MineEvents {
  const ev: MineEvents = { revealedSome: false, exploded: false, won: false };
  if (s.status !== 'ready' && s.status !== 'playing') return ev;
  const cell = s.grid[idx];
  if (cell.revealed || cell.flagged) return ev;

  if (s.status === 'ready') {
    placeMines(s, idx, rand);
    s.status = 'playing';
  }

  if (cell.mine) {
    s.status = 'lost';
    for (const c of s.grid) if (c.mine) c.revealed = true;
    ev.exploded = true;
    return ev;
  }

  // Flood fill (iterative stack DFS, no recursion; same result as BFS): zero cells expand, numbered cells are revealed as the border but don't expand; flagged cells are skipped
  const queue = [idx];
  while (queue.length > 0) {
    const i = queue.pop()!;
    const c = s.grid[i];
    if (c.revealed || c.flagged || c.mine) continue;
    c.revealed = true;
    s.revealed += 1;
    if (c.adj === 0) {
      for (const n of neighbors(s.diff, i)) {
        if (!s.grid[n].revealed) queue.push(n);
      }
    }
  }
  ev.revealedSome = true;

  // Win is judged by the mines actually on the board, not the difficulty's count: "every non-mine
  // cell revealed" is what winning means, and hand-built test boards share the production check
  const totalMines = s.grid.reduce((n, c) => n + (c.mine ? 1 : 0), 0);
  if (s.revealed === s.grid.length - totalMines) {
    s.status = 'won';
    ev.won = true;
  }
  return ev;
}

export function toggleFlag(s: MineState, idx: number): boolean {
  if (s.status !== 'ready' && s.status !== 'playing') return false;
  const c = s.grid[idx];
  if (c.revealed) return false;
  c.flagged = !c.flagged;
  s.flags += c.flagged ? 1 : -1;
  return true;
}
