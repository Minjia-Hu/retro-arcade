import { describe, it, expect } from 'vitest';
import {
  createBoard, BLACK, WHITE, EMPTY, CENTER, SIZE, checkWin,
} from '../src/games/gomoku/logic';
import {
  AI_LEVELS, evaluatePoint, candidates, findBestMove,
} from '../src/games/gomoku/ai';

const at = (x: number, y: number) => y * SIZE + x;

describe('gomoku ai', () => {
  it('three levels with increasing depth', () => {
    expect(AI_LEVELS.map((l) => l.id)).toEqual(['easy', 'medium', 'hard']);
    expect(AI_LEVELS[0].depth).toBeLessThan(AI_LEVELS[1].depth);
    expect(AI_LEVELS[1].depth).toBeLessThan(AI_LEVELS[2].depth);
  });

  it('evaluatePoint: five > open four > open three > open two', () => {
    const b = createBoard();
    b[at(4, 7)] = BLACK; b[at(5, 7)] = BLACK; b[at(6, 7)] = BLACK; b[at(7, 7)] = BLACK;
    const five = evaluatePoint(b, at(8, 7), BLACK); // completes five

    const b4 = createBoard();
    b4[at(4, 7)] = BLACK; b4[at(5, 7)] = BLACK; b4[at(6, 7)] = BLACK;
    const four = evaluatePoint(b4, at(7, 7), BLACK); // both ends open → open four

    const b3 = createBoard();
    b3[at(5, 7)] = BLACK; b3[at(6, 7)] = BLACK;
    const three = evaluatePoint(b3, at(7, 7), BLACK); // open three

    const b2 = createBoard();
    b2[at(6, 7)] = BLACK;
    const two = evaluatePoint(b2, at(7, 7), BLACK); // open two

    expect(five).toBeGreaterThan(four);
    expect(four).toBeGreaterThan(three);
    expect(three).toBeGreaterThan(two);
  });

  it('evaluatePoint: blocked four > open three — a four demands an answer, a three is only a threat', () => {
    const blocked = createBoard(); // ○●●●_ : filling it makes a four blocked on one end
    blocked[at(3, 7)] = WHITE;
    blocked[at(4, 7)] = BLACK; blocked[at(5, 7)] = BLACK; blocked[at(6, 7)] = BLACK;
    const four = evaluatePoint(blocked, at(7, 7), BLACK);

    const open = createBoard(); // _●●_ : filling it makes an open three
    open[at(5, 7)] = BLACK; open[at(6, 7)] = BLACK;
    const three = evaluatePoint(open, at(7, 7), BLACK);

    expect(four).toBeGreaterThan(three);
  });

  it('candidates: only the centre on an empty board; nearby empties otherwise, never occupied cells', () => {
    expect(candidates(createBoard())).toEqual([CENTER]);
    const b = createBoard();
    b[CENTER] = BLACK;
    const c = candidates(b);
    expect(c).not.toContain(CENTER); // occupied
    expect(c).toContain(at(8, 7)); // neighbour
    expect(c.every((i) => b[i] === EMPTY)).toBe(true);
  });

  it('findBestMove: plays the centre on an empty board', () => {
    expect(findBestMove(createBoard(), BLACK, 2)).toBe(CENTER);
  });

  it('findBestMove: returns an empty cell in bounds', () => {
    const b = createBoard();
    b[CENTER] = BLACK; b[at(8, 7)] = WHITE;
    const m = findBestMove(b, BLACK, 2);
    expect(m).toBeGreaterThanOrEqual(0);
    expect(m).toBeLessThan(225);
    expect(b[m]).toBe(EMPTY);
  });

  it('findBestMove: takes an immediate five at every depth', () => {
    for (const lvl of AI_LEVELS) {
      const b = createBoard();
      for (let x = 3; x <= 6; x++) b[at(x, 7)] = BLACK; // four black in a row
      const m = findBestMove(b, BLACK, lvl.depth);
      b[m] = BLACK;
      expect(checkWin(b, m, BLACK)).toBe(true);
    }
  });

  it('findBestMove: blocks the opponent\'s four (the only open end)', () => {
    const b = createBoard();
    for (let x = 4; x <= 7; x++) b[at(x, 7)] = WHITE; // four white in a row (columns 4–7)
    b[at(8, 7)] = BLACK; // right end already blocked by black
    // The left end (3,7) is white's only open end; black must block it
    const m = findBestMove(b, BLACK, AI_LEVELS[1].depth);
    expect(m).toBe(at(3, 7));
  });

  it('findBestMove: makes its own open four rather than a random move', () => {
    const b = createBoard();
    b[at(5, 7)] = BLACK; b[at(6, 7)] = BLACK; b[at(7, 7)] = BLACK; // black open three
    const m = findBestMove(b, BLACK, AI_LEVELS[2].depth);
    b[m] = BLACK;
    // After the move black has four in a row on row 7
    let run = 1;
    let x = (m % SIZE) + 1;
    while (x < SIZE && b[7 * SIZE + x] === BLACK) { run += 1; x += 1; }
    x = (m % SIZE) - 1;
    while (x >= 0 && b[7 * SIZE + x] === BLACK) { run += 1; x -= 1; }
    expect(run).toBeGreaterThanOrEqual(4);
  });

  it('findBestMove: answers the opponent\'s open three (hard looks ahead to block or counter)', () => {
    const b = createBoard();
    // White open three: columns 5–7 on row 7, both ends (4,7)(8,7) empty — unblocked it becomes an open four and loses
    b[at(5, 7)] = WHITE; b[at(6, 7)] = WHITE; b[at(7, 7)] = WHITE;
    const m = findBestMove(b, BLACK, AI_LEVELS[2].depth);
    // Black should play one of the extension ends (blocking the open four) or have an equivalent attack — black has no stones here, so it must block
    expect([at(4, 7), at(8, 7)]).toContain(m);
  });

  it('findBestMove: deterministic without rand; the same board gives the same move', () => {
    const b = createBoard();
    b[CENTER] = WHITE;
    const m1 = findBestMove(b, BLACK, 2);
    const m2 = findBestMove(b, BLACK, 2);
    expect(m1).toBe(m2); // no random injected → reproducible
    expect(b[m1]).toBe(EMPTY);
  });
});
