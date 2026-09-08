import { describe, it, expect } from 'vitest';
import { GAMES } from '../src/games/registry';

/**
 * registry 的 meta 与游戏模块内的 meta 是两份手写副本（懒加载需要）。
 * 首页卡片读 registry 那份，机柜顶栏读模块那份——不一致会静默分叉。
 */
describe('registry 与游戏模块的 meta 一致', () => {
  it('每个游戏加载后，id / name / icon / displayName 都对得上', async () => {
    for (const entry of GAMES) {
      if (!entry.load) continue;
      const game = await entry.load();
      const from = entry.meta;
      const to = game.meta;
      expect(to.id, `${from.id} 的 id`).toBe(from.id);
      expect(to.name, `${from.id} 的 name`).toBe(from.name);
      expect(to.icon, `${from.id} 的 icon`).toBe(from.icon);
      expect(to.displayName, `${from.id} 的 displayName`).toBe(from.displayName);
    }
  });
});
