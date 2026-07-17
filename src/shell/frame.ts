import type { Game, GameContext } from '../core/game';
import type { AudioFx } from '../core/audio';
import type { ArcadeStorage } from '../core/storage';
import { InputService } from '../core/input';

export class GameFrame {
  private game: Game | null = null;
  private input: InputService | null = null;
  private observer: ResizeObserver | null = null;
  private paused = false;

  constructor(private audio: AudioFx, private storage: ArcadeStorage) {}

  open(root: HTMLElement, game: Game): void {
    this.close();
    this.paused = false;
    root.innerHTML = `
      <div class="frame">
        <div class="frame-bar">
          <button class="btn" data-act="back">◀ 返回</button>
          <span class="frame-title">${game.meta.icon} ${game.meta.name}</span>
          <span class="frame-right">
            <button class="btn" data-act="pause">⏸</button>
            <button class="btn" data-act="mute">${this.audio.isMuted() ? '🔇' : '🔊'}</button>
          </span>
        </div>
        <div class="frame-body"></div>
      </div>`;

    const body = root.querySelector<HTMLElement>('.frame-body')!;
    const btn = (act: string) => root.querySelector<HTMLButtonElement>(`[data-act="${act}"]`)!;

    btn('back').addEventListener('click', () => {
      this.audio.play('click');
      location.hash = '#/';
    });
    btn('mute').addEventListener('click', () => {
      const muted = this.audio.toggleMuted();
      btn('mute').textContent = muted ? '🔇' : '🔊';
      this.audio.play('click');
    });
    btn('pause').addEventListener('click', () => {
      if (!this.game) return;
      this.paused = !this.paused;
      btn('pause').textContent = this.paused ? '▶' : '⏸';
      try {
        if (this.paused) this.game.pause();
        else this.game.resume();
      } catch (err) {
        console.error('[arcade] game crashed on pause/resume:', err);
      }
    });

    const resizeCbs = new Set<() => void>();
    this.observer = new ResizeObserver(() => resizeCbs.forEach((cb) => cb()));
    this.observer.observe(body);
    this.input = new InputService();

    const ctx: GameContext = {
      audio: this.audio,
      storage: this.storage,
      input: this.input,
      onResize: (cb) => {
        resizeCbs.add(cb);
        return () => resizeCbs.delete(cb);
      },
    };

    try {
      game.mount(body, ctx);
      this.game = game;
    } catch (err) {
      console.error('[arcade] game crashed on mount:', err);
      try { game.destroy(); } catch { /* 尽力清理半挂载游戏的自有资源（rAF/定时器） */ }
      this.showError(root);
    }
  }

  close(): void {
    try {
      this.game?.destroy();
    } catch (err) {
      console.error('[arcade] game crashed on destroy:', err);
    }
    this.game = null;
    this.input?.dispose();
    this.input = null;
    this.observer?.disconnect();
    this.observer = null;
  }

  private showError(root: HTMLElement): void {
    root.innerHTML = `
      <div class="frame-error">
        <p>💥 GAME ERROR · 游戏出错了</p>
        <button class="btn" data-act="home">返回首页</button>
      </div>`;
    root.querySelector('[data-act="home"]')!.addEventListener('click', () => {
      location.hash = '#/';
    });
  }
}
