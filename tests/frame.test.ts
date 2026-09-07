// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameFrame } from '../src/shell/frame';
import { AudioFx } from '../src/core/audio';
import { ArcadeStorage, memoryBackend } from '../src/core/storage';
import type { Game, GameContext, GameMeta } from '../src/core/game';

globalThis.ResizeObserver = class {
  observe() {}
  disconnect() {}
} as never;

function fakeGame(meta: Partial<GameMeta> = {}): { game: Game; ctx: () => GameContext } {
  let captured: GameContext | null = null;
  const game: Game = {
    meta: { id: 'snake', name: '贪吃蛇', icon: '🐍', hints: ['PLAY HINT'], ...meta },
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
// 必须真的 close：InputService.onKey 绑的是 window，只清 body 不解绑。
// 今天的假游戏不监听输入所以无害，但第一个监听键盘的用例会开始跨用例叠加。
afterEach(() => { opened.splice(0).forEach((f) => f.close()); });

describe('提示条', () => {
  it('挂载时用 meta.hints', () => {
    const { root } = mount();
    expect(hints(root)).toContain('PLAY HINT');
  });

  it('setHints 覆写，浮层收起后还原成它而非 meta.hints', () => {
    const { root, ctx } = mount();
    ctx.setHints(['LIVE 42']);
    expect(hints(root)).toContain('LIVE 42');

    ctx.overlay({ title: 'X', tone: 'lose', lines: [], actions: [{ label: 'A', onPress: () => {} }], hints: ['OVER HINT'] });
    expect(hints(root)).toContain('OVER HINT');

    ctx.overlay(null);
    expect(hints(root)).toContain('LIVE 42');
  });

  it('结算态优先：浮层展示期间 setHints 不冲掉浮层提示', () => {
    const { root, ctx } = mount();
    ctx.overlay({ title: 'X', tone: 'lose', lines: [], actions: [{ label: 'A', onPress: () => {} }], hints: ['OVER HINT'] });
    ctx.setHints(['LIVE 42']);
    expect(hints(root)).toContain('OVER HINT');
    ctx.overlay(null);
    expect(hints(root)).toContain('LIVE 42');
  });
});

describe('浮层', () => {
  it('多个动作各自绑定，点击调用对应回调', () => {
    const { root, ctx } = mount();
    const hit: string[] = [];
    ctx.overlay({
      title: 'MENU', tone: 'win', lines: [],
      actions: ['A', 'B', 'C'].map((l) => ({ label: l, onPress: () => hit.push(l) })),
    });
    root.querySelector<HTMLButtonElement>('[data-act="overlay:1"]')!.click();
    expect(hit).toEqual(['B']);
  });

  it('close 收起浮层', () => {
    const { root, frame, ctx } = mount();
    ctx.overlay({ title: 'X', tone: 'lose', lines: [], actions: [{ label: 'A', onPress: () => {} }] });
    expect(root.querySelector('.settle-card')).not.toBeNull();
    frame.close();
    expect(root.querySelector('.settle-card')).toBeNull();
  });
});

describe('顶栏', () => {
  it('pausable 为 false 时没有暂停按钮', () => {
    const { root } = mount({ pausable: false });
    expect(root.querySelector('[data-act="pause"]')).toBeNull();
    expect(root.querySelector('[data-act="mute"]')).not.toBeNull();
  });

  it('浮层开着时 overlayOpen 为真，收起后为假', () => {
    const { ctx } = mount();
    expect(ctx.overlayOpen()).toBe(false);
    ctx.overlay({ title: 'X', tone: 'win', lines: [], actions: [{ label: 'A', onPress: () => {} }] });
    expect(ctx.overlayOpen()).toBe(true);
    ctx.overlay(null);
    expect(ctx.overlayOpen()).toBe(false);
  });

  it('浮层不带 hints 时，游戏调 setHints 也不改写屏幕', () => {
    const { root, ctx } = mount();
    ctx.setHints(['LIVE 1']);
    // 这个浮层没有 hints —— 早先用 settleHints===null 判优先级时，这里会被冲掉
    ctx.overlay({ title: 'X', tone: 'win', lines: [], actions: [{ label: 'A', onPress: () => {} }] });
    ctx.setHints(['LIVE 2']);
    expect(hints(root)).toContain('LIVE 1');
    ctx.overlay(null);
    expect(hints(root)).toContain('LIVE 2');
  });

  it('onTool 绑定声明过的工具按钮', () => {
    const { root, ctx } = mount({ tools: [{ id: 'menu', label: '☰', aria: '菜单' }] });
    let hit = 0;
    ctx.onTool('menu', () => { hit += 1; });
    root.querySelector<HTMLButtonElement>('[data-act="tool:menu"]')!.click();
    expect(hit).toBe(1);
  });

  it('setPill 改写药丸并控制显隐', () => {
    const { root, ctx } = mount();
    const pill = root.querySelector<HTMLElement>('.cab-pill')!;
    expect(pill.hidden).toBe(true); // 起手隐藏，内容只能来自 setPill
    ctx.setPill('EASY');
    expect(pill.textContent).toBe('EASY');
    ctx.setPill('HARD');
    expect(pill.textContent).toBe('HARD');
    ctx.setPill(null);
    expect(pill.hidden).toBe(true);
  });
});

describe('插槽', () => {
  it('按 meta 提供 side / pad，否则为 null', () => {
    expect(mount().ctx.side).toBeNull();
    expect(mount().ctx.pad).toBeNull();
    expect(mount({ side: true }).ctx.side).not.toBeNull();
    expect(mount({ pad: true }).ctx.pad).not.toBeNull();
  });

  it('按 meta 提供 head，否则为 null', () => {
    expect(mount().ctx.head).toBeNull();
    expect(mount({ head: true }).ctx.head).not.toBeNull();
  });
});
