import { describe, it, expect } from 'vitest';
import {
  createState, reveal, toggleFlag, neighbors, computeAdjacency,
  DIFFICULTIES,
} from '../src/games/minesweeper/logic';

const EASY = DIFFICULTIES[0];
const zero = () => 0;

describe('minesweeper logic', () => {
  it('three tiers with the right parameters', () => {
    expect(DIFFICULTIES.map((d) => [d.cols, d.rows, d.mines])).toEqual([
      [9, 9, 10],
      [12, 16, 30],
      [16, 24, 80],
    ]);
  });

  it('initial state: ready, no mines, zero flags', () => {
    const s = createState(EASY);
    expect(s.status).toBe('ready');
    expect(s.grid).toHaveLength(81);
    expect(s.grid.every((c) => !c.mine && !c.revealed && !c.flagged)).toBe(true);
    expect(s.flags).toBe(0);
  });

  it('neighbors: 3 at a corner, 8 in the middle', () => {
    expect(neighbors(EASY, 0)).toHaveLength(3);
    expect(neighbors(EASY, 40)).toHaveLength(8);
  });

  it('the first click is never a mine (including its 8 neighbours), and the mine count is right', () => {
    const s = createState(EASY);
    reveal(s, 40, zero); // rand=0 is the adversarial sequence that most wants to put mines first
    expect(s.status).not.toBe('lost');
    expect(s.grid.filter((c) => c.mine)).toHaveLength(10);
    for (const i of [40, ...neighbors(EASY, 40)]) {
      expect(s.grid[i].mine).toBe(false);
    }
  });

  it('computeAdjacency: one mine in a corner gives its three neighbours adj 1', () => {
    const s = createState(EASY);
    s.grid[0].mine = true;
    computeAdjacency(s);
    expect(s.grid[1].adj).toBe(1);
    expect(s.grid[9].adj).toBe(1);
    expect(s.grid[10].adj).toBe(1);
    expect(s.grid[11].adj).toBe(0);
  });

  it('flood fill: on a one-mine board, revealing the far corner wins (all 80 cells open)', () => {
    const s = createState(EASY);
    s.grid[0].mine = true;
    computeAdjacency(s);
    s.status = 'playing';
    const ev = reveal(s, 80, zero);
    expect(ev.won).toBe(true);
    expect(s.status).toBe('won');
    expect(s.revealed).toBe(80);
    expect(s.grid[0].revealed).toBe(false); // the mine itself is not revealed
  });

  it('flood fill skips flagged cells: no win while the flag stays, win after unflagging and revealing', () => {
    const s = createState(EASY);
    s.grid[0].mine = true;
    computeAdjacency(s);
    s.status = 'playing';
    toggleFlag(s, 44);
    reveal(s, 80, zero);
    expect(s.status).toBe('playing');
    expect(s.revealed).toBe(79);
    expect(s.grid[44].revealed).toBe(false);
    toggleFlag(s, 44);
    const ev = reveal(s, 44, zero);
    expect(ev.won).toBe(true);
  });

  it('hitting a mine: lost, exploded event, every mine revealed', () => {
    const s = createState(EASY);
    s.grid[0].mine = true;
    s.grid[17].mine = true;
    computeAdjacency(s);
    s.status = 'playing';
    const ev = reveal(s, 0, zero);
    expect(ev.exploded).toBe(true);
    expect(s.status).toBe('lost');
    expect(s.grid[0].revealed).toBe(true);
    expect(s.grid[17].revealed).toBe(true);
  });

  it('flag toggling and counting; revealed cells cannot be flagged', () => {
    const s = createState(EASY);
    expect(toggleFlag(s, 3)).toBe(true);
    expect(s.flags).toBe(1);
    expect(toggleFlag(s, 3)).toBe(true);
    expect(s.flags).toBe(0);
    s.grid[5].revealed = true;
    expect(toggleFlag(s, 5)).toBe(false);
  });

  it('a flagged cell cannot be revealed', () => {
    const s = createState(EASY);
    s.grid[0].mine = true;
    computeAdjacency(s);
    s.status = 'playing';
    toggleFlag(s, 0);
    const ev = reveal(s, 0, zero);
    expect(ev.exploded).toBe(false);
    expect(s.status).toBe('playing');
  });

  it('after the game ends, reveal and toggleFlag are both rejected', () => {
    const s = createState(EASY);
    s.grid[0].mine = true;
    computeAdjacency(s);
    s.status = 'playing';
    reveal(s, 0, zero); // lost
    const ev = reveal(s, 40, zero);
    expect(ev.revealedSome).toBe(false);
    expect(toggleFlag(s, 40)).toBe(false);
  });

  it('revealing an already-revealed cell is an eventless no-op', () => {
    const s = createState(EASY);
    s.grid[0].mine = true;
    computeAdjacency(s);
    s.status = 'playing';
    reveal(s, 80, zero);
    const ev = reveal(s, 80, zero);
    expect(ev.revealedSome).toBe(false);
    expect(ev.won).toBe(false);
  });

  it('winning via the production path: placeMines then revealing every non-mine cell', () => {
    const s = createState(EASY);
    reveal(s, 40, zero); // zero rand puts the mines deterministically at 0..9
    for (let i = 0; i < s.grid.length; i++) {
      const c = s.grid[i];
      if (!c.mine && !c.revealed) reveal(s, i, zero);
    }
    expect(s.status).toBe('won');
    expect(s.revealed).toBe(71);
  });

  it('flagging while ready: clicking a flagged cell does not place mines', () => {
    const s = createState(EASY);
    toggleFlag(s, 40);
    const ev = reveal(s, 40, zero);
    expect(ev.revealedSome).toBe(false);
    expect(s.status).toBe('ready');
    expect(s.grid.every((c) => !c.mine)).toBe(true);
  });
});
