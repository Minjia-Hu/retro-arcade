import { describe, it, expect } from 'vitest';
import {
  createState, emptyBoard, slideLine, moveBoard, spawnTile, canMove,
  move, continueAfterWin, undo, SIZE,
} from '../src/games/g2048/logic';

// A rand that returns the given values in order (cycling when exhausted)
const seq = (...vals: number[]) => {
  let i = 0;
  return () => vals[i++ % vals.length];
};

describe('2048 logic', () => {
  it('initial state: two tiles, zero score, playing, no undo', () => {
    const s = createState(seq(0, 0, 0, 0));
    expect(s.board.filter((v) => v !== 0)).toHaveLength(2);
    expect(s.score).toBe(0);
    expect(s.status).toBe('playing');
    expect(s.prev).toBeNull();
  });

  it('slideLine compresses and merges: [0,2,0,2] → [4,0,0,0] scores 4', () => {
    expect(slideLine([0, 2, 0, 2])).toEqual({ line: [4, 0, 0, 0], gained: 4 });
  });

  it('slideLine merges two pairs: [2,2,2,2] → [4,4,0,0] scores 8', () => {
    expect(slideLine([2, 2, 2, 2])).toEqual({ line: [4, 4, 0, 0], gained: 8 });
  });

  it('slideLine does not chain merges: [4,2,2,0] → [4,4,0,0] scores 4', () => {
    expect(slideLine([4, 2, 2, 0])).toEqual({ line: [4, 4, 0, 0], gained: 4 });
  });

  it('moveBoard right', () => {
    const b = emptyBoard();
    b[0] = 2; b[3] = 2; // first row [2,0,0,2]
    const r = moveBoard(b, 'right');
    expect(r.board.slice(0, 4)).toEqual([0, 0, 0, 4]);
    expect(r.gained).toBe(4);
    expect(r.moved).toBe(true);
  });

  it('moveBoard up', () => {
    const b = emptyBoard();
    b[0] = 2; b[8] = 2; // first column [2,0,2,0]
    const r = moveBoard(b, 'up');
    expect(r.board[0]).toBe(4);
    expect(r.board[8]).toBe(0);
  });

  it('moveBoard down', () => {
    const b = emptyBoard();
    b[0] = 2; b[8] = 2;
    const r = moveBoard(b, 'down');
    expect(r.board[12]).toBe(4);
    expect(r.board[0]).toBe(0);
  });

  it('a move that changes nothing returns false, spawns nothing and records no undo', () => {
    const s = createState(seq(0, 0, 0, 0)); // tiles at cells 0 and 1
    const before = s.board.slice();
    expect(move(s, 'up', seq(0, 0))).toBe(false); // already on the top row; up changes nothing
    expect(s.board).toEqual(before);
    expect(s.prev).toBeNull();
  });

  it('a real move: merges score, exactly one new tile, undo point recorded', () => {
    const s = createState(seq(0, 0, 0, 0)); // [2,2,0,...]
    expect(move(s, 'left', seq(0, 0))).toBe(true);
    expect(s.board[0]).toBe(4);
    expect(s.score).toBe(4);
    expect(s.board.filter((v) => v !== 0)).toHaveLength(2); // 1 merged + 1 spawned
    expect(s.prev).not.toBeNull();
  });

  it('undo restores board and score, one level only', () => {
    const s = createState(seq(0, 0, 0, 0));
    const before = s.board.slice();
    move(s, 'left', seq(0, 0));
    expect(undo(s)).toBe(true);
    expect(s.board).toEqual(before);
    expect(s.score).toBe(0);
    expect(undo(s)).toBe(false);
  });

  it('spawnTile: rand ≥0.9 spawns a 4', () => {
    const b = spawnTile(emptyBoard(), seq(0, 0.95));
    expect(b[0]).toBe(4);
  });

  it('canMove: a full board with no merges is false, adjacent equals is true', () => {
    const dead = [2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 2];
    expect(canMove(dead)).toBe(false);
    const alive = dead.slice();
    alive[15] = 4; // equal to its left neighbour 4
    expect(canMove(alive)).toBe(true);
  });

  it('making 2048 sets won', () => {
    const s = createState(seq(0, 0, 0, 0));
    s.board = emptyBoard();
    s.board[0] = 1024; s.board[1] = 1024;
    move(s, 'left', seq(0, 0));
    expect(s.status).toBe('won');
  });

  it('after continueAfterWin the game goes on; another 2048 does not trigger won', () => {
    const s = createState(seq(0, 0, 0, 0));
    s.board = emptyBoard();
    s.board[0] = 1024; s.board[1] = 1024;
    move(s, 'left', seq(0, 0));
    continueAfterWin(s);
    expect(s.status).toBe('playing');
    expect(s.keepPlaying).toBe(true);
    s.board = emptyBoard();
    s.board[0] = 1024; s.board[1] = 1024;
    move(s, 'left', seq(0, 0));
    expect(s.status).toBe('playing');
  });

  it('no moves left after a spawn sets over', () => {
    const s = createState(seq(0, 0, 0, 0));
    s.board = [
      2, 4, 2, 4,
      4, 2, 4, 2,
      2, 4, 2, 4,
      0, 4, 2, 4,
    ];
    // Left: last row [0,4,2,4] → [4,2,4,0], the only empty cell gets a 2 → a full checkerboard
    move(s, 'left', seq(0, 0));
    expect(s.board).toEqual([
      2, 4, 2, 4,
      4, 2, 4, 2,
      2, 4, 2, 4,
      4, 2, 4, 2,
    ]);
    expect(s.status).toBe('over');
  });

  it('undo then the same move spawns the same tile — undo is not a reroll', () => {
    const s = createState(seq(0, 0, 0, 0));
    s.board = emptyBoard();
    s.board[0] = 2; s.board[5] = 4; s.board[10] = 8; s.board[15] = 16;
    expect(move(s, 'left')).toBe(true); // no rand: uses the state's own seed
    const first = s.board.slice();
    expect(undo(s)).toBe(true);
    expect(move(s, 'left')).toBe(true);
    expect(s.board).toEqual(first);
  });

  it('without rand, consecutive moves draw different randoms (the seed advances)', () => {
    const s = createState(seq(0, 0, 0, 0));
    s.board = emptyBoard();
    s.board[3] = 2;
    move(s, 'down');
    const a = s.board.slice();
    const t = createState(seq(0, 0, 0, 0));
    t.board = emptyBoard();
    t.board[3] = 2;
    move(t, 'down');
    expect(t.board).toEqual(a); // same seed, same board → same result (deterministic)
    const seedAfterFirst = t.seed;
    const sumBefore = t.board.reduce((n, v) => n + v, 0);
    // Two tiles can always move in some direction; where the new tile lands and whether it merges depends on the seed, so check the sum, not the count
    expect((['up', 'left', 'right', 'down'] as const).some((d) => move(t, d))).toBe(true);
    expect(t.board.reduce((n, v) => n + v, 0)).toBeGreaterThan(sumBefore); // the second move spawned again
    expect(t.seed).not.toBe(seedAfterFirst); // the seed advanced
  });

  it('SIZE is always 4 (the renderer depends on it)', () => {
    expect(SIZE).toBe(4);
  });

  it('undo returns from won to playing; making 2048 again wins again', () => {
    const s = createState(seq(0, 0, 0, 0));
    s.board = emptyBoard();
    s.board[0] = 1024; s.board[1] = 1024;
    move(s, 'left', seq(0, 0));
    expect(s.status).toBe('won');
    expect(undo(s)).toBe(true);
    expect(s.status).toBe('playing');
    move(s, 'left', seq(0, 0));
    expect(s.status).toBe('won'); // never chose to continue, so reaching it again prompts again
  });

  it('move is rejected outside playing', () => {
    const s = createState(seq(0, 0, 0, 0));
    s.board = emptyBoard();
    s.board[0] = 1024; s.board[1] = 1024;
    move(s, 'left', seq(0, 0)); // → won
    const before = s.board.slice();
    expect(move(s, 'right', seq(0, 0))).toBe(false);
    expect(s.board).toEqual(before);
  });
});
