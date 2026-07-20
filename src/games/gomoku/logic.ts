// 15×15 五子棋，扁平 225 长数组。自由风格：五连及以上即胜，无禁手。
export const SIZE = 15;
export const EMPTY = 0;
export const BLACK = 1;
export const WHITE = 2;
export const CENTER = 7 * SIZE + 7; // 112，天元

// 四条方向：水平、垂直、主对角、反对角
export const DIRS: [number, number][] = [[1, 0], [0, 1], [1, 1], [1, -1]];

export function createBoard(): number[] {
  return new Array<number>(SIZE * SIZE).fill(EMPTY);
}

export function inBounds(x: number, y: number): boolean {
  return x >= 0 && x < SIZE && y >= 0 && y < SIZE;
}

export function other(player: number): number {
  return player === BLACK ? WHITE : BLACK;
}

/** 经 idx 的四方向是否有 ≥5 连（idx 处假定为 player） */
export function checkWin(board: number[], idx: number, player: number): boolean {
  const x0 = idx % SIZE;
  const y0 = Math.floor(idx / SIZE);
  for (const [dx, dy] of DIRS) {
    let count = 1;
    let x = x0 + dx;
    let y = y0 + dy;
    while (inBounds(x, y) && board[y * SIZE + x] === player) { count += 1; x += dx; y += dy; }
    x = x0 - dx;
    y = y0 - dy;
    while (inBounds(x, y) && board[y * SIZE + x] === player) { count += 1; x -= dx; y -= dy; }
    if (count >= 5) return true;
  }
  return false;
}

export type GomokuStatus = 'playing' | 'won' | 'draw';

export interface GomokuState {
  board: number[];
  turn: number; // 当前该谁落子
  status: GomokuStatus;
  winner: number; // 0 = 无
  last: number; // 最近一手 idx，-1 = 无
  moves: number;
}

export function createGame(): GomokuState {
  return { board: createBoard(), turn: BLACK, status: 'playing', winner: 0, last: -1, moves: 0 };
}

/** 在 idx 落下当前手方；成功则判胜负/和棋并翻手。返回是否落子成功。 */
export function playMove(s: GomokuState, idx: number): boolean {
  if (s.status !== 'playing') return false;
  if (idx < 0 || idx >= SIZE * SIZE || s.board[idx] !== EMPTY) return false;
  s.board[idx] = s.turn;
  s.last = idx;
  s.moves += 1;
  if (checkWin(s.board, idx, s.turn)) {
    s.status = 'won';
    s.winner = s.turn;
  } else if (s.moves === SIZE * SIZE) {
    s.status = 'draw';
  } else {
    s.turn = other(s.turn);
  }
  return true;
}
