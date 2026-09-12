/**
 * In-canvas palette for the dark-screen games (Sunset Arcade warm neon).
 * The four paper-board games each keep their own PAPER constant in their index.ts — their
 * palettes genuinely differ, and forcing them into one table gives an abstraction that fits none.
 */
export const SCREEN = {
  ground: '#1a1410', // mirrors --screen-ground in arcade.css; change both together
  teal: '#2ee6c8',
  gold: '#ffc93c',
  pink: '#ff5c9e',
  orange: '#ff8c42',
  white: '#fffaf0',
  mono: "'JetBrains Mono', ui-monospace, monospace",
  /** Glows are the same colour at 50% alpha (white reads brighter, so 80%) */
  glow: {
    teal: 'rgba(46, 230, 200, .5)',
    gold: 'rgba(255, 201, 60, .5)',
    pink: 'rgba(255, 92, 158, .5)',
    orange: 'rgba(255, 140, 66, .5)',
    white: 'rgba(255, 250, 240, .8)',
  },
} as const;
