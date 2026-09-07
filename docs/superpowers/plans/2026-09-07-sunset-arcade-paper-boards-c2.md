# 浅色纸盘余下三款（子项目 C2）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 2048 / MINES / GOMOKU 迁到浅色纸盘风格，抽出三处已经重复的共用件，并在收尾时删掉再无消费者的 `THEME`。

**Architecture:** 沿用 C1 的机柜能力，只补一个「屏幕上方一行」的 `head` 插槽——三个游戏都需要它。棋盘一律留 canvas，周边控件改 DOM。

**Tech Stack:** Vite 5 + TypeScript 5 + Vitest 2 + Playwright 1.46，无前端框架，DOM 直出 + Canvas 2D。

**Spec:** `docs/superpowers/specs/2026-09-07-sunset-arcade-paper-boards-c2-design.md`

---

## 背景：读计划前必须知道的事

1. **A / B / C1 已合并。** `src/games/sudoku/index.ts` 是最完整的纸盘样板（画布只剩棋盘、
   控件在 DOM、难度菜单是多动作浮层、用 `ctx.overlayOpen()` 冻结输入）。**先读它。**
2. **视觉改动不许碰 `logic.ts`**，判据见 `CLAUDE.md`。C2 **没有例外**，
   `git diff --stat main -- 'src/games/*/logic.ts' 'tests/*-logic.test.ts'` 全程应为空。
3. **MINES 的计时器放渲染层**（`index.ts` 里从首次点击开始计），不动 `logic.ts`。
   这与 C1 拒绝给 SUDOKU 加计时的区别在于：SUDOKU 支持存档恢复、从挂载计时会少算；
   MINES 不存档，渲染层计时是准确的。
4. **GOMOKU 的模式菜单不是难度菜单。** 它选的是对局模式（双人 / AI 三档），
   形状像但语义不同，**不要复用 `difficultyMenu`**，直接用多动作浮层。
5. **抽共用件时旧调用点一并改造。** 只让新代码用共用件、把旧的留成第二份，等于白抽。
6. 未跟踪的 `design_handoff_*/` 是设计参考资料，**任何任务都不要提交它**。
   用 `git add <具体路径>`，**不要 `git add -A`**。

## 文件结构

| 文件 | 本次职责 |
|---|---|
| `src/core/game.ts`（改） | `GameMeta.head`、`GameContext.head` |
| `src/shell/cabinet-view.ts`（改） | `.cab-stack` 包裹、`.cab-head` 插槽 |
| `src/shell/frame.ts`（改） | `head` 引用 |
| `src/core/format.ts`（改） | `DIFF_LABEL` 移入 |
| `src/shell/pad.ts`（新） | `padButtons()` |
| `src/shell/difficulty-menu.ts`（新） | `difficultyMenu()` |
| `src/games/{g2048,minesweeper,gomoku}/index.ts`（改） | 三个游戏迁移 |
| `src/games/{sudoku,tetris}/index.ts`（改） | 改用共用件 |
| `src/core/theme.ts`（改） | 收尾删 `THEME` |

---

## Task 1: 机柜补 head 插槽

三个游戏都有一行位于棋盘上方的 DOM，而机柜只有右侧与下方的槽。

**Files:**
- Modify: `src/core/game.ts`
- Modify: `src/shell/cabinet-view.ts`
- Modify: `src/shell/frame.ts`
- Modify: `src/styles/arcade.css`
- Modify: `tests/cabinet-view.test.ts`, `tests/frame.test.ts`

- [ ] **Step 1: 写失败测试**

`tests/cabinet-view.test.ts` 末尾追加：

```ts
describe('cabinetHtml 上方栏', () => {
  it('缺省不渲染上方栏，但 stack 始终在', () => {
    const html = cabinetHtml(snake, false);
    expect(html).not.toContain('cab-head');
    expect(html).toContain('class="cab-stack"');
  });

  it('head 为 true 时渲染空的上方栏', () => {
    expect(cabinetHtml({ ...snake, head: true }, false)).toContain('<div class="cab-head"></div>');
  });

  it('上方栏排在屏幕之前、侧栏之外', () => {
    const html = cabinetHtml({ ...snake, head: true, side: true }, false);
    const head = html.indexOf('cab-head');
    const screen = html.indexOf('class="screen ');
    const side = html.indexOf('cab-side');
    expect(head).toBeGreaterThan(-1);
    expect(head).toBeLessThan(screen);
    expect(screen).toBeLessThan(side);
  });
});
```

`tests/frame.test.ts` 的「插槽」describe 里追加：

```ts
  it('按 meta 提供 head，否则为 null', () => {
    expect(mount().ctx.head).toBeNull();
    expect(mount({ head: true }).ctx.head).not.toBeNull();
  });
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/cabinet-view.test.ts tests/frame.test.ts`
Expected: FAIL。

- [ ] **Step 3: 改类型**

`src/core/game.ts` 的 `GameMeta` 补：

```ts
  /** 需要屏幕井上方的一行 DOM 时置 true，内容由游戏自己填 */
  head?: boolean;
```

`GameContext` 补（放在 `side` 之前）：

```ts
  /** 上方栏容器；meta.head 为 true 时可用，否则为 null */
  head: HTMLElement | null;
```

- [ ] **Step 4: 改 cabinetHtml**

在 `sideHtml` 之后补：

```ts
  const headHtml = meta.head ? '<div class="cab-head"></div>' : '';
```

把 `.cab-screen` 那段改为：

```ts
      <div class="cab-screen">
        <div class="cab-stack">
          ${headHtml}
          <div class="screen screen-${meta.screen ?? 'dark'}">
            <div class="screen-body"></div>
            <div class="screen-glass"></div>
            <div class="settle" role="status" aria-live="polite" hidden></div>
          </div>
        </div>
        ${sideHtml}
      </div>
```

`.cab-stack` 无条件渲染——一种形状比两种好推理，且对 TETRIS 的侧栏布局无视觉影响。

- [ ] **Step 5: 改 frame**

`ctx` 里 `side` 之前补：

```ts
      head: root.querySelector<HTMLElement>('.cab-head'),
```

- [ ] **Step 6: CSS**

`.cab-side` 那条规则之前插入：

```css
.cab-stack { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
.cab-head { display: flex; justify-content: center; align-items: center; gap: 10px; flex-wrap: wrap; }
/* 上方栏里的统计卡与按钮共用一套外观 */
.head-card {
  background: var(--paper); border: 2px solid var(--ink); border-radius: 8px;
  padding: 7px 16px; display: flex; flex-direction: column; align-items: center;
  font-family: var(--mono); font-weight: 700; font-size: 15px; color: var(--ink);
}
.head-label { font-family: 'Bungee', 'Space Grotesk', sans-serif; font-size: 9px; color: var(--dim); }
.head-btn {
  background: var(--paper); border: 2px solid var(--ink); border-radius: 8px;
  box-shadow: 3px 3px 0 var(--ink); padding: 7px 14px; color: var(--ink);
  font-family: var(--mono); font-weight: 700; font-size: 14px;
  transition: transform .1s, box-shadow .1s;
}
.head-btn:hover { transform: translate(2px, 2px); box-shadow: 1px 1px 0 var(--ink); }
.head-btn:active { transform: translate(3px, 3px); box-shadow: 0 0 0 var(--ink); }
.head-btn:focus-visible { outline: none; box-shadow: 3px 3px 0 var(--ink), var(--focus-ring); }
.head-btn:disabled { color: var(--faint); border-color: var(--faint); box-shadow: none; transform: translate(3px, 3px); }
.head-btn-accent { background: var(--highlight); }
```

`@media (prefers-reduced-motion: reduce)` 的选择器补上 `.head-btn`。

- [ ] **Step 7: 验证并提交**

Run: `npx tsc --noEmit && npm test && npm run e2e`
Expected: 全绿（e2e 19 passed，机柜多了一层 div 但视觉不变）。

```bash
git add src/core/game.ts src/shell/cabinet-view.ts src/shell/frame.ts src/styles/arcade.css tests/cabinet-view.test.ts tests/frame.test.ts
git commit -m "feat: add a head slot above the cabinet screen"
```

---

## Task 2: 抽出三处共用件

**Files:**
- Modify: `src/core/format.ts`
- Create: `src/shell/pad.ts`, `src/shell/difficulty-menu.ts`, `tests/pad.test.ts`
- Modify: `src/games/sudoku/index.ts`, `src/games/tetris/index.ts`

- [ ] **Step 1: DIFF_LABEL 移入 core/format**

`src/core/format.ts` 末尾追加：

```ts
/** 难度 id → 顶栏药丸用的英文标签。logic 里的 name 是中文，顶栏按设计稿用英文 */
export const DIFF_LABEL: Record<'easy' | 'medium' | 'hard', string> = {
  easy: 'EASY', medium: 'MEDIUM', hard: 'HARD',
};
```

从 `src/games/sudoku/index.ts` 删掉本地的 `DIFF_LABEL` 定义，改为导入。

**不要抽 `DIFFICULTIES`**——SUDOKU 与 MINES 的两张表除 `id`/`name` 外字段完全不同
（`clues` vs `cols/rows/mines/cell`），抽表是错的。

- [ ] **Step 2: padButtons 的失败测试**

创建 `tests/pad.test.ts`：

```ts
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { padButtons } from '../src/shell/pad';

const host = () => document.createElement('div');

describe('padButtons', () => {
  it('每个定义渲染一个按钮，带 aria 与可选 variant', () => {
    const el = host();
    padButtons(el, [
      { id: 'a', label: 'A', aria: '甲' },
      { id: 'b', label: 'B', aria: '乙', variant: 'pad-btn-wide' },
    ], () => {});
    const btns = el.querySelectorAll('button');
    expect(btns).toHaveLength(2);
    expect(btns[0].className).toBe('pad-btn');
    expect(btns[0].getAttribute('aria-label')).toBe('甲');
    expect(btns[1].className).toBe('pad-btn pad-btn-wide');
  });

  it('点击回传 id', () => {
    const el = host();
    const hit: string[] = [];
    padButtons(el, [{ id: 'x', label: 'X', aria: 'X' }], (id) => hit.push(id));
    el.querySelector('button')!.click();
    expect(hit).toEqual(['x']);
  });

  it('点完就 blur —— 与顶栏 wire() 同一约定', () => {
    const el = host();
    document.body.appendChild(el);
    padButtons(el, [{ id: 'x', label: 'X', aria: 'X' }], () => {});
    const b = el.querySelector('button')!;
    b.focus();
    expect(document.activeElement).toBe(b);
    b.click();
    expect(document.activeElement).not.toBe(b);
  });

  it('标签会被转义', () => {
    const el = host();
    padButtons(el, [{ id: 'x', label: '<b>X</b>', aria: 'X' }], () => {});
    expect(el.innerHTML).toContain('&lt;b&gt;X&lt;/b&gt;');
    expect(el.querySelector('b')).toBeNull();
  });
});
```

- [ ] **Step 3: 实现 padButtons**

创建 `src/shell/pad.ts`：

```ts
import { esc } from './escape';

export interface PadButton {
  id: string;
  label: string;
  aria: string;
  /** 额外 class，如 pad-btn-digit / pad-btn-wide */
  variant?: string;
}

/**
 * 在控制垫（或其中一行）里渲染一排按钮并接上点击。
 * 点完统一 blur——与顶栏 wire() 同一约定，避免残留焦点让空格键既触发按钮又触发游戏逻辑。
 */
export function padButtons(
  host: HTMLElement,
  buttons: PadButton[],
  onPress: (id: string) => void,
): void {
  host.innerHTML = buttons
    .map((b) => `<button class="pad-btn${b.variant ? ` ${b.variant}` : ''}" data-pad="${esc(b.id)}" aria-label="${esc(b.aria)}">${esc(b.label)}</button>`)
    .join('');
  host.querySelectorAll<HTMLButtonElement>('[data-pad]').forEach((el) => {
    el.addEventListener('click', () => {
      el.blur();
      onPress(el.dataset.pad!);
    });
  });
}
```

- [ ] **Step 4: TETRIS 与 SUDOKU 改用它**

**TETRIS**：把 `buildPad` 替换为：

```ts
  function buildPad(host: HTMLElement): void {
    padButtons(host, PAD.map((b) => ({ id: b.id, label: b.label, aria: b.aria })),
      (id) => act(id as PadId));
  }
```

**SUDOKU**：`buildPad` 里两行各建一个 `.pad-row` 容器后调用：

```ts
  function buildPad(host: HTMLElement): void {
    host.classList.add('cab-pad-rows');
    host.innerHTML = '<div class="pad-row" data-row="digits"></div><div class="pad-row" data-row="fns"></div>';
    const row = (n: string) => host.querySelector<HTMLElement>(`[data-row="${n}"]`)!;

    padButtons(row('digits'),
      [1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => ({
        id: String(d), label: String(d), aria: `填入 ${d}`, variant: 'pad-btn-digit',
      })),
      (id) => applyDigit(Number(id)));

    padButtons(row('fns'), [
      { id: 'erase', label: '⌫ ERASE', aria: '清除', variant: 'pad-btn-wide' },
      { id: 'notes', label: '✎ NOTES', aria: '笔记模式', variant: 'pad-btn-wide' },
      { id: 'check', label: '⚑ CHECK', aria: '检查冲突', variant: 'pad-btn-wide' },
    ], (id) => {
      if (frozen()) return;
      if (id === 'erase') eraseSelected();
      else if (id === 'notes') { notesMode = !notesMode; syncPad(); }
      else if (id === 'check') { showErrors = !showErrors; syncPad(); }
    });

    padRefs = {
      notes: row('fns').querySelector('[data-pad="notes"]')!,
      check: row('fns').querySelector('[data-pad="check"]')!,
    };
    syncPad();
  }
```

（`eraseSelected` 自己有 `frozen()` 守卫，这里再挡一次是为了 notes/check 两个开关。）

- [ ] **Step 5: difficultyMenu**

创建 `src/shell/difficulty-menu.ts`：

```ts
import type { GameContext } from '../core/game';
import { DIFF_LABEL } from '../core/format';

/**
 * 难度菜单浮层。进行中时给一个回到当前局的出口——玩到一半误触 ☰ 不该只能弃局。
 * 返回的 open() 供 ctx.onTool('menu', …) 与首次挂载共用。
 */
export function difficultyMenu<D extends { id: 'easy' | 'medium' | 'hard' }>(opts: {
  ctx: GameContext;
  difficulties: D[];
  /** 当前是否有进行中的局（决定要不要渲染 ✕ RESUME） */
  resumable: () => boolean;
  onPick: (d: D) => void;
}): { open: () => void } {
  const open = (): void => {
    const resumable = opts.resumable();
    opts.ctx.overlay({
      title: 'DIFFICULTY', // 单词标题：卡片比棋盘窄不了多少，两词会折行并盖满整块屏幕
      tone: 'win',
      lines: [],
      actions: [
        ...(resumable
          ? [{ label: '✕ RESUME', kind: 'secondary' as const, onPress: () => opts.ctx.overlay(null) }]
          : []),
        ...opts.difficulties.map((d) => ({
          label: DIFF_LABEL[d.id],
          kind: 'secondary' as const,
          onPress: () => opts.onPick(d),
        })),
      ],
      hints: [resumable ? 'RESUME OR PICK A DIFFICULTY' : 'PICK A DIFFICULTY TO BEGIN'],
    });
  };
  return { open };
}
```

**SUDOKU 改用它**：删掉本地 `showMenu`，在 `mount()` 里建：

```ts
      const menu = difficultyMenu({
        ctx,
        difficulties: L.DIFFICULTIES,
        resumable: () => state !== null && state.status === 'playing',
        onPick: startGame,
      });
      showMenu = menu.open;   // 供 backToMenu / onTool 复用
```

`showMenu` 改成模块内的 `let showMenu: () => void = () => {};`，
在 `mount` 里赋值。`backToMenu` 与 `reportSolved` 的引用不变。

- [ ] **Step 6: 验证并提交**

Run: `npx tsc --noEmit && npm test && npm run e2e`
Expected: 全绿。SUDOKU 与 TETRIS 的行为应当**完全不变**——这是纯重构。

Run: `git diff --stat main -- 'src/games/*/logic.ts' 'tests/*-logic.test.ts'`
Expected: 空输出。

```bash
git add src/core/format.ts src/shell/pad.ts src/shell/difficulty-menu.ts tests/pad.test.ts src/games/sudoku/index.ts src/games/tetris/index.ts
git commit -m "refactor: share the pad builder, difficulty menu and difficulty labels"
```

---

## Task 3: 2048

**Files:**
- Modify: `src/games/g2048/index.ts`

**不要动 `src/games/g2048/logic.ts` 与 `tests/g2048-logic.test.ts`。**

- [ ] **Step 1: 常量与配色**

把文件顶部的 import 与常量替换为：

```ts
import type { Game, GameContext } from '../../core/game';
import { GameLoop } from '../../core/loop';
import { createScreenCanvas } from '../../core/screen';
import { padScore } from '../../core/format';
import * as L from './logic';

const PAD = 8;
const CELL = 71;
const W = L.SIZE * CELL + (L.SIZE + 1) * PAD; // 4*71 + 5*8 = 324
const H = W;

/** 纸盘配色（设计稿 2d 的 T 对象） */
const WELL = '#efe5d3';
const EMPTY_LINE = '#ddd1bc';
const INK = '#2b2118';
const TILE: Record<number, [bg: string, fg: string]> = {
  2: ['#f6efe3', '#8a7a66'],
  4: ['#efe0c3', '#8a7a66'],
  8: ['#ffd9a8', INK],
  16: ['#ffbe76', INK],
  32: ['#ff8c42', '#fffaf0'],
  64: ['#e8590c', '#fffaf0'],
  128: ['#d6336c', '#fffaf0'],
  256: ['#0b7285', '#fffaf0'],
};
const TILE_SUPER: [string, string] = ['#0b7285', '#fffaf0'];
const MONO = "'JetBrains Mono', ui-monospace, monospace";
```

- [ ] **Step 2: 重画 drawTile 与 render**

```ts
  function drawTile(x: number, y: number, v: number): void {
    if (!g) return;
    const px = PAD + x * (CELL + PAD);
    const py = PAD + y * (CELL + PAD);
    if (v === 0) {
      g.strokeStyle = EMPTY_LINE;
      g.lineWidth = 2;
      g.setLineDash([5, 4]);
      g.strokeRect(px + 1, py + 1, CELL - 2, CELL - 2);
      g.setLineDash([]);
      return;
    }
    const [bg, fg] = TILE[v] ?? TILE_SUPER;
    g.fillStyle = bg;
    g.beginPath();
    g.roundRect(px, py, CELL, CELL, 8);
    g.fill();
    // ≤4 用软描边，≥8 用墨色描边（设计稿 2d）
    g.strokeStyle = v <= 4 ? EMPTY_LINE : INK;
    g.lineWidth = 2;
    g.beginPath();
    g.roundRect(px + 1, py + 1, CELL - 2, CELL - 2, 7);
    g.stroke();
    g.fillStyle = fg;
    g.font = `700 ${v >= 128 ? 22 : 26}px ${MONO}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(v), px + CELL / 2, py + CELL / 2 + 1);
  }

  function render(): void {
    if (!g) return;
    g.fillStyle = WELL;
    g.fillRect(0, 0, W, H);
    for (let y = 0; y < L.SIZE; y++) {
      for (let x = 0; x < L.SIZE; x++) drawTile(x, y, state.board[y * L.SIZE + x]);
    }
    syncHead();
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
  }
```

**画布内不再画分数、撤销按钮与终局覆盖层**——分别搬到上方栏与结算浮层。

- [ ] **Step 3: 上方栏**

```ts
  let head: { score: HTMLElement; best: HTMLElement; undo: HTMLButtonElement } | null = null;
  let shownScore = '';
  let shownBest = '';

  function buildHead(host: HTMLElement): void {
    host.innerHTML = `
      <div class="head-card"><span class="head-label">SCORE</span><span data-ref="score">000000</span></div>
      <div class="head-card"><span class="head-label">BEST</span><span data-ref="best">000000</span></div>
      <button class="head-btn" data-ref="undo" aria-label="撤销">↩ UNDO</button>`;
    const q = <T extends HTMLElement>(r: string) => host.querySelector<T>(`[data-ref="${r}"]`)!;
    head = { score: q('score'), best: q('best'), undo: q<HTMLButtonElement>('undo') };
    head.undo.addEventListener('click', () => {
      head!.undo.blur();
      doUndo();
    });
    shownScore = '';
    shownBest = '';
  }

  /** 每帧同步；只在值变了才写 DOM */
  function syncHead(): void {
    if (!head) return;
    const s = padScore(state.score, 6);
    if (s !== shownScore) { shownScore = s; head.score.textContent = s; }
    const b = padScore(best, 6);
    if (b !== shownBest) { shownBest = b; head.best.textContent = b; }
    head.undo.disabled = !state.prev;
  }
```

- [ ] **Step 4: 结算与重开**

```ts
  function newGame(): void {
    state = L.createState();
    ctx?.overlay(null);
  }

  function reportEnd(): void {
    const record = state.score > bestAtStart;
    if (state.status === 'won') {
      ctx?.overlay({
        title: '2048!',
        tone: 'win',
        lines: [`SCORE ${padScore(state.score, 6)}`, `BEST ${padScore(best, 6)}`],
        actions: [
          { label: '▶ KEEP GOING', onPress: () => ctx?.overlay(null) },
          { label: '↺ NEW GAME', kind: 'secondary', onPress: newGame },
        ],
        hints: ['KEEP GOING OR START OVER'],
      });
      return;
    }
    ctx?.overlay({
      title: record ? 'NEW HIGH SCORE' : 'GAME OVER',
      tone: record ? 'record' : 'lose',
      lines: [`SCORE ${padScore(state.score, 6)}`, `BEST ${padScore(best, 6)}`],
      actions: [{ label: '▶ NEW GAME', onPress: newGame }],
      hints: ['SPACE / TAP FOR A NEW GAME'],
    });
  }
```

变量区补 `let bestAtStart = 0;`，`newGame()` 与 `mount()` 里都设它。
终局判定处（原来设 `endedAt` 的地方）调 `reportEnd()`。

**`won` 态的「继续」很关键**：2048 拼出目标后可以继续玩，所以主按钮是
`▶ KEEP GOING`（只收浮层），次按钮才是新局。

- [ ] **Step 5: 输入与 meta**

`doMove` / `doUndo` / 键盘处理都补 `ctx?.overlayOpen()` 守卫（照 SUDOKU 的 `frozen()` 写法）。
画布点按只保留「浮层收起时无操作」——终局重开走浮层按钮。

```ts
    meta: {
      id: 'g2048',
      name: '2048',
      icon: '🔢',
      displayName: '2048',
      hints: ['↑↓←→ / SWIPE TO MERGE', 'Z UNDO'],
      screen: 'paper',
      head: true,
      pausable: false,
      tools: [{ id: 'new', label: '↺ NEW', aria: '新局' }],
    },
```

`mount()` 里：`({ canvas, g } = createScreenCanvas(container, W, H));`、
`if (ctx.head) buildHead(ctx.head);`、`ctx.onTool('new', newGame);`、`bestAtStart = best;`。
`destroy()` 里 `head = null;`。

- [ ] **Step 6: 验证并提交**

Run: `npx tsc --noEmit && npm test`
Run: `git diff --stat src/games/g2048/logic.ts tests/g2048-logic.test.ts` → 空

```bash
git add src/games/g2048/index.ts
git commit -m "feat: rebuild 2048 on paper with DOM score cards and undo"
```

---

## Task 4: MINES

**Files:**
- Modify: `src/games/minesweeper/index.ts`

**不要动 `src/games/minesweeper/logic.ts` 与 `tests/minesweeper-logic.test.ts`。**

- [ ] **Step 1: 画布缩成纯雷区**

删掉 `HUD_H`、画布内的难度菜单与 HUD 绘制。`setCanvasSize` 改为
`setCanvasSize(diff.cols * diff.cell, diff.rows * diff.cell)`，
菜单态（`state` 为 null）用第一档难度的尺寸占位。

格子坐标里所有 `HUD_H + …` 的偏移一并去掉，`MARGIN` 也去掉（边框由 `.screen` 提供）。

- [ ] **Step 2: 纸盘配色**

```ts
/** 纸盘配色（设计稿 2e） */
const PAPER = {
  hidden: '#fffaf0',
  revealed: '#efe5d3',
  line: '#ddd1bc',
  ink: '#2b2118',
  flag: '#d6336c',
  mine: 'rgba(214, 51, 108, .25)',
  mono: "'JetBrains Mono', ui-monospace, monospace",
} as const;

/** 数字 1–8：1–5 按设计稿，6–8 沿用第 5 色系 */
const NUM_COLORS = ['', '#0b7285', '#5c940d', '#d6336c', '#7048e8', '#e8590c', '#e8590c', '#e8590c', '#e8590c'];
```

未翻开格画 `PAPER.hidden` 底 + 右下 `rgba(0,0,0,.10)` 与左上 `rgba(255,255,255,.9)` 两条
2px 边模拟凸起；已翻开格画 `PAPER.revealed` 平底。格线 `PAPER.line` 0.5px。

- [ ] **Step 3: 上方栏（旗数 / 🙂 / 计时）**

```ts
  let head: { flags: HTMLElement; face: HTMLButtonElement; time: HTMLElement } | null = null;
  let startedAt = 0;   // 首次点击才起表，扫雷惯例
  let stoppedAt = 0;

  function buildHead(host: HTMLElement): void {
    host.innerHTML = `
      <div class="head-card" data-ref="flags">⚑ 00</div>
      <button class="head-btn head-btn-accent" data-ref="face" aria-label="重开本局">🙂</button>
      <div class="head-card" data-ref="time">00:00</div>`;
    const q = <T extends HTMLElement>(r: string) => host.querySelector<T>(`[data-ref="${r}"]`)!;
    head = { flags: q('flags'), face: q<HTMLButtonElement>('face'), time: q('time') };
    head.face.addEventListener('click', () => {
      head!.face.blur();
      replay();
    });
  }

  /** 🙂 是重开本局（同难度）；返回难度菜单走顶栏 ☰ —— 这两件事语义不同 */
  function replay(): void {
    if (!state) return;
    startGame(state.diff);
  }

  function elapsed(): number {
    if (!startedAt) return 0;
    return Math.floor(((stoppedAt || performance.now()) - startedAt) / 1000);
  }

  function syncHead(): void {
    if (!head || !state) return;
    head.flags.textContent = `⚑ ${padScore(Math.max(0, state.diff.mines - state.flags), 2)}`;
    const s = elapsed();
    head.time.textContent = `${padScore(Math.floor(s / 60), 2)}:${padScore(s % 60, 2)}`;
    head.face.textContent = state.status === 'lost' ? '💥' : state.status === 'won' ? '😎' : '🙂';
  }
```

`startGame` 里 `startedAt = 0; stoppedAt = 0;`；首次成功翻格时 `startedAt = performance.now()`；
胜负时 `stoppedAt = performance.now()`。`render()` 末尾调 `syncHead()`。

- [ ] **Step 4: 难度菜单改用共用件，结算走浮层**

```ts
      const menu = difficultyMenu({
        ctx,
        difficulties: L.DIFFICULTIES,
        resumable: () => state !== null && state.status === 'playing',
        onPick: startGame,
      });
      showMenu = menu.open;
      ctx.onTool('menu', showMenu);
```

结算：

```ts
  function reportEnd(): void {
    if (!state) return;
    const won = state.status === 'won';
    ctx?.overlay({
      title: won ? 'CLEARED!' : 'BOOM',
      tone: won ? 'win' : 'lose',
      lines: [DIFF_LABEL[state.diff.id], `TIME ${padScore(Math.floor(elapsed() / 60), 2)}:${padScore(elapsed() % 60, 2)}`],
      actions: [{ label: '▶ NEW GAME', onPress: replay }],
      hints: ['SPACE / TAP TO PLAY AGAIN'],
    });
  }
```

- [ ] **Step 5: meta 与输入守卫**

```ts
    meta: {
      id: 'minesweeper',
      name: '扫雷',
      icon: '💣',
      displayName: 'MINES',
      hints: ['CLICK REVEAL', 'LONG-PRESS / RIGHT-CLICK FLAG'],
      screen: 'paper',
      head: true,
      pausable: false,
      tools: [{ id: 'menu', label: '☰', aria: '难度菜单' }],
    },
```

`onPress` 的三个手势处理都补 `ctx?.overlayOpen()` 守卫。

- [ ] **Step 6: 验证并提交**

Run: `npx tsc --noEmit && npm test`
Run: `git diff --stat src/games/minesweeper/logic.ts tests/minesweeper-logic.test.ts` → 空

```bash
git add src/games/minesweeper/index.ts
git commit -m "feat: rebuild Mines on paper with a DOM HUD and a render-layer clock"
```

---

## Task 5: GOMOKU

**Files:**
- Modify: `src/games/gomoku/index.ts`

**不要动 `src/games/gomoku/logic.ts`、`ai.ts`、`ai.worker.ts` 与
`tests/gomoku-{logic,ai}.test.ts`。**

- [ ] **Step 1: 画布缩成纯棋盘**

`W = H = 320`，删掉 `MENU_H`、`HUD_Y` 与画布内的模式菜单、HUD 绘制。

- [ ] **Step 2: 纸盘配色**

盘面 `#efe0c3`，格线 `#b5a88f` 1px，星位 ink 实心 3px 圆点。
棋子直径 22：黑 = `#2b2118` + 内侧 `rgba(255,255,255,.2)` 高光；
白 = `#fffaf0` + 内侧 `#ddd1bc` 阴影；都带 2px ink 描边与 `rgba(43,33,24,.3)` 投影。
悬停虚影 = 2px `#d6336c` 虚线圆。

- [ ] **Step 3: 上方栏（回合筹）**

```ts
  let head: { black: HTMLElement; white: HTMLElement } | null = null;

  function buildHead(host: HTMLElement): void {
    host.innerHTML = `
      <div class="chip" data-ref="black"></div>
      <div class="chip" data-ref="white"></div>`;
    const q = (r: string) => host.querySelector<HTMLElement>(`[data-ref="${r}"]`)!;
    head = { black: q('black'), white: q('white') };
  }

  /** 文案随模式变：AI 局是 YOU/CPU，双人局是 BLACK/WHITE（设计稿只画了 AI 那种） */
  function syncHead(): void {
    if (!head || !game) return;
    const ai = mode !== 'pvp';
    head.black.textContent = ai ? '● YOU' : '● BLACK';
    head.white.textContent = ai ? '○ CPU' : '○ WHITE';
    const turn = game.turn;
    head.black.classList.toggle('is-turn', turn === L.BLACK && game.status === 'playing');
    head.white.classList.toggle('is-turn', turn === L.WHITE && game.status === 'playing');
  }
```

CSS（加到 `arcade.css` 的 `.head-btn` 之后）：

```css
.chip {
  font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 13px; letter-spacing: 1px;
  border: 2px solid var(--faint); border-radius: 8px; padding: 7px 16px;
  background: var(--panel); color: var(--dim);
}
.chip.is-turn {
  background: var(--ink); color: var(--panel); border-color: var(--ink);
  box-shadow: 3px 3px 0 rgba(43, 33, 24, .35);
}
```

- [ ] **Step 4: 模式菜单（4 项，不复用 difficultyMenu）**

```ts
  const MODES: { id: 'pvp' | AiLevel['id']; label: string }[] = [
    { id: 'pvp', label: '2 PLAYERS' },
    { id: 'easy', label: 'AI EASY' },
    { id: 'medium', label: 'AI MEDIUM' },
    { id: 'hard', label: 'AI HARD' },
  ];

  function showMenu(): void {
    const resumable = game !== null && game.status === 'playing';
    ctx?.overlay({
      title: 'GOMOKU',
      tone: 'win',
      lines: [],
      actions: [
        ...(resumable
          ? [{ label: '✕ RESUME', kind: 'secondary' as const, onPress: () => ctx?.overlay(null) }]
          : []),
        ...MODES.map((m) => ({
          label: m.label, kind: 'secondary' as const, onPress: () => startGame(m.id),
        })),
      ],
      hints: [resumable ? 'RESUME OR PICK A MODE' : 'PICK A MODE TO BEGIN'],
    });
  }
```

`startGame` 里 `ctx?.setPill(MODES.find((m) => m.id === mode)!.label)`。

**卡片高度要实测**：4 个按钮 + 可能的 RESUME + 标题 + QUIT，而棋盘只有 320px。
若过挤，把三档 AI 的标签缩短（`EASY` / `MEDIUM` / `HARD`，靠标题 `GOMOKU` 与
`2 PLAYERS` 区分即可）。**在 Task 6 目视核对时确认。**

- [ ] **Step 5: 结算与 meta**

```ts
  function reportEnd(): void {
    if (!game) return;
    const draw = game.status === 'draw';
    const humanWon = mode === 'pvp' || game.winner === L.BLACK;
    ctx?.overlay({
      title: draw ? 'DRAW' : game.winner === L.BLACK ? 'BLACK WINS' : 'WHITE WINS',
      tone: draw ? 'win' : humanWon ? 'win' : 'lose',
      lines: [MODES.find((m) => m.id === mode)!.label],
      actions: [{ label: '▶ NEW GAME', onPress: showMenu }],
      hints: ['SPACE / TAP FOR A NEW GAME'],
    });
  }
```

```ts
    meta: {
      id: 'gomoku',
      name: '五子棋',
      icon: '⚫',
      displayName: 'GOMOKU',
      hints: ['CLICK TO PLACE', 'FIVE IN A ROW WINS'],
      screen: 'paper',
      head: true,
      pausable: false,
      tools: [{ id: 'new', label: '↺ NEW', aria: '新局' }],
    },
```

`ctx.onTool('new', showMenu)`。落子处理补 `ctx?.overlayOpen()` 守卫。

**artboard 2f 的 `WINS 012` 不做**——仓库里没有任何胜场持久化，属功能新增。

- [ ] **Step 6: 验证并提交**

Run: `npx tsc --noEmit && npm test`
Run: `git diff --stat src/games/gomoku/logic.ts src/games/gomoku/ai.ts src/games/gomoku/ai.worker.ts tests/gomoku-logic.test.ts tests/gomoku-ai.test.ts` → 空

```bash
git add src/games/gomoku/index.ts src/styles/arcade.css
git commit -m "feat: rebuild Gomoku on paper with DOM turn chips and a mode overlay"
```

---

## Task 6: e2e 与目视核对

**Files:**
- Modify: `e2e/smoke.spec.ts`

- [ ] **Step 1: 三条断言改英文**

`'2048'` 本来就是英文不用改；`'扫雷'` → `'MINES'`；`'五子棋'` → `'GOMOKU'`。

- [ ] **Step 2: 补新能力的 e2e**

```ts
test('2048 的分数卡与撤销在 DOM 里', async ({ page }) => {
  await page.goto('/#/g2048');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('.cab-head .head-card')).toHaveCount(2);
  // 开局无步可撤
  await expect(page.locator('[data-ref="undo"]')).toBeDisabled();
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('[data-ref="undo"]')).toBeEnabled();
  await expect(page.locator('[data-act="tool:new"]')).toHaveCount(1);
});

test('MINES 的 🙂 重开本局，☰ 才回难度菜单', async ({ page }) => {
  await page.goto('/#/minesweeper');
  await page.click('[data-act="overlay:0"]');           // 选第一档难度
  await expect(page.locator('.settle-card')).toBeHidden();
  await expect(page.locator('.cab-pill')).toHaveText('EASY');

  // 🙂 重开：仍在同一难度，不回菜单
  await page.click('[data-ref="face"]');
  await expect(page.locator('.settle-card')).toBeHidden();
  await expect(page.locator('.cab-pill')).toHaveText('EASY');

  // ☰ 才是回难度菜单
  await page.click('[data-act="tool:menu"]');
  await expect(page.locator('.settle-title')).toHaveText('DIFFICULTY');
});

test('MINES 的计时器首次点击才起表', async ({ page }) => {
  await page.goto('/#/minesweeper');
  await page.click('[data-act="overlay:0"]');
  await expect(page.locator('[data-ref="time"]')).toHaveText('00:00');
  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.click(box.x + 16, box.y + 16);
  await expect(page.locator('[data-ref="time"]')).not.toHaveText('00:00', { timeout: 3000 });
});

test('GOMOKU 的模式菜单有四项，回合筹随模式变', async ({ page }) => {
  await page.goto('/#/gomoku');
  await expect(page.locator('.settle-title')).toHaveText('GOMOKU');
  await expect(page.locator('.settle-actions .settle-action')).toHaveCount(4);

  await page.click('[data-act="overlay:0"]');           // 2 PLAYERS
  await expect(page.locator('[data-ref="black"]')).toHaveText('● BLACK');
  await expect(page.locator('[data-ref="white"]')).toHaveText('○ WHITE');
  await expect(page.locator('[data-ref="black"]')).toHaveClass(/is-turn/);

  await page.click('[data-act="tool:new"]');
  await page.click('[data-act="overlay:2"]');           // RESUME + 四项里的 AI EASY
  await expect(page.locator('[data-ref="white"]')).toHaveText('○ CPU');
});
```

**注意最后一条**：点 `↺ NEW` 时局面进行中，菜单会多一个 `✕ RESUME` 排在最前，
所以 `AI EASY` 的下标是 2 而非 1。**落地时按实际下标核对**。

- [ ] **Step 3: 全量与目视**

Run: `npx tsc --noEmit && npm test && npm run e2e`

Run: `npm run build && npx vite preview --port 4173`，对照 artboard 2d / 2e / 2f：

- **2048**：方块八级色阶、`≤4` 软描边 `≥8` 墨色描边、空格虚线；上方 SCORE/BEST 卡 + `↩ UNDO`；
  顶栏 `↺ NEW` + `SND` 无暂停；拼出 2048 时结算标题 `2048!` 且能 `▶ KEEP GOING` 继续
- **MINES**：未翻开格有凸起感、已翻开是平的；上方 `⚑ NN` / 🙂 / `MM:SS`；
  首次点击才起表；踩雷 🙂 变 💥、通关变 😎
- **GOMOKU**：盘面米色带星位、黑白子有高光与投影、悬停粉色虚线圆；
  上方两个回合筹轮到谁谁高亮；**模式菜单四项在 320px 棋盘上不显局促**
- 另外五个游戏逐个进一遍，确认 `head` 插槽的 DOM 结构改动没弄坏它们

- [ ] **Step 4: 提交**

```bash
git add e2e/smoke.spec.ts
git commit -m "test: cover the paper boards' DOM heads, menus and clock"
```

---

## Task 7: 删除 THEME 并收尾

C2 完成后 `THEME` 应当再无消费者。

**Files:**
- Modify: `src/core/theme.ts`
- Modify: `tests/hub-model.test.ts`

- [ ] **Step 1: 确认无消费者**

Run: `grep -rn "THEME" src/`
Expected: 只剩 `src/core/theme.ts` 里的定义本身。**若还有游戏在引用，说明前面某个任务没迁完，
回去补，不要为了删而删。**

- [ ] **Step 2: 删除**

`src/core/theme.ts` 里删掉 `THEME` 常量，只留 `SCREEN`。

`tests/hub-model.test.ts` 里删掉那条守着 `THEME` 的整体快照断言与 `THEME` 的导入——
它的使命（保证首页重设计期间画布调色板一个键都不许动）到此结束。

- [ ] **Step 3: 全量验证**

Run: `npx tsc --noEmit && npm test && npm run e2e`
Expected: 全绿。

Run: `git diff --stat main -- 'src/games/*/logic.ts' 'tests/*-logic.test.ts'`
Expected: **空输出**。C2 全程没有改玩法的例外。

- [ ] **Step 4: 提交**

```bash
git add src/core/theme.ts tests/hub-model.test.ts
git commit -m "refactor: remove THEME now that every game has migrated"
```
