/**
 * 深色屏游戏的画布内配色（Sunset Arcade 暖霓虹）。
 * 浅色纸盘的四款各自在 index.ts 里持有自己的 PAPER 常量——它们的配色互不相同，
 * 硬凑成一张表只会得到一个谁都不合身的抽象。
 */
export const SCREEN = {
  ground: '#1a1410', // 与 arcade.css 的 --screen-ground 对应，改一处要同步另一处
  teal: '#2ee6c8',
  gold: '#ffc93c',
  pink: '#ff5c9e',
  orange: '#ff8c42',
  white: '#fffaf0',
  mono: "'JetBrains Mono', ui-monospace, monospace",
  /** 发光统一用同色 50% alpha（白色偏亮，用 80%） */
  glow: {
    teal: 'rgba(46, 230, 200, .5)',
    gold: 'rgba(255, 201, 60, .5)',
    pink: 'rgba(255, 92, 158, .5)',
    orange: 'rgba(255, 140, 66, .5)',
    white: 'rgba(255, 250, 240, .8)',
  },
} as const;
