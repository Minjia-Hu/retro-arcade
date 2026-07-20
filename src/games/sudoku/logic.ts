// 9×9 数独，扁平 81 长数组，0 表示空。生成保证唯一解。
export interface Difficulty {
  id: 'easy' | 'medium' | 'hard';
  name: string;
  clues: number; // 目标给定格数（挖洞下限）
}

export const DIFFICULTIES: Difficulty[] = [
  { id: 'easy', name: '初级', clues: 44 },
  { id: 'medium', name: '中级', clues: 36 },
  { id: 'hard', name: '高级', clues: 30 },
];

export type SudokuStatus = 'playing' | 'won';

export interface SudokuState {
  puzzle: number[]; // 给定盘（0 空），给定格判定依据
  solution: number[]; // 唯一解
  values: number[]; // 玩家当前盘（含给定）
  notes: number[][]; // 每格铅笔标记（升序）
  status: SudokuStatus;
  diff: Difficulty;
}

export interface SudokuSave {
  p: number[]; s: number[]; v: number[]; n: number[][]; d: string; st: string;
}

/** 某格在当前盘下的合法候选值（1-9 去掉同行/列/宫已占用） */
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

/** 数解数目，最多数到 limit（MRV 加速，用于唯一性校验时传 2） */
export function solutionCount(board: number[], limit: number): number {
  const work = board.slice();
  let count = 0;
  const recurse = (): void => {
    let best = -1;
    let bestCands: number[] = [];
    for (let i = 0; i < 81; i++) {
      if (work[i] !== 0) continue;
      const c = candidates(work, i);
      if (c.length === 0) return; // 死路
      if (best === -1 || c.length < bestCands.length) {
        best = i;
        bestCands = c;
        if (c.length === 1) break; // 无法更优
      }
    }
    if (best === -1) {
      count += 1; // 无空格 = 一个完整解
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

/** 随机 MRV 回溯填出一个完整合法盘 */
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

/** 挖洞：随机顺序尝试移除，仅当唯一解仍保持时保留移除，直到 givens 降到 clues 或无处可挖 */
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
    if (solutionCount(puzzle, 2) !== 1) puzzle[pos] = saved; // 破坏唯一性，还原
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

/** 违反行/列/宫唯一性的格子下标集合（用于错误高亮） */
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
    || !o.n.every((x) => Array.isArray(x))) return null; // notes 逐元素须为数组，否则渲染 for..of 会每帧抛异常
  return {
    puzzle: o.p,
    solution: o.s,
    values: o.v,
    notes: o.n,
    status: o.st === 'won' ? 'won' : 'playing',
    diff,
  };
}
