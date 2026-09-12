import { describe, it, expect } from 'vitest';
import { GAMES } from '../src/games/registry';

/**
 * The registry's meta and each game module's meta are two hand-written copies (lazy loading
 * needs it). The hub card reads the registry's, the cabinet top bar reads the module's — a
 * mismatch forks silently.
 */
describe('registry meta matches the game modules', () => {
  it('after loading, id / name / icon / displayName all match', async () => {
    for (const entry of GAMES) {
      if (!entry.load) continue;
      const game = await entry.load();
      const from = entry.meta;
      const to = game.meta;
      expect(to.id, `id of ${from.id}`).toBe(from.id);
      expect(to.name, `name of ${from.id}`).toBe(from.name);
      expect(to.icon, `icon of ${from.id}`).toBe(from.icon);
      expect(to.displayName, `displayName of ${from.id}`).toBe(from.displayName);
    }
  });
});
