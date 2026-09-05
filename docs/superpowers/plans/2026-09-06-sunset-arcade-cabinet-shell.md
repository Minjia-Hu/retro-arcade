# Sunset Arcade 机柜外壳（子项目 A）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把游戏页从裸露的深色外框换成 Sunset Arcade 机柜（顶栏 / 屏幕井 / 按键提示条），加上 8 个游戏共用的 DOM 结算浮层，并以 SNAKE 作为端到端样板跑通暖霓虹调色板。

**Architecture:** `frame.ts` 的 HTML 拼接抽成可单测的纯函数 `src/shell/cabinet-view.ts`；`accentAt` 与 `pixelIconSvg` 从 `hub/` 上移到 `shell/` 供两处共用；结算浮层通过 `GameContext.settle()` 由游戏上报、frame 统一渲染。

**Tech Stack:** Vite 5 + TypeScript 5 + Vitest 2 + Playwright 1.46，无前端框架，DOM 直出 + canvas。

**Spec:** `docs/superpowers/specs/2026-09-06-sunset-arcade-cabinet-shell-design.md`

---

## 背景：读计划前必须知道的事

1. **首页已完成并合并**（`15b8dd8`）。`src/shell/hub/` 下的 `{index,model,view,icons}.ts`、
   `src/styles/arcade.css` 的 `:root` 色板、`.accent-*` 色调 class 都已存在，本计划复用它们。
2. **`frame.ts` 用的是 `game.meta`（游戏模块自己的 meta），不是 registry 的那份。** 游戏模块的
   meta 目前只有 `{ id, name, icon }`，没有 `displayName`。所以本计划只给 SNAKE 补
   `displayName`，其余 7 个游戏顶栏仍显示中文名，等 B/C 迁移。e2e 断言要按这个事实写。
3. **屏幕井的暗角不能直接放在 canvas 上。** CSS 的 inset 阴影绘制在元素背景之上、内容之下，
   而 canvas 位图就是内容，会把暗角整个盖住。必须由覆盖在上方、`pointer-events: none` 的
   `.screen-glass` 承载。
4. **`THEME` 在本子项目中不改动。** 它仍被其余 7 个游戏引用。新增 `SCREEN` 供 SNAKE 使用，
   `tests/hub-model.test.ts` 里的 `THEME` 整体快照断言应当保持通过。
5. **不自动聚焦结算浮层的主按钮。** 游戏的 Space 处理器仍在监听，自动聚焦会让一次 Space
   同时触发按钮点击和游戏自身的重开逻辑。
6. 未跟踪的 `design_handoff_sunset_arcade_homepage*/` 是设计参考资料，**任何任务都不要提交它**。

## 文件结构

| 文件 | 职责 |
|---|---|
| `src/shell/accent.ts`（新） | `AccentTone`、`accentAt(index)`、`accentOf(gameId)` |
| `src/shell/pixel-icons.ts`（新，由 `hub/icons.ts` 移入） | `PIXELS`、`pixelIconSvg(id)` |
| `src/shell/cabinet-view.ts`（新） | `cabinetHtml(meta, muted)`、`settleHtml(view)` 纯函数 |
| `src/shell/frame.ts`（改） | 机柜宿主：绑事件、管生命周期、渲染/收起浮层 |
| `src/core/game.ts`（改） | `GameMeta` 加 `hints`/`screen`；新增 `SettleView`；`GameContext` 加 `settle` |
| `src/core/theme.ts`（改） | 新增 `SCREEN`，`THEME` 不动 |
| `src/games/snake/index.ts`（改） | 换 `SCREEN` 配色、接入 `settle`、补 meta |
| `src/styles/arcade.css`（改） | 机柜与浮层样式 |
| `index.html`（改） | 字体加 JetBrains Mono |
| `tests/cabinet-view.test.ts`（新） | 机柜与浮层的渲染断言 |

---

## Task 1: 共享模块上移

`accentAt` 与 `pixelIconSvg` 现在住在 `src/shell/hub/` 里，但顶栏也要用。让 `frame.ts`
反向依赖 hub 页面模块是错误的方向，因此上移到 `src/shell/`。

**Files:**
- Create: `src/shell/accent.ts`
- Move: `src/shell/hub/icons.ts` → `src/shell/pixel-icons.ts`
- Modify: `src/shell/hub/model.ts`, `src/shell/hub/view.ts`
- Move: `tests/hub-icons.test.ts` → `tests/pixel-icons.test.ts`
- Modify: `tests/hub-model.test.ts`

- [ ] **Step 1: 移动图标模块**

```bash
git mv src/shell/hub/icons.ts src/shell/pixel-icons.ts
git mv tests/hub-icons.test.ts tests/pixel-icons.test.ts
```

文件内容不变。改 `tests/pixel-icons.test.ts` 的导入路径：

```ts
import { pixelIconSvg, PIXELS } from '../src/shell/pixel-icons';
```

改 `src/shell/hub/view.ts` 第一行：

```ts
import { pixelIconSvg } from '../pixel-icons';
```

- [ ] **Step 2: 写 accent 模块的失败测试**

创建 `tests/accent.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { accentAt, accentOf } from '../src/shell/accent';
import { GAMES } from '../src/games/registry';

describe('accentAt', () => {
  it('四色调轮转', () => {
    expect(accentAt(0)).toBe('teal');
    expect(accentAt(1)).toBe('magenta');
    expect(accentAt(2)).toBe('orange');
    expect(accentAt(3)).toBe('gold');
    expect(accentAt(4)).toBe('teal');
  });
});

describe('accentOf', () => {
  it('按 registry 下标取色调', () => {
    expect(accentOf('snake')).toBe('teal');
    expect(accentOf('tetris')).toBe('magenta');
    expect(accentOf('gomoku')).toBe('gold');
  });

  it('与 accentAt 对 registry 顺序保持一致', () => {
    GAMES.forEach((g, i) => expect(accentOf(g.meta.id)).toBe(accentAt(i)));
  });

  it('未知 id 回退首个色调而不是抛错', () => {
    expect(accentOf('nope')).toBe('teal');
  });
});
```

- [ ] **Step 3: 跑测试确认失败**

Run: `npx vitest run tests/accent.test.ts`
Expected: FAIL —— 找不到模块 `../src/shell/accent`。

- [ ] **Step 4: 实现 accent.ts**

创建 `src/shell/accent.ts`：

```ts
import { GAMES } from '../games/registry';

/** accent 色调名。具体色值由 CSS 的 .accent-* 持有，TS 不碰 hex */
export type AccentTone = 'teal' | 'magenta' | 'orange' | 'gold';

const ACCENTS: AccentTone[] = ['teal', 'magenta', 'orange', 'gold'];

/** 按 registry 下标轮转 accent 色调 */
export function accentAt(index: number): AccentTone {
  return ACCENTS[index % ACCENTS.length];
}

/** 按游戏 id 取 accent 色调；id 不在 registry 中时回退首个色调 */
export function accentOf(id: string): AccentTone {
  const index = GAMES.findIndex((g) => g.meta.id === id);
  return accentAt(index < 0 ? 0 : index);
}
```

- [ ] **Step 5: 让 hub/model.ts 改用共享模块**

在 `src/shell/hub/model.ts` 中删除这三段：

```ts
/** accent 色调名。具体色值由 CSS 的 .accent-* 持有，TS 不碰 hex */
export type AccentTone = 'teal' | 'magenta' | 'orange' | 'gold';

const ACCENTS: AccentTone[] = ['teal', 'magenta', 'orange', 'gold'];

/** 按 registry 下标轮转 accent 色调 */
export function accentAt(index: number): AccentTone {
  return ACCENTS[index % ACCENTS.length];
}
```

在文件顶部的 import 区补上：

```ts
import { accentAt } from '../accent';
import type { AccentTone } from '../accent';
```

并在紧邻的位置重新导出类型，供 `view.ts` 与测试使用：

```ts
export type { AccentTone };
```

- [ ] **Step 6: 更新 hub 模型测试的导入**

`tests/hub-model.test.ts` 中，把 `accentAt` 从 model 的导入行移到新模块：

```ts
import { accentAt } from '../src/shell/accent';
```

（该文件原本从 `'../src/shell/hub/model'` 导入 `accentAt`，只需把这一个名字挪走，
其余名字保持从 model 导入。）

- [ ] **Step 7: 类型检查与全量测试**

Run: `npx tsc --noEmit`
Expected: 无输出。若报 `AccentTone` 未使用，检查 `export type { AccentTone };` 是否写了。

Run: `npm test`
Expected: 全部 PASS，194 个用例 + 新增 4 个。

- [ ] **Step 8: 提交**

```bash
git add -A ':!design_handoff_sunset_arcade_homepage' ':!design_handoff_sunset_arcade_homepage_2'
git commit -m "refactor: lift accent and pixel icons out of hub for frame reuse"
```

---

## Task 2: 机柜视图纯函数

**Files:**
- Modify: `src/core/game.ts`
- Create: `src/shell/cabinet-view.ts`
- Create: `tests/cabinet-view.test.ts`

本任务只加类型和纯函数，不碰 `frame.ts`，因此不会破坏任何现有行为。

- [ ] **Step 1: 扩展 game.ts 的类型**

`src/core/game.ts` 中把 `GameMeta` 改为：

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
}
```

并在 `GameContext` 之前新增：

```ts
export interface SettleView {
  /** 标题文案，如 GAME OVER / SOLVED! / NEW HIGH SCORE */
  title: string;
  /** 决定标题颜色：lose→magenta、win→teal、record→gold */
  tone: 'lose' | 'win' | 'record';
  /** 分数行，等宽字体渲染 */
  lines: string[];
  /** 主操作按钮 */
  action: { label: string; onPress: () => void };
}
```

暂不动 `GameContext`（Task 3 才加 `settle`）。

- [ ] **Step 2: 写失败测试**

创建 `tests/cabinet-view.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { cabinetHtml, settleHtml } from '../src/shell/cabinet-view';
import type { GameMeta, SettleView } from '../src/core/game';

const snake: GameMeta = {
  id: 'snake', name: '贪吃蛇', icon: '🐍', displayName: 'SNAKE',
  hints: ['↑↓←→ / WASD MOVE', 'SPACE START'], screen: 'dark',
};

const settle: SettleView = {
  title: 'GAME OVER', tone: 'lose',
  lines: ['SCORE 0042', 'BEST 003840'],
  action: { label: '▶ RETRY', onPress: () => {} },
};

describe('cabinetHtml 顶栏', () => {
  it('三个操作按钮各一个', () => {
    const html = cabinetHtml(snake, false);
    for (const act of ['back', 'pause', 'mute']) {
      expect(html.match(new RegExp(`data-act="${act}"`, 'g'))!.length).toBe(1);
    }
  });

  it('优先用 displayName，缺省回退 name', () => {
    expect(cabinetHtml(snake, false)).toContain('>SNAKE<');
    expect(cabinetHtml({ id: 'x', name: '数独', icon: '✏️' }, false)).toContain('>数独<');
  });

  it('机柜根节点带该游戏的 accent 色调 class', () => {
    expect(cabinetHtml(snake, false)).toContain('class="cabinet accent-teal"');
    expect(cabinetHtml({ id: 'tetris', name: 'T', icon: 't' }, false)).toContain('accent-magenta');
  });

  it('静音时 SND 按钮带 is-off', () => {
    expect(cabinetHtml(snake, true)).toContain('class="cab-btn is-off" data-act="mute"');
    expect(cabinetHtml(snake, false)).toContain('class="cab-btn" data-act="mute"');
  });
});

describe('cabinetHtml 屏幕井', () => {
  it('游戏挂载点、玻璃层、浮层容器齐全', () => {
    const html = cabinetHtml(snake, false);
    expect(html).toContain('class="screen-body"');
    expect(html).toContain('class="screen-glass"');
    expect(html).toContain('class="settle" hidden');
  });

  it('screen 风格由 meta 决定，缺省 dark', () => {
    expect(cabinetHtml(snake, false)).toContain('screen screen-dark');
    expect(cabinetHtml({ ...snake, screen: 'paper' }, false)).toContain('screen screen-paper');
    expect(cabinetHtml({ id: 'x', name: 'X', icon: 'x' }, false)).toContain('screen screen-dark');
  });
});

describe('cabinetHtml 按键提示', () => {
  it('多条提示用中点分隔', () => {
    const html = cabinetHtml(snake, false);
    expect(html).toContain('<span>↑↓←→ / WASD MOVE</span><span class="cab-dot">·</span><span>SPACE START</span>');
  });

  it('没有提示时不渲染提示条', () => {
    expect(cabinetHtml({ id: 'x', name: 'X', icon: 'x' }, false)).not.toContain('cab-hints');
  });
});

describe('settleHtml', () => {
  it('三种 tone 对应三种标题 class', () => {
    expect(settleHtml(settle)).toContain('settle-title settle-title-lose');
    expect(settleHtml({ ...settle, tone: 'win' })).toContain('settle-title-win');
    expect(settleHtml({ ...settle, tone: 'record' })).toContain('settle-title-record');
  });

  it('分数行逐行渲染', () => {
    const html = settleHtml(settle);
    expect(html.match(/class="settle-line"/g)!.length).toBe(2);
    expect(html).toContain('>SCORE 0042<');
    expect(html).toContain('>BEST 003840<');
  });

  it('两个按钮各带自己的 data-act', () => {
    const html = settleHtml(settle);
    expect(html).toContain('data-act="settle-action"');
    expect(html).toContain('data-act="settle-quit"');
    expect(html).toContain('>▶ RETRY<');
    expect(html).toContain('>QUIT TO HUB<');
  });
});

describe('转义', () => {
  it('机柜里的游戏名被转义', () => {
    expect(cabinetHtml({ id: 'x', name: '<b>PWN</b>', icon: 'x' }, false))
      .toContain('&lt;b&gt;PWN&lt;/b&gt;');
  });

  it('浮层里的标题与分数行被转义', () => {
    const html = settleHtml({ ...settle, title: '<script>x</script>', lines: ['A & B'] });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;x&lt;/script&gt;');
    expect(html).toContain('A &amp; B');
  });
});
```

- [ ] **Step 3: 跑测试确认失败**

Run: `npx vitest run tests/cabinet-view.test.ts`
Expected: FAIL —— 找不到模块 `../src/shell/cabinet-view`。

- [ ] **Step 4: 实现 cabinet-view.ts**

创建 `src/shell/cabinet-view.ts`：

```ts
import { pixelIconSvg } from './pixel-icons';
import { accentOf } from './accent';
import type { GameMeta, SettleView } from '../core/game';

const ESCAPES: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
};
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ESCAPES[c]);

const TITLE_CLASS: Record<SettleView['tone'], string> = {
  lose: 'settle-title-lose',
  win: 'settle-title-win',
  record: 'settle-title-record',
};

/** 机柜外壳。游戏挂载到 .screen-body，结算浮层由 settleHtml 填进 .settle */
export function cabinetHtml(meta: GameMeta, muted: boolean): string {
  const name = meta.displayName ?? meta.name;
  const hints = meta.hints ?? [];
  const hintsHtml = hints.length
    ? `<p class="cab-hints">${hints
        .map((h) => `<span>${esc(h)}</span>`)
        .join('<span class="cab-dot">·</span>')}</p>`
    : '';

  return `
    <div class="cabinet accent-${accentOf(meta.id)}">
      <div class="cab-bar">
        <button class="cab-btn" data-act="back">◀ BACK</button>
        <span class="cab-id">
          <span class="px px-xs">${pixelIconSvg(meta.id)}</span>
          <span class="cab-name">${esc(name)}</span>
        </span>
        <span class="cab-tools">
          <button class="cab-btn" data-act="pause">❚❚</button>
          <button class="cab-btn${muted ? ' is-off' : ''}" data-act="mute">SND</button>
        </span>
      </div>
      <div class="cab-screen">
        <div class="screen screen-${meta.screen ?? 'dark'}">
          <div class="screen-body"></div>
          <div class="screen-glass"></div>
          <div class="settle" hidden></div>
        </div>
      </div>
      ${hintsHtml}
    </div>`;
}

/** 结算浮层卡片。按钮的点击由 frame 绑定 */
export function settleHtml(view: SettleView): string {
  const lines = view.lines
    .map((l) => `<span class="settle-line">${esc(l)}</span>`)
    .join('');
  return `
    <div class="settle-card">
      <span class="settle-title ${TITLE_CLASS[view.tone]}">${esc(view.title)}</span>
      ${lines}
      <button class="settle-action" data-act="settle-action">${esc(view.action.label)}</button>
      <button class="settle-quit" data-act="settle-quit">QUIT TO HUB</button>
    </div>`;
}
```

- [ ] **Step 5: 跑测试确认通过**

Run: `npx vitest run tests/cabinet-view.test.ts`
Expected: PASS，12 passed。

- [ ] **Step 6: 类型检查与全量测试**

Run: `npx tsc --noEmit && npm test`
Expected: 无类型错误，全部 PASS。

- [ ] **Step 7: 提交**

```bash
git add src/core/game.ts src/shell/cabinet-view.ts tests/cabinet-view.test.ts
git commit -m "feat: add cabinet and settle overlay view functions"
```

---

## Task 3: frame 接入机柜与浮层

**Files:**
- Modify: `src/core/game.ts`（`GameContext` 加 `settle`）
- Modify: `src/shell/frame.ts`（整体重写 `open`/`close`）
- Modify: `e2e/smoke.spec.ts`

- [ ] **Step 1: GameContext 加 settle**

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
}
```

- [ ] **Step 2: 重写 frame.ts**

把 `src/shell/frame.ts` **整体替换**为：

```ts
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
```

- [ ] **Step 3: 更新 e2e 的选择器**

`e2e/smoke.spec.ts` 中把 8 处 `.frame-title` 改成 `.cab-name`。
**文案暂时全部保持中文**——只有 SNAKE 在 Task 5 才拿到 `displayName`，其余 7 个游戏的
游戏模块 meta 里还没有这个字段，顶栏仍显示中文名。

例如：

```ts
  await expect(page.locator('.cab-name')).toContainText('FLAPPY');
```

（flappy 的中文 meta.name 本来就是 `'FLAPPY BIRD'`，`toContainText('FLAPPY')` 继续成立。）

其余七处照改类名、保留原文案：`贪吃蛇`、`2048`、`打砖块`、`扫雷`、`俄罗斯方块`、`数独`、`五子棋`。

- [ ] **Step 4: 类型检查与测试**

Run: `npx tsc --noEmit && npm test`
Expected: 无类型错误，单测全部 PASS。

- [ ] **Step 5: 跑 e2e**

Run: `npm run e2e`
Expected: 10 passed。此时机柜还没有样式（Task 4 才写 CSS），页面会很朴素，但结构与交互应当
完全可用。若 `.screen-body` 找不到，检查 `cabinetHtml` 的输出。

- [ ] **Step 6: 提交**

```bash
git add src/core/game.ts src/shell/frame.ts e2e/smoke.spec.ts
git commit -m "feat: mount games inside the cabinet shell with a settle overlay host"
```

---

## Task 4: 机柜样式与字体

**Files:**
- Modify: `index.html`
- Modify: `src/styles/arcade.css`

- [ ] **Step 1: 字体加 JetBrains Mono**

`index.html` 中把那行 Google Fonts 的 `<link>` 换成：

```html
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bungee&family=JetBrains+Mono:wght@400;700&family=Space+Grotesk:wght@400;500;700&display=swap" />
```

- [ ] **Step 2: `:root` 补三个变量**

`src/styles/arcade.css` 的 `:root` 块中，在 `--focus-ring` 那行之前插入：

```css
  --well: #efe5d3;
  --screen-ground: #1a1410;
  --mono: 'JetBrains Mono', ui-monospace, monospace;
```

- [ ] **Step 3: 给四个 accent 色调补屏幕辉光色**

把 `.accent-*` 那四行替换为（辉光取暖霓虹调色板对应色的 35%，与设计稿 artboard 1b 一致）：

```css
.accent-teal { --accent: var(--teal); --glow: rgba(46, 230, 200, .35); }
.accent-magenta { --accent: var(--magenta); --glow: rgba(255, 92, 158, .35); }
.accent-orange { --accent: var(--orange); --glow: rgba(255, 140, 66, .35); }
.accent-gold { --accent: var(--gold); --glow: rgba(255, 201, 60, .35); }
```

- [ ] **Step 4: 图标补 20px 档**

在 `.px-sm` 那行之后补：

```css
.px-xs { width: 20px; height: 20px; }
```

- [ ] **Step 5: 用机柜样式替换旧的游戏外框样式**

把 `arcade.css` 中从 `/* ---- 游戏外框：保持原深色，底色下沉到 .frame 自身 ---- */` 起
到 `.frame-body canvas { ... }` 为止的整段（即 `.frame`、`.frame-bar`、`.frame-title`、
`.frame-right`、`.btn`、`.frame-body`、`.frame-body canvas` 七条规则）替换为下面内容。

注意 `.btn` 规则在此被删除——Task 3 已经把 `showError` 里最后一个 `.btn` 用户改成了
`cab-btn`，改完后仓库里不应再有 `class="btn"`。替换后用
`grep -rn 'class="btn"' src/` 确认为空。

```css
/* ---- 游戏机柜 ---- */
.cabinet {
  margin: 28px auto;
  width: 100%;
  max-width: 464px;
  background: var(--panel);
  border: 3px solid var(--ink);
  border-radius: 14px;
  box-shadow: 8px 8px 0 var(--ink);
  overflow: hidden;
}
.cab-bar {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 14px 18px; border-bottom: 3px solid var(--ink);
}
.cab-id { display: flex; align-items: center; gap: 12px; min-width: 0; }
.cab-name {
  font-family: 'Bungee', 'Space Grotesk', sans-serif; font-size: 17px; color: var(--ink);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.cab-tools { display: flex; gap: 8px; }
.cab-btn {
  font-size: 13px; font-weight: 700; letter-spacing: 1px;
  background: var(--paper); border: 2px solid var(--ink); border-radius: 8px;
  box-shadow: 3px 3px 0 var(--ink); padding: 8px 14px; color: var(--ink);
  transition: transform .1s, box-shadow .1s, opacity .1s;
}
.cab-btn:hover { transform: translate(2px, 2px); box-shadow: 1px 1px 0 var(--ink); }
.cab-btn:active { transform: translate(3px, 3px); box-shadow: 0 0 0 var(--ink); }
.cab-btn:focus-visible { outline: none; box-shadow: 3px 3px 0 var(--ink), var(--focus-ring); }
/* 静音：按钮压平并变淡，表示已关闭 */
.cab-btn.is-off {
  transform: translate(3px, 3px); box-shadow: 0 0 0 var(--ink);
  color: var(--faint); border-color: var(--faint);
}

.cab-screen { padding: 22px; display: flex; justify-content: center; background: var(--well); }
.screen {
  position: relative; border: 3px solid var(--ink); border-radius: 10px; overflow: hidden;
}
.screen-dark { background: var(--screen-ground); }
.screen-paper { background: var(--paper); }
.screen-body { display: block; line-height: 0; }
.screen-body canvas { display: block; max-width: 100%; height: auto; }
/* 暗角必须盖在 canvas 之上：CSS 的 inset 阴影画在内容之下，会被 canvas 位图整个遮住 */
.screen-glass {
  position: absolute; inset: 0; pointer-events: none; border-radius: 7px;
  box-shadow: inset 0 0 0 2px var(--glow), inset 0 0 40px rgba(0, 0, 0, .6);
}
.screen-paper .screen-glass { box-shadow: inset 0 0 0 2px var(--glow); }
.screen.is-settled .screen-body { opacity: .25; }
.screen-paper.is-settled .screen-body { opacity: .45; }

.cab-hints {
  display: flex; flex-wrap: wrap; justify-content: center; gap: 10px;
  padding: 12px; border-top: 3px solid var(--ink);
  font-family: var(--mono); font-size: 11px; color: var(--dim); letter-spacing: 1px;
}
.cab-dot { color: var(--faint); }

/* ---- 结算浮层 ---- */
.settle { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
.settle[hidden] { display: none; }
.settle-card {
  width: 280px; max-width: calc(100% - 32px);
  background: var(--panel); border: 3px solid var(--ink); border-radius: 14px;
  box-shadow: 6px 6px 0 rgba(0, 0, 0, .55); padding: 26px 24px;
  display: flex; flex-direction: column; align-items: center; gap: 14px;
}
.settle-title { font-family: 'Bungee', 'Space Grotesk', sans-serif; font-size: 24px; }
.settle-title-lose { color: var(--magenta); }
.settle-title-win { color: var(--teal); }
.settle-title-record { color: var(--gold); }
.settle-line { font-family: var(--mono); font-size: 14px; font-weight: 700; color: var(--ink); }
.settle-line ~ .settle-line { font-size: 12px; font-weight: 400; color: var(--dim); }
.settle-action {
  font-family: 'Bungee', 'Space Grotesk', sans-serif; font-size: 14px;
  background: var(--orange); color: var(--panel);
  border: 3px solid var(--ink); border-radius: 10px;
  box-shadow: 4px 4px 0 var(--ink); padding: 12px 26px; margin-top: 6px;
  transition: transform .1s, box-shadow .1s;
}
.settle-action:hover { transform: translate(2px, 2px); box-shadow: 2px 2px 0 var(--ink); }
.settle-action:active { transform: translate(4px, 4px); box-shadow: 0 0 0 var(--ink); }
.settle-action:focus-visible { outline: none; box-shadow: 4px 4px 0 var(--ink), var(--focus-ring); }
.settle-quit {
  font-size: 12px; font-weight: 700; letter-spacing: 2px;
  background: none; border: none; color: var(--dim); text-decoration: underline;
}
.settle-quit:focus-visible { outline: none; box-shadow: var(--focus-ring); border-radius: 4px; }
```

- [ ] **Step 6: 减少动效的媒体查询补上机柜元素**

把 `@media (prefers-reduced-motion: reduce)` 那条规则的选择器改为：

```css
@media (prefers-reduced-motion: reduce) {
  .btn-start, .btn-accept, .card, .cab-btn, .settle-action { transition: none; }
}
```

- [ ] **Step 7: 错误兜底沿用深色，但改用机柜配色**

把 `.frame-error` 规则替换为：

```css
.frame-error {
  flex: 1; display: flex; flex-direction: column; gap: 16px;
  align-items: center; justify-content: center;
  color: var(--magenta); font-family: var(--mono);
}
```

- [ ] **Step 8: 构建并跑全部测试**

Run: `npm run build && npm test && npm run e2e`
Expected: 构建成功，单测全绿，e2e 10 passed。

- [ ] **Step 9: 提交**

```bash
git add index.html src/styles/arcade.css
git commit -m "feat: style the Sunset Arcade cabinet and settle overlay"
```

---

## Task 5: 暖霓虹调色板与 SNAKE 样板

**Files:**
- Modify: `src/core/theme.ts`
- Modify: `src/games/snake/index.ts`
- Modify: `e2e/smoke.spec.ts`

- [ ] **Step 1: 新增 SCREEN 调色板**

在 `src/core/theme.ts` 末尾追加（`THEME` 不动，它还被其余 7 个游戏引用）：

```ts
/**
 * 深色屏游戏的画布内配色（Sunset Arcade 暖霓虹）。
 * 逐个游戏从 THEME 迁移过来（A 迁 SNAKE，B 迁其余三款），迁完后删除 THEME。
 */
export const SCREEN = {
  ground: '#1a1410',
  teal: '#2ee6c8',
  gold: '#ffc93c',
  pink: '#ff5c9e',
  orange: '#ff8c42',
  white: '#fffaf0',
  mono: "'JetBrains Mono', ui-monospace, monospace",
  /** 发光统一用同色 50% alpha */
  glow: {
    teal: 'rgba(46, 230, 200, .5)',
    gold: 'rgba(255, 201, 60, .5)',
    pink: 'rgba(255, 92, 158, .5)',
  },
} as const;
```

- [ ] **Step 2: SNAKE 换调色板与 meta**

`src/games/snake/index.ts` 的第 3 行导入改为：

```ts
import { SCREEN } from '../../core/theme';
```

（`THEME` 不再被这个文件使用；若 `noUnusedLocals` 报错说明还有残留引用，逐处换掉。）

在 `createSnake()` 的局部变量区，`let diedAt = 0;` 之后补一行：

```ts
  let bestAtStart = 0; // 本局开始前的最高分，用来判断是否刷新纪录
```

在 `tapAction` 之前新增重开函数：

```ts
  function pad(n: number, width: number): string {
    return String(Math.max(0, Math.floor(n))).padStart(width, '0');
  }

  function restart(): void {
    state = L.createState();
    deadHandled = false;
    bestAtStart = best;
    ctx?.settle(null);
  }
```

把 `tapAction` 里的重开分支改为调用它：

```ts
  function tapAction(): void {
    if (paused) return;
    if (state.status === 'dead') {
      if (performance.now() - diedAt < 400) return; // 死亡瞬间常有连点
      restart();
      return;
    }
    if (state.status === 'ready') {
      L.setDirection(state, state.dir); // 点按沿当前方向开局
    }
  }
```

- [ ] **Step 3: 死亡时上报结算**

把 `update()` 里的死亡分支替换为：

```ts
    if (ev.died && !deadHandled) {
      deadHandled = true;
      diedAt = performance.now();
      ctx?.audio.play('over');
      const record = state.score > bestAtStart;
      ctx?.settle({
        title: record ? 'NEW HIGH SCORE' : 'GAME OVER',
        tone: record ? 'record' : 'lose',
        lines: [`SCORE ${pad(state.score, 4)}`, `BEST ${pad(best, 6)}`],
        action: { label: '▶ RETRY', onPress: restart },
      });
    }
```

- [ ] **Step 4: 重画 render()**

把 `render()` 整体替换为：

```ts
  function render(): void {
    if (!g) return;
    g.fillStyle = SCREEN.ground;
    g.fillRect(0, 0, W, H);

    // 边界墙：撞上即死，必须肉眼可见（画布背景与屏幕井同色，无此描边则边界隐形）
    g.strokeStyle = SCREEN.teal;
    g.lineWidth = 2;
    g.strokeRect(1, 1, W - 2, H - 2);

    // 食物：暖霓虹粉，圆角 3
    g.fillStyle = SCREEN.pink;
    g.shadowColor = SCREEN.glow.pink;
    g.shadowBlur = 10;
    g.beginPath();
    g.roundRect(state.food.x * CELL + 2, state.food.y * CELL + 2, CELL - 4, CELL - 4, 3);
    g.fill();

    // 蛇身：teal，蛇头：gold
    g.shadowBlur = 8;
    for (let i = state.snake.length - 1; i >= 0; i--) {
      const c = state.snake[i];
      const head = i === 0;
      g.fillStyle = head ? SCREEN.gold : SCREEN.teal;
      g.shadowColor = head ? SCREEN.glow.gold : SCREEN.glow.teal;
      g.fillRect(c.x * CELL + 1, c.y * CELL + 1, CELL - 2, CELL - 2);
    }

    // 分数：设计稿补零到 4 位
    g.fillStyle = SCREEN.gold;
    g.shadowColor = SCREEN.glow.gold;
    g.shadowBlur = 10;
    g.font = `700 24px ${SCREEN.mono}`;
    g.textAlign = 'center';
    g.fillText(pad(state.score, 4), W / 2, 40);
    g.shadowBlur = 0;

    // GAME OVER 与开局提示不再画在画布里：前者走 ctx.settle 的 DOM 浮层，
    // 后者放在机柜底部的按键提示条
  }
```

若 `npx tsc --noEmit` 报 `roundRect` 不存在于 `CanvasRenderingContext2D`，说明 TS 的 lib
版本偏旧——**不要改 tsconfig**，把那三行换成普通方块并在此记录：

```ts
    g.fillRect(state.food.x * CELL + 2, state.food.y * CELL + 2, CELL - 4, CELL - 4);
```

- [ ] **Step 5: 补 meta**

把 `meta` 那行替换为：

```ts
    meta: {
      id: 'snake',
      name: '贪吃蛇',
      icon: '🐍',
      displayName: 'SNAKE',
      hints: ['↑↓←→ / WASD MOVE', 'SPACE START'],
      screen: 'dark',
    },
```

- [ ] **Step 6: mount 时初始化 bestAtStart**

在 `mount()` 中 `best = ctx.storage.get('best.snake', 0);` 之后补一行：

```ts
      bestAtStart = best;
```

- [ ] **Step 7: e2e 改用英文名断言 SNAKE**

`e2e/smoke.spec.ts` 里 snake 那条用例的断言改为：

```ts
  await expect(page.locator('.cab-name')).toContainText('SNAKE');
```

其余七个游戏保持中文断言不变（它们的模块 meta 还没有 `displayName`）。

- [ ] **Step 8: 类型检查、单测、e2e**

Run: `npx tsc --noEmit && npm test && npm run e2e`
Expected: 全绿，e2e 10 passed。

- [ ] **Step 9: 提交**

```bash
git add src/core/theme.ts src/games/snake/index.ts e2e/smoke.spec.ts
git commit -m "feat: migrate Snake to the warm neon screen palette and settle overlay"
```

---

## Task 6: 全量验证

- [ ] **Step 1: 静态检查与测试**

Run: `npx tsc --noEmit && npm test && npm run e2e`
Expected: 无类型错误；单测全绿；e2e 10 passed。

- [ ] **Step 2: 目视核对 SNAKE 游戏中**

Run: `npm run build && npx vite preview --port 4173`，浏览器打开 `http://localhost:4173/#/snake`，
对照 `design_handoff_sunset_arcade_homepage_2/Game Screens.dc.html` 的 artboard **1a**：

- 机柜卡片居中、奶油底、3px 墨色描边、`8px 8px 0` 硬投影
- 顶栏：`◀ BACK` 左、青色像素蛇图标 + Bungee `SNAKE` 居中、`❚❚` `SND` 右
- 屏幕井 `#efe5d3`，画布 `#1a1410`，**暗角与青色内描边可见**（这是 `.screen-glass` 是否生效的判据）
- 画布内：蛇身青绿、蛇头金黄、食物粉色圆角，分数金色四位补零居中靠上
- 底部提示条：`↑↓←→ / WASD MOVE · SPACE START`，等宽字体

- [ ] **Step 3: 目视核对结算浮层**

在游戏中撞墙致死，对照 artboard **1b**：

- 画布内容变暗到 25%，浮层卡片居中
- 标题 `GAME OVER` 洋红（若刷新纪录则 `NEW HIGH SCORE` 金色）
- 两行分数：`SCORE 00xx` 加粗、`BEST 0000xx` 变灰变小
- `▶ RETRY` 橙色 Bungee 按钮、`QUIT TO HUB` 下划线灰色文本按钮
- 点 `▶ RETRY` 浮层消失、游戏重开；点 `QUIT TO HUB` 回首页
- 按 Space 也能重开（浮层随之消失）
- Tab 能依次聚焦浮层的两个按钮，焦点环为橙色

- [ ] **Step 4: 确认其余 7 个游戏没被弄坏**

逐个进入 `#/tetris`、`#/breakout`、`#/flappy`、`#/g2048`、`#/minesweeper`、`#/sudoku`、`#/gomoku`：

- 都套上了机柜外壳，顶栏显示各自的中文名与像素图标
- 画布内配色仍是旧的冷霓虹（**这是预期**，B/C 才迁移）
- 没有底部提示条（它们还没有 `hints`，按设计不渲染该条）
- 各自的 GAME OVER 仍画在画布里（**这是预期**，它们还没接 `settle`）

- [ ] **Step 5: 静音按钮**

点 `SND`，按钮应压平并变淡；刷新页面后仍保持该状态（读 `storage` 的 `muted`）。

- [ ] **Step 6: 窄屏**

390px 宽下机柜应收缩且无横向溢出，画布不溢出屏幕井。

- [ ] **Step 7: 提交（若有修补）**

```bash
git add -A ':!design_handoff_sunset_arcade_homepage' ':!design_handoff_sunset_arcade_homepage_2'
git commit -m "fix: address issues found in final verification"
```

若无改动则跳过。
