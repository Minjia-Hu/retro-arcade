# 机柜补完 + SUDOKU 样板（子项目 C1）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 还清子项目 B 留下的三个欠债，给机柜补上顶栏自定义按钮与多动作浮层，并以 SUDOKU 作为浅色纸盘的端到端样板。

**Architecture:** `settle` 泛化为 `overlay`（开始菜单与结算浮层是同一视觉模式，不新造第二套机制）；顶栏右侧按钮由游戏声明；棋盘留 canvas，周边控件改 DOM。

**Tech Stack:** Vite 5 + TypeScript 5 + Vitest 2 + Playwright 1.46，无前端框架，DOM 直出 + Canvas 2D。

**Spec:** `docs/superpowers/specs/2026-09-06-sunset-arcade-paper-boards-c1-design.md`

---

## 背景：读计划前必须知道的事

1. **A 与 B 已合并。** 机柜外壳、结算浮层、`SCREEN` 调色板、侧栏/控制垫插槽、可选暂停、
   动态提示条都已存在。`src/games/tetris/index.ts` 是最完整的样板（用到侧栏与控制垫）。
2. **视觉改动不许碰 `logic.ts`**，判据见 `CLAUDE.md`。**本计划有唯一一个例外**：Task 2 给
   `breakout/logic.ts` 的 `Brick` 加 `row` 字段。纯加字段不改玩法，判据是
   `tests/breakout-logic.test.ts` 零改动仍全绿。
3. **`data-act` 是一个扁平命名空间**（现有 `back` / `pause` / `mute` / `settle-action` /
   `settle-quit`）。顶栏自定义按钮渲染为 `data-act="tool:<id>"`，避免游戏声明一个叫
   `back` 的工具时撞车。
4. **CSS 沿用 `.settle-*` 类名**。改名会连带动 A/B 的样式与测试，收益为零。
5. 未跟踪的 `design_handoff_*/` 是设计参考资料，**任何任务都不要提交它**。
   用 `git add <具体文件>`，不要 `git add -A`。

## 文件结构

| 文件 | 本次职责 |
|---|---|
| `src/core/screen.ts`（新） | `createScreenCanvas()`，消掉四份复制 |
| `src/core/game.ts`（改） | `OverlayView`/`OverlayAction`；`GameMeta` 加 `tools`/`pill`；`GameContext` 加 `overlay`/`onTool`/`setPill` |
| `src/shell/cabinet-view.ts`（改） | 顶栏工具按钮与药丸、`overlayHtml` 多动作 |
| `src/shell/frame.ts`（改） | 工具按钮绑定、药丸更新、多动作浮层 |
| `src/styles/arcade.css`（改） | `.cab-pill`、`.settle-actions`、次按钮、数字盘变体 |
| `src/games/breakout/logic.ts`（改） | `Brick.row` |
| `src/games/{snake,tetris,breakout,flappy}/index.ts`（改） | 改用 `createScreenCanvas`；`settle` → `overlay` |
| `src/games/sudoku/index.ts`（改） | 画布缩成棋盘、控件改 DOM、接浮层 |
| `tests/frame.test.ts`（新） | `GameFrame` 首个单测（jsdom） |

---

## Task 1: 提取 createScreenCanvas（B 欠债 1）

四个游戏各有一份逐字相同的画布建立代码。其中「只设 `style.width` 不设 height」是窄屏
不溢出的唯一依赖，复制多份意味着有人改一份就会不一致。C 会把这个数字推到 8。

**Files:**
- Create: `src/core/screen.ts`
- Modify: `src/games/{snake,tetris,breakout,flappy,sudoku,g2048,minesweeper,gomoku}/index.ts`

- [ ] **Step 1: 实现 screen.ts**

创建 `src/core/screen.ts`：

```ts
/**
 * 建立游戏画布并挂到容器上。
 *
 * 两个不显眼但要紧的约定：
 * - **只设 style.width，不设 height**：高度靠替换元素的内在比例推导，配合
 *   arcade.css 的 `.screen-body canvas { height: auto }`，窄屏才能等比缩小不溢出。
 *   显式设高会让缩放失效并撑破机柜。
 * - **dpr 上限 3**：再高只增显存不增观感。
 */
export function createScreenCanvas(
  host: HTMLElement,
  w: number,
  h: number,
): { canvas: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = `${w}px`;
  canvas.style.touchAction = 'none';
  canvas.style.userSelect = 'none';
  host.appendChild(canvas);
  const g = canvas.getContext('2d')!;
  g.scale(dpr, dpr);
  return { canvas, g };
}
```

- [ ] **Step 2: 八个游戏改用它**

每个游戏的 `mount()` 里，把这段（各游戏的宽高常量名不同，`W`/`H` 或 `L.W`/`L.H`）：

```ts
      canvas = document.createElement('canvas');
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = `${W}px`;
      canvas.style.touchAction = 'none';
      canvas.style.userSelect = 'none';   // 只有部分游戏有这行
      container.appendChild(canvas);
      g = canvas.getContext('2d')!;
      g.scale(dpr, dpr);
```

替换为：

```ts
      ({ canvas, g } = createScreenCanvas(container, W, H));
```

并在文件顶部加导入 `import { createScreenCanvas } from '../../core/screen';`。

**注意**：`({ canvas, g } = ...)` 的括号不能省——赋值给已声明变量的解构必须包起来。

八个游戏都要改（`tests/` 下的逻辑测试不受影响）。gomoku 的宽高常量在 `index.ts` 里，
其余按各自现状。

- [ ] **Step 3: 类型检查与测试**

Run: `npx tsc --noEmit && npm test && npm run e2e`
Expected: 全绿，e2e 15 passed。行为不变（这是纯提取）。

Run: `grep -rn "devicePixelRatio" src/games/`
Expected: 空输出——八份复制都清掉了。

- [ ] **Step 4: 提交**

```bash
git add src/core/screen.ts src/games/*/index.ts
git commit -m "refactor: extract createScreenCanvas from eight copies"
```

---

## Task 2: Brick.row（B 欠债 3）

`breakout/index.ts` 用 `Math.floor((b.y - 60) / 18)` 反推 `logic.ts` 里 `makeBricks` 的
私有常量。改砖块布局会让配色静默错位且无测试报警。

**这是本计划唯一一次故意改 `logic.ts`。**

**Files:**
- Modify: `src/games/breakout/logic.ts`
- Modify: `src/games/breakout/index.ts`

- [ ] **Step 1: Brick 加 row 字段**

`src/games/breakout/logic.ts` 的 `Brick` 接口加一行：

```ts
export interface Brick {
  x: number;
  y: number;
  w: number;
  h: number;
  points: number;
  alive: boolean;
  /** 第几行（0 起）。渲染按行取色，避免从 y 反推布局常量 */
  row: number;
}
```

在 `makeBricks` 里构造砖块的地方填上 `row`（该函数用双层循环生成，外层索引即行号）。
**不要改任何坐标计算或 `points` 逻辑。**

- [ ] **Step 2: 渲染直接读 row**

`src/games/breakout/index.ts` 里把这三行：

```ts
      // 60 与 18 来自 logic.ts makeBricks 的 y0 与 bh+gap，两者都没导出；
      // 改那里必须同步这里，否则配色会静默错位且没有测试会发现
      const row = Math.floor((b.y - 60) / 18);
```

替换为：

```ts
      const row = b.row;
```

并把下一行的负数保护简化（`row` 恒为非负）：

```ts
      const tone = ROW_TONES[b.row % ROW_TONES.length];
```

- [ ] **Step 3: 验证玩法未变**

Run: `npx tsc --noEmit && npm test`
Expected: 全绿。

Run: `git diff --stat tests/breakout-logic.test.ts`
Expected: **空输出**。测试一行未改仍全绿，才说明只加了字段没动规则。

- [ ] **Step 4: 提交**

```bash
git add src/games/breakout/logic.ts src/games/breakout/index.ts
git commit -m "refactor: give Brick a row instead of deriving it from y"
```

---

## Task 3: settle 泛化为 overlay

开始菜单与结算浮层是同一个视觉模式——盖在棋盘上的一张卡片，区别只是菜单要多个按钮。
不为此新造第二套机制。顺带把名字改诚实：拿 `settle`（结算）渲染开始菜单是说谎。

**Files:**
- Modify: `src/core/game.ts`
- Modify: `src/shell/cabinet-view.ts`
- Modify: `src/shell/frame.ts`
- Modify: `src/games/{snake,tetris,breakout,flappy}/index.ts`
- Modify: `tests/cabinet-view.test.ts`

- [ ] **Step 1: 改类型**

`src/core/game.ts` 里把 `SettleView` 整体替换为：

```ts
export interface OverlayAction {
  label: string;
  onPress: () => void;
  /** primary 为 accent 底色的主按钮，secondary 为描边按钮。缺省 primary */
  kind?: 'primary' | 'secondary';
}

export interface OverlayView {
  /** 标题文案，如 GAME OVER / SOLVED! / SELECT DIFFICULTY */
  title: string;
  /** 决定标题颜色：lose→magenta、win→teal、record→gold */
  tone: 'lose' | 'win' | 'record';
  /** 说明行，等宽字体渲染 */
  lines: string[];
  /** 一到多个操作按钮，按顺序纵向排列 */
  actions: OverlayAction[];
  /**
   * 浮层期间的底部按键提示，覆盖 meta.hints。不给则沿用 meta.hints。
   */
  hints?: string[];
  /** 是否显示 QUIT TO HUB，缺省 true */
  quit?: boolean;
}
```

`GameContext` 里把 `settle` 改为：

```ts
  /** 展示或收起浮层（开始菜单、结算卡片）；传 null 收起 */
  overlay(view: OverlayView | null): void;
```

- [ ] **Step 2: 改 cabinet-view**

`src/shell/cabinet-view.ts` 里把 `TITLE_CLASS` 的类型参数与 `settleHtml` 替换为：

```ts
const TITLE_CLASS: Record<OverlayView['tone'], string> = {
  lose: 'settle-title-lose',
  win: 'settle-title-win',
  record: 'settle-title-record',
};

/** 浮层卡片。按钮的点击由 frame 绑定，data-act 用下标寻址 */
export function overlayHtml(view: OverlayView): string {
  const lines = view.lines
    .map((l) => `<span class="settle-line">${esc(l)}</span>`)
    .join('');
  const actions = view.actions
    .map((a, i) => {
      const secondary = a.kind === 'secondary' ? ' settle-action-secondary' : '';
      return `<button class="settle-action${secondary}" data-act="overlay:${i}">${esc(a.label)}</button>`;
    })
    .join('');
  const quit = view.quit === false
    ? ''
    : '<button class="settle-quit" data-act="overlay-quit">QUIT TO HUB</button>';
  return `
    <div class="settle-card">
      <span class="settle-title ${TITLE_CLASS[view.tone]}">${esc(view.title)}</span>
      ${lines}
      <div class="settle-actions">${actions}</div>
      ${quit}
    </div>`;
}
```

导入行里 `SettleView` 改为 `OverlayView`。

- [ ] **Step 3: 改 frame**

`src/shell/frame.ts` 里：

- 导入 `SettleView` → `OverlayView`，`settleHtml` → `overlayHtml`
- 私有方法 `showSettle` 改名为 `showOverlay`，参数类型改为 `OverlayView | null`
- `ctx` 里 `settle: (view) => this.showSettle(view)` 改为
  `overlay: (view) => this.showOverlay(view)`
- `showOverlay` 里绑定按钮的那段替换为：

```ts
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
```

- [ ] **Step 4: 四个已迁移游戏改调用**

snake / tetris / breakout / flappy 各有一处 `ctx?.settle({...})` 与若干处
`ctx?.settle(null)`。把方法名改为 `overlay`，并把

```ts
        action: { label: '▶ RETRY', onPress: retry },
```

改为

```ts
        actions: [{ label: '▶ RETRY', onPress: retry }],
```

- [ ] **Step 5: 改测试**

`tests/cabinet-view.test.ts` 里 `settleHtml` 改为 `overlayHtml`，fixture 的
`action: {...}` 改为 `actions: [{...}]`，类型导入 `SettleView` 改为 `OverlayView`，
断言 `data-act="settle-action"` 改为 `data-act="overlay:0"`、
`data-act="settle-quit"` 改为 `data-act="overlay-quit"`。

并追加：

```ts
describe('overlayHtml 多动作', () => {
  const menu: OverlayView = {
    title: 'SELECT DIFFICULTY', tone: 'win', lines: [],
    actions: [
      { label: 'EASY', onPress: () => {}, kind: 'secondary' },
      { label: 'MEDIUM', onPress: () => {}, kind: 'secondary' },
      { label: 'HARD', onPress: () => {}, kind: 'secondary' },
    ],
  };

  it('每个动作各一个按钮，按下标寻址', () => {
    const html = overlayHtml(menu);
    expect(html.match(/class="settle-action/g)!.length).toBe(3);
    for (const i of [0, 1, 2]) expect(html).toContain(`data-act="overlay:${i}"`);
    expect(html).toContain('>EASY<');
    expect(html).toContain('>HARD<');
  });

  it('kind 决定主次按钮样式，缺省为主按钮', () => {
    expect(overlayHtml(menu)).toContain('settle-action settle-action-secondary');
    expect(overlayHtml({ ...menu, actions: [{ label: 'GO', onPress: () => {} }] }))
      .toContain('class="settle-action" data-act="overlay:0"');
  });

  it('quit 为 false 时不渲染 QUIT TO HUB', () => {
    expect(overlayHtml({ ...menu, quit: false })).not.toContain('overlay-quit');
    expect(overlayHtml(menu)).toContain('overlay-quit');
  });
});
```

- [ ] **Step 6: CSS 补多动作与次按钮**

`src/styles/arcade.css` 里，在 `.settle-action` 那条规则**之前**插入：

```css
.settle-actions { display: flex; flex-direction: column; gap: 10px; align-items: stretch; margin-top: 6px; }
```

并在 `.settle-action:focus-visible` 之后补：

```css
.settle-action-secondary {
  background: var(--paper); color: var(--ink);
  border-width: 2px; box-shadow: 3px 3px 0 var(--ink); padding: 10px 22px;
}
.settle-action-secondary:hover { transform: translate(2px, 2px); box-shadow: 1px 1px 0 var(--ink); }
.settle-action-secondary:active { transform: translate(3px, 3px); box-shadow: 0 0 0 var(--ink); }
```

把 `.settle-action` 规则里的 `margin-top: 6px;` 删掉（移到 `.settle-actions` 上了）。

- [ ] **Step 7: 全量验证**

Run: `npx tsc --noEmit && npm test && npm run e2e`
Expected: 全绿。e2e 里 `[data-act="settle-action"]` 的两处点击要改成
`[data-act="overlay:0"]`，`[data-act="settle-quit"]` 改成 `[data-act="overlay-quit"]`。

Run: `grep -rn "settle(" src/ | grep -v "showSettle\|settleEl\|settleHints"`
Expected: 空输出——旧 API 已无残留。

- [ ] **Step 8: 提交**

```bash
git add src/core/game.ts src/shell/ src/games/ src/styles/arcade.css tests/cabinet-view.test.ts e2e/smoke.spec.ts
git commit -m "refactor: generalise settle into a multi-action overlay"
```

---

## Task 4: 顶栏自定义按钮与药丸

**Files:**
- Modify: `src/core/game.ts`
- Modify: `src/shell/cabinet-view.ts`
- Modify: `src/shell/frame.ts`
- Modify: `src/styles/arcade.css`
- Modify: `tests/cabinet-view.test.ts`

- [ ] **Step 1: 写失败测试**

`tests/cabinet-view.test.ts` 末尾追加：

```ts
describe('cabinetHtml 顶栏工具按钮与药丸', () => {
  const withTool = {
    ...snake,
    tools: [{ id: 'menu', label: '☰', aria: '难度菜单' }],
    pill: 'MEDIUM',
  };

  it('工具按钮用 tool: 前缀，避开 back/pause/mute 的命名空间', () => {
    const html = cabinetHtml(withTool, false);
    expect(html).toContain('data-act="tool:menu"');
    expect(html).toContain('>☰<');
  });

  it('工具按钮排在 SND 之前', () => {
    const html = cabinetHtml(withTool, false);
    expect(html.indexOf('tool:menu')).toBeLessThan(html.indexOf('data-act="mute"'));
  });

  it('缺省不渲染工具按钮与药丸', () => {
    const html = cabinetHtml(snake, false);
    expect(html).not.toContain('data-act="tool:');
    expect(html).not.toContain('cab-pill');
  });

  it('药丸渲染在游戏名之后', () => {
    const html = cabinetHtml(withTool, false);
    expect(html).toContain('class="cab-pill">MEDIUM<');
    expect(html.indexOf('cab-name')).toBeLessThan(html.indexOf('cab-pill'));
  });

  it('工具按钮与 pausable:false 可以并存', () => {
    const html = cabinetHtml({ ...withTool, pausable: false }, false);
    expect(html).not.toContain('data-act="pause"');
    expect(html).toContain('data-act="tool:menu"');
    expect(html).toContain('data-act="mute"');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/cabinet-view.test.ts`
Expected: FAIL。

- [ ] **Step 3: 改类型**

`src/core/game.ts` 的 `GameMeta` 补两个可选字段：

```ts
  /** 顶栏右侧的额外按钮，排在 SND 之前 */
  tools?: { id: string; label: string; aria: string }[];
  /** 游戏名右侧的药丸文案（如数独难度）；运行时可用 ctx.setPill 改 */
  pill?: string;
```

`GameContext` 补两个成员：

```ts
  /** 注册顶栏自定义按钮的点击处理；id 需与 meta.tools 中的一致 */
  onTool(id: string, handler: () => void): void;
  /** 改写游戏名右侧的药丸；传 null 隐藏 */
  setPill(text: string | null): void;
```

- [ ] **Step 4: 改 cabinetHtml**

`src/shell/cabinet-view.ts` 的 `cabinetHtml` 里，在 `pauseHtml` 之后补：

```ts
  const toolsHtml = (meta.tools ?? [])
    .map((t) => `<button class="cab-btn" data-act="tool:${esc(t.id)}" aria-label="${esc(t.aria)}">${esc(t.label)}</button>`)
    .join('');
  // 药丸始终渲染，靠 hidden 控制显隐，这样 setPill 不必凭空插入节点
  const pillHtml = `<span class="cab-pill"${meta.pill ? '' : ' hidden'}>${esc(meta.pill ?? '')}</span>`;
```

把 `.cab-id` 那段的内容改为：

```ts
        <span class="cab-id">
          <!-- pixelIconSvg 的输出只由白名单查表与数字构成，不含任何入参文本，故不转义 -->
          <span class="px px-xs">${pixelIconSvg(meta.id)}</span>
          <span class="cab-name">${esc(name)}</span>
          ${pillHtml}
        </span>
```

把 `.cab-tools` 那段改为：

```ts
        <span class="cab-tools">
          ${pauseHtml}
          ${toolsHtml}
          <button class="cab-btn${muted ? ' is-off' : ''}" data-act="mute" aria-pressed="${muted}" aria-label="音效">SND</button>
        </span>
```

**注意测试断言的是「缺省不渲染 `cab-pill`」**，而上面的写法总会渲染一个带 `hidden` 的
span。把该断言改为 `expect(html).toContain('class="cab-pill" hidden')`，并在
「药丸渲染在游戏名之后」用例里保持现有断言。

- [ ] **Step 5: 改 frame**

`src/shell/frame.ts` 的 `open()` 里，在 `ctx` 定义之前补：

```ts
    const pillEl = root.querySelector<HTMLElement>('.cab-pill');
```

`ctx` 补两个成员：

```ts
      onTool: (id, handler) => {
        wire(`tool:${id}`, () => handler());
      },
      setPill: (text) => {
        if (!pillEl) return;
        pillEl.textContent = text ?? '';
        pillEl.hidden = text === null;
      },
```

（`wire` 已经能容忍按钮缺席，游戏声明了 `tools` 才会有对应节点。）

- [ ] **Step 6: CSS 补药丸**

`src/styles/arcade.css` 里 `.cab-name` 那条规则之后补：

```css
.cab-pill {
  font-family: var(--mono); font-size: 11px; font-weight: 700; letter-spacing: 1px;
  color: var(--panel); background: var(--accent);
  border: 2px solid var(--ink); border-radius: 6px; padding: 3px 8px;
}
```

- [ ] **Step 7: 验证**

Run: `npx tsc --noEmit && npm test && npm run e2e`
Expected: 全绿。

- [ ] **Step 8: 提交**

```bash
git add src/core/game.ts src/shell/ src/styles/arcade.css tests/cabinet-view.test.ts
git commit -m "feat: let games declare top-bar tools and a status pill"
```

---

## Task 5: GameFrame 单测（B 欠债 2）

`GameFrame` 至今没有单测，而 B 往里塞了 `applyHints` 的结算态优先逻辑，目前只有一条
e2e 守着。本任务补上，同时守住 Task 3/4 新加的 `overlay` / `onTool` / `setPill`。

**Files:**
- Modify: `package.json`（加 `jsdom` devDependency）
- Create: `tests/frame.test.ts`

- [ ] **Step 1: 装 jsdom**

```bash
npm install -D jsdom
```

不改 `vite.config.ts` 的全局 environment——用文件级注释开启，避免拖慢其余 19 个纯逻辑
测试文件。

- [ ] **Step 2: 写测试**

创建 `tests/frame.test.ts`：

```ts
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { GameFrame } from '../src/shell/frame';
import { AudioFx } from '../src/core/audio';
import { ArcadeStorage, memoryBackend } from '../src/core/storage';
import type { Game, GameContext, GameMeta } from '../src/core/game';

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

function mount(meta?: Partial<GameMeta>) {
  const root = document.createElement('div');
  document.body.appendChild(root);
  const storage = new ArcadeStorage(memoryBackend());
  const frame = new GameFrame(new AudioFx(storage), storage);
  const { game, ctx } = fakeGame(meta);
  frame.open(root, game);
  return { root, frame, ctx: ctx() };
}

const hints = (root: HTMLElement) => root.querySelector('.cab-hints')?.textContent ?? '';

beforeEach(() => { document.body.innerHTML = ''; });

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

  it('onTool 绑定声明过的工具按钮', () => {
    const { root, ctx } = mount({ tools: [{ id: 'menu', label: '☰', aria: '菜单' }] });
    let hit = 0;
    ctx.onTool('menu', () => { hit += 1; });
    root.querySelector<HTMLButtonElement>('[data-act="tool:menu"]')!.click();
    expect(hit).toBe(1);
  });

  it('setPill 改写药丸并控制显隐', () => {
    const { root, ctx } = mount({ pill: 'EASY' });
    const pill = root.querySelector<HTMLElement>('.cab-pill')!;
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
});
```

- [ ] **Step 3: 跑测试**

Run: `npx vitest run tests/frame.test.ts`
Expected: 全部 PASS。若报 `ResizeObserver is not defined`，jsdom 未实现它——在测试文件
顶部补：

```ts
globalThis.ResizeObserver = class { observe() {} disconnect() {} } as never;
```

- [ ] **Step 4: 验证测试真的有效**

依次注入这两处回归，确认对应用例变红，然后还原：

1. `frame.ts` 的 `setHints` 里删掉 `this.baseHints = hints;` → 「浮层收起后还原」应红
2. `applyHints` 改成 `this.renderHints(this.baseHints)` → 「结算态优先」应红

在报告里贴出两次注入的结果。

- [ ] **Step 5: 全量与提交**

Run: `npm test`
Expected: 20 个测试文件全绿。

```bash
git add package.json package-lock.json tests/frame.test.ts
git commit -m "test: cover GameFrame's hints, overlay, tools and slots"
```

---

## Task 6: SUDOKU 画布缩成棋盘

**Files:**
- Modify: `src/games/sudoku/index.ts`

**不要动 `src/games/sudoku/logic.ts` 与 `tests/sudoku-logic.test.ts`。**

- [ ] **Step 1: 换常量与调色板**

把文件顶部替换为：

```ts
import type { Game, GameContext } from '../../core/game';
import { GameLoop } from '../../core/loop';
import { createScreenCanvas } from '../../core/screen';
import * as L from './logic';

const CELL = 32;
const W = 9 * CELL; // 288：画布只剩棋盘，边框圆角由 .screen 提供
const H = W;
const SAVE_KEY = 'sudoku.save';

/** 纸盘配色（设计稿 1c）。与 arcade.css 的同名变量对应，改一处要同步另一处 */
const PAPER = {
  ground: '#f6efe3',
  ink: '#2b2118',
  line: '#ddd1bc',
  entry: '#0b7285',
  note: '#b5a88f',
  selected: 'rgba(11, 114, 133, .18)',
  errorFg: '#d6336c',
  errorBg: 'rgba(214, 51, 108, .12)',
  mono: "'JetBrains Mono', ui-monospace, monospace",
} as const;

/** 难度药丸文案：logic 里的 name 是中文，顶栏按设计稿用英文 */
const DIFF_LABEL: Record<L.Difficulty['id'], string> = {
  easy: 'EASY', medium: 'MEDIUM', hard: 'HARD',
};
```

删除 `MENU_H` / `GRID_X` / `GRID_Y` / `GRID` / `PAD_Y` / `ROW2_Y` / `MenuButton` /
`menuButtons`（菜单与控件都搬走了）。

- [ ] **Step 2: 重画 renderBoard**

把 `renderBoard` 与 `renderMenu` 两个函数替换为单个 `renderBoard`：

```ts
  /** 只画 9×9 棋盘；HUD、数字盘、功能按钮、难度菜单都在 DOM 里 */
  function renderBoard(): void {
    if (!g) return;
    g.fillStyle = PAPER.ground;
    g.fillRect(0, 0, W, H);

    const s = state;
    const bad = s && showErrors ? L.conflicts(s.values) : new Set<number>();
    const selVal = s && selected >= 0 ? s.values[selected] : 0;

    // 选中格与同数高亮、冲突格底色
    for (let i = 0; i < 81; i++) {
      const cx = (i % 9) * CELL;
      const cy = Math.floor(i / 9) * CELL;
      if (bad.has(i)) g.fillStyle = PAPER.errorBg;
      else if (i === selected) g.fillStyle = PAPER.selected;
      else if (s && selVal !== 0 && s.values[i] === selVal) g.fillStyle = 'rgba(11, 114, 133, .08)';
      else continue;
      g.fillRect(cx, cy, CELL, CELL);
    }

    // 数字与笔记
    if (s) {
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      for (let i = 0; i < 81; i++) {
        const cx = (i % 9) * CELL;
        const cy = Math.floor(i / 9) * CELL;
        const v = s.values[i];
        if (v !== 0) {
          const given = L.isGiven(s, i);
          g.fillStyle = bad.has(i) ? PAPER.errorFg : given ? PAPER.ink : PAPER.entry;
          g.font = `${given ? '700' : '500'} 17px ${PAPER.mono}`;
          g.fillText(String(v), cx + CELL / 2, cy + CELL / 2 + 1);
        } else if (s.notes[i].length > 0) {
          g.fillStyle = PAPER.note;
          g.font = `9px ${PAPER.mono}`;
          for (const n of s.notes[i]) {
            g.fillText(String(n), cx + 7 + ((n - 1) % 3) * 9, cy + 8 + Math.floor((n - 1) / 3) * 9);
          }
        }
      }
    }

    // 细格线
    g.strokeStyle = PAPER.line;
    g.lineWidth = 1;
    for (let k = 1; k < 9; k++) {
      if (k % 3 === 0) continue;
      g.beginPath();
      g.moveTo(k * CELL + .5, 0); g.lineTo(k * CELL + .5, H);
      g.moveTo(0, k * CELL + .5); g.lineTo(W, k * CELL + .5);
      g.stroke();
    }
    // 3×3 分隔线
    g.strokeStyle = PAPER.ink;
    g.lineWidth = 2;
    for (let k = 3; k < 9; k += 3) {
      g.beginPath();
      g.moveTo(k * CELL, 0); g.lineTo(k * CELL, H);
      g.moveTo(0, k * CELL); g.lineTo(W, k * CELL);
      g.stroke();
    }

    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
  }

  function render(): void {
    renderBoard();
  }
```

- [ ] **Step 3: 简化 tapAt**

把 `tapAt` 替换为——画布只剩选格：

```ts
  function tapAt(cssX: number, cssY: number): void {
    if (paused || !state || state.status === 'won' || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const c = Math.floor(((cssX / rect.width) * W) / CELL);
    const r = Math.floor(((cssY / rect.height) * H) / CELL);
    if (c < 0 || c > 8 || r < 0 || r > 8) return;
    selected = r * 9 + c;
  }
```

（原来的 `toLogical` 若只被 `tapAt` 使用，一并删除。）

- [ ] **Step 4: 类型检查**

Run: `npx tsc --noEmit`
Expected: 会报若干「已声明未使用」——那是被删掉的菜单/控件相关代码留下的。逐个清掉，
**不要用 `void x` 之类的手段绕过**。清完后应无输出。

`npm test` 此时应仍全绿（`tests/sudoku-logic.test.ts` 不受影响）。

- [ ] **Step 5: 提交**

```bash
git add src/games/sudoku/index.ts
git commit -m "feat: shrink Sudoku's canvas to the board and repaint it on paper"
```

---

## Task 7: SUDOKU 的 DOM 控件与浮层

**Files:**
- Modify: `src/games/sudoku/index.ts`
- Modify: `src/styles/arcade.css`

- [ ] **Step 1: CSS 补数字盘变体**

`src/styles/arcade.css` 的 `.pad-btn` 规则之后补：

```css
/* 数独数字盘：比默认 pad-btn 窄，一行放得下 9 个 */
.cab-pad-rows { flex-direction: column; gap: 10px; }
.pad-row { display: flex; justify-content: center; gap: 6px; flex-wrap: wrap; }
.pad-btn-digit { width: 33px; height: 38px; font-family: var(--mono); font-size: 16px; }
.pad-btn-wide { width: auto; height: auto; padding: 9px 16px; font-size: 12px; letter-spacing: 1px; }
.pad-btn.is-on { background: var(--highlight); }
```

- [ ] **Step 2: 控件与浮层的构建**

在 `src/games/sudoku/index.ts` 里新增：

```ts
  let padRefs: { notes: HTMLButtonElement; check: HTMLButtonElement } | null = null;

  function buildPad(host: HTMLElement): void {
    host.classList.add('cab-pad-rows');
    const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9]
      .map((d) => `<button class="pad-btn pad-btn-digit" data-digit="${d}" aria-label="填入 ${d}">${d}</button>`)
      .join('');
    host.innerHTML = `
      <div class="pad-row">${digits}</div>
      <div class="pad-row">
        <button class="pad-btn pad-btn-wide" data-fn="erase" aria-label="清除">⌫ ERASE</button>
        <button class="pad-btn pad-btn-wide" data-fn="notes" aria-label="笔记模式">✎ NOTES</button>
        <button class="pad-btn pad-btn-wide" data-fn="check" aria-label="检查冲突">⚑ CHECK</button>
      </div>`;

    host.querySelectorAll<HTMLButtonElement>('[data-digit]').forEach((el) => {
      el.addEventListener('click', () => {
        applyDigit(Number(el.dataset.digit));
        el.blur();
      });
    });
    const fn = (name: string) => host.querySelector<HTMLButtonElement>(`[data-fn="${name}"]`)!;
    fn('erase').addEventListener('click', () => { eraseCell(); fn('erase').blur(); });
    fn('notes').addEventListener('click', () => { notesMode = !notesMode; syncPad(); fn('notes').blur(); });
    fn('check').addEventListener('click', () => { showErrors = !showErrors; syncPad(); fn('check').blur(); });
    padRefs = { notes: fn('notes'), check: fn('check') };
    syncPad();
  }

  /** 两个开关按钮的激活态 */
  function syncPad(): void {
    padRefs?.notes.classList.toggle('is-on', notesMode);
    padRefs?.check.classList.toggle('is-on', showErrors);
  }

  function showMenu(): void {
    ctx?.overlay({
      title: 'SELECT DIFFICULTY',
      tone: 'win',
      lines: [],
      actions: L.DIFFICULTIES.map((d) => ({
        label: DIFF_LABEL[d.id],
        kind: 'secondary' as const,
        onPress: () => startGame(d),
      })),
      hints: ['PICK A DIFFICULTY TO BEGIN'],
    });
  }

  function startGame(diff: L.Difficulty): void {
    state = L.createState(diff);
    selected = -1;
    ctx?.setPill(DIFF_LABEL[diff.id]);
    ctx?.overlay(null);
    save();
  }

  function reportSolved(): void {
    ctx?.overlay({
      title: 'SOLVED!',
      tone: 'win',
      // 设计稿还写了用时与失误数，但 SudokuState 里没有这两项数据源，不造假
      lines: [DIFF_LABEL[state!.diff.id]],
      actions: [{ label: '▶ NEW PUZZLE', onPress: showMenu }],
      hints: ['SPACE / TAP FOR A NEW PUZZLE'],
    });
  }
```

`eraseCell()` 若不存在，把原来「清除」按钮调用的那段逻辑抽成同名函数。

- [ ] **Step 3: 落子后判胜**

`applyDigit` 里写入成功后，若 `state.status === 'won'` 则调 `reportSolved()`
（原来是画胜利横幅，现在走浮层）。原先画横幅的代码已在 Task 6 删除。

- [ ] **Step 4: meta 与 mount**

`meta` 替换为：

```ts
    meta: {
      id: 'sudoku',
      name: '数独',
      icon: '✏️',
      displayName: 'SUDOKU',
      hints: ['TAP CELL', 'THEN A NUMBER'],
      screen: 'paper',
      pad: true,
      pausable: false, // 回合制，暂停无意义
      tools: [{ id: 'menu', label: '☰', aria: '难度菜单' }],
    },
```

`mount()` 里：

```ts
      ({ canvas, g } = createScreenCanvas(container, W, H));

      const restored = L.deserialize(ctx.storage.get(SAVE_KEY, null));
      if (restored) {
        state = restored;
        ctx.setPill(DIFF_LABEL[restored.diff.id]);
      } else {
        ctx.setPill(null);
        showMenu();
      }

      if (ctx.pad) buildPad(ctx.pad);
      ctx.onTool('menu', showMenu);
```

`destroy()` 里在 `ctx = null;` 之前补 `padRefs = null;`。

- [ ] **Step 5: 验证**

Run: `npx tsc --noEmit && npm test`
Expected: 全绿，`tests/sudoku-logic.test.ts` 零改动。

Run: `git diff --stat src/games/sudoku/logic.ts tests/sudoku-logic.test.ts`
Expected: 空输出。

- [ ] **Step 6: 提交**

```bash
git add src/games/sudoku/index.ts src/styles/arcade.css
git commit -m "feat: move Sudoku's keypad, difficulty menu and status into DOM"
```

---

## Task 8: e2e 与全量验证

**Files:**
- Modify: `e2e/smoke.spec.ts`

- [ ] **Step 1: 断言改英文并补新能力**

`e2e/smoke.spec.ts` 里 sudoku 那条断言由 `'数独'` 改为 `'SUDOKU'`。

**注意**：sudoku 现在进去先弹难度菜单，浮层盖在棋盘上但 canvas 仍然可见，
`toBeVisible()` 不受影响。

末尾追加：

```ts
test('SUDOKU 先弹难度菜单，选完出现数字盘', async ({ page }) => {
  await page.goto('/#/sudoku');
  await expect(page.locator('canvas')).toBeVisible();

  // 难度菜单是多动作浮层
  await expect(page.locator('.settle-title')).toHaveText('SELECT DIFFICULTY');
  await expect(page.locator('.settle-actions .settle-action')).toHaveCount(3);
  await expect(page.locator('[data-act="pause"]')).toHaveCount(0);

  await page.click('[data-act="overlay:0"]');
  await expect(page.locator('.settle-card')).toBeHidden();
  await expect(page.locator('.cab-pill')).toHaveText('EASY');
  await expect(page.locator('.pad-btn-digit')).toHaveCount(9);
  await expect(page.locator('.pad-btn-wide')).toHaveCount(3);

  // ☰ 重新打开菜单
  await page.click('[data-act="tool:menu"]');
  await expect(page.locator('.settle-title')).toHaveText('SELECT DIFFICULTY');
});

test('SUDOKU 的笔记开关有激活态', async ({ page }) => {
  await page.goto('/#/sudoku');
  await page.click('[data-act="overlay:0"]');
  const notes = page.locator('[data-fn="notes"]');
  await expect(notes).not.toHaveClass(/is-on/);
  await notes.click();
  await expect(notes).toHaveClass(/is-on/);
});
```

- [ ] **Step 2: 全量跑**

Run: `npx tsc --noEmit && npm test && npm run e2e`
Expected: 无类型错误；单测 20 文件全绿；e2e 全过。

- [ ] **Step 3: 越界检查**

Run: `git diff --stat main -- 'src/games/*/logic.ts' 'tests/*-logic.test.ts'`
Expected: **只有 `src/games/breakout/logic.ts` 一行改动**（Task 2 加的 `row` 字段）。
其余 logic 与全部逻辑测试必须为空。

- [ ] **Step 4: 目视核对**

Run: `npm run build && npx vite preview --port 4173`

对照 artboard **1c** 与 **1d**：

- 进入 SUDOKU 先弹 `SELECT DIFFICULTY` 浮层，三个描边按钮 + `QUIT TO HUB`
- 选难度后浮层消失，顶栏出现 `EASY` / `MEDIUM` / `HARD` 药丸（accent 底、墨色描边）
- 顶栏右侧是 `☰` + `SND`，**没有暂停键**
- 棋盘：奶油底、`#ddd1bc` 细线、2px 墨色 3×3 分隔、给定数字墨色加粗、填入数字青色
- 选中格淡青底；开 CHECK 后冲突格粉底粉字
- 屏幕下方两行控件：9 个数字键 + `⌫ ERASE` / `✎ NOTES` / `⚑ CHECK`，
  后两者激活时底色 `#ffe08a`
- 填完最后一格弹 `SOLVED!`（**青色标题——这是 `tone: 'win'` 第一次被真正渲染，
  A/B 里从没有消费者，专门核对观感**）
- 点 `☰` 重新弹出难度菜单
- 另外七个游戏逐个进一遍，确认 `settle` → `overlay` 改名没弄坏它们的结算浮层

- [ ] **Step 5: 提交**

```bash
git add e2e/smoke.spec.ts
git commit -m "test: cover Sudoku's difficulty menu, pill and DOM keypad"
```
