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
  private pauseBtn: HTMLButtonElement | null = null;
  private baseHints: string[] = [];              // key hints for the in-game state
  private isOverlayOpen = false;
  private overlayHints: string[] = [];           // snapshot taken when the overlay opens: its own hints, or whatever was on screen

  constructor(private audio: AudioFx, private storage: ArcadeStorage) {}

  open(root: HTMLElement, game: Game): void {
    this.close();
    this.paused = false;
    root.innerHTML = cabinetHtml(game.meta, this.audio.isMuted());

    const body = root.querySelector<HTMLElement>('.screen-body')!;
    this.cabinetEl = root.querySelector<HTMLElement>('.cabinet');
    this.screenEl = root.querySelector<HTMLElement>('.screen');
    this.settleEl = root.querySelector<HTMLElement>('.settle');
    this.pauseBtn = root.querySelector<HTMLButtonElement>('[data-act="pause"]');
    this.baseHints = game.meta.hints ?? [];

    // Blur after click, or a lingering focus lets Space trigger the button again.
    // The button may not exist (FLAPPY has no pause); skip silently when absent.
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
      // the class is only styling; aria-pressed is what tells a screen reader whether it's on or off
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
    const toolBound = new Set<string>(); // stops the same id being registered twice and firing twice per click

    const ctx: GameContext = {
      audio: this.audio,
      storage: this.storage,
      input: this.input,
      onResize: (cb) => {
        resizeCbs.add(cb);
        return () => resizeCbs.delete(cb);
      },
      overlay: (view) => this.showOverlay(view),
      head: root.querySelector<HTMLElement>('.cab-head'),
      side: root.querySelector<HTMLElement>('.cab-side'),
      pad: root.querySelector<HTMLElement>('.cab-pad'),
      // only the in-game hints change; while an overlay is up, applyHints keeps its hints from being clobbered
      setHints: (hints) => {
        this.baseHints = hints;
        this.applyHints();
      },
      onTool: (id, handler) => {
        const b = root.querySelector<HTMLButtonElement>(`[data-act="tool:${id}"]`);
        if (!b) {
          // wire()'s "skip silently when absent" exists for FLAPPY's missing pause button; here it
          // would make a misspelled id do nothing with no trace, so warn explicitly
          console.warn(`[arcade] onTool("${id}"): no such id in meta.tools`);
          return;
        }
        if (toolBound.has(id)) {
          console.warn(`[arcade] onTool("${id}") registered more than once; the later one is ignored`);
          return;
        }
        toolBound.add(id);
        b.addEventListener('click', () => {
          b.blur();
          handler();
        });
      },
      overlayOpen: () => this.isOverlayOpen,
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
      try { game.destroy(); } catch { /* best effort to free the half-mounted game's own resources (rAF/timers) */ }
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
    // Clear the overlay and slots before dropping references: overlay buttons and head/pad
    // buttons hold closures of the destroyed game, and the next open() is an `await entry.load()`
    // away — without this, dead but clickable buttons survive in that window (side has no
    // buttons, but would keep showing the previous game's numbers)
    this.clearSettle();
    this.cabinetEl?.querySelectorAll<HTMLElement>('.cab-head, .cab-side, .cab-pad')
      .forEach((slot) => { slot.innerHTML = ''; });
    this.input?.dispose();
    this.input = null;
    this.observer?.disconnect();
    this.observer = null;
    this.cabinetEl = null;
    this.pauseBtn = null;
    this.screenEl = null;
    this.settleEl = null;
    this.baseHints = [];
    this.overlayHints = [];
    this.isOverlayOpen = false;
  }

  private clearSettle(): void {
    if (this.settleEl) {
      this.settleEl.hidden = true;
      this.settleEl.innerHTML = '';
    }
    this.screenEl?.classList.remove('is-settled');
  }

  /**
   * Overlay state wins. "Which hints show now" is an explicit rule rather than call order —
   * otherwise a setHints from the game while the overlay is up would clobber
   * SPACE / TAP TO RETRY with the overlay still open.
   */
  /**
   * The overlay freezes the hint bar: while open it shows the snapshot taken at open time; a
   * setHints from the game only updates baseHints and takes effect once the overlay closes.
   */
  private applyHints(): void {
    this.renderHints(this.isOverlayOpen ? this.overlayHints : this.baseHints);
  }

  /** Replace the bottom key-hint bar; overlay and in-game copy differ (mockup artboards 1a vs 1b) */
  private renderHints(hints: string[]): void {
    const html = hintsBarHtml(hints);
    const bar = this.cabinetEl?.querySelector('.cab-hints');
    if (bar) bar.outerHTML = html;
    else if (html) this.cabinetEl?.insertAdjacentHTML('beforeend', html);
  }

  /**
   * Render or dismiss the overlay. The primary button is not auto-focused: the game's Space
   * handler is still listening, and a focused button would make one Space both click the button
   * and trigger the game's own restart.
   */
  private showOverlay(view: OverlayView | null): void {
    const el = this.settleEl;
    if (!el) return;
    if (!view) {
      this.clearSettle();
      this.isOverlayOpen = false;
      if (this.pauseBtn) this.pauseBtn.disabled = false;
      this.applyHints();
      return;
    }
    el.innerHTML = overlayHtml(view);
    el.hidden = false;
    this.screenEl?.classList.add('is-settled');
    this.overlayHints = view.hints ?? this.baseHints;
    this.isOverlayOpen = true;
    // Pausing makes no sense under an overlay, and games' retry() shares the paused guard —
    // "die → pause → RETRY" would give a dead button. Disabling it beats patching the state machine.
    if (this.pauseBtn) this.pauseBtn.disabled = true;
    this.applyHints();

    // Blur after click — same convention as the top-bar wire(), so a lingering focus can't make Space hit both the button and the game
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
    // cab-btn rather than the old .btn — the .btn rule no longer exists since the cabinet styles landed
    root.innerHTML = `
      <div class="frame-error">
        <p>💥 GAME ERROR · something went wrong</p>
        <button class="cab-btn" data-act="home">BACK TO HUB</button>
      </div>`;
    root.querySelector('[data-act="home"]')!.addEventListener('click', () => {
      location.hash = '#/';
    });
  }
}
