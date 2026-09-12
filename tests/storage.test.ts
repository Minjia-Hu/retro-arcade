import { describe, it, expect } from 'vitest';
import { ArcadeStorage, memoryBackend, type KVBackend } from '../src/core/storage';

describe('ArcadeStorage', () => {
  it('get returns what set stored (under the arcade. namespace)', () => {
    const backend = memoryBackend();
    const s = new ArcadeStorage(backend);
    s.set('best.flappy', 42);
    expect(s.get('best.flappy', 0)).toBe(42);
    expect(backend.getItem('arcade.best.flappy')).toBe('42');
  });

  it('a missing key returns the fallback', () => {
    const s = new ArcadeStorage(memoryBackend());
    expect(s.get('nope', 'x')).toBe('x');
  });

  it('corrupt JSON returns the fallback', () => {
    const backend = memoryBackend();
    backend.setItem('arcade.bad', '{oops');
    const s = new ArcadeStorage(backend);
    expect(s.get('bad', 7)).toBe(7);
  });

  it('when the backend throws, get returns the fallback and set does not throw', () => {
    const broken: KVBackend = {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('denied'); },
    };
    const s = new ArcadeStorage(broken);
    expect(s.get('k', 1)).toBe(1);
    expect(() => s.set('k', 2)).not.toThrow();
  });
});
