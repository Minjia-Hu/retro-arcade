import { describe, it, expect } from 'vitest';
import { AudioFx, SFX } from '../src/core/audio';
import { ArcadeStorage, memoryBackend } from '../src/core/storage';

describe('AudioFx', () => {
  it('SFX note data is valid (positive frequency and duration)', () => {
    for (const notes of Object.values(SFX)) {
      expect(notes.length).toBeGreaterThan(0);
      for (const [freq, dur] of notes) {
        expect(freq).toBeGreaterThan(0);
        expect(dur).toBeGreaterThan(0);
      }
    }
  });

  it('play() is silent and does not throw without AudioContext', () => {
    const fx = new AudioFx(new ArcadeStorage(memoryBackend()));
    expect(() => fx.play('score')).not.toThrow();
  });

  it('mute state persists to storage', () => {
    const storage = new ArcadeStorage(memoryBackend());
    const fx = new AudioFx(storage);
    expect(fx.isMuted()).toBe(false);
    expect(fx.toggleMuted()).toBe(true);
    // Rebuild and read the persisted state back
    expect(new AudioFx(storage).isMuted()).toBe(true);
  });
});
