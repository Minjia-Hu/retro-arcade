import type { GameContext } from '../core/game';
import { DIFF_LABEL } from '../core/format';

/**
 * 难度菜单浮层。进行中时给一个回到当前局的出口——玩到一半误触 ☰ 不该只能弃局。
 * 返回的 open() 供 ctx.onTool('menu', …) 与首次挂载共用。
 */
export function difficultyMenu<D extends { id: 'easy' | 'medium' | 'hard' }>(opts: {
  ctx: GameContext;
  difficulties: D[];
  /** 当前是否有进行中的局（决定要不要渲染 ✕ RESUME） */
  resumable: () => boolean;
  onPick: (d: D) => void;
}): { open: () => void } {
  const open = (): void => {
    const resumable = opts.resumable();
    opts.ctx.overlay({
      title: 'DIFFICULTY', // 单词标题：卡片比棋盘窄不了多少，两词会折行并盖满整块屏幕
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
