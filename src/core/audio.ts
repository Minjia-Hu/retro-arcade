import type { ArcadeStorage } from './storage';

// Names stay game-agnostic ('action', not 'flap') so no game's vocabulary leaks into core
export type SfxName = 'action' | 'score' | 'hit' | 'win' | 'over' | 'click';

// Each effect is a sequence of [frequency Hz, duration s] notes, played as square waves in order
export const SFX: Record<SfxName, [number, number][]> = {
  action: [[600, 0.05], [900, 0.05]],
  score: [[880, 0.06], [1320, 0.09]],
  hit: [[200, 0.1], [120, 0.15]],
  win: [[660, 0.1], [880, 0.1], [1100, 0.2]],
  over: [[400, 0.12], [300, 0.12], [200, 0.25]],
  click: [[700, 0.04]],
};

export class AudioFx {
  private ctx: AudioContext | null = null;
  private muted: boolean;

  constructor(private storage: ArcadeStorage) {
    this.muted = storage.get('muted', false);
  }

  isMuted(): boolean {
    return this.muted;
  }

  toggleMuted(): boolean {
    this.muted = !this.muted;
    this.storage.set('muted', this.muted);
    return this.muted;
  }

  play(name: SfxName): void {
    if (this.muted) return;
    try {
      // Create the AudioContext on first use — always after a user gesture, so autoplay policy is satisfied
      this.ctx ??= new AudioContext();
      // iOS Safari suspends the AudioContext after backgrounding; we are inside a user gesture here, so resume is allowed
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      let t = this.ctx.currentTime;
      for (const [freq, dur] of SFX[name]) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.08, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
        osc.connect(gain).connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + dur);
        t += dur;
      }
    } catch {
      // No Web Audio in this environment: degrade silently
    }
  }
}
