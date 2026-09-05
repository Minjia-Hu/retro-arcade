import { describe, it, expect } from 'vitest';
import { accentAt, accentOf } from '../src/shell/accent';
import { GAMES } from '../src/games/registry';

describe('accentAt', () => {
  it('四色调轮转', () => {
    expect(accentAt(0)).toBe('teal');
    expect(accentAt(1)).toBe('magenta');
    expect(accentAt(2)).toBe('orange');
    expect(accentAt(3)).toBe('gold');
    expect(accentAt(4)).toBe('teal');
    expect(accentAt(7)).toBe('gold');
  });
});

describe('accentOf', () => {
  it('按 registry 下标取色调', () => {
    expect(accentOf('snake')).toBe('teal');
    expect(accentOf('tetris')).toBe('magenta');
    expect(accentOf('gomoku')).toBe('gold');
  });

  it('与 accentAt 对 registry 顺序保持一致', () => {
    GAMES.forEach((g, i) => expect(accentOf(g.meta.id)).toBe(accentAt(i)));
  });

  it('未知 id 回退首个色调而不是抛错', () => {
    expect(accentOf('nope')).toBe('teal');
  });
});
