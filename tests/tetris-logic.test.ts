import { describe, it, expect } from 'vitest';
import {
  createState, start, move, rotate, softDrop, hardDrop, holdPiece, tick,
  rotatedCells, drawFromBag, dropInterval, COLS, ROWS,
} from '../src/games/tetris/logic';

const zero = () => 0;
const sortCells = (c: [number, number][]) => [...c].sort((a, b) => a[0] - b[0] || a[1] - b[1]);

describe('tetris logic', () => {
  it('initial state: empty board, ready, current and next pieces, no hold', () => {
    const s = createState(zero);
    expect(s.board).toHaveLength(COLS * ROWS);
    expect(s.board.every((v) => v === 0)).toBe(true);
    expect(s.status).toBe('ready');
    expect(s.current.type).toBeGreaterThanOrEqual(0);
    expect(s.next).toBeGreaterThanOrEqual(0);
    expect(s.hold).toBeNull();
    expect(s.score).toBe(0);
  });

  it('7-bag: 14 draws give each piece exactly twice', () => {
    const s = createState(zero);
    const types = [s.current.type, s.next];
    for (let i = 0; i < 12; i++) types.push(drawFromBag(s, zero));
    const counts = new Array(7).fill(0);
    for (const t of types) counts[t] += 1;
    expect(counts).toEqual([2, 2, 2, 2, 2, 2, 2]);
  });

  it('rotation formula: T once clockwise and I twice are correct', () => {
    expect(sortCells(rotatedCells(2, 1))).toEqual(sortCells([[1, 0], [1, 1], [2, 1], [1, 2]]));
    expect(sortCells(rotatedCells(0, 2))).toEqual(sortCells([[0, 2], [1, 2], [2, 2], [3, 2]]));
  });

  it('rotating O is the identity', () => {
    for (let r = 1; r < 4; r++) {
      expect(sortCells(rotatedCells(1, r))).toEqual(sortCells(rotatedCells(1, 0)));
    }
  });

  it('moving left stops at the wall', () => {
    const s = createState(zero);
    start(s);
    s.current = { type: 0, rot: 0, x: 3, y: 0 }; // horizontal I, columns 3–6
    expect(move(s, -1)).toBe(true);
    expect(move(s, -1)).toBe(true);
    expect(move(s, -1)).toBe(true); // x = 0, columns 0–3
    expect(move(s, -1)).toBe(false);
    expect(s.current.x).toBe(0);
  });

  it('rotating against the wall kicks; every cell stays in bounds', () => {
    const s = createState(zero);
    start(s);
    s.current = { type: 0, rot: 1, x: -2, y: 5 }; // vertical I against the left wall (absolute column 0)
    expect(rotate(s)).toBe(true);
    for (const [cx] of rotatedCells(s.current.type, s.current.rot)) {
      expect(s.current.x + cx).toBeGreaterThanOrEqual(0);
      expect(s.current.x + cx).toBeLessThan(COLS);
    }
  });

  it('gravity: y+1 after one drop interval accumulates', () => {
    const s = createState(zero);
    start(s);
    const y0 = s.current.y;
    tick(s, dropInterval(0), zero);
    expect(s.current.y).toBe(y0 + 1);
  });

  it('tick while ready does nothing', () => {
    const s = createState(zero);
    const y0 = s.current.y;
    tick(s, 10, zero);
    expect(s.current.y).toBe(y0);
  });

  it('soft drop: one cell down and +1', () => {
    const s = createState(zero);
    start(s);
    expect(softDrop(s)).toBe(true);
    expect(s.score).toBe(1);
  });

  it('hard drop: locks at the bottom, +2×distance, spawns the next piece', () => {
    const s = createState(zero); // zero rand: the current piece is O (type 1)
    start(s);
    const ev = hardDrop(s, zero);
    expect(ev.locked).toBe(true);
    expect(s.board.filter((v) => v !== 0)).toHaveLength(4);
    expect(s.score).toBe(36); // 18 cells × 2 from y=0 (every spawn shape's max row offset is 1, so the distance is piece-independent)
    expect(s.current).not.toBeNull();
  });

  it('single line clear: 100×level, rows shift down', () => {
    const s = createState(zero);
    start(s);
    for (let x = 0; x < COLS; x++) if (x !== 4 && x !== 5) s.board[19 * COLS + x] = 3;
    s.current = { type: 1, rot: 0, x: 4, y: 18 }; // O covers columns x+0/x+1; x=4 fills the hole at columns 4/5
    const ev = hardDrop(s, zero);
    expect(ev.cleared).toBe(1);
    expect(s.lines).toBe(1);
    expect(s.score).toBe(100);
    expect(s.board[19 * COLS + 4]).toBe(2); // the O remnant from row 18 dropped to row 19
    expect(s.board[19 * COLS + 0]).toBe(0); // the full row's filler is gone
  });

  it('a four-line clear (Tetris) scores 800', () => {
    const s = createState(zero);
    start(s);
    for (let y = 16; y < 20; y++) {
      for (let x = 1; x < COLS; x++) s.board[y * COLS + x] = 3;
    }
    s.current = { type: 0, rot: 1, x: -2, y: 16 }; // vertical I in column 0 completes rows 16–19
    const ev = hardDrop(s, zero);
    expect(ev.cleared).toBe(4);
    expect(s.score).toBe(800);
    expect(s.board.every((v) => v === 0)).toBe(true);
  });

  it('an occupied spawn position is game over', () => {
    const s = createState(zero);
    start(s);
    s.board[1 * COLS + 4] = 3; // every spawn shape covers (4,1), regardless of bag order
    s.current = { type: 1, rot: 0, x: 0, y: 18 }; // the current piece is far from the spawn area and locks at the bottom
    const ev = hardDrop(s, zero);
    expect(ev.over).toBe(true);
    expect(s.status).toBe('over');
  });

  it('Hold: stores the current piece, once per drop, available again after lock', () => {
    const s = createState(zero);
    start(s);
    const t0 = s.current.type;
    const t1 = s.next;
    expect(holdPiece(s, zero)).toBe(true);
    expect(s.hold).toBe(t0);
    expect(s.current.type).toBe(t1);
    expect(holdPiece(s, zero)).toBe(false); // already used this drop
    hardDrop(s, zero);
    expect(holdPiece(s, zero)).toBe(true); // available again after lock
  });

  it('Hold swap: the second hold brings back the first stored piece', () => {
    const s = createState(zero);
    start(s);
    const t0 = s.current.type;
    holdPiece(s, zero);
    hardDrop(s, zero);
    holdPiece(s, zero);
    expect(s.current.type).toBe(t0);
  });

  it('the drop interval decays geometrically with level and has a floor', () => {
    expect(dropInterval(0)).toBeGreaterThan(dropInterval(10));
    expect(dropInterval(10)).toBeGreaterThan(dropInterval(20));
    expect(dropInterval(1000)).toBe(dropInterval(2000));
    expect(dropInterval(1000)).toBeGreaterThanOrEqual(0.08);
  });
});
