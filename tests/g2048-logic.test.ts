import { describe, it, expect } from 'vitest';
import {
  createState, emptyBoard, slideLine, moveBoard, spawnTile, canMove,
  move, continueAfterWin, undo, SIZE,
} from '../src/games/g2048/logic';

// 依序返回给定值的 rand（用完循环）
const seq = (...vals: number[]) => {
  let i = 0;
  return () => vals[i++ % vals.length];
};

describe('2048 logic', () => {
  it('初始状态：两个初始砖、零分、playing、无撤销', () => {
    const s = createState(seq(0, 0, 0, 0));
    expect(s.board.filter((v) => v !== 0)).toHaveLength(2);
    expect(s.score).toBe(0);
    expect(s.status).toBe('playing');
    expect(s.prev).toBeNull();
  });

  it('slideLine 压缩合并：[0,2,0,2] → [4,0,0,0] 得 4 分', () => {
    expect(slideLine([0, 2, 0, 2])).toEqual({ line: [4, 0, 0, 0], gained: 4 });
  });

  it('slideLine 两对同时合并：[2,2,2,2] → [4,4,0,0] 得 8 分', () => {
    expect(slideLine([2, 2, 2, 2])).toEqual({ line: [4, 4, 0, 0], gained: 8 });
  });

  it('slideLine 单次合并不连锁：[4,2,2,0] → [4,4,0,0] 得 4 分', () => {
    expect(slideLine([4, 2, 2, 0])).toEqual({ line: [4, 4, 0, 0], gained: 4 });
  });

  it('moveBoard 向右', () => {
    const b = emptyBoard();
    b[0] = 2; b[3] = 2; // 第一行 [2,0,0,2]
    const r = moveBoard(b, 'right');
    expect(r.board.slice(0, 4)).toEqual([0, 0, 0, 4]);
    expect(r.gained).toBe(4);
    expect(r.moved).toBe(true);
  });

  it('moveBoard 向上', () => {
    const b = emptyBoard();
    b[0] = 2; b[8] = 2; // 第一列 [2,0,2,0]
    const r = moveBoard(b, 'up');
    expect(r.board[0]).toBe(4);
    expect(r.board[8]).toBe(0);
  });

  it('moveBoard 向下', () => {
    const b = emptyBoard();
    b[0] = 2; b[8] = 2;
    const r = moveBoard(b, 'down');
    expect(r.board[12]).toBe(4);
    expect(r.board[0]).toBe(0);
  });

  it('无效方向的 move 返回 false 且不生砖不记撤销', () => {
    const s = createState(seq(0, 0, 0, 0)); // 砖在 0、1 号格
    const before = s.board.slice();
    expect(move(s, 'up', seq(0, 0))).toBe(false); // 已在顶行，向上无变化
    expect(s.board).toEqual(before);
    expect(s.prev).toBeNull();
  });

  it('有效 move：合并计分、恰好生一块新砖、记录撤销点', () => {
    const s = createState(seq(0, 0, 0, 0)); // [2,2,0,...]
    expect(move(s, 'left', seq(0, 0))).toBe(true);
    expect(s.board[0]).toBe(4);
    expect(s.score).toBe(4);
    expect(s.board.filter((v) => v !== 0)).toHaveLength(2); // 合并后 1 块 + 新生 1 块
    expect(s.prev).not.toBeNull();
  });

  it('undo 恢复棋盘与分数，仅一层', () => {
    const s = createState(seq(0, 0, 0, 0));
    const before = s.board.slice();
    move(s, 'left', seq(0, 0));
    expect(undo(s)).toBe(true);
    expect(s.board).toEqual(before);
    expect(s.score).toBe(0);
    expect(undo(s)).toBe(false);
  });

  it('spawnTile：rand 值 ≥0.9 生成 4', () => {
    const b = spawnTile(emptyBoard(), seq(0, 0.95));
    expect(b[0]).toBe(4);
  });

  it('canMove：满盘无可合并为 false，有相邻同值为 true', () => {
    const dead = [2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 2];
    expect(canMove(dead)).toBe(false);
    const alive = dead.slice();
    alive[15] = 4; // 与左邻 4 相邻同值
    expect(canMove(alive)).toBe(true);
  });

  it('合出 2048 置为 won', () => {
    const s = createState(seq(0, 0, 0, 0));
    s.board = emptyBoard();
    s.board[0] = 1024; s.board[1] = 1024;
    move(s, 'left', seq(0, 0));
    expect(s.status).toBe('won');
  });

  it('continueAfterWin 后继续游戏，再合 2048 不再触发 won', () => {
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

  it('生砖后无路可走置为 over', () => {
    const s = createState(seq(0, 0, 0, 0));
    s.board = [
      2, 4, 2, 4,
      4, 2, 4, 2,
      2, 4, 2, 4,
      0, 4, 2, 4,
    ];
    // 向左：末行 [0,4,2,4] → [4,2,4,0]，唯一空格生 2 → 棋盘成完整棋盘格
    move(s, 'left', seq(0, 0));
    expect(s.board).toEqual([
      2, 4, 2, 4,
      4, 2, 4, 2,
      2, 4, 2, 4,
      4, 2, 4, 2,
    ]);
    expect(s.status).toBe('over');
  });

  it('SIZE 恒为 4（渲染层依赖）', () => {
    expect(SIZE).toBe(4);
  });

  it('undo 可从 won 退回 playing，重新合出 2048 会再次胜利', () => {
    const s = createState(seq(0, 0, 0, 0));
    s.board = emptyBoard();
    s.board[0] = 1024; s.board[1] = 1024;
    move(s, 'left', seq(0, 0));
    expect(s.status).toBe('won');
    expect(undo(s)).toBe(true);
    expect(s.status).toBe('playing');
    move(s, 'left', seq(0, 0));
    expect(s.status).toBe('won'); // 未曾选择继续，再次达成应再次提示
  });

  it('非 playing 状态下 move 被拒绝', () => {
    const s = createState(seq(0, 0, 0, 0));
    s.board = emptyBoard();
    s.board[0] = 1024; s.board[1] = 1024;
    move(s, 'left', seq(0, 0)); // → won
    const before = s.board.slice();
    expect(move(s, 'right', seq(0, 0))).toBe(false);
    expect(s.board).toEqual(before);
  });
});
