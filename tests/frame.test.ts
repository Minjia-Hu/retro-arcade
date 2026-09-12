// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameFrame } from '../src/shell/frame';
import { AudioFx } from '../src/core/audio';
import { ArcadeStorage, memoryBackend } from '../src/core/storage';
import type { Game, GameContext, GameMeta } from '../src/core/game';
import css from '../src/styles/arcade.css?raw';

globalThis.ResizeObserver = class {
  observe() {}
  disconnect() {}
} as never;

function fakeGame(meta: Partial<GameMeta> = {}): { game: Game; ctx: () => GameContext } {
  let captured: GameContext | null = null;
  const game: Game = {
    meta: { id: 'snake', name: 'Snake', icon: '🐍', hints: ['PLAY HINT'], ...meta },
    mount(_host, context) { captured = context; },
    pause() {},
    resume() {},
    destroy() {},
  };
  return { game, ctx: () => captured! };
}

const opened: GameFrame[] = [];

function mount(meta?: Partial<GameMeta>) {
  const root = document.createElement('div');
  document.body.appendChild(root);
  const storage = new ArcadeStorage(memoryBackend());
  const frame = new GameFrame(new AudioFx(storage), storage);
  const { game, ctx } = fakeGame(meta);
  frame.open(root, game);
  opened.push(frame);
  return { root, frame, ctx: ctx() };
}

const hints = (root: HTMLElement) => root.querySelector('.cab-hints')?.textContent ?? '';

beforeEach(() => { document.body.innerHTML = ''; });
// Must really close: InputService.onKey binds to window, and clearing body doesn't unbind.
// Today's fake game listens to nothing, but the first keyboard-listening case would start leaking across cases.
afterEach(() => { opened.splice(0).forEach((f) => f.close()); });

describe('hint bar', () => {
  it('uses meta.hints on mount', () => {
    const { root } = mount();
    expect(hints(root)).toContain('PLAY HINT');
  });

  it('setHints overrides; after the overlay closes it is restored, not meta.hints', () => {
    const { root, ctx } = mount();
    ctx.setHints(['LIVE 42']);
    expect(hints(root)).toContain('LIVE 42');

    ctx.overlay({ title: 'X', tone: 'lose', lines: [], actions: [{ label: 'A', onPress: () => {} }], hints: ['OVER HINT'] });
    expect(hints(root)).toContain('OVER HINT');

    ctx.overlay(null);
    expect(hints(root)).toContain('LIVE 42');
  });

  it('overlay state wins: setHints while the overlay is up does not clobber its hints', () => {
    const { root, ctx } = mount();
    ctx.overlay({ title: 'X', tone: 'lose', lines: [], actions: [{ label: 'A', onPress: () => {} }], hints: ['OVER HINT'] });
    ctx.setHints(['LIVE 42']);
    expect(hints(root)).toContain('OVER HINT');
    ctx.overlay(null);
    expect(hints(root)).toContain('LIVE 42');
  });
});

describe('overlay', () => {
  it('multiple actions bind separately; a click calls its own callback', () => {
    const { root, ctx } = mount();
    const hit: string[] = [];
    ctx.overlay({
      title: 'MENU', tone: 'win', lines: [],
      actions: ['A', 'B', 'C'].map((l) => ({ label: l, onPress: () => hit.push(l) })),
    });
    root.querySelector<HTMLButtonElement>('[data-act="overlay:1"]')!.click();
    expect(hit).toEqual(['B']);
  });

  it('close dismisses the overlay', () => {
    const { root, frame, ctx } = mount();
    ctx.overlay({ title: 'X', tone: 'lose', lines: [], actions: [{ label: 'A', onPress: () => {} }] });
    expect(root.querySelector('.settle-card')).not.toBeNull();
    frame.close();
    expect(root.querySelector('.settle-card')).toBeNull();
  });
});

describe('top bar', () => {
  it('pausable: false has no pause button', () => {
    const { root } = mount({ pausable: false });
    expect(root.querySelector('[data-act="pause"]')).toBeNull();
    expect(root.querySelector('[data-act="mute"]')).not.toBeNull();
  });

  it('overlayOpen is true while open, false after dismiss', () => {
    const { ctx } = mount();
    expect(ctx.overlayOpen()).toBe(false);
    ctx.overlay({ title: 'X', tone: 'win', lines: [], actions: [{ label: 'A', onPress: () => {} }] });
    expect(ctx.overlayOpen()).toBe(true);
    ctx.overlay(null);
    expect(ctx.overlayOpen()).toBe(false);
  });

  it('with an overlay that has no hints, setHints from the game still does not touch the screen', () => {
    const { root, ctx } = mount();
    ctx.setHints(['LIVE 1']);
    // This overlay has no hints — back when priority was judged by settleHints===null, this got clobbered
    ctx.overlay({ title: 'X', tone: 'win', lines: [], actions: [{ label: 'A', onPress: () => {} }] });
    ctx.setHints(['LIVE 2']);
    expect(hints(root)).toContain('LIVE 1');
    ctx.overlay(null);
    expect(hints(root)).toContain('LIVE 2');
  });

  it('onTool binds a declared tool button', () => {
    const { root, ctx } = mount({ tools: [{ id: 'menu', label: '☰', aria: 'Menu' }] });
    let hit = 0;
    ctx.onTool('menu', () => { hit += 1; });
    root.querySelector<HTMLButtonElement>('[data-act="tool:menu"]')!.click();
    expect(hit).toBe(1);
  });

  it('setPill writes the pill and toggles its visibility', () => {
    const { root, ctx } = mount();
    const pill = root.querySelector<HTMLElement>('.cab-pill')!;
    expect(pill.hidden).toBe(true); // hidden at first; content only comes from setPill
    ctx.setPill('EASY');
    expect(pill.textContent).toBe('EASY');
    ctx.setPill('HARD');
    expect(pill.textContent).toBe('HARD');
    ctx.setPill(null);
    expect(pill.hidden).toBe(true);
  });
});

describe('slots', () => {
  it('provides side / pad per meta, otherwise null', () => {
    expect(mount().ctx.side).toBeNull();
    expect(mount().ctx.pad).toBeNull();
    expect(mount({ side: true }).ctx.side).not.toBeNull();
    expect(mount({ pad: true }).ctx.pad).not.toBeNull();
  });

  it('provides head per meta, otherwise null', () => {
    expect(mount().ctx.head).toBeNull();
    expect(mount({ head: true }).ctx.head).not.toBeNull();
  });
});

describe('overlay and pause', () => {
  it('the pause button is disabled while an overlay is open, restored after', () => {
    const { root, ctx } = mount();
    const pause = root.querySelector<HTMLButtonElement>('[data-act="pause"]')!;
    expect(pause.disabled).toBe(false);
    ctx.overlay({ title: 'X', tone: 'lose', lines: [], actions: [{ label: 'A', onPress: () => {} }] });
    expect(pause.disabled).toBe(true);
    ctx.overlay(null);
    expect(pause.disabled).toBe(false);
  });

  it('the overlay backdrop passes pointer events, the card catches them', () => {
    // The dark-screen games' TAP TO RETRY relies on the canvas's own onTap; if .settle swallowed pointer events, phones couldn't tap it
    expect(css).toMatch(/\.settle\s*\{[^}]*pointer-events:\s*none/);
    expect(css).toMatch(/\.settle-card\s*\{[^}]*pointer-events:\s*auto/);
  });
});

describe('close', () => {
  it('empties head / side / pad so no dead buttons linger before the next open', () => {
    const { root, frame, ctx } = mount({ head: true, side: true, pad: true });
    ctx.head!.innerHTML = '<button>H</button>';
    ctx.side!.innerHTML = '<span>S</span>';
    ctx.pad!.innerHTML = '<button>P</button>';
    frame.close();
    expect(root.querySelector('.cab-head')!.innerHTML).toBe('');
    expect(root.querySelector('.cab-side')!.innerHTML).toBe('');
    expect(root.querySelector('.cab-pad')!.innerHTML).toBe('');
  });
});
