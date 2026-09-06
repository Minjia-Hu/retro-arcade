import type { Game, GameContext, OverlayView } from '../core/game';
import type { AudioFx } from '../core/audio';
import type { ArcadeStorage } from '../core/storage';
import { InputService } from '../core/input';
import { cabinetHtml, hintsBarHtml, overlayHtml } from './cabinet-view';

export class GameFrame {
  private game: Game | null = null;
  private input: InputService | null = null;
  private observer: ResizeObserver | null = null;
  private paused = false;
  private screenEl: HTMLElement | null = null;
  private settleEl: HTMLElement | null = null;
  private cabinetEl: HTMLElement | null = null;
  private baseHints: string[] = [];              // 游戏态的按键提示
  private settleHints: string[] | null = null;   // 结算态的提示；null 表示不在结算态

  constructor(private audio: AudioFx, private storage: ArcadeStorage) {}

  open(root: HTMLElement, game: Game): void {
    this.close();
    this.paused = false;
    root.innerHTML = cabinetHtml(game.meta, this.audio.isMuted());

    const body = root.querySelector<HTMLElement>('.screen-body')!;
    this.cabinetEl = root.querySelector<HTMLElement>('.cabinet');
    this.screenEl = root.querySelector<HTMLElement>('.screen');
    this.settleEl = root.querySelector<HTMLElement>('.settle');
    this.baseHints = game.meta.hints ?? [];

    // 点击后移除焦点，避免残留焦点让空格键误触按钮。
    // 按钮可能不存在（FLAPPY 没有暂停键），缺席时静默跳过。
    const wire = (act: string, fn: (b: HTMLButtonElement) => void) => {
      const b = root.querySelector<HTMLButtonElement>(`[data-act="${act}"]`);
      if (!b) return;
      b.addEventListener('click', () => {
        fn(b);
        b.blur();
      });
    };

    wire('back', () => {
      this.audio.play('click');
      location.hash = '#/';
    });
    wire('mute', (b) => {
      const muted = this.audio.toggleMuted();
      // class 只管样式；aria-pressed 才让屏幕阅读器知道当前是开还是关
      b.classList.toggle('is-off', muted);
      b.setAttribute('aria-pressed', String(muted));
      this.audio.play('click');
    });
    wire('pause', (b) => {
      if (!this.game) return;
      this.paused = !this.paused;
      b.textContent = this.paused ? '▶' : '❚❚';
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
    const pillEl = root.querySelector<HTMLElement>('.cab-pill');

    const ctx: GameContext = {
      audio: this.audio,
      storage: this.storage,
      input: this.input,
      onResize: (cb) => {
        resizeCbs.add(cb);
        return () => resizeCbs.delete(cb);
      },
      overlay: (view) => this.showOverlay(view),
      side: root.querySelector<HTMLElement>('.cab-side'),
      pad: root.querySelector<HTMLElement>('.cab-pad'),
      // 只更新游戏态那一路；结算态在时由 applyHints 保证浮层提示不被冲掉
      setHints: (hints) => {
        this.baseHints = hints;
        this.applyHints();
      },
      onTool: (id, handler) => {
        wire(`tool:${id}`, () => handler());
      },
      setPill: (text) => {
        if (!pillEl) return;
        pillEl.textContent = text ?? '';
        pillEl.hidden = text === null;
      },
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
    // 先收浮层再断引用：浮层按钮持有已 destroy 游戏的 onPress 闭包，而路由切换到
    // 下一次 open() 之间隔着 await entry.load()，不收会在这个窗口里留下可点的死按钮
    this.clearSettle();
    this.input?.dispose();
    this.input = null;
    this.observer?.disconnect();
    this.observer = null;
    this.cabinetEl = null;
    this.screenEl = null;
    this.settleEl = null;
    this.baseHints = [];
    this.settleHints = null;
  }

  private clearSettle(): void {
    if (this.settleEl) {
      this.settleEl.hidden = true;
      this.settleEl.innerHTML = '';
    }
    this.screenEl?.classList.remove('is-settled');
  }

  /**
   * 结算态优先。把「当前该显示哪条提示」写成显式规则，而不是靠调用顺序——
   * 否则浮层展示期间游戏若调 setHints，会把 SPACE / TAP TO RETRY 冲掉而浮层还开着。
   */
  private applyHints(): void {
    this.renderHints(this.settleHints ?? this.baseHints);
  }

  /** 替换底部按键提示条；结算态与游戏态的文案不同（设计稿 artboard 1a vs 1b） */
  private renderHints(hints: string[]): void {
    const html = hintsBarHtml(hints);
    const bar = this.cabinetEl?.querySelector('.cab-hints');
    if (bar) bar.outerHTML = html;
    else if (html) this.cabinetEl?.insertAdjacentHTML('beforeend', html);
  }

  /**
   * 渲染或收起结算浮层。不自动聚焦主按钮——游戏的 Space 处理器仍在监听，
   * 自动聚焦会让一次 Space 同时触发按钮点击和游戏自身的重开逻辑。
   */
  private showOverlay(view: OverlayView | null): void {
    const el = this.settleEl;
    if (!el) return;
    if (!view) {
      this.clearSettle();
      this.settleHints = null;
      this.applyHints();
      return;
    }
    el.innerHTML = overlayHtml(view);
    el.hidden = false;
    this.screenEl?.classList.add('is-settled');
    this.settleHints = view.hints ?? null;
    this.applyHints();

    // 点完就 blur：与顶栏 wire() 同一约定，避免残留焦点让空格键既触发按钮又触发游戏逻辑
    view.actions.forEach((a, i) => {
      const b = el.querySelector<HTMLButtonElement>(`[data-act="overlay:${i}"]`);
      b?.addEventListener('click', () => {
        b.blur();
        this.audio.play('click');
        a.onPress();
      });
    });
    const quit = el.querySelector<HTMLButtonElement>('[data-act="overlay-quit"]');
    quit?.addEventListener('click', () => {
      quit.blur();
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
