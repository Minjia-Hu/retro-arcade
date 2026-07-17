import type { Game, GameMeta } from '../core/game';

export interface GameEntry {
  meta: GameMeta;
  /** 未实装的游戏没有 load，首页显示 COMING SOON */
  load?: () => Promise<Game>;
}

export const GAMES: GameEntry[] = [
  { meta: { id: 'snake', name: '贪吃蛇', icon: '🐍' } },
  { meta: { id: 'tetris', name: '俄罗斯方块', icon: '🧱' } },
  { meta: { id: 'breakout', name: '打砖块', icon: '🕹️' } },
  {
    meta: { id: 'flappy', name: 'FLAPPY BIRD', icon: '🐦' },
    load: async () => (await import('./flappy')).createFlappy(),
  },
  { meta: { id: 'g2048', name: '2048', icon: '🔢' } },
  { meta: { id: 'minesweeper', name: '扫雷', icon: '💣' } },
  { meta: { id: 'sudoku', name: '数独', icon: '✏️' } },
  { meta: { id: 'gomoku', name: '五子棋', icon: '⚫' } },
];
