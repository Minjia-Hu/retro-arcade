import type { Game, GameMeta } from '../core/game';

export interface GameEntry {
  /**
   * id/name/icon/displayName are kept in sync by hand with the meta inside each game module
   * (deliberate duplication: lazy loading needs it).
   *
   * displayName must be written in both places: the hub card reads it here (the module isn't
   * loaded yet), the cabinet top bar reads the module's copy. A mismatch forks silently — one
   * name on the hub, another in the top bar. tests/registry.test.ts guards the invariant.
   */
  meta: GameMeta;
  /**
   * Unimplemented games have no load. The hub no longer renders a COMING SOON state (the mockups
   * have none); such cards are still clickable but main.ts bounces the route back to the hub.
   * Adding an unimplemented game for real would need a disabled state designed first.
   */
  load?: () => Promise<Game>;
}

export const GAMES: GameEntry[] = [
  {
    meta: { id: 'snake', name: 'Snake', icon: '🐍', displayName: 'SNAKE' },
    load: async () => (await import('./snake')).createSnake(),
  },
  {
    meta: { id: 'tetris', name: 'Tetris', icon: '🧱', displayName: 'TETRIS' },
    load: async () => (await import('./tetris')).createTetris(),
  },
  {
    meta: { id: 'breakout', name: 'Breakout', icon: '🕹️', displayName: 'BREAKOUT' },
    load: async () => (await import('./breakout')).createBreakout(),
  },
  {
    meta: { id: 'flappy', name: 'FLAPPY BIRD', icon: '🐦', displayName: 'FLAPPY' },
    load: async () => (await import('./flappy')).createFlappy(),
  },
  {
    meta: { id: 'g2048', name: '2048', icon: '🔢', displayName: '2048' },
    load: async () => (await import('./g2048')).createG2048(),
  },
  {
    meta: { id: 'minesweeper', name: 'Minesweeper', icon: '💣', displayName: 'MINES' },
    load: async () => (await import('./minesweeper')).createMinesweeper(),
  },
  {
    meta: { id: 'sudoku', name: 'Sudoku', icon: '✏️', displayName: 'SUDOKU' },
    load: async () => (await import('./sudoku')).createSudoku(),
  },
  {
    meta: { id: 'gomoku', name: 'Gomoku', icon: '⚫', displayName: 'GOMOKU' },
    load: async () => (await import('./gomoku')).createGomoku(),
  },
];
