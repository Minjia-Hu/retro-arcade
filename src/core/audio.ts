import type { ArcadeStorage } from './storage';

// 名字保持游戏无关的通用语义（'action' 而非 'flap'），避免各游戏词汇泄漏进 core
export type SfxName = 'action' | 'score' | 'hit' | 'win' | 'over' | 'click';

// 每个音效 = 一串 [频率Hz, 时长s] 音符，方波依次播放
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
      // 首次调用（必然发生在用户交互后）才创建 AudioContext，符合自动播放策略
      this.ctx ??= new AudioContext();
      // iOS Safari 等会在切后台后挂起 AudioContext，此处正值用户手势，允许 resume
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
      // 环境不支持 Web Audio 时静默降级
    }
  }
}
