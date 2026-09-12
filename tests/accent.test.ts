import { describe, it, expect } from 'vitest';
import { accentAt, accentOf } from '../src/shell/accent';
import { GAMES } from '../src/games/registry';

describe('accentAt', () => {
  it('rotates through four tones', () => {
    expect(accentAt(0)).toBe('teal');
    expect(accentAt(1)).toBe('magenta');
    expect(accentAt(2)).toBe('orange');
    expect(accentAt(3)).toBe('gold');
    expect(accentAt(4)).toBe('teal');
    expect(accentAt(7)).toBe('gold');
  });
});

describe('accentOf', () => {
  it('tone by registry index', () => {
    expect(accentOf('snake')).toBe('teal');
    expect(accentOf('tetris')).toBe('magenta');
    expect(accentOf('gomoku')).toBe('gold');
  });

  it('agrees with accentAt over the registry order', () => {
    GAMES.forEach((g, i) => expect(accentOf(g.meta.id)).toBe(accentAt(i)));
  });

  it('an unknown id falls back to the first tone instead of throwing', () => {
    expect(accentOf('nope')).toBe('teal');
  });
});
