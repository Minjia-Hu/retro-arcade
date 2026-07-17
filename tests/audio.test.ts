import { describe, it, expect } from 'vitest';
import { AudioFx, SFX } from '../src/core/audio';
import { ArcadeStorage, memoryBackend } from '../src/core/storage';

describe('AudioFx', () => {
  it('SFX 音符数据合法（频率/时长为正）', () => {
    for (const notes of Object.values(SFX)) {
      expect(notes.length).toBeGreaterThan(0);
      for (const [freq, dur] of notes) {
        expect(freq).toBeGreaterThan(0);
        expect(dur).toBeGreaterThan(0);
      }
    }
  });

  it('无 AudioContext 环境下 play 静默不抛', () => {
    const fx = new AudioFx(new ArcadeStorage(memoryBackend()));
    expect(() => fx.play('score')).not.toThrow();
  });

  it('静音状态持久化到 storage', () => {
    const storage = new ArcadeStorage(memoryBackend());
    const fx = new AudioFx(storage);
    expect(fx.isMuted()).toBe(false);
    expect(fx.toggleMuted()).toBe(true);
    // 重新构造，读回持久化状态
    expect(new AudioFx(storage).isMuted()).toBe(true);
  });
});
