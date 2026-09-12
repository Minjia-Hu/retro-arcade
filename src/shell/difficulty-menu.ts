import type { GameContext } from '../core/game';
import { DIFF_LABEL } from '../core/format';

/**
 * The difficulty-menu overlay. Mid-game it offers a way back to the current board — hitting ☰
 * by accident should not force you to abandon it. The returned open() serves both
 * ctx.onTool('menu', …) and the initial mount.
 */
export function difficultyMenu<D extends { id: 'easy' | 'medium' | 'hard' }>(opts: {
  ctx: GameContext;
  difficulties: D[];
  /** Whether a game is in progress (decides whether ✕ RESUME is rendered) */
  resumable: () => boolean;
  onPick: (d: D) => void;
}): { open: () => void } {
  const open = (): void => {
    const resumable = opts.resumable();
    opts.ctx.overlay({
      title: 'DIFFICULTY', // one word: the card is barely narrower than the board, two words would wrap and cover the whole screen
      tone: 'win',
      lines: [],
      actions: [
        ...(resumable
          ? [{ label: '✕ RESUME', kind: 'secondary' as const, onPress: () => opts.ctx.overlay(null) }]
          : []),
        ...opts.difficulties.map((d) => ({
          label: DIFF_LABEL[d.id],
          kind: 'secondary' as const,
          onPress: () => opts.onPick(d),
        })),
      ],
      hints: [resumable ? 'RESUME OR PICK A DIFFICULTY' : 'PICK A DIFFICULTY TO BEGIN'],
    });
  };
  return { open };
}
