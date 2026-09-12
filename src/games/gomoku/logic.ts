// 15×15 Gomoku as a flat 225-array. Freestyle: five or more in a row wins, no forbidden moves.
export const SIZE = 15;
export const EMPTY = 0;
export const BLACK = 1;
export const WHITE = 2;
export const CENTER = 7 * SIZE + 7; // 112, the centre point

// Four directions: horizontal, vertical, main diagonal, anti-diagonal
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

/** Whether any of the four lines through idx has ≥5 in a row (idx assumed to be player's) */
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
  turn: number; // whose move it is
  status: GomokuStatus;
  winner: number; // 0 = none
  last: number; // index of the last move, -1 = none
  moves: number;
}

export function createGame(): GomokuState {
  return { board: createBoard(), turn: BLACK, status: 'playing', winner: 0, last: -1, moves: 0 };
}

/** Place the current player's stone at idx; on success check win/draw and switch turns. Returns whether the move was made. */
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
