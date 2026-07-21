import { describe, it, expect } from 'vitest';
import {
  createBoard, BLACK, WHITE, EMPTY, CENTER, SIZE, checkWin,
} from '../src/games/gomoku/logic';
import {
  AI_LEVELS, evaluatePoint, candidates, findBestMove,
} from '../src/games/gomoku/ai';

const at = (x: number, y: number) => y * SIZE + x;

describe('gomoku ai', () => {
  it('三档难度：深度递增', () => {
    expect(AI_LEVELS.map((l) => l.id)).toEqual(['easy', 'medium', 'hard']);
    expect(AI_LEVELS[0].depth).toBeLessThan(AI_LEVELS[1].depth);
    expect(AI_LEVELS[1].depth).toBeLessThan(AI_LEVELS[2].depth);
  });

  it('evaluatePoint：成五 > 活四 > 活三 > 活二', () => {
    const b = createBoard();
    b[at(4, 7)] = BLACK; b[at(5, 7)] = BLACK; b[at(6, 7)] = BLACK; b[at(7, 7)] = BLACK;
    const five = evaluatePoint(b, at(8, 7), BLACK); // 补成五

    const b4 = createBoard();
    b4[at(4, 7)] = BLACK; b4[at(5, 7)] = BLACK; b4[at(6, 7)] = BLACK;
    const four = evaluatePoint(b4, at(7, 7), BLACK); // 两端空 → 活四

    const b3 = createBoard();
    b3[at(5, 7)] = BLACK; b3[at(6, 7)] = BLACK;
    const three = evaluatePoint(b3, at(7, 7), BLACK); // 活三

    const b2 = createBoard();
    b2[at(6, 7)] = BLACK;
    const two = evaluatePoint(b2, at(7, 7), BLACK); // 活二

    expect(five).toBeGreaterThan(four);
    expect(four).toBeGreaterThan(three);
    expect(three).toBeGreaterThan(two);
  });

  it('candidates：空盘只有天元；有子时取邻近空格且不含已占', () => {
    expect(candidates(createBoard())).toEqual([CENTER]);
    const b = createBoard();
    b[CENTER] = BLACK;
    const c = candidates(b);
    expect(c).not.toContain(CENTER); // 已占
    expect(c).toContain(at(8, 7)); // 邻格
    expect(c.every((i) => b[i] === EMPTY)).toBe(true);
  });

  it('findBestMove：空盘落天元', () => {
    expect(findBestMove(createBoard(), BLACK, 2)).toBe(CENTER);
  });

  it('findBestMove：返回界内空格', () => {
    const b = createBoard();
    b[CENTER] = BLACK; b[at(8, 7)] = WHITE;
    const m = findBestMove(b, BLACK, 2);
    expect(m).toBeGreaterThanOrEqual(0);
    expect(m).toBeLessThan(225);
    expect(b[m]).toBe(EMPTY);
  });

  it('findBestMove：有连五机会时直接制胜（各档深度）', () => {
    for (const lvl of AI_LEVELS) {
      const b = createBoard();
      for (let x = 3; x <= 6; x++) b[at(x, 7)] = BLACK; // 黑四连
      const m = findBestMove(b, BLACK, lvl.depth);
      b[m] = BLACK;
      expect(checkWin(b, m, BLACK)).toBe(true);
    }
  });

  it('findBestMove：挡掉对手的冲四（唯一活口）', () => {
    const b = createBoard();
    for (let x = 4; x <= 7; x++) b[at(x, 7)] = WHITE; // 白四连（列 4-7）
    b[at(8, 7)] = BLACK; // 右端已被黑封
    // 左端 (3,7) 为白唯一活口，黑必须堵这里
    const m = findBestMove(b, BLACK, AI_LEVELS[1].depth);
    expect(m).toBe(at(3, 7));
  });

  it('findBestMove：会抢先做出自己的活四而非随手', () => {
    const b = createBoard();
    b[at(5, 7)] = BLACK; b[at(6, 7)] = BLACK; b[at(7, 7)] = BLACK; // 黑活三
    const m = findBestMove(b, BLACK, AI_LEVELS[2].depth);
    b[m] = BLACK;
    // 落子后黑在第 7 行形成四连
    let run = 1;
    let x = (m % SIZE) + 1;
    while (x < SIZE && b[7 * SIZE + x] === BLACK) { run += 1; x += 1; }
    x = (m % SIZE) - 1;
    while (x >= 0 && b[7 * SIZE + x] === BLACK) { run += 1; x -= 1; }
    expect(run).toBeGreaterThanOrEqual(4);
  });

  it('findBestMove：应对对手活三（困难档前瞻封堵或反制）', () => {
    const b = createBoard();
    // 白活三：列 5-7 第 7 行，两端 (4,7)(8,7) 皆空 —— 不堵将成活四必败
    b[at(5, 7)] = WHITE; b[at(6, 7)] = WHITE; b[at(7, 7)] = WHITE;
    const m = findBestMove(b, BLACK, AI_LEVELS[2].depth);
    // 黑应落在白活三的延展端之一（堵活四），或己方已有等价强攻——此处黑无子，必为封堵
    expect([at(4, 7), at(8, 7)]).toContain(m);
  });

  it('findBestMove：省略 rand 时确定；相同盘面重复调用结果一致', () => {
    const b = createBoard();
    b[CENTER] = WHITE;
    const m1 = findBestMove(b, BLACK, 2);
    const m2 = findBestMove(b, BLACK, 2);
    expect(m1).toBe(m2); // 无随机注入 → 可复现
    expect(b[m1]).toBe(EMPTY);
  });
});
