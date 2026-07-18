// 4×4 棋盘，扁平数组行优先存储，0 表示空格
export const SIZE = 4;

export type Board = number[]; // 长度 16
export type Dir = 'up' | 'down' | 'left' | 'right';
export type G2048Status = 'playing' | 'won' | 'over'; // won = 刚达成 2048、尚未选择继续

export interface G2048State {
  board: Board;
  score: number;
  status: G2048Status;
  keepPlaying: boolean; // 达成 2048 后选择继续
  prev: { board: Board; score: number } | null; // 单层撤销
}

export function emptyBoard(): Board {
  return new Array<number>(SIZE * SIZE).fill(0);
}

export function spawnTile(board: Board, rand: () => number = Math.random): Board {
  const empties = board.map((v, i) => (v === 0 ? i : -1)).filter((i) => i >= 0);
  if (empties.length === 0) return board;
  const next = board.slice();
  next[empties[Math.floor(rand() * empties.length)]] = rand() < 0.9 ? 2 : 4;
  return next;
}

export function createState(rand: () => number = Math.random): G2048State {
  let board = emptyBoard();
  board = spawnTile(board, rand);
  board = spawnTile(board, rand);
  return { board, score: 0, status: 'playing', keepPlaying: false, prev: null };
}

/** 单行向左压缩合并；每块砖一次移动至多参与一次合并 */
export function slideLine(line: number[]): { line: number[]; gained: number } {
  const tiles = line.filter((v) => v !== 0);
  const out: number[] = [];
  let gained = 0;
  for (let i = 0; i < tiles.length; i++) {
    if (i + 1 < tiles.length && tiles[i] === tiles[i + 1]) {
      out.push(tiles[i] * 2);
      gained += tiles[i] * 2;
      i++; // 跳过被合并的砖
    } else {
      out.push(tiles[i]);
    }
  }
  while (out.length < SIZE) out.push(0);
  return { line: out, gained };
}

export function moveBoard(board: Board, dir: Dir): { board: Board; gained: number; moved: boolean } {
  const next = board.slice();
  let gained = 0;
  for (let i = 0; i < SIZE; i++) {
    // 第 i 条线的格子下标，按移动方向从"前"到"后"排列
    const idx: number[] = [];
    for (let j = 0; j < SIZE; j++) {
      if (dir === 'left') idx.push(i * SIZE + j);
      else if (dir === 'right') idx.push(i * SIZE + (SIZE - 1 - j));
      else if (dir === 'up') idx.push(j * SIZE + i);
      else idx.push((SIZE - 1 - j) * SIZE + i);
    }
    const r = slideLine(idx.map((k) => board[k]));
    gained += r.gained;
    idx.forEach((k, j) => {
      next[k] = r.line[j];
    });
  }
  return { board: next, gained, moved: next.some((v, k) => v !== board[k]) };
}

export function canMove(board: Board): boolean {
  if (board.includes(0)) return true;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const v = board[y * SIZE + x];
      if (x + 1 < SIZE && board[y * SIZE + x + 1] === v) return true;
      if (y + 1 < SIZE && board[(y + 1) * SIZE + x] === v) return true;
    }
  }
  return false;
}

/** 尝试一步移动；实际移动了才生新砖、记撤销点、判胜负。返回是否移动。 */
export function move(s: G2048State, dir: Dir, rand: () => number = Math.random): boolean {
  if (s.status !== 'playing') return false; // won 界面需先"继续"或撤销
  const r = moveBoard(s.board, dir);
  if (!r.moved) return false;
  s.prev = { board: s.board, score: s.score };
  s.board = spawnTile(r.board, rand);
  s.score += r.gained;
  if (!s.keepPlaying && r.board.includes(2048)) {
    s.status = 'won';
  } else if (!canMove(s.board)) {
    s.status = 'over';
  }
  return true;
}

export function continueAfterWin(s: G2048State): void {
  if (s.status !== 'won') return;
  s.status = 'playing';
  s.keepPlaying = true;
}

/** 撤销一步（可从 won/over 退回）；仅一层 */
export function undo(s: G2048State): boolean {
  if (!s.prev) return false;
  s.board = s.prev.board;
  s.score = s.prev.score;
  s.prev = null;
  s.status = 'playing';
  return true;
}
