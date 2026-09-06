# 深色屏三款（子项目 B）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 TETRIS / BREAKOUT / FLAPPY 迁到 Sunset Arcade 暖霓虹配色与共用结算浮层，并给机柜补上侧栏、控制垫、可选暂停、动态提示条四项能力。

**Architecture:** 沿用子项目 A 的机柜外壳。新增的两个 DOM 插槽（`.cab-side` / `.cab-pad`）由 frame 提供空容器与样式，内容由游戏自己填——只有 TETRIS 一个消费者，不做抽象。

**Tech Stack:** Vite 5 + TypeScript 5 + Vitest 2 + Playwright 1.46，无前端框架，DOM 直出 + canvas。

**Spec:** `docs/superpowers/specs/2026-09-06-sunset-arcade-dark-screens-design.md`

---

## 背景：读计划前必须知道的事

1. **子项目 A 已合并**（`a53780d`）。机柜外壳、结算浮层、`SCREEN` 调色板、`GameContext.settle`
   都已存在并被 SNAKE 消费。读 `src/games/snake/index.ts` 是了解目标形态的最快方式。
2. **不要动三个游戏的 `logic.ts`。** B 只改渲染与外壳，不动玩法。
   `tests/{tetris,breakout,flappy}-logic.test.ts` 三个文件**应当零改动**——这是判断有没有越界的判据。
3. **TETRIS 的画布底部有一排触屏按钮**（`BTNS`），是手机上唯一的操作方式。本计划把它们搬到 DOM，
   不是删掉。设计稿 2a 是桌面稿，没画这排按钮。
4. **保持现有画布逻辑尺寸**（BREAKOUT / FLAPPY 均 320×480）。设计稿的 360×480 / 360×540
   是等比放大，改尺寸会动到碰撞与难度手感。TETRIS 是例外——它的画布要缩成纯棋盘，
   因为侧栏和按钮排都搬走了。
5. 未跟踪的 `design_handoff_sunset_arcade_homepage*/` 是设计参考资料，**任何任务都不要提交它**。

## 文件结构

| 文件 | 本次职责 |
|---|---|
| `src/core/game.ts`（改） | `GameMeta` 加 `side`/`pad`/`pausable`；`GameContext` 加 `side`/`pad`/`setHints` |
| `src/core/theme.ts`（改） | `SCREEN.glow` 补 `orange`/`white` |
| `src/shell/cabinet-view.ts`（改） | 可选 pause、侧栏容器、控制垫容器 |
| `src/shell/frame.ts`（改） | 两个插槽的引用、pause 可缺省、开放 `setHints` |
| `src/styles/arcade.css`（改） | `.cab-side` / `.side-*` / `.cab-pad` / `.pad-btn` |
| `src/games/tetris/index.ts`（改） | 画布缩成棋盘、侧栏与控制垫改 DOM、暖霓虹、接 settle |
| `src/games/breakout/index.ts`（改） | 暖霓虹、接 settle |
| `src/games/flappy/index.ts`（改） | 暖霓虹、无暂停、动态 BEST 提示条、接 settle |

---

## Task 1: 核心类型与调色板扩展

**Files:**
- Modify: `src/core/game.ts`
- Modify: `src/core/theme.ts`

本任务只加可选字段与常量，不会破坏任何现有行为。`GameContext` 的三个新成员会让
`frame.ts` 编译不过——所以本任务**不改 `GameContext`**，留到 Task 3 与 frame 一起改。

- [ ] **Step 1: GameMeta 加三个可选字段**

`src/core/game.ts` 的 `GameMeta` 改为：

```ts
export interface GameMeta {
  id: string;
  name: string;
  icon: string;
  /** 首页展示用的英文大写名；缺省时回退到 name */
  displayName?: string;
  /** 机柜底部的按键提示，用 · 分隔渲染 */
  hints?: string[];
  /** 屏幕井风格：深色屏或浅色纸盘，缺省 dark */
  screen?: 'dark' | 'paper';
  /** 需要屏幕井右侧的侧栏时置 true，内容由游戏自己填 */
  side?: boolean;
  /** 需要屏幕下方的触屏控制垫时置 true，内容由游戏自己填 */
  pad?: boolean;
  /** 顶栏是否渲染暂停按钮，缺省 true。FLAPPY 按设计稿不显示 */
  pausable?: boolean;
}
```

- [ ] **Step 2: SCREEN.glow 补两色**

`src/core/theme.ts` 的 `SCREEN.glow` 改为：

```ts
  /** 发光统一用同色 50% alpha（白色偏亮，用 80%） */
  glow: {
    teal: 'rgba(46, 230, 200, .5)',
    gold: 'rgba(255, 201, 60, .5)',
    pink: 'rgba(255, 92, 158, .5)',
    orange: 'rgba(255, 140, 66, .5)',
    white: 'rgba(255, 250, 240, .8)',
  },
```

- [ ] **Step 3: 类型检查与测试**

Run: `npx tsc --noEmit && npm test`
Expected: 无类型错误，215 个用例全部 PASS。

- [ ] **Step 4: 提交**

```bash
git add src/core/game.ts src/core/theme.ts
git commit -m "feat: add cabinet slot flags and the remaining screen glows"
```

---

## Task 2: 机柜视图支持插槽与可选暂停

**Files:**
- Modify: `src/shell/cabinet-view.ts`
- Modify: `tests/cabinet-view.test.ts`

- [ ] **Step 1: 写失败测试**

在 `tests/cabinet-view.test.ts` 末尾追加：

```ts
describe('cabinetHtml 可选暂停', () => {
  it('缺省渲染暂停按钮', () => {
    expect(cabinetHtml(snake, false)).toContain('data-act="pause"');
  });

  it('pausable 为 false 时不渲染暂停按钮', () => {
    const html = cabinetHtml({ ...snake, pausable: false }, false);
    expect(html).not.toContain('data-act="pause"');
    expect(html).toContain('data-act="mute"'); // 静音按钮仍在
  });
});

describe('cabinetHtml 插槽', () => {
  it('缺省不渲染侧栏与控制垫', () => {
    const html = cabinetHtml(snake, false);
    expect(html).not.toContain('cab-side');
    expect(html).not.toContain('cab-pad');
  });

  it('side 为 true 时在屏幕井里渲染空侧栏', () => {
    expect(cabinetHtml({ ...snake, side: true }, false)).toContain('<div class="cab-side"></div>');
  });

  it('pad 为 true 时在屏幕井之后渲染空控制垫', () => {
    expect(cabinetHtml({ ...snake, pad: true }, false)).toContain('<div class="cab-pad"></div>');
  });

  it('控制垫排在提示条之前', () => {
    const html = cabinetHtml({ ...snake, pad: true }, false);
    expect(html.indexOf('cab-pad')).toBeLessThan(html.indexOf('cab-hints'));
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/cabinet-view.test.ts`
Expected: FAIL —— 至少 4 条新用例红（`pausable: false` 仍渲染 pause、无 `cab-side`、无 `cab-pad`）。

- [ ] **Step 3: 改 cabinetHtml**

`src/shell/cabinet-view.ts` 的 `cabinetHtml` 改为：

```ts
/** 机柜外壳。游戏挂载到 .screen-body，结算浮层由 settleHtml 填进 .settle */
export function cabinetHtml(meta: GameMeta, muted: boolean): string {
  const name = meta.displayName ?? meta.name;
  const hintsHtml = hintsBarHtml(meta.hints ?? []);
  const pauseHtml = meta.pausable === false
    ? ''
    : '<button class="cab-btn" data-act="pause" aria-label="暂停">❚❚</button>';
  const sideHtml = meta.side ? '<div class="cab-side"></div>' : '';
  const padHtml = meta.pad ? '<div class="cab-pad"></div>' : '';

  return `
    <div class="cabinet accent-${accentOf(meta.id)}">
      <div class="cab-bar">
        <button class="cab-btn" data-act="back">◀ BACK</button>
        <span class="cab-id">
          <!-- pixelIconSvg 的输出只由白名单查表与数字构成，不含任何入参文本，故不转义 -->
          <span class="px px-xs">${pixelIconSvg(meta.id)}</span>
          <span class="cab-name">${esc(name)}</span>
        </span>
        <span class="cab-tools">
          ${pauseHtml}
          <button class="cab-btn${muted ? ' is-off' : ''}" data-act="mute" aria-pressed="${muted}" aria-label="音效">SND</button>
        </span>
      </div>
      <div class="cab-screen">
        <div class="screen screen-${meta.screen ?? 'dark'}">
          <div class="screen-body"></div>
          <div class="screen-glass"></div>
          <div class="settle" role="status" aria-live="polite" hidden></div>
        </div>
        ${sideHtml}
      </div>
      ${padHtml}
      ${hintsHtml}
    </div>`;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run tests/cabinet-view.test.ts && npm test`
Expected: 全部 PASS。

- [ ] **Step 5: 提交**

```bash
git add src/shell/cabinet-view.ts tests/cabinet-view.test.ts
git commit -m "feat: render optional pause button and the side/pad slots"
```

---

## Task 3: frame 接入插槽与公开 setHints

**Files:**
- Modify: `src/core/game.ts`（`GameContext`）
- Modify: `src/shell/frame.ts`

- [ ] **Step 1: GameContext 加三个成员**

`src/core/game.ts` 的 `GameContext` 改为：

```ts
export interface GameContext {
  audio: AudioFx;
  storage: ArcadeStorage;
  input: InputService;
  /** 注册容器尺寸变化回调，返回解除函数 */
  onResize(cb: () => void): () => void;
  /** 上报结算状态；传 null 收起浮层 */
  settle(view: SettleView | null): void;
  /** 侧栏容器；meta.side 为 true 时可用，否则为 null */
  side: HTMLElement | null;
  /** 控制垫容器；meta.pad 为 true 时可用，否则为 null */
  pad: HTMLElement | null;
  /** 替换底部按键提示条 */
  setHints(hints: string[]): void;
}
```

- [ ] **Step 2: 改 frame.ts**

三处改动。

**其一**，把私有方法 `setHints` 改名为 `renderHints`（避免与新的公开接口重名），
两处调用点（`showSettle` 里的两次）一并改名。

**其二**，把 `open()` 里的 `wire` 与 `btn` helper 替换成下面这个能容忍按钮缺席的版本，
并删掉原来的 `const btn = ...` 那一行：

```ts
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
```

**其三**，`ctx` 对象补三个成员：

```ts
    const ctx: GameContext = {
      audio: this.audio,
      storage: this.storage,
      input: this.input,
      onResize: (cb) => {
        resizeCbs.add(cb);
        return () => resizeCbs.delete(cb);
      },
      settle: (view) => this.showSettle(view),
      side: root.querySelector<HTMLElement>('.cab-side'),
      pad: root.querySelector<HTMLElement>('.cab-pad'),
      // 公开版本必须同时更新 baseHints，否则结算浮层收起时会把游戏设的文案冲掉
      setHints: (hints) => {
        this.baseHints = hints;
        this.renderHints(hints);
      },
    };
```

- [ ] **Step 3: 类型检查与测试**

Run: `npx tsc --noEmit && npm test && npm run e2e`
Expected: 无类型错误，215 单测全过，12 e2e 全过。此时还没有任何游戏用到新插槽，行为不变。

- [ ] **Step 4: 提交**

```bash
git add src/core/game.ts src/shell/frame.ts
git commit -m "feat: expose the side/pad slots and hint control to games"
```

---

## Task 4: 插槽样式

**Files:**
- Modify: `src/styles/arcade.css`

- [ ] **Step 1: 屏幕井加间隙**

把 `.cab-screen` 那条规则改为（加 `gap`，供侧栏使用）：

```css
.cab-screen { padding: 22px; display: flex; justify-content: center; gap: 16px; background: var(--well); }
```

- [ ] **Step 2: 补侧栏与控制垫样式**

在 `.cab-hints` 那条规则**之前**插入：

```css
/* ---- 侧栏（当前只有 TETRIS 用）---- */
.cab-side { display: flex; flex-direction: column; gap: 12px; width: 110px; flex: none; }
.side-card {
  background: var(--panel); border: 2px solid var(--ink); border-radius: 10px;
  box-shadow: 3px 3px 0 var(--ink); padding: 12px;
  display: flex; flex-direction: column; align-items: center; gap: 6px;
}
.side-label { font-family: 'Bungee', 'Space Grotesk', sans-serif; font-size: 10px; color: var(--dim); }
.side-value { font-family: var(--mono); font-weight: 700; font-size: 16px; color: var(--ink); }
.side-value-accent { color: var(--orange); }
.side-value-dim { font-size: 14px; color: var(--dim); }
.side-piece { position: relative; display: block; width: 44px; height: 30px; }
.side-piece i { position: absolute; box-shadow: inset -2px -2px 0 rgba(0, 0, 0, .25); }

/* ---- 触屏控制垫（当前只有 TETRIS 用）---- */
.cab-pad {
  display: flex; justify-content: center; flex-wrap: wrap; gap: 8px;
  padding: 12px; border-top: 3px solid var(--ink);
}
.pad-btn {
  width: 48px; height: 48px; font-size: 20px; line-height: 1;
  background: var(--paper); border: 2px solid var(--ink); border-radius: 8px;
  box-shadow: 3px 3px 0 var(--ink); color: var(--ink);
  transition: transform .1s, box-shadow .1s;
}
.pad-btn:hover { transform: translate(2px, 2px); box-shadow: 1px 1px 0 var(--ink); }
.pad-btn:active { transform: translate(3px, 3px); box-shadow: 0 0 0 var(--ink); }
.pad-btn:focus-visible { outline: none; box-shadow: 3px 3px 0 var(--ink), var(--focus-ring); }
```

- [ ] **Step 3: 减少动效的媒体查询补上 pad-btn**

把该媒体查询的选择器改为：

```css
@media (prefers-reduced-motion: reduce) {
  .btn-start, .btn-accept, .card, .cab-btn, .settle-action, .pad-btn { transition: none; }
}
```

- [ ] **Step 4: 构建与测试**

Run: `npm run build && npm test && npm run e2e`
Expected: 全部通过。此时样式已就位但无人使用，页面外观不变。

- [ ] **Step 5: 提交**

```bash
git add src/styles/arcade.css
git commit -m "feat: style the cabinet side panel and touch pad"
```

---

## Task 5: TETRIS

三个游戏里改动最大的一个：画布缩成纯棋盘，侧栏与触屏按钮排都搬到 DOM。

**Files:**
- Modify: `src/games/tetris/index.ts`

**不要动 `src/games/tetris/logic.ts` 与 `tests/tetris-logic.test.ts`。**

- [ ] **Step 1: 换掉文件头部的常量**

把 `src/games/tetris/index.ts` 顶部从 `import` 到 `BTNS` 定义结束的那一段
（即 `const W`、`const H`、`const CELL`、`const BOARD_X`、`const BOARD_Y`、`const SIDE_X`、
`const REPEAT_DELAY`、`PIECE_COLORS`、`BTN_Y`、`type Btn`、`const BTNS` 全部）替换为：

```ts
import type { Game, GameContext } from '../../core/game';
import { GameLoop } from '../../core/loop';
import { SCREEN } from '../../core/theme';
import * as L from './logic';

const CELL = 22;
const W = L.COLS * CELL; // 220：画布只剩棋盘，边框圆角由 .screen 提供
const H = L.ROWS * CELL; // 440
const REPEAT_DELAY = 0.11; // 按住左右/软降的重复间隔（秒）

/** 七种方块循环取暖霓虹四色（设计稿 2a 的 NE 对象就是这四色） */
const PIECE_TONES = ['teal', 'gold', 'pink', 'orange'] as const;
const pieceFill = (type: number): string => SCREEN[PIECE_TONES[type % PIECE_TONES.length]];
const pieceGlow = (type: number): string => SCREEN.glow[PIECE_TONES[type % PIECE_TONES.length]];

type PadId = 'left' | 'right' | 'rotate' | 'soft' | 'hard' | 'hold';

const PAD: { id: PadId; label: string; aria: string }[] = [
  { id: 'left', label: '◀', aria: '左移' },
  { id: 'right', label: '▶', aria: '右移' },
  { id: 'rotate', label: '⟳', aria: '旋转' },
  { id: 'soft', label: '▼', aria: '软降' },
  { id: 'hard', label: '⤓', aria: '硬降' },
  { id: 'hold', label: '⇄', aria: '暂存' },
];

function pad(n: number, width: number): string {
  return String(Math.max(0, Math.floor(n))).padStart(width, '0');
}
```

- [ ] **Step 2: 局部变量补侧栏引用与纪录快照**

在 `let repeatTimer = 0;` 之后补：

```ts
  let bestAtStart = 0; // 本局开始前的最高分，用来判断是否刷新纪录
  let side: {
    next: HTMLElement; hold: HTMLElement;
    score: HTMLElement; level: HTMLElement; best: HTMLElement;
  } | null = null;
  let shownNext: number | null = -1; // 侧栏迷你块的重绘节流：仅在换块时改 innerHTML
  let shownHold: number | null = -1;
```

- [ ] **Step 3: act 的签名改用 PadId，删除画布按钮命中**

把 `act(id: Btn['id'])` 的签名改为 `act(id: PadId)`（函数体不变）。

把 `tapAt` 整个函数替换为——画布点按只保留「开始 / 重开」：

```ts
  function tapBoard(): void {
    if (paused) return;
    primary();
  }
```

- [ ] **Step 4: primary 里重开时收浮层并重置快照**

把 `primary()` 替换为：

```ts
  function primary(): void {
    if (paused) return;
    if (state.status === 'ready') {
      L.start(state);
      ctx?.audio.play('click');
    } else if (state.status === 'over') {
      if (performance.now() - endedAt < 400) return;
      restart();
    }
  }

  /** 浮层 RETRY 按钮的入口：共用 paused 卫语句，但不继承 primary 的 400ms 防连点 */
  function retry(): void {
    if (paused) return;
    restart();
  }

  function restart(): void {
    state = L.createState();
    bestAtStart = best;
    ctx?.settle(null);
    ctx?.audio.play('click');
  }
```

- [ ] **Step 5: 终局时上报结算**

`afterEvents` 里的 `if (ev.over)` 分支、以及 `doHold` 里的 `if (state.status === 'over')` 分支，
都在 `ctx?.audio.play('over')` 之后补一行 `reportOver();`。并在 `afterEvents` 之前新增：

```ts
  function reportOver(): void {
    const record = state.score > bestAtStart;
    ctx?.settle({
      title: record ? 'NEW HIGH SCORE' : 'GAME OVER',
      tone: record ? 'record' : 'lose',
      lines: [`SCORE ${pad(state.score, 6)}`, `LINES ${pad(state.lines, 3)}`, `BEST ${pad(best, 6)}`],
      action: { label: '▶ RETRY', onPress: retry },
      hints: ['SPACE / TAP TO RETRY'],
    });
  }
```

- [ ] **Step 6: 侧栏与控制垫的 DOM 构建**

把 `drawMini` 整个函数替换为下面三个函数：

```ts
  /** 迷你块用 DOM 小方块拼；格子尺寸按块宽自适应，I 型（4 格宽）也不会溢出 44px */
  function miniHtml(type: number | null): string {
    if (type === null) return '';
    const def = L.PIECE_DEFS[type];
    const size = Math.min(13, Math.floor(44 / def.size));
    const ox = (44 - def.size * size) / 2;
    const oy = (30 - def.size * size) / 2;
    return L.rotatedCells(type, 0)
      .map(([cx, cy]) =>
        `<i style="left:${ox + cx * size}px;top:${oy + cy * size}px;` +
        `width:${size}px;height:${size}px;background:${pieceFill(type)}"></i>`)
      .join('');
  }

  function buildSide(host: HTMLElement): void {
    host.innerHTML = `
      <div class="side-card"><span class="side-label">NEXT</span><span class="side-piece" data-ref="next"></span></div>
      <div class="side-card"><span class="side-label">HOLD</span><span class="side-piece" data-ref="hold"></span></div>
      <div class="side-card"><span class="side-label">SCORE</span><span class="side-value" data-ref="score">000000</span></div>
      <div class="side-card"><span class="side-label">LEVEL</span><span class="side-value side-value-accent" data-ref="level">01</span></div>
      <div class="side-card"><span class="side-label">BEST</span><span class="side-value side-value-dim" data-ref="best">000000</span></div>`;
    const q = (ref: string) => host.querySelector<HTMLElement>(`[data-ref="${ref}"]`)!;
    side = { next: q('next'), hold: q('hold'), score: q('score'), level: q('level'), best: q('best') };
    shownNext = -1;
    shownHold = -1;
  }

  function buildPad(host: HTMLElement): void {
    host.innerHTML = PAD
      .map((b) => `<button class="pad-btn" data-pad="${b.id}" aria-label="${b.aria}">${b.label}</button>`)
      .join('');
    host.querySelectorAll<HTMLButtonElement>('[data-pad]').forEach((el) => {
      el.addEventListener('click', () => {
        act(el.dataset.pad as PadId);
        el.blur();
      });
    });
  }

  /** 每帧同步侧栏；迷你块只在换块时重绘，避免 60fps 反复写 innerHTML */
  function syncSide(): void {
    if (!side) return;
    if (state.next !== shownNext) {
      shownNext = state.next;
      side.next.innerHTML = miniHtml(state.next);
    }
    if (state.hold !== shownHold) {
      shownHold = state.hold;
      side.hold.innerHTML = miniHtml(state.hold);
    }
    side.score.textContent = pad(state.score, 6);
    side.level.textContent = pad(L.levelOf(state.lines), 2);
    side.best.textContent = pad(best, 6);
  }
```

- [ ] **Step 7: 重画 render()**

把 `drawCell` 与 `render` 两个函数替换为：

```ts
  /** 单格：填充 + 同色辉光 + 设计稿的斜面（右下暗、左上亮） */
  function drawCell(px: number, py: number, size: number, type: number): void {
    if (!g) return;
    g.fillStyle = pieceFill(type);
    g.shadowColor = pieceGlow(type);
    g.shadowBlur = 8;
    g.fillRect(px, py, size, size);
    g.shadowBlur = 0;
    const b = Math.max(2, Math.round(size / 7)); // 22px 格对应 3px 斜面
    g.fillStyle = 'rgba(0, 0, 0, .3)';
    g.fillRect(px + size - b, py, b, size);
    g.fillRect(px, py + size - b, size, b);
    g.fillStyle = 'rgba(255, 255, 255, .25)';
    g.fillRect(px, py, size, b);
    g.fillRect(px, py, b, size);
  }

  function render(): void {
    if (!g) return;
    g.fillStyle = SCREEN.ground;
    g.fillRect(0, 0, W, H);

    for (let y = 0; y < L.ROWS; y++) {
      for (let x = 0; x < L.COLS; x++) {
        const v = state.board[y * L.COLS + x];
        if (v !== 0) drawCell(x * CELL, y * CELL, CELL, v - 1);
      }
    }

    // 当前块（y<0 的部分不画）
    if (state.status !== 'over') {
      for (const [cx, cy] of L.rotatedCells(state.current.type, state.current.rot)) {
        const y = state.current.y + cy;
        if (y >= 0) drawCell((state.current.x + cx) * CELL, y * CELL, CELL, state.current.type);
      }
    }

    // 开局提示留在画布内；GAME OVER 走 ctx.settle 的 DOM 浮层
    if (state.status === 'ready') {
      g.fillStyle = 'rgba(26, 20, 16, .75)';
      g.fillRect(0, H / 2 - 40, W, 80);
      g.fillStyle = SCREEN.gold;
      g.font = `700 14px ${SCREEN.mono}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('TAP / ENTER TO START', W / 2, H / 2);
      g.textAlign = 'left';
      g.textBaseline = 'alphabetic';
    }

    syncSide();
  }
```

- [ ] **Step 8: meta 与 mount**

把 `meta` 那行替换为：

```ts
    meta: {
      id: 'tetris',
      name: '俄罗斯方块',
      icon: '🧱',
      displayName: 'TETRIS',
      hints: ['←→ MOVE', '↑ ROTATE', '↓ DROP', 'SPACE HARD DROP'],
      screen: 'dark',
      side: true,
      pad: true,
    },
```

`mount()` 中，把 `best = ctx.storage.get('best.tetris', 0);` 之后补一行 `bestAtStart = best;`，
把 `ctx.input.onTapAt(canvas, tapAt);` 改为 `ctx.input.onTapAt(canvas, tapBoard);`，
并在 `g.scale(dpr, dpr);` 之后补：

```ts
      if (ctx.side) buildSide(ctx.side);
      if (ctx.pad) buildPad(ctx.pad);
```

`destroy()` 中在 `ctx = null;` 之前补一行 `side = null;`。

- [ ] **Step 9: 类型检查与测试**

Run: `npx tsc --noEmit && npm test`
Expected: 无类型错误。若报 `THEME` 未使用，说明还有残留引用没换掉。
`tests/tetris-logic.test.ts` 必须零改动且全绿。

Run: `git diff --stat src/games/tetris/logic.ts tests/tetris-logic.test.ts`
Expected: 空输出（这两个文件不该被碰）。

- [ ] **Step 10: 提交**

```bash
git add src/games/tetris/index.ts
git commit -m "feat: migrate Tetris to warm neon with DOM side panel and touch pad"
```

---

## Task 6: BREAKOUT

**Files:**
- Modify: `src/games/breakout/index.ts`

**不要动 `src/games/breakout/logic.ts` 与 `tests/breakout-logic.test.ts`。**

- [ ] **Step 1: 换调色板常量**

把文件顶部的 `import { THEME } ...` 改为 `import { SCREEN } from '../../core/theme';`，
把 `ROW_COLORS` 那行替换为：

```ts
/** 砖块四行由上至下：pink / orange / gold / teal（设计稿 2b） */
const ROW_TONES = ['pink', 'orange', 'gold', 'teal'] as const;
```

并在其后补：

```ts
function pad(n: number, width: number): string {
  return String(Math.max(0, Math.floor(n))).padStart(width, '0');
}
```

- [ ] **Step 2: 局部变量与重开**

在 `let state = L.createState();` 所在的变量区末尾补：

```ts
  let bestAtStart = 0; // 本局开始前的最高分，用来判断是否刷新纪录
```

把 `primary()` 里 `state.status === 'over'` 的重开分支改为调用新函数，并新增：

```ts
  /** 浮层 RETRY 按钮的入口：共用 paused 卫语句，但不继承 400ms 防连点 */
  function retry(): void {
    if (paused) return;
    restart();
  }

  function restart(): void {
    state = L.createState();
    bestAtStart = best;
    ctx?.settle(null);
  }
```

（原分支里的 `state = L.createState();` 换成 `restart();`，其余保持。）

- [ ] **Step 3: 终局时上报结算**

在处理 `ev.over` 的地方（`if (ev.over)` 或等价分支）补：

```ts
      const record = state.score > bestAtStart;
      ctx?.settle({
        title: record ? 'NEW HIGH SCORE' : 'GAME OVER',
        tone: record ? 'record' : 'lose',
        lines: [`SCORE ${pad(state.score, 6)}`, `LEVEL ${pad(state.level, 2)}`, `BEST ${pad(best, 6)}`],
        action: { label: '▶ RETRY', onPress: retry },
        hints: ['SPACE / TAP TO RETRY'],
      });
```

若现有代码里 `ev.over` 没有独立分支，在 `update` 末尾按 `state.status === 'over'` 加一个
只触发一次的守卫（参考 SNAKE 的 `deadHandled` 写法）。

- [ ] **Step 4: 重画 render()**

把 `render()` 整体替换为：

```ts
  function render(): void {
    if (!g) return;
    g.fillStyle = SCREEN.ground;
    g.fillRect(0, 0, L.W, L.H);
    g.textBaseline = 'alphabetic';

    // HUD：分数金色左上、生命粉色右上（设计稿 2b）
    g.font = `700 15px ${SCREEN.mono}`;
    g.textAlign = 'left';
    g.fillStyle = SCREEN.gold;
    g.fillText(`SCORE ${pad(state.score, 4)}`, 16, 30);
    g.textAlign = 'right';
    g.fillStyle = SCREEN.pink;
    const lives = Math.max(0, Math.min(3, state.lives));
    g.fillText('♥'.repeat(lives) + '♡'.repeat(3 - lives), L.W - 16, 30);
    // 关卡设计稿没画，但游戏会升级，不显示玩家就无从得知，故保留为暗色小字
    g.textAlign = 'center';
    g.font = `12px ${SCREEN.mono}`;
    g.fillStyle = 'rgba(255, 250, 240, .45)';
    g.fillText(`LEVEL ${state.level}`, L.W / 2, 30);

    // 砖块：按行取色，斜面 + 同色辉光
    for (const b of state.bricks) {
      if (!b.alive) continue;
      const row = Math.floor((b.y - 60) / 18);
      const tone = ROW_TONES[((row % ROW_TONES.length) + ROW_TONES.length) % ROW_TONES.length];
      g.fillStyle = SCREEN[tone];
      g.shadowColor = SCREEN.glow[tone];
      g.shadowBlur = 8;
      g.beginPath();
      g.roundRect(b.x, b.y, b.w, b.h, 3);
      g.fill();
      g.shadowBlur = 0;
      g.fillStyle = 'rgba(0, 0, 0, .3)';
      g.fillRect(b.x + b.w - 3, b.y, 3, b.h);
      g.fillRect(b.x, b.y + b.h - 3, b.w, 3);
      g.fillStyle = 'rgba(255, 255, 255, .25)';
      g.fillRect(b.x, b.y, b.w, 2);
    }

    // 挡板：teal 圆角
    g.fillStyle = SCREEN.teal;
    g.shadowColor = SCREEN.glow.teal;
    g.shadowBlur = 12;
    g.beginPath();
    g.roundRect(state.paddleX - L.PADDLE_W / 2, L.PADDLE_Y, L.PADDLE_W, L.PADDLE_H, 6);
    g.fill();
    g.shadowBlur = 0;
    g.fillStyle = 'rgba(0, 0, 0, .25)';
    g.fillRect(state.paddleX - L.PADDLE_W / 2, L.PADDLE_Y + L.PADDLE_H - 2, L.PADDLE_W, 2);

    // 球：白色
    g.fillStyle = SCREEN.white;
    g.shadowColor = SCREEN.glow.white;
    g.shadowBlur = 12;
    g.beginPath();
    g.arc(state.ballX, state.ballY, L.BALL_R, 0, Math.PI * 2);
    g.fill();
    g.shadowBlur = 0;

    // 开局提示留在画布内；GAME OVER 走 ctx.settle 的 DOM 浮层
    if (state.status === 'ready') {
      g.textAlign = 'center';
      g.font = `700 14px ${SCREEN.mono}`;
      g.fillStyle = SCREEN.gold;
      g.fillText('TAP / SPACE TO LAUNCH', L.W / 2, L.H / 2 + 40);
    }
    g.textAlign = 'left';
  }
```

- [ ] **Step 5: meta**

把 `meta` 那行替换为：

```ts
    meta: {
      id: 'breakout',
      name: '打砖块',
      icon: '🕹️',
      displayName: 'BREAKOUT',
      hints: ['←→ / MOUSE MOVE', 'SPACE LAUNCH'],
      screen: 'dark',
    },
```

`mount()` 中 `best = ctx.storage.get('best.breakout', 0);` 之后补 `bestAtStart = best;`。

- [ ] **Step 6: 类型检查与测试**

Run: `npx tsc --noEmit && npm test`
Expected: 无类型错误，全绿。

Run: `git diff --stat src/games/breakout/logic.ts tests/breakout-logic.test.ts`
Expected: 空输出。

- [ ] **Step 7: 提交**

```bash
git add src/games/breakout/index.ts
git commit -m "feat: migrate Breakout to the warm neon screen palette"
```

---

## Task 7: FLAPPY

**Files:**
- Modify: `src/games/flappy/index.ts`

**不要动 `src/games/flappy/logic.ts` 与 `tests/flappy-logic.test.ts`。**

- [ ] **Step 1: 换调色板与补重开**

顶部 `import { THEME } ...` 改为 `import { SCREEN } from '../../core/theme';`，并在其下补：

```ts
function pad(n: number, width: number): string {
  return String(Math.max(0, Math.floor(n))).padStart(width, '0');
}
```

变量区补 `let bestAtStart = 0;`。把 `act()` 的重开分支与新函数写成：

```ts
  function act(): void {
    if (paused) return;
    if (state.status === 'dead') {
      if (performance.now() - diedAt < 400) return; // 死亡瞬间常有连点，给结算浮层一点展示时间
      restart();
      return;
    }
    L.flap(state);
    ctx?.audio.play('action');
  }

  /** 浮层 RETRY 按钮的入口：共用 paused 卫语句，但不继承 400ms 防连点 */
  function retry(): void {
    if (paused) return;
    restart();
  }

  function restart(): void {
    state = L.createState();
    deadHandled = false;
    bestAtStart = best;
    ctx?.settle(null);
  }
```

- [ ] **Step 2: 刷新纪录时更新提示条，死亡时上报结算**

把 `update()` 替换为：

```ts
  function update(dt: number): void {
    const scored = L.tick(state, dt);
    if (scored) {
      ctx?.audio.play('score');
      if (state.score > best) {
        best = state.score;
        ctx?.storage.set('best.flappy', best);
        ctx?.setHints([`BEST ${pad(best, 6)}`]); // 设计稿 2c 的提示条显示实时最高分
      }
    }
    if (state.status === 'dead' && !deadHandled) {
      deadHandled = true;
      diedAt = performance.now();
      ctx?.audio.play('hit');
      const record = state.score > bestAtStart;
      ctx?.settle({
        title: record ? 'NEW HIGH SCORE' : 'GAME OVER',
        tone: record ? 'record' : 'lose',
        lines: [`SCORE ${pad(state.score, 4)}`, `BEST ${pad(best, 6)}`],
        action: { label: '▶ RETRY', onPress: retry },
        hints: ['SPACE / TAP TO RETRY'],
      });
    }
  }
```

- [ ] **Step 3: 重画 render()**

把 `render()` 整体替换为：

```ts
  function render(): void {
    if (!g) return;
    // 背景：竖向渐变（设计稿 2c）
    const sky = g.createLinearGradient(0, 0, 0, L.H);
    sky.addColorStop(0, SCREEN.ground);
    sky.addColorStop(0.6, SCREEN.ground);
    sky.addColorStop(1, '#241a12');
    g.fillStyle = sky;
    g.fillRect(0, 0, L.W, L.H);
    g.textBaseline = 'alphabetic';

    // 管道：teal 填充 + 深色描边 + 左侧高光
    for (const p of state.pipes) {
      const top = p.gapY - L.PIPE_GAP / 2;
      const bottomY = p.gapY + L.PIPE_GAP / 2;
      for (const [y, h] of [[0, top], [bottomY, L.H - bottomY]] as const) {
        g.fillStyle = '#0b7285';
        g.fillRect(p.x, y, L.PIPE_W, h);
        g.strokeStyle = '#075a68';
        g.lineWidth = 3;
        g.strokeRect(p.x + 1.5, y + 1.5, L.PIPE_W - 3, h - 3);
        g.fillStyle = 'rgba(255, 255, 255, .12)';
        g.fillRect(p.x + 3, y + 3, 4, h - 6);
      }
    }

    // 地面：条纹 + 墨色顶边
    const groundH = 28;
    const gy = L.H - groundH;
    for (let x = 0; x < L.W; x += 36) {
      g.fillStyle = '#3a2c1c';
      g.fillRect(x, gy, 18, groundH);
      g.fillStyle = '#2e2316';
      g.fillRect(x + 18, gy, 18, groundH);
    }
    g.fillStyle = '#2b2118';
    g.fillRect(0, gy, L.W, 3);

    // 小鸟：gold 身 + orange 喙 + 深色眼
    const bx = L.BIRD_X;
    const by = state.birdY;
    g.fillStyle = SCREEN.gold;
    g.shadowColor = SCREEN.glow.gold;
    g.shadowBlur = 12;
    g.beginPath();
    g.roundRect(bx - 12, by - 9, 24, 18, 5);
    g.fill();
    g.shadowBlur = 0;
    g.fillStyle = SCREEN.orange;
    g.fillRect(bx + 10, by - 4, 8, 6);
    g.fillStyle = SCREEN.ground;
    g.beginPath();
    g.arc(bx + 2, by - 4, 2.5, 0, Math.PI * 2);
    g.fill();

    // 分数：Bungee 大字 + 墨色投影
    g.textAlign = 'center';
    g.fillStyle = '#2b2118';
    g.font = `34px 'Bungee', ${SCREEN.mono}`;
    g.fillText(pad(state.score, 2), L.W / 2 + 3, 55 + 3);
    g.fillStyle = SCREEN.white;
    g.fillText(pad(state.score, 2), L.W / 2, 55);

    // 开局提示留在画布内；GAME OVER 走 ctx.settle 的 DOM 浮层
    if (state.status === 'ready') {
      g.fillStyle = SCREEN.gold;
      g.font = `700 14px ${SCREEN.mono}`;
      g.fillText('TAP / SPACE TO FLAP', L.W / 2, L.H / 2 + 60);
    }
    g.textAlign = 'left';
  }
```

若 `L.BIRD_X` 不存在，读 `src/games/flappy/logic.ts` 找到小鸟横坐标的实际导出名并替换；
**不要改 logic.ts 去迎合这段代码。**

- [ ] **Step 4: meta 与 mount**

把 `meta` 那行替换为：

```ts
    meta: {
      id: 'flappy',
      name: 'FLAPPY BIRD',
      icon: '🐦',
      displayName: 'FLAPPY',
      hints: ['BEST 000000'], // 挂载时由 setHints 覆写为真实值
      screen: 'dark',
      pausable: false, // 设计稿 2c 的顶栏只有 SND
    },
```

`mount()` 中 `best = ctx.storage.get('best.flappy', 0);` 之后补：

```ts
      bestAtStart = best;
      ctx.setHints([`BEST ${pad(best, 6)}`]);
```

- [ ] **Step 5: 类型检查与测试**

Run: `npx tsc --noEmit && npm test`
Expected: 无类型错误，全绿。

Run: `git diff --stat src/games/flappy/logic.ts tests/flappy-logic.test.ts`
Expected: 空输出。

- [ ] **Step 6: 提交**

```bash
git add src/games/flappy/index.ts
git commit -m "feat: migrate Flappy to warm neon with a live best-score hint bar"
```

---

## Task 8: e2e 与全量验证

**Files:**
- Modify: `e2e/smoke.spec.ts`

- [ ] **Step 1: 三条断言改英文**

`e2e/smoke.spec.ts` 中：

- tetris 那条：`toContainText('俄罗斯方块')` → `toContainText('TETRIS')`
- breakout 那条：`toContainText('打砖块')` → `toContainText('BREAKOUT')`
- flappy 那条已经是 `toContainText('FLAPPY')`，不用改

- [ ] **Step 2: 补机柜新能力的 e2e**

在文件末尾追加：

```ts
test('TETRIS 的侧栏与触屏控制垫是 DOM 且可用', async ({ page }) => {
  await page.goto('/#/tetris');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('.cab-side .side-card')).toHaveCount(5);
  await expect(page.locator('.cab-pad .pad-btn')).toHaveCount(6);

  // 点开始，再点旋转键——不抛错即说明按钮确实接到了游戏
  await page.locator('canvas').click();
  await page.locator('[data-pad="rotate"]').click();
  await expect(page.locator('canvas')).toBeVisible();
});

test('FLAPPY 没有暂停按钮，提示条显示实时最高分', async ({ page }) => {
  await page.goto('/#/flappy');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('[data-act="pause"]')).toHaveCount(0);
  await expect(page.locator('[data-act="mute"]')).toHaveCount(1);
  await expect(page.locator('.cab-hints')).toContainText('BEST');
});
```

- [ ] **Step 3: 全量跑**

Run: `npx tsc --noEmit && npm test && npm run e2e`
Expected: 无类型错误；单测全绿；e2e 14 passed。

- [ ] **Step 4: 确认没有越界改动**

Run: `git diff --stat main -- 'src/games/*/logic.ts' 'tests/*-logic.test.ts'`
Expected: 空输出。任何一行改动都说明本子项目动了玩法，属于越界。

- [ ] **Step 5: 目视核对**

Run: `npm run build && npx vite preview --port 4173`

对照 `design_handoff_sunset_arcade_homepage_2/Game Screens.dc.html`：

**TETRIS（artboard 2a）**：棋盘只占屏幕、方块暖霓虹四色带斜面高光与辉光；右侧五张奶油卡片
NEXT / HOLD / SCORE / LEVEL / BEST，LEVEL 是橙色、BEST 是灰色小字；屏幕下方六个触屏按钮；
底部提示条四段键盘提示。整体不超出机柜宽度、无横向溢出。

**BREAKOUT（artboard 2b）**：砖块四行 pink/orange/gold/teal 带斜面，球白色，挡板青绿圆角；
SCORE 金色左上、`♥♥♡` 粉色右上。

**FLAPPY（artboard 2c）**：背景竖向渐变，管道青色带深描边与左侧高光，小鸟金身橙喙，
地面棕色条纹，分数 Bungee 大字带墨色投影；**顶栏只有 SND，没有暂停键**；
底部提示条显示 `BEST ??????`。

三个游戏各撞死一次，确认结算浮层弹出、`▶ RETRY` 能重开、`QUIT TO HUB` 回首页。

`SCREEN.orange` 与 `SCREEN.white` 在本子项目首次被真正渲染（BREAKOUT 的砖块与球、
FLAPPY 的喙），**要特别核对这两色的观感**——A 里它们没有任何消费者。

- [ ] **Step 6: 提交**

```bash
git add e2e/smoke.spec.ts
git commit -m "test: cover the cabinet side panel, touch pad and pauseless top bar"
```
