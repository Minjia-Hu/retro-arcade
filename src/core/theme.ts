export const THEME = {
  bg: '#0d0d16',
  panel: '#16121f',
  text: '#e8e6ff',
  dim: '#665f7a',
  neonGreen: '#39ff14',
  neonPink: '#ff2fd6',
  neonCyan: '#00e5ff',
  neonYellow: '#ffe600',
  font: "'Courier New', ui-monospace, monospace",
} as const;

/**
 * 深色屏游戏的画布内配色（Sunset Arcade 暖霓虹）。
 * 逐个游戏从 THEME 迁移过来（A 迁 SNAKE，B 迁其余三款），迁完后删除 THEME。
 */
export const SCREEN = {
  ground: '#1a1410', // 与 arcade.css 的 --screen-ground 对应，改一处要同步另一处
  teal: '#2ee6c8',
  gold: '#ffc93c',
  pink: '#ff5c9e',
  orange: '#ff8c42',
  white: '#fffaf0',
  mono: "'JetBrains Mono', ui-monospace, monospace",
  /** 发光统一用同色 50% alpha */
  glow: {
    teal: 'rgba(46, 230, 200, .5)',
    gold: 'rgba(255, 201, 60, .5)',
    pink: 'rgba(255, 92, 158, .5)',
  },
} as const;
