// 9×9 Sudoku as a flat 81-array; 0 is empty. Generated puzzles have a unique solution.
export interface Difficulty {
  id: 'easy' | 'medium' | 'hard';
  name: string;
  clues: number; // target number of givens (the floor for digging)
}

// At 44/36/30, easy and medium were all solvable by singles alone and hard mostly too — the tiers
// didn't differ (measured over 90 puzzles). 26 is the practical floor for random digging: 12ms
// average, 30ms worst; 24 drops to 35ms / 185ms worst and often can't reach the target
export const DIFFICULTIES: Difficulty[] = [
  { id: 'easy', name: 'Easy', clues: 40 },
  { id: 'medium', name: 'Medium', clues: 32 },
  { id: 'hard', name: 'Hard', clues: 26 },
];

export type SudokuStatus = 'playing' | 'won';

export interface SudokuState {
  puzzle: number[]; // the givens (0 empty); decides which cells are fixed
  solution: number[]; // the unique solution
  values: number[]; // the player's current board (including givens)
  notes: number[][]; // pencil marks per cell (ascending)
  status: SudokuStatus;
  diff: Difficulty;
}

export interface SudokuSave {
  p: number[]; s: number[]; v: number[]; n: number[][]; d: string; st: string;
}

/** Legal candidates for a cell on the current board (1–9 minus what its row/column/box already use) */
export function candidates(board: number[], idx: number): number[] {
  const used = new Set<number>();
  const r = Math.floor(idx / 9);
  const c = idx % 9;
  const br = Math.floor(r / 3) * 3;
  const bc = Math.floor(c / 3) * 3;
  for (let k = 0; k < 9; k++) {
    used.add(board[r * 9 + k]);
    used.add(board[k * 9 + c]);
    used.add(board[(br + Math.floor(k / 3)) * 9 + (bc + (k % 3))]);
  }
  const out: number[] = [];
  for (let v = 1; v <= 9; v++) if (!used.has(v)) out.push(v);
  return out;
}

/** Count solutions up to `limit` (MRV-accelerated; pass 2 for a uniqueness check) */
export function solutionCount(board: number[], limit: number): number {
  const work = board.slice();
  let count = 0;
  const recurse = (): void => {
    let best = -1;
    let bestCands: number[] = [];
    for (let i = 0; i < 81; i++) {
      if (work[i] !== 0) continue;
      const c = candidates(work, i);
      if (c.length === 0) return; // dead end
      if (best === -1 || c.length < bestCands.length) {
        best = i;
        bestCands = c;
        if (c.length === 1) break; // can't do better
      }
    }
    if (best === -1) {
      count += 1; // no empty cell = one complete solution
      return;
    }
    for (const v of bestCands) {
      work[best] = v;
      recurse();
      work[best] = 0;
      if (count >= limit) return;
    }
  };
  recurse();
  return count;
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Fill a complete valid board by randomised MRV backtracking */
export function generateSolved(rand: () => number = Math.random): number[] {
  const board = new Array<number>(81).fill(0);
  const fill = (): boolean => {
    let best = -1;
    let bestCands: number[] = [];
    for (let i = 0; i < 81; i++) {
      if (board[i] !== 0) continue;
      const c = candidates(board, i);
      if (best === -1 || c.length < bestCands.length) {
        best = i;
        bestCands = c;
      }
    }
    if (best === -1) return true;
    for (const v of shuffle(bestCands.slice(), rand)) {
      board[best] = v;
      if (fill()) return true;
      board[best] = 0;
    }
    return false;
  };
  fill();
  return board;
}

/** Dig holes: try removals in random order, keeping each only while the solution stays unique, until givens reach `clues` or nothing is left to dig */
export function makePuzzle(clues: number, rand: () => number = Math.random): { puzzle: number[]; solution: number[] } {
  const solution = generateSolved(rand);
  const puzzle = solution.slice();
  const positions = shuffle(Array.from({ length: 81 }, (_, i) => i), rand);
  let givens = 81;
  for (const pos of positions) {
    if (givens <= clues) break;
    const saved = puzzle[pos];
    if (saved === 0) continue;
    puzzle[pos] = 0;
    if (solutionCount(puzzle, 2) !== 1) puzzle[pos] = saved; // uniqueness broken, put it back
    else givens -= 1;
  }
  return { puzzle, solution };
}

export function isGiven(s: SudokuState, idx: number): boolean {
  return s.puzzle[idx] !== 0;
}

export function createState(diff: Difficulty, rand: () => number = Math.random): SudokuState {
  const { puzzle, solution } = makePuzzle(diff.clues, rand);
  return {
    puzzle,
    solution,
    values: puzzle.slice(),
    notes: Array.from({ length: 81 }, () => []),
    status: 'playing',
    diff,
  };
}

function checkWin(s: SudokuState): void {
  if (s.values.every((v, i) => v === s.solution[i])) s.status = 'won';
}

export function setValue(s: SudokuState, idx: number, v: number): boolean {
  if (s.status !== 'playing' || isGiven(s, idx)) return false;
  s.values[idx] = v;
  s.notes[idx] = [];
  checkWin(s);
  return true;
}

export function clearCell(s: SudokuState, idx: number): boolean {
  if (s.status !== 'playing' || isGiven(s, idx)) return false;
  s.values[idx] = 0;
  s.notes[idx] = [];
  return true;
}

export function toggleNote(s: SudokuState, idx: number, v: number): boolean {
  if (s.status !== 'playing' || isGiven(s, idx) || s.values[idx] !== 0) return false;
  const n = s.notes[idx];
  const at = n.indexOf(v);
  if (at >= 0) n.splice(at, 1);
  else {
    n.push(v);
    n.sort((a, b) => a - b);
  }
  return true;
}

/** Indices of cells that break row/column/box uniqueness (for error highlighting) */
export function conflicts(values: number[]): Set<number> {
  const bad = new Set<number>();
  const groups: number[][] = [];
  for (let i = 0; i < 9; i++) {
    const row: number[] = [];
    const col: number[] = [];
    const box: number[] = [];
    for (let k = 0; k < 9; k++) {
      row.push(i * 9 + k);
      col.push(k * 9 + i);
      const br = Math.floor(i / 3) * 3;
      const bc = (i % 3) * 3;
      box.push((br + Math.floor(k / 3)) * 9 + (bc + (k % 3)));
    }
    groups.push(row, col, box);
  }
  for (const g of groups) {
    const seen = new Map<number, number[]>();
    for (const idx of g) {
      const v = values[idx];
      if (v === 0) continue;
      if (!seen.has(v)) seen.set(v, []);
      seen.get(v)!.push(idx);
    }
    for (const idxs of seen.values()) if (idxs.length > 1) idxs.forEach((i) => bad.add(i));
  }
  return bad;
}

export function serialize(s: SudokuState): SudokuSave {
  return { p: s.puzzle, s: s.solution, v: s.values, n: s.notes, d: s.diff.id, st: s.status };
}

export function deserialize(save: unknown): SudokuState | null {
  if (!save || typeof save !== 'object') return null;
  const o = save as Partial<SudokuSave>;
  const diff = DIFFICULTIES.find((d) => d.id === o.d);
  if (!diff || !Array.isArray(o.p) || o.p.length !== 81 || !Array.isArray(o.v) || o.v.length !== 81
    || !Array.isArray(o.s) || o.s.length !== 81 || !Array.isArray(o.n) || o.n.length !== 81
    || !o.n.every((x) => Array.isArray(x))) return null; // every notes entry must be an array, or the renderer's for..of throws every frame
  return {
    puzzle: o.p,
    solution: o.s,
    values: o.v,
    notes: o.n,
    status: o.st === 'won' ? 'won' : 'playing',
    diff,
  };
}
