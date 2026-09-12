import { GAMES } from '../games/registry';

/** Accent tone names. The hex values live in CSS (.accent-*); TS never touches them */
export type AccentTone = 'teal' | 'magenta' | 'orange' | 'gold';

const ACCENTS: AccentTone[] = ['teal', 'magenta', 'orange', 'gold'];

/** Rotate accent tones by registry index */
export function accentAt(index: number): AccentTone {
  return ACCENTS[index % ACCENTS.length];
}

/** Accent tone for a game id; unknown ids fall back to the first tone */
export function accentOf(id: string): AccentTone {
  const index = GAMES.findIndex((g) => g.meta.id === id);
  return accentAt(index < 0 ? 0 : index);
}
