import { describe, it, expect } from 'vitest';
import {
  DIFFICULTIES, candidates, solutionCount, generateSolved, makePuzzle,
  createState, setValue, clearCell, toggleNote, conflicts, isGiven,
  serialize, deserialize,
} from '../src/games/sudoku/logic';

// Deterministic PRNG so the test is never slow or flaky
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
  it('tiers are 40/32/26 givens: at 44/36/30, easy and medium were both pure singles puzzles', () => {
    expect(DIFFICULTIES.map((d) => d.clues)).toEqual([40, 32, 26]);
  });

  it('hard digs down to 28 or fewer while staying unique', () => {
    const { puzzle } = makePuzzle(DIFFICULTIES[2].clues, mulberry32(7));
    expect(puzzle.filter((v) => v !== 0).length).toBeLessThanOrEqual(28);
    expect(solutionCount(puzzle, 2)).toBe(1);
  });

  it('three tiers with decreasing clues', () => {
    expect(DIFFICULTIES.map((d) => d.id)).toEqual(['easy', 'medium', 'hard']);
    expect(DIFFICULTIES[0].clues).toBeGreaterThan(DIFFICULTIES[1].clues);
    expect(DIFFICULTIES[1].clues).toBeGreaterThan(DIFFICULTIES[2].clues);
  });

  it('candidates: values used in the row/column/box are excluded', () => {
    const b = new Array(81).fill(0);
    b[0] = 1; b[1] = 2; // same row
    b[9] = 3; // same column
    b[10] = 4; // same box
    const c = candidates(b, 2); // row 0, column 2
    expect(c).not.toContain(1);
    expect(c).not.toContain(2);
    expect(c).not.toContain(3);
    expect(c).not.toContain(4);
    expect(c).toContain(5);
  });

  it('solutionCount: empty board ≥2 (hits the limit), a full solution exactly 1', () => {
    expect(solutionCount(new Array(81).fill(0), 2)).toBe(2);
    const full = generateSolved(mulberry32(1));
    expect(solutionCount(full, 2)).toBe(1);
  });

  it('generateSolved: produces a valid full board', () => {
    expect(isFullValid(generateSolved(mulberry32(7)))).toBe(true);
  });

  it('makePuzzle: unique solution, givens ≥ target, remaining cells match the solution', () => {
    const { puzzle, solution } = makePuzzle(EASY.clues, mulberry32(42));
    expect(solutionCount(puzzle, 2)).toBe(1);
    const givens = puzzle.filter((v) => v !== 0).length;
    expect(givens).toBeGreaterThanOrEqual(EASY.clues);
    expect(isFullValid(solution)).toBe(true);
    for (let i = 0; i < 81; i++) if (puzzle[i] !== 0) expect(puzzle[i]).toBe(solution[i]);
  });

  it('createState: values start equal to puzzle, playing, givens present', () => {
    const s = createState(EASY, mulberry32(3));
    expect(s.values).toEqual(s.puzzle);
    expect(s.status).toBe('playing');
    expect(s.puzzle.filter((v) => v !== 0).length).toBeGreaterThanOrEqual(EASY.clues);
  });

  it('setValue: rejects givens, accepts empties and clears their notes', () => {
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

  it('clearCell: clears a non-given cell, rejects a given', () => {
    const s = createState(EASY, mulberry32(3));
    const empty = s.puzzle.findIndex((v) => v === 0);
    setValue(s, empty, 7);
    expect(clearCell(s, empty)).toBe(true);
    expect(s.values[empty]).toBe(0);
    const given = s.puzzle.findIndex((v) => v !== 0);
    expect(clearCell(s, given)).toBe(false);
  });

  it('toggleNote: adds/removes sorted; rejects givens and filled cells', () => {
    const s = createState(EASY, mulberry32(3));
    const empty = s.puzzle.findIndex((v) => v === 0);
    expect(toggleNote(s, empty, 3)).toBe(true);
    expect(toggleNote(s, empty, 1)).toBe(true);
    expect(s.notes[empty]).toEqual([1, 3]);
    expect(toggleNote(s, empty, 3)).toBe(true);
    expect(s.notes[empty]).toEqual([1]);
    setValue(s, empty, 9);
    expect(toggleNote(s, empty, 2)).toBe(false); // already filled
  });

  it('conflicts: detects duplicates in a row/column/box', () => {
    const v = new Array(81).fill(0);
    v[0] = 5; v[1] = 5; // duplicate in a row
    v[9] = 7; v[18] = 7; // duplicate in a column
    const bad = conflicts(v);
    expect(bad.has(0)).toBe(true);
    expect(bad.has(1)).toBe(true);
    expect(bad.has(9)).toBe(true);
    expect(bad.has(18)).toBe(true);
    expect(bad.size).toBe(4);
  });

  it('filling everything correctly wins', () => {
    const s = createState(EASY, mulberry32(11));
    for (let i = 0; i < 81; i++) if (!isGiven(s, i)) setValue(s, i, s.solution[i]);
    expect(s.status).toBe('won');
  });

  it('a wrong entry does not win; setValue is rejected after winning', () => {
    const s = createState(EASY, mulberry32(11));
    const empties = s.puzzle.map((v, i) => (v === 0 ? i : -1)).filter((i) => i >= 0);
    const wrong = (s.solution[empties[0]] % 9) + 1; // never equals the solution
    setValue(s, empties[0], wrong);
    expect(s.status).toBe('playing'); // a wrong entry does not win
    for (const i of empties) setValue(s, i, s.solution[i]);
    expect(s.status).toBe('won');
    expect(setValue(s, empties[0], 1)).toBe(false); // locked after winning
  });

  it('conflicts does not flag a correct full solution', () => {
    const s = createState(EASY, mulberry32(5));
    expect(conflicts(s.solution).size).toBe(0);
  });

  it('serialize/deserialize round-trips; bad data returns null', () => {
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
    // Corrupt save: a notes entry that is not an array must be rejected, or the renderer crashes every frame
    expect(deserialize({
      p: new Array(81).fill(0), s: new Array(81).fill(0), v: new Array(81).fill(0),
      n: new Array(81).fill(0), d: 'easy', st: 'playing',
    })).toBeNull();
  });
});
