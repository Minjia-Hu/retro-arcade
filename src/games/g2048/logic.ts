// 4×4 board as a flat row-major array; 0 is empty
export const SIZE = 4;

export type Board = number[]; // length 16
export type Dir = 'up' | 'down' | 'left' | 'right';
export type G2048Status = 'playing' | 'won' | 'over'; // won = just reached 2048, hasn't chosen to continue yet

export interface G2048State {
  board: Board;
  score: number;
  status: G2048Status;
  keepPlaying: boolean; // chose to keep going after 2048
  /**
   * Random source for new tiles. Undo must restore it too: otherwise undo + the same move
   * rerolls the tile, a free reroll. The same board and the same move always spawn the same tile.
   */
  seed: number;
  prev: { board: Board; score: number; seed: number } | null; // single-level undo
}

/** mulberry32: advance s.seed and return [0,1). Used only when move() gets no rand */
function nextRand(s: G2048State): number {
  s.seed = (s.seed + 0x6d2b79f5) | 0;
  let t = s.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
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
  // The seed is drawn after the two opening tiles, so injected test sequences are unaffected
  const seed = Math.floor(rand() * 4294967296) | 0;
  return { board, score: 0, status: 'playing', keepPlaying: false, seed, prev: null };
}

/** Compress and merge one line to the left; a tile merges at most once per move */
export function slideLine(line: number[]): { line: number[]; gained: number } {
  const tiles = line.filter((v) => v !== 0);
  const out: number[] = [];
  let gained = 0;
  for (let i = 0; i < tiles.length; i++) {
    if (i + 1 < tiles.length && tiles[i] === tiles[i + 1]) {
      out.push(tiles[i] * 2);
      gained += tiles[i] * 2;
      i++; // skip the tile that was merged in
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
    // Cell indices of line i, ordered from the "front" to the "back" of the move
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

/**
 * Try one move; only an actual move spawns a tile, records the undo point and checks the
 * outcome. Returns whether anything moved. `rand` is for tests; production omits it and uses
 * the state's own seed (see the seed comment).
 */
export function move(s: G2048State, dir: Dir, rand?: () => number): boolean {
  if (s.status !== 'playing') return false; // the won screen needs "continue" or undo first
  const r = moveBoard(s.board, dir);
  if (!r.moved) return false;
  s.prev = { board: s.board, score: s.score, seed: s.seed };
  s.board = spawnTile(r.board, rand ?? (() => nextRand(s)));
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

/** Undo one move (also out of won/over); single level */
export function undo(s: G2048State): boolean {
  if (!s.prev) return false;
  s.board = s.prev.board;
  s.score = s.prev.score;
  s.seed = s.prev.seed;
  s.prev = null;
  s.status = 'playing';
  return true;
}
