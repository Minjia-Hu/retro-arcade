import { describe, it, expect } from 'vitest';
import {
  createState, reveal, toggleFlag, neighbors, computeAdjacency,
  DIFFICULTIES,
} from '../src/games/minesweeper/logic';

const EASY = DIFFICULTIES[0];
const zero = () => 0;

describe('minesweeper logic', () => {
  it('三档难度参数正确', () => {
    expect(DIFFICULTIES.map((d) => [d.cols, d.rows, d.mines])).toEqual([
      [9, 9, 10],
      [12, 16, 30],
      [16, 24, 80],
    ]);
  });

  it('初始状态：ready、无雷、零旗', () => {
    const s = createState(EASY);
    expect(s.status).toBe('ready');
    expect(s.grid).toHaveLength(81);
    expect(s.grid.every((c) => !c.mine && !c.revealed && !c.flagged)).toBe(true);
    expect(s.flags).toBe(0);
  });

  it('neighbors：角 3 个、中心 8 个', () => {
    expect(neighbors(EASY, 0)).toHaveLength(3);
    expect(neighbors(EASY, 40)).toHaveLength(8);
  });

  it('首点必不踩雷（含 8 邻域），且布雷数正确', () => {
    const s = createState(EASY);
    reveal(s, 40, zero); // rand=0 是最"想"把雷放在前面的对抗序列
    expect(s.status).not.toBe('lost');
    expect(s.grid.filter((c) => c.mine)).toHaveLength(10);
    for (const i of [40, ...neighbors(EASY, 40)]) {
      expect(s.grid[i].mine).toBe(false);
    }
  });

  it('computeAdjacency：角上一颗雷，三邻格 adj 为 1', () => {
    const s = createState(EASY);
    s.grid[0].mine = true;
    computeAdjacency(s);
    expect(s.grid[1].adj).toBe(1);
    expect(s.grid[9].adj).toBe(1);
    expect(s.grid[10].adj).toBe(1);
    expect(s.grid[11].adj).toBe(0);
  });

  it('洪水展开：单雷棋盘从远角揭开即胜（80 格全开）', () => {
    const s = createState(EASY);
    s.grid[0].mine = true;
    computeAdjacency(s);
    s.status = 'playing';
    const ev = reveal(s, 80, zero);
    expect(ev.won).toBe(true);
    expect(s.status).toBe('won');
    expect(s.revealed).toBe(80);
    expect(s.grid[0].revealed).toBe(false); // 雷本身不被展开
  });

  it('展开跳过插旗格：旗未拔则不胜，拔旗补开后胜', () => {
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

  it('踩雷：lost、爆雷事件、所有雷翻开', () => {
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

  it('插旗开关与计数；已开格不能插旗', () => {
    const s = createState(EASY);
    expect(toggleFlag(s, 3)).toBe(true);
    expect(s.flags).toBe(1);
    expect(toggleFlag(s, 3)).toBe(true);
    expect(s.flags).toBe(0);
    s.grid[5].revealed = true;
    expect(toggleFlag(s, 5)).toBe(false);
  });

  it('插旗格不可被 reveal', () => {
    const s = createState(EASY);
    s.grid[0].mine = true;
    computeAdjacency(s);
    s.status = 'playing';
    toggleFlag(s, 0);
    const ev = reveal(s, 0, zero);
    expect(ev.exploded).toBe(false);
    expect(s.status).toBe('playing');
  });

  it('终局后 reveal 与 toggleFlag 均被拒绝', () => {
    const s = createState(EASY);
    s.grid[0].mine = true;
    computeAdjacency(s);
    s.status = 'playing';
    reveal(s, 0, zero); // lost
    const ev = reveal(s, 40, zero);
    expect(ev.revealedSome).toBe(false);
    expect(toggleFlag(s, 40)).toBe(false);
  });

  it('重复 reveal 已开格是无事件空操作', () => {
    const s = createState(EASY);
    s.grid[0].mine = true;
    computeAdjacency(s);
    s.status = 'playing';
    reveal(s, 80, zero);
    const ev = reveal(s, 80, zero);
    expect(ev.revealedSome).toBe(false);
    expect(ev.won).toBe(false);
  });
});
