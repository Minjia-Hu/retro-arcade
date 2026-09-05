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
 * 首页 Sunset Arcade 的 accent 色轮。
 *
 * 这里只放 TS 真正需要的值：featured 卡片的 accent 取决于是哪个游戏，只能由 JS 内联，
 * 无法交给 CSS 的 nth-child。其余色板（纸底、墨色描边、药丸等）是 CSS 的唯一真相源，
 * 见 src/styles/arcade.css 的 :root。改动这四个色值时记得同步那里的 --accent-*。
 *
 * 游戏画布仍用上面的 THEME，两者互不影响。
 */
export const SUNSET = {
  /** 按游戏在 registry 中的下标 % accents.length 轮转 */
  accents: ['#0b7285', '#d6336c', '#e8590c', '#e67700'],
} as const;
