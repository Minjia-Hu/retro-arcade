import { GAMES } from '../games/registry';

/** accent 色调名。具体色值由 CSS 的 .accent-* 持有，TS 不碰 hex */
export type AccentTone = 'teal' | 'magenta' | 'orange' | 'gold';

const ACCENTS: AccentTone[] = ['teal', 'magenta', 'orange', 'gold'];

/** 按 registry 下标轮转 accent 色调 */
export function accentAt(index: number): AccentTone {
  return ACCENTS[index % ACCENTS.length];
}

/** 按游戏 id 取 accent 色调；id 不在 registry 中时回退首个色调 */
export function accentOf(id: string): AccentTone {
  const index = GAMES.findIndex((g) => g.meta.id === id);
  return accentAt(index < 0 ? 0 : index);
}
