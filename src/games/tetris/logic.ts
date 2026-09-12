// Flat 10×20 board: 0 empty, 1–7 = piece type + 1.
// Shapes, rotation, line clearing and the gravity curve follow an earlier, proven implementation of the author's, ported to pure functions.
export const COLS = 10;
export const ROWS = 20;

export interface PieceDef {
  size: number; // side of the rotation bounding box
  spawn: [number, number][]; // spawn shape (SRS orientation)
}

// 0:I 1:O 2:T 3:S 4:Z 5:J 6:L
export const PIECE_DEFS: PieceDef[] = [
  { size: 4, spawn: [[0, 1], [1, 1], [2, 1], [3, 1]] },
  { size: 2, spawn: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  { size: 3, spawn: [[1, 0], [0, 1], [1, 1], [2, 1]] },
  { size: 3, spawn: [[1, 0], [2, 0], [0, 1], [1, 1]] },
  { size: 3, spawn: [[0, 0], [1, 0], [1, 1], [2, 1]] },
  { size: 3, spawn: [[0, 0], [0, 1], [1, 1], [2, 1]] },
  { size: 3, spawn: [[2, 0], [0, 1], [1, 1], [2, 1]] },
];

/** Any rotation derives from the spawn shape via the clockwise formula [size-1-y, x] (O is 2×2, so it's the identity) */
export function rotatedCells(type: number, rot: number): [number, number][] {
  const def = PIECE_DEFS[type];
  let cells = def.spawn;
  const r = ((rot % 4) + 4) % 4;
  for (let i = 0; i < r; i++) {
    cells = cells.map(([x, y]) => [def.size - 1 - y, x] as [number, number]);
  }
  return cells;
}

export interface Active {
  type: number;
  rot: number;
  x: number;
  y: number;
}

export type TetrisStatus = 'ready' | 'playing' | 'over';

export interface TetrisState {
  board: number[];
  current: Active;
  next: number;
  hold: number | null;
  holdUsed: boolean;
  bag: number[];
  score: number;
  lines: number;
  status: TetrisStatus;
  dropTimer: number;
}

export interface TetrisEvents {
  locked: boolean;
  cleared: number;
  over: boolean;
}

const noEvents = (): TetrisEvents => ({ locked: false, cleared: 0, over: false });

export function levelOf(lines: number): number {
  return Math.floor(lines / 10) + 1;
}

/** Geometrically decaying gravity: 0.8s × 0.82^(level-1), floor 0.08s */
export function dropInterval(lines: number): number {
  return Math.max(0.08, 0.8 * Math.pow(0.82, levelOf(lines) - 1));
}

function refillBag(s: TetrisState, rand: () => number): void {
  const types = [0, 1, 2, 3, 4, 5, 6];
  for (let i = types.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [types[i], types[j]] = [types[j], types[i]];
  }
  s.bag.push(...types);
}

/** Refill when the bag has fewer than 2, so the next preview is always valid */
export function drawFromBag(s: TetrisState, rand: () => number): number {
  if (s.bag.length < 2) refillBag(s, rand);
  return s.bag.shift()!;
}

function makeActive(type: number): Active {
  return { type, rot: 0, x: type === 1 ? 4 : 3, y: 0 };
}

export function createState(rand: () => number = Math.random): TetrisState {
  const s: TetrisState = {
    board: new Array<number>(COLS * ROWS).fill(0),
    current: { type: 0, rot: 0, x: 3, y: 0 },
    next: 0,
    hold: null,
    holdUsed: false,
    bag: [],
    score: 0,
    lines: 0,
    status: 'ready',
    dropTimer: 0,
  };
  s.current = makeActive(drawFromBag(s, rand));
  s.next = drawFromBag(s, rand);
  return s;
}

export function collides(board: number[], a: Active): boolean {
  for (const [cx, cy] of rotatedCells(a.type, a.rot)) {
    const x = a.x + cx;
    const y = a.y + cy;
    if (x < 0 || x >= COLS || y >= ROWS) return true;
    if (y >= 0 && board[y * COLS + x] !== 0) return true;
  }
  return false;
}

export function start(s: TetrisState): void {
  if (s.status === 'ready') s.status = 'playing';
}

export function move(s: TetrisState, dx: number): boolean {
  if (s.status !== 'playing') return false;
  const t = { ...s.current, x: s.current.x + dx };
  if (collides(s.board, t)) return false;
  s.current = t;
  return true;
}

const KICKS: [number, number][] = [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1]];

export function rotate(s: TetrisState): boolean {
  if (s.status !== 'playing') return false;
  for (const [kx, ky] of KICKS) {
    const t = { ...s.current, rot: (s.current.rot + 1) % 4, x: s.current.x + kx, y: s.current.y + ky };
    if (!collides(s.board, t)) {
      s.current = t;
      return true;
    }
  }
  return false;
}

export function softDrop(s: TetrisState): boolean {
  if (s.status !== 'playing') return false;
  const t = { ...s.current, y: s.current.y + 1 };
  if (collides(s.board, t)) return false;
  s.current = t;
  s.score += 1;
  return true;
}

export function hardDrop(s: TetrisState, rand: () => number = Math.random): TetrisEvents {
  if (s.status !== 'playing') return noEvents();
  let d = 0;
  while (!collides(s.board, { ...s.current, y: s.current.y + d + 1 })) d += 1;
  s.current = { ...s.current, y: s.current.y + d };
  s.score += d * 2;
  return lockPiece(s, rand);
}

export function holdPiece(s: TetrisState, rand: () => number = Math.random): boolean {
  if (s.status !== 'playing' || s.holdUsed) return false;
  if (s.hold === null) {
    s.hold = s.current.type;
    spawn(s, rand);
  } else {
    const prev = s.hold;
    s.hold = s.current.type;
    s.current = makeActive(prev);
    if (collides(s.board, s.current)) s.status = 'over';
  }
  s.holdUsed = true;
  return true;
}

function spawn(s: TetrisState, rand: () => number): void {
  s.current = makeActive(s.next);
  s.next = drawFromBag(s, rand);
  s.holdUsed = false;
  if (collides(s.board, s.current)) s.status = 'over';
}

const LINE_SCORES = [0, 100, 300, 500, 800];

function lockPiece(s: TetrisState, rand: () => number): TetrisEvents {
  const ev: TetrisEvents = { locked: true, cleared: 0, over: false };
  let aboveTop = false;
  for (const [cx, cy] of rotatedCells(s.current.type, s.current.rot)) {
    const y = s.current.y + cy;
    if (y < 0) {
      aboveTop = true;
      continue;
    }
    s.board[y * COLS + (s.current.x + cx)] = s.current.type + 1;
  }

  // Clear lines: keep the non-full rows, pad empty rows on top
  const rows: number[][] = [];
  for (let y = 0; y < ROWS; y++) {
    const row = s.board.slice(y * COLS, (y + 1) * COLS);
    if (!row.every((v) => v !== 0)) rows.push(row);
  }
  ev.cleared = ROWS - rows.length;
  while (rows.length < ROWS) rows.unshift(new Array<number>(COLS).fill(0));
  s.board = rows.flat();

  if (ev.cleared > 0) {
    s.score += LINE_SCORES[ev.cleared] * levelOf(s.lines); // scored at the level before the clear
    s.lines += ev.cleared;
  }

  // Two game-over checks: a locked cell above the top, or the new piece colliding on spawn
  if (aboveTop) {
    s.status = 'over';
    ev.over = true;
    return ev;
  }
  spawn(s, rand);
  if (s.status === 'over') ev.over = true;
  return ev;
}

export function tick(s: TetrisState, dt: number, rand: () => number = Math.random): TetrisEvents {
  if (s.status !== 'playing') return noEvents();
  s.dropTimer += dt;
  const ev = noEvents();
  while (s.dropTimer >= dropInterval(s.lines)) {
    s.dropTimer -= dropInterval(s.lines);
    const down = { ...s.current, y: s.current.y + 1 };
    if (!collides(s.board, down)) {
      s.current = down;
    } else {
      const e = lockPiece(s, rand);
      ev.locked = true;
      ev.cleared += e.cleared;
      ev.over = ev.over || e.over;
      if (ev.over) break;
    }
  }
  return ev;
}
