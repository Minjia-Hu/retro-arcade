import { describe, it, expect } from 'vitest';
import {
  DIFFICULTIES, candidates, solutionCount, generateSolved, makePuzzle,
  createState, setValue, clearCell, toggleNote, conflicts, isGiven,
  serialize, deserialize,
} from '../src/games/sudoku/logic';

// 确定性 PRNG，避免测试偶发慢/抖动
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function isFullValid(b: number[]): boolean {
  const groups: number[][] = [];
  for (let i = 0; i < 9; i++) {
    const row: number[] = []; const col: number[] = []; const box: number[] = [];
    for (let k = 0; k < 9; k++) {
      row.push(b[i * 9 + k]);
      col.push(b[k * 9 + i]);
      const br = Math.floor(i / 3) * 3; const bc = (i % 3) * 3;
      box.push(b[(br + Math.floor(k / 3)) * 9 + (bc + (k % 3))]);
    }
    groups.push(row, col, box);
  }
  return groups.every((g) => new Set(g).size === 9 && g.every((v) => v >= 1 && v <= 9));
}

const EASY = DIFFICULTIES[0];

describe('sudoku logic', () => {
  it('三档难度参数：clues 递减', () => {
    expect(DIFFICULTIES.map((d) => d.id)).toEqual(['easy', 'medium', 'hard']);
    expect(DIFFICULTIES[0].clues).toBeGreaterThan(DIFFICULTIES[1].clues);
    expect(DIFFICULTIES[1].clues).toBeGreaterThan(DIFFICULTIES[2].clues);
  });

  it('candidates：给定行/列/宫已占用的值被排除', () => {
    const b = new Array(81).fill(0);
    b[0] = 1; b[1] = 2; // 同行
    b[9] = 3; // 同列
    b[10] = 4; // 同宫
    const c = candidates(b, 2); // 行 0 列 2
    expect(c).not.toContain(1);
    expect(c).not.toContain(2);
    expect(c).not.toContain(3);
    expect(c).not.toContain(4);
    expect(c).toContain(5);
  });

  it('solutionCount：空盘 ≥2（触上限），完整解恰 1', () => {
    expect(solutionCount(new Array(81).fill(0), 2)).toBe(2);
    const full = generateSolved(mulberry32(1));
    expect(solutionCount(full, 2)).toBe(1);
  });

  it('generateSolved：产出合法完整盘', () => {
    expect(isFullValid(generateSolved(mulberry32(7)))).toBe(true);
  });

  it('makePuzzle：唯一解、givens 数 ≥ 目标、去洞处与解一致', () => {
    const { puzzle, solution } = makePuzzle(EASY.clues, mulberry32(42));
    expect(solutionCount(puzzle, 2)).toBe(1);
    const givens = puzzle.filter((v) => v !== 0).length;
    expect(givens).toBeGreaterThanOrEqual(EASY.clues);
    expect(isFullValid(solution)).toBe(true);
    for (let i = 0; i < 81; i++) if (puzzle[i] !== 0) expect(puzzle[i]).toBe(solution[i]);
  });

  it('createState：values 初始等于 puzzle、playing、givens 存在', () => {
    const s = createState(EASY, mulberry32(3));
    expect(s.values).toEqual(s.puzzle);
    expect(s.status).toBe('playing');
    expect(s.puzzle.filter((v) => v !== 0).length).toBeGreaterThanOrEqual(EASY.clues);
  });

  it('setValue：givens 拒绝、空格接受并清空该格笔记', () => {
    const s = createState(EASY, mulberry32(3));
    const given = s.puzzle.findIndex((v) => v !== 0);
    const empty = s.puzzle.findIndex((v) => v === 0);
    expect(isGiven(s, given)).toBe(true);
    expect(setValue(s, given, 5)).toBe(false);
    s.notes[empty] = [1, 2, 3];
    expect(setValue(s, empty, 7)).toBe(true);
    expect(s.values[empty]).toBe(7);
    expect(s.notes[empty]).toEqual([]);
  });

  it('clearCell：清空非给定格，给定格拒绝', () => {
    const s = createState(EASY, mulberry32(3));
    const empty = s.puzzle.findIndex((v) => v === 0);
    setValue(s, empty, 7);
    expect(clearCell(s, empty)).toBe(true);
    expect(s.values[empty]).toBe(0);
    const given = s.puzzle.findIndex((v) => v !== 0);
    expect(clearCell(s, given)).toBe(false);
  });

  it('toggleNote：增删排序；给定格或已填格拒绝', () => {
    const s = createState(EASY, mulberry32(3));
    const empty = s.puzzle.findIndex((v) => v === 0);
    expect(toggleNote(s, empty, 3)).toBe(true);
    expect(toggleNote(s, empty, 1)).toBe(true);
    expect(s.notes[empty]).toEqual([1, 3]);
    expect(toggleNote(s, empty, 3)).toBe(true);
    expect(s.notes[empty]).toEqual([1]);
    setValue(s, empty, 9);
    expect(toggleNote(s, empty, 2)).toBe(false); // 已填
  });

  it('conflicts：检出同行/同列/同宫重复', () => {
    const v = new Array(81).fill(0);
    v[0] = 5; v[1] = 5; // 同行重复
    v[9] = 7; v[18] = 7; // 同列重复
    const bad = conflicts(v);
    expect(bad.has(0)).toBe(true);
    expect(bad.has(1)).toBe(true);
    expect(bad.has(9)).toBe(true);
    expect(bad.has(18)).toBe(true);
    expect(bad.size).toBe(4);
  });

  it('填满正确即获胜', () => {
    const s = createState(EASY, mulberry32(11));
    for (let i = 0; i < 81; i++) if (!isGiven(s, i)) setValue(s, i, s.solution[i]);
    expect(s.status).toBe('won');
  });

  it('填错不获胜；获胜后 setValue 被拒', () => {
    const s = createState(EASY, mulberry32(11));
    const empties = s.puzzle.map((v, i) => (v === 0 ? i : -1)).filter((i) => i >= 0);
    for (const i of empties) setValue(s, i, s.solution[i]);
    expect(s.status).toBe('won');
    expect(setValue(s, empties[0], 1)).toBe(false); // 已胜锁定
  });

  it('conflicts 不把正确完整解误报', () => {
    const s = createState(EASY, mulberry32(5));
    expect(conflicts(s.solution).size).toBe(0);
  });

  it('serialize/deserialize 往返一致；坏数据返回 null', () => {
    const s = createState(EASY, mulberry32(9));
    const empty = s.puzzle.findIndex((v) => v === 0);
    setValue(s, empty, s.solution[empty]);
    s.notes[s.puzzle.lastIndexOf(0)] = [4, 5];
    const restored = deserialize(serialize(s));
    expect(restored).not.toBeNull();
    expect(restored!.values).toEqual(s.values);
    expect(restored!.notes).toEqual(s.notes);
    expect(restored!.diff.id).toBe(EASY.id);
    expect(deserialize(null)).toBeNull();
    expect(deserialize({ bogus: 1 })).toBeNull();
  });
});
