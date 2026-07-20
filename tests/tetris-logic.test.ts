import { describe, it, expect } from 'vitest';
import {
  createState, start, move, rotate, softDrop, hardDrop, holdPiece, tick,
  rotatedCells, drawFromBag, dropInterval, COLS, ROWS,
} from '../src/games/tetris/logic';

const zero = () => 0;
const sortCells = (c: [number, number][]) => [...c].sort((a, b) => a[0] - b[0] || a[1] - b[1]);

describe('tetris logic', () => {
  it('初始状态：空板、ready、有当前块与预览块、无暂存', () => {
    const s = createState(zero);
    expect(s.board).toHaveLength(COLS * ROWS);
    expect(s.board.every((v) => v === 0)).toBe(true);
    expect(s.status).toBe('ready');
    expect(s.current.type).toBeGreaterThanOrEqual(0);
    expect(s.next).toBeGreaterThanOrEqual(0);
    expect(s.hold).toBeNull();
    expect(s.score).toBe(0);
  });

  it('7-bag：连续 14 次抽取，每种方块恰好两次', () => {
    const s = createState(zero);
    const types = [s.current.type, s.next];
    for (let i = 0; i < 12; i++) types.push(drawFromBag(s, zero));
    const counts = new Array(7).fill(0);
    for (const t of types) counts[t] += 1;
    expect(counts).toEqual([2, 2, 2, 2, 2, 2, 2]);
  });

  it('旋转公式：T 顺时针一次、I 两次的形状正确', () => {
    expect(sortCells(rotatedCells(2, 1))).toEqual(sortCells([[1, 0], [1, 1], [2, 1], [1, 2]]));
    expect(sortCells(rotatedCells(0, 2))).toEqual(sortCells([[0, 2], [1, 2], [2, 2], [3, 2]]));
  });

  it('O 块旋转是恒等变换', () => {
    for (let r = 1; r < 4; r++) {
      expect(sortCells(rotatedCells(1, r))).toEqual(sortCells(rotatedCells(1, 0)));
    }
  });

  it('左移到墙停住', () => {
    const s = createState(zero);
    start(s);
    s.current = { type: 0, rot: 0, x: 3, y: 0 }; // I 横放，占列 3-6
    expect(move(s, -1)).toBe(true);
    expect(move(s, -1)).toBe(true);
    expect(move(s, -1)).toBe(true); // x = 0，占列 0-3
    expect(move(s, -1)).toBe(false);
    expect(s.current.x).toBe(0);
  });

  it('贴墙旋转触发踢墙，旋转后所有格在界内', () => {
    const s = createState(zero);
    start(s);
    s.current = { type: 0, rot: 1, x: -2, y: 5 }; // 竖 I 贴左墙（绝对列 0）
    expect(rotate(s)).toBe(true);
    for (const [cx] of rotatedCells(s.current.type, s.current.rot)) {
      expect(s.current.x + cx).toBeGreaterThanOrEqual(0);
      expect(s.current.x + cx).toBeLessThan(COLS);
    }
  });

  it('重力：累积一个下落间隔后 y+1', () => {
    const s = createState(zero);
    start(s);
    const y0 = s.current.y;
    tick(s, dropInterval(0), zero);
    expect(s.current.y).toBe(y0 + 1);
  });

  it('ready 状态下 tick 不动', () => {
    const s = createState(zero);
    const y0 = s.current.y;
    tick(s, 10, zero);
    expect(s.current.y).toBe(y0);
  });

  it('软降：下移一格且 +1 分', () => {
    const s = createState(zero);
    start(s);
    expect(softDrop(s)).toBe(true);
    expect(s.score).toBe(1);
  });

  it('硬降：落底锁定、+2×距离、生成新块', () => {
    const s = createState(zero); // zero rand：当前块为 O（type 1）
    start(s);
    const ev = hardDrop(s, zero);
    expect(ev.locked).toBe(true);
    expect(s.board.filter((v) => v !== 0)).toHaveLength(4);
    expect(s.score).toBe(36); // O 从 y=0 落到 y=18，距离 18 × 2
    expect(s.current).not.toBeNull();
  });

  it('单行消除：计分 100×等级、行下移', () => {
    const s = createState(zero);
    start(s);
    for (let x = 0; x < COLS; x++) if (x !== 4 && x !== 5) s.board[19 * COLS + x] = 3;
    s.current = { type: 1, rot: 0, x: 4, y: 18 }; // O 形状占 x+0/x+1 两列，x=4 恰补 4/5 列的洞
    const ev = hardDrop(s, zero);
    expect(ev.cleared).toBe(1);
    expect(s.lines).toBe(1);
    expect(s.score).toBe(100);
    expect(s.board[19 * COLS + 4]).toBe(2); // 原 18 行的 O 残块降到 19 行
    expect(s.board[19 * COLS + 0]).toBe(0); // 原满行的杂块被清掉
  });

  it('四行消除（Tetris）计 800 分', () => {
    const s = createState(zero);
    start(s);
    for (let y = 16; y < 20; y++) {
      for (let x = 1; x < COLS; x++) s.board[y * COLS + x] = 3;
    }
    s.current = { type: 0, rot: 1, x: -2, y: 16 }; // 竖 I 落在第 0 列，补满 16-19 行
    const ev = hardDrop(s, zero);
    expect(ev.cleared).toBe(4);
    expect(s.score).toBe(800);
    expect(s.board.every((v) => v === 0)).toBe(true);
  });

  it('新块出生位置被占则判负', () => {
    const s = createState(zero); // 当前 O，下一块 T（zero rand 洗牌确定）
    start(s);
    s.board[2 * COLS + 4] = 3;
    s.board[2 * COLS + 5] = 3; // 挡住 O 的下落，让它锁在 0-1 行
    const ev = hardDrop(s, zero); // O 锁定于 (4,0)(5,0)(4,1)(5,1)
    expect(ev.over).toBe(true);
    expect(s.status).toBe('over'); // T 出生于 (4,0)... 与 O 重叠
  });

  it('Hold：暂存当前块、每次落块限用一次、锁定后恢复', () => {
    const s = createState(zero);
    start(s);
    const t0 = s.current.type;
    const t1 = s.next;
    expect(holdPiece(s, zero)).toBe(true);
    expect(s.hold).toBe(t0);
    expect(s.current.type).toBe(t1);
    expect(holdPiece(s, zero)).toBe(false); // 本次落块已用过
    hardDrop(s, zero);
    expect(holdPiece(s, zero)).toBe(true); // 锁定后恢复可用
  });

  it('Hold 交换：第二次暂存换回第一次存的块', () => {
    const s = createState(zero);
    start(s);
    const t0 = s.current.type;
    holdPiece(s, zero);
    hardDrop(s, zero);
    holdPiece(s, zero);
    expect(s.current.type).toBe(t0);
  });

  it('下落间隔随等级几何递减且有下限', () => {
    expect(dropInterval(0)).toBeGreaterThan(dropInterval(10));
    expect(dropInterval(10)).toBeGreaterThan(dropInterval(20));
    expect(dropInterval(1000)).toBe(dropInterval(2000));
    expect(dropInterval(1000)).toBeGreaterThanOrEqual(0.08);
  });
});
