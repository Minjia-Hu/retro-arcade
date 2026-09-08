import type { Game, GameMeta } from '../core/game';

export interface GameEntry {
  /**
   * id/name/icon/displayName 与各游戏模块内的 meta 保持手动同步（懒加载需要，属有意重复）。
   *
   * displayName 两处都要写：首页卡片读这里（懒加载前拿不到模块），机柜顶栏读模块里的那份。
   * 两边不一致时会静默分叉——首页显示一个名字、进去顶栏显示另一个。
   * tests/registry.test.ts 守着这个不变量。
   */
  meta: GameMeta;
  /**
   * 未实装的游戏没有 load。首页不再渲染 COMING SOON 状态（设计稿里没有这一态），
   * 这类条目的卡片仍可点击，但 main.ts 会把路由弹回首页。若将来真要加未实装的游戏，
   * 需要先给设计补一个禁用态。
   */
  load?: () => Promise<Game>;
}

export const GAMES: GameEntry[] = [
  {
    meta: { id: 'snake', name: '贪吃蛇', icon: '🐍', displayName: 'SNAKE' },
    load: async () => (await import('./snake')).createSnake(),
  },
  {
    meta: { id: 'tetris', name: '俄罗斯方块', icon: '🧱', displayName: 'TETRIS' },
    load: async () => (await import('./tetris')).createTetris(),
  },
  {
    meta: { id: 'breakout', name: '打砖块', icon: '🕹️', displayName: 'BREAKOUT' },
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
    meta: { id: 'minesweeper', name: '扫雷', icon: '💣', displayName: 'MINES' },
    load: async () => (await import('./minesweeper')).createMinesweeper(),
  },
  {
    meta: { id: 'sudoku', name: '数独', icon: '✏️', displayName: 'SUDOKU' },
    load: async () => (await import('./sudoku')).createSudoku(),
  },
  {
    meta: { id: 'gomoku', name: '五子棋', icon: '⚫', displayName: 'GOMOKU' },
    load: async () => (await import('./gomoku')).createGomoku(),
  },
];
