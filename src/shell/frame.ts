import type { Game, GameContext, SettleView } from '../core/game';
import type { AudioFx } from '../core/audio';
import type { ArcadeStorage } from '../core/storage';
import { InputService } from '../core/input';
import { cabinetHtml, settleHtml } from './cabinet-view';

export class GameFrame {
  private game: Game | null = null;
  private input: InputService | null = null;
  private observer: ResizeObserver | null = null;
  private paused = false;
  private screenEl: HTMLElement | null = null;
  private settleEl: HTMLElement | null = null;

  constructor(private audio: AudioFx, private storage: ArcadeStorage) {}

  open(root: HTMLElement, game: Game): void {
    this.close();
    this.paused = false;
    root.innerHTML = cabinetHtml(game.meta, this.audio.isMuted());

    const body = root.querySelector<HTMLElement>('.screen-body')!;
    this.screenEl = root.querySelector<HTMLElement>('.screen');
    this.settleEl = root.querySelector<HTMLElement>('.settle');
    const btn = (act: string) => root.querySelector<HTMLButtonElement>(`[data-act="${act}"]`)!;

    // 点击后移除焦点，避免残留焦点让空格键误触按钮
    const wire = (act: string, fn: () => void) => {
      const b = btn(act);
      b.addEventListener('click', () => {
        fn();
        b.blur();
      });
    };

    wire('back', () => {
      this.audio.play('click');
      location.hash = '#/';
    });
    wire('mute', () => {
      const muted = this.audio.toggleMuted();
      btn('mute').classList.toggle('is-off', muted);
      this.audio.play('click');
    });
    wire('pause', () => {
      if (!this.game) return;
      this.paused = !this.paused;
      btn('pause').textContent = this.paused ? '▶' : '❚❚';
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
      settle: (view) => this.showSettle(view),
    };

    try {
      game.mount(body, ctx);
      this.game = game;
    } catch (err) {
      console.error('[arcade] game crashed on mount:', err);
      try { game.destroy(); } catch { /* 尽力清理半挂载游戏的自有资源（rAF/定时器） */ }
      this.input?.dispose();
      this.input = null;
      this.observer?.disconnect();
      this.observer = null;
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
    this.screenEl = null;
    this.settleEl = null;
  }

  /**
   * 渲染或收起结算浮层。不自动聚焦主按钮——游戏的 Space 处理器仍在监听，
   * 自动聚焦会让一次 Space 同时触发按钮点击和游戏自身的重开逻辑。
   */
  private showSettle(view: SettleView | null): void {
    const el = this.settleEl;
    if (!el) return;
    if (!view) {
      el.hidden = true;
      el.innerHTML = '';
      this.screenEl?.classList.remove('is-settled');
      return;
    }
    el.innerHTML = settleHtml(view);
    el.hidden = false;
    this.screenEl?.classList.add('is-settled');
    el.querySelector('[data-act="settle-action"]')!.addEventListener('click', () => {
      this.audio.play('click');
      view.action.onPress();
    });
    el.querySelector('[data-act="settle-quit"]')!.addEventListener('click', () => {
      location.hash = '#/';
    });
  }

  private showError(root: HTMLElement): void {
    // 用 cab-btn 而非旧的 .btn —— 机柜样式落地后 .btn 规则将不复存在
    root.innerHTML = `
      <div class="frame-error">
        <p>💥 GAME ERROR · 游戏出错了</p>
        <button class="cab-btn" data-act="home">返回首页</button>
      </div>`;
    root.querySelector('[data-act="home"]')!.addEventListener('click', () => {
      location.hash = '#/';
    });
  }
}
