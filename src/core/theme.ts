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

/** 首页 Sunset Arcade 主题令牌。游戏画布仍用上面的 THEME，两者互不影响。 */
export const SUNSET = {
  bg: '#f6efe3',
  panel: '#fffaf0',
  panelAlt: '#f6efe3',
  hover: '#fff3dd',
  ink: '#2b2118',
  dim: '#8a7a66',
  faint: '#b5a88f',
  pillOff: '#e6dcc8',
  highlight: '#ffe08a',
  /** 按游戏在 registry 中的下标 % 4 轮转 */
  accents: ['#0b7285', '#d6336c', '#e8590c', '#e67700'],
} as const;
