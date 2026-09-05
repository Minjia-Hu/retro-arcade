import { describe, it, expect } from 'vitest';
import { SUNSET } from '../src/core/theme';
import { THEME } from '../src/core/theme';
import { GAMES } from '../src/games/registry';

describe('SUNSET 令牌', () => {
  it('提供四个 accent 颜色，顺序为 teal/magenta/orange/gold', () => {
    expect(SUNSET.accents).toEqual(['#0b7285', '#d6336c', '#e8590c', '#e67700']);
  });

  it('不破坏游戏画布使用的 THEME', () => {
    expect(THEME.neonCyan).toBe('#00e5ff');
    expect(THEME.font).toContain('Courier New');
  });
});

describe('registry displayName', () => {
  it('八个游戏都有英文大写展示名', () => {
    expect(GAMES.map((g) => g.meta.displayName)).toEqual([
      'SNAKE', 'TETRIS', 'BREAKOUT', 'FLAPPY', '2048', 'MINES', 'SUDOKU', 'GOMOKU',
    ]);
  });
});
