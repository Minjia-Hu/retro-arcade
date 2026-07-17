import { describe, it, expect } from 'vitest';
import { ArcadeStorage, memoryBackend, type KVBackend } from '../src/core/storage';

describe('ArcadeStorage', () => {
  it('set 后能 get 回同一值（带 arcade. 命名空间）', () => {
    const backend = memoryBackend();
    const s = new ArcadeStorage(backend);
    s.set('best.flappy', 42);
    expect(s.get('best.flappy', 0)).toBe(42);
    expect(backend.getItem('arcade.best.flappy')).toBe('42');
  });

  it('缺失键返回 fallback', () => {
    const s = new ArcadeStorage(memoryBackend());
    expect(s.get('nope', 'x')).toBe('x');
  });

  it('损坏的 JSON 返回 fallback', () => {
    const backend = memoryBackend();
    backend.setItem('arcade.bad', '{oops');
    const s = new ArcadeStorage(backend);
    expect(s.get('bad', 7)).toBe(7);
  });

  it('后端抛异常时 get 返回 fallback、set 不抛', () => {
    const broken: KVBackend = {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('denied'); },
    };
    const s = new ArcadeStorage(broken);
    expect(s.get('k', 1)).toBe(1);
    expect(() => s.set('k', 2)).not.toThrow();
  });
});
