# 扫雷（Minesweeper）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付第五款可玩游戏扫雷：三档难度（竖屏适配）、首点必不踩雷（含邻域）、洪水展开、长按（手机）/右键（桌面）插旗。

**Architecture:** 沿用模板：`logic.ts` 纯函数（扁平网格、延迟布雷实现首点安全、BFS 展开、可注入 rand）+ `index.ts` 闭包式 Game（画布内难度菜单，画布尺寸随难度变化）。新增 core 手势：`InputService.onPress` —— 短按/长按/右键三合一（长按触发后同手势不再报 tap，右键抑制系统菜单），扫雷专用且供数独/五子棋复用。

**Tech Stack:** 同主项目（Vite 5 / TS 5 / Vitest 2 / Playwright）。

**规格文档:** `docs/superpowers/specs/2026-07-17-retro-arcade-design.md` 第 6/7 节（扫雷行）。难度对竖屏做了适配（board 恒宽 288px）：初级 9×9/10 雷、中级 12×16/30 雷、高级 16×24/80 雷（密度与经典各档接近）。

**约定:** 分支 `feature/minesweeper`；commit 英文；合并由协调者执行。扫雷无"最高分"，不写 storage 的 best 键（首页卡片显示 `—` 属预期）。

---

## 文件结构

```
├── src/core/input.ts                # 修改：新增 onPress（其余不动）
├── src/games/registry.ts            # 修改：minesweeper 条目加 load
├── src/games/minesweeper/
│   ├── logic.ts                     # 新建：布雷/展开/插旗/胜负 纯逻辑
│   └── index.ts                     # 新建：难度菜单 + 棋盘渲染 + Game 实现
├── tests/minesweeper-logic.test.ts  # 新建：12 个单测
└── e2e/smoke.spec.ts                # 修改：加 minesweeper 用例（共 7 条）
```

---

### Task 1: core/input 新增 onPress

**Files:**
- Modify: `src/core/input.ts`

- [ ] **Step 1: 建分支**

```bash
cd retro-arcade
git checkout main && git pull --ff-only && git checkout -b feature/minesweeper
```

- [ ] **Step 2: 在 `InputService` 类中（`onDrag` 之后、`dispose` 之前）新增方法**

```ts
  /**
   * 组合按压手势（三合一）：
   * - tap：原地（位移 < 10px）短按抬起时触发；
   * - long：按住 450ms 未移动未抬起时触发，触发后本次手势不再报 tap；
   * - right：桌面右键触发，并抑制系统上下文菜单。
   * 坐标为元素内相对 CSS 像素。仅跟踪首个按下的指针。
   * 注意：不要与 onTap/onTapAt 共挂同一元素（会双触发）。
   * 前置条件：消费方需在目标元素设置 touch-action: none。
   */
  onPress(
    el: HTMLElement,
    h: { tap?: (x: number, y: number) => void; long?: (x: number, y: number) => void; right?: (x: number, y: number) => void },
  ): () => void {
    let sx = 0;
    let sy = 0;
    let pid = -1;
    let timer = 0;
    let tracking = false;
    let longFired = false;
    let moved = false;
    const rel = (clientX: number, clientY: number): [number, number] => {
      const r = el.getBoundingClientRect();
      return [clientX - r.left, clientY - r.top];
    };
    const clear = () => {
      if (timer) {
        window.clearTimeout(timer);
        timer = 0;
      }
    };
    const down = (e: PointerEvent) => {
      if (tracking || e.button !== 0) return;
      tracking = true;
      longFired = false;
      moved = false;
      pid = e.pointerId;
      sx = e.clientX;
      sy = e.clientY;
      el.setPointerCapture?.(e.pointerId);
      if (h.long) {
        timer = window.setTimeout(() => {
          timer = 0;
          if (tracking && !moved) {
            longFired = true;
            h.long!(...rel(sx, sy));
          }
        }, 450);
      }
    };
    const move = (e: PointerEvent) => {
      if (!tracking || e.pointerId !== pid) return;
      if (Math.abs(e.clientX - sx) >= 10 || Math.abs(e.clientY - sy) >= 10) {
        moved = true;
        clear();
      }
    };
    const up = (e: PointerEvent) => {
      if (!tracking || e.pointerId !== pid) return;
      tracking = false;
      clear();
      if (!longFired && !moved) h.tap?.(...rel(e.clientX, e.clientY));
      longFired = false; // 鼠标路径在此复位；触屏取消路径保持 true 以拦截随后的模拟 contextmenu
    };
    const cancel = (e: PointerEvent) => {
      if (e.pointerId !== pid) return;
      tracking = false;
      clear();
      // 注意：不要在此复位 longFired——Android 长按序列是 down → cancel → contextmenu，
      // longFired 需要活到 contextmenu 守卫处
    };
    const ctxMenu = (e: MouseEvent) => {
      e.preventDefault();
      // Android Chrome/Firefox 触屏长按会派发模拟 contextmenu，此时 450ms 定时器已报 long，
      // 吞掉避免 long+right 双触发（插旗翻两次 = 净零）
      if (tracking || longFired) return;
      h.right?.(...rel(e.clientX, e.clientY));
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', cancel);
    el.addEventListener('contextmenu', ctxMenu);
    return this.track(() => {
      clear();
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', cancel);
      el.removeEventListener('contextmenu', ctxMenu);
    });
  }
```

（DOM 行为按项目既定取舍不做单测；释放函数里 `clear()` 防止 destroy 后定时器迟到触发。）

- [ ] **Step 3: 验证并提交**

```bash
npx tsc && npm test
```
Expected: tsc 干净；75 单测通过。

```bash
git add src/core/input.ts
git commit -m "feat: add combined tap/long-press/right-click gesture to input service"
```

---

### Task 2: 扫雷纯逻辑（TDD）

**Files:**
- Test: `tests/minesweeper-logic.test.ts`
- Create: `src/games/minesweeper/logic.ts`

- [ ] **Step 1: 写失败测试 `tests/minesweeper-logic.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import {
  createState, reveal, toggleFlag, neighbors, computeAdjacency,
  DIFFICULTIES,
} from '../src/games/minesweeper/logic';

const EASY = DIFFICULTIES[0];
const zero = () => 0;

describe('minesweeper logic', () => {
  it('三档难度参数正确', () => {
    expect(DIFFICULTIES.map((d) => [d.cols, d.rows, d.mines])).toEqual([
      [9, 9, 10],
      [12, 16, 30],
      [16, 24, 80],
    ]);
  });

  it('初始状态：ready、无雷、零旗', () => {
    const s = createState(EASY);
    expect(s.status).toBe('ready');
    expect(s.grid).toHaveLength(81);
    expect(s.grid.every((c) => !c.mine && !c.revealed && !c.flagged)).toBe(true);
    expect(s.flags).toBe(0);
  });

  it('neighbors：角 3 个、中心 8 个', () => {
    expect(neighbors(EASY, 0)).toHaveLength(3);
    expect(neighbors(EASY, 40)).toHaveLength(8);
  });

  it('首点必不踩雷（含 8 邻域），且布雷数正确', () => {
    const s = createState(EASY);
    reveal(s, 40, zero); // rand=0 是最"想"把雷放在前面的对抗序列
    expect(s.status).not.toBe('lost');
    expect(s.grid.filter((c) => c.mine)).toHaveLength(10);
    for (const i of [40, ...neighbors(EASY, 40)]) {
      expect(s.grid[i].mine).toBe(false);
    }
  });

  it('computeAdjacency：角上一颗雷，三邻格 adj 为 1', () => {
    const s = createState(EASY);
    s.grid[0].mine = true;
    computeAdjacency(s);
    expect(s.grid[1].adj).toBe(1);
    expect(s.grid[9].adj).toBe(1);
    expect(s.grid[10].adj).toBe(1);
    expect(s.grid[11].adj).toBe(0);
  });

  it('洪水展开：单雷棋盘从远角揭开即胜（80 格全开）', () => {
    const s = createState(EASY);
    s.grid[0].mine = true;
    computeAdjacency(s);
    s.status = 'playing';
    const ev = reveal(s, 80, zero);
    expect(ev.won).toBe(true);
    expect(s.status).toBe('won');
    expect(s.revealed).toBe(80);
    expect(s.grid[0].revealed).toBe(false); // 雷本身不被展开
  });

  it('展开跳过插旗格：旗未拔则不胜，拔旗补开后胜', () => {
    const s = createState(EASY);
    s.grid[0].mine = true;
    computeAdjacency(s);
    s.status = 'playing';
    toggleFlag(s, 44);
    reveal(s, 80, zero);
    expect(s.status).toBe('playing');
    expect(s.revealed).toBe(79);
    expect(s.grid[44].revealed).toBe(false);
    toggleFlag(s, 44);
    const ev = reveal(s, 44, zero);
    expect(ev.won).toBe(true);
  });

  it('踩雷：lost、爆雷事件、所有雷翻开', () => {
    const s = createState(EASY);
    s.grid[0].mine = true;
    s.grid[17].mine = true;
    computeAdjacency(s);
    s.status = 'playing';
    const ev = reveal(s, 0, zero);
    expect(ev.exploded).toBe(true);
    expect(s.status).toBe('lost');
    expect(s.grid[0].revealed).toBe(true);
    expect(s.grid[17].revealed).toBe(true);
  });

  it('插旗开关与计数；已开格不能插旗', () => {
    const s = createState(EASY);
    expect(toggleFlag(s, 3)).toBe(true);
    expect(s.flags).toBe(1);
    expect(toggleFlag(s, 3)).toBe(true);
    expect(s.flags).toBe(0);
    s.grid[5].revealed = true;
    expect(toggleFlag(s, 5)).toBe(false);
  });

  it('插旗格不可被 reveal', () => {
    const s = createState(EASY);
    s.grid[0].mine = true;
    computeAdjacency(s);
    s.status = 'playing';
    toggleFlag(s, 0);
    const ev = reveal(s, 0, zero);
    expect(ev.exploded).toBe(false);
    expect(s.status).toBe('playing');
  });

  it('终局后 reveal 与 toggleFlag 均被拒绝', () => {
    const s = createState(EASY);
    s.grid[0].mine = true;
    computeAdjacency(s);
    s.status = 'playing';
    reveal(s, 0, zero); // lost
    const ev = reveal(s, 40, zero);
    expect(ev.revealedSome).toBe(false);
    expect(toggleFlag(s, 40)).toBe(false);
  });

  it('重复 reveal 已开格是无事件空操作', () => {
    const s = createState(EASY);
    s.grid[0].mine = true;
    computeAdjacency(s);
    s.status = 'playing';
    reveal(s, 80, zero);
    const ev = reveal(s, 80, zero);
    expect(ev.revealedSome).toBe(false);
    expect(ev.won).toBe(false);
  });

  it('生产路径胜利：placeMines 布雷后翻完全部非雷格', () => {
    const s = createState(EASY);
    reveal(s, 40, zero); // zero rand 使雷确定落在 0..9
    for (let i = 0; i < s.grid.length; i++) {
      const c = s.grid[i];
      if (!c.mine && !c.revealed) reveal(s, i, zero);
    }
    expect(s.status).toBe('won');
    expect(s.revealed).toBe(71);
  });

  it('ready 时先插旗：点旗格不触发布雷', () => {
    const s = createState(EASY);
    toggleFlag(s, 40);
    const ev = reveal(s, 40, zero);
    expect(ev.revealedSome).toBe(false);
    expect(s.status).toBe('ready');
    expect(s.grid.every((c) => !c.mine)).toBe(true);
  });
});
```

- [ ] **Step 2: 运行确认失败**

```bash
npm test -- tests/minesweeper-logic.test.ts
```
Expected: FAIL（找不到模块 `../src/games/minesweeper/logic`）。

- [ ] **Step 3: 实现 `src/games/minesweeper/logic.ts`**

```ts
// 扁平网格行优先存储；延迟布雷（首次 reveal 时避开点击格及其邻域）实现首点安全
export interface Difficulty {
  id: 'easy' | 'medium' | 'hard';
  name: string;
  cols: number;
  rows: number;
  mines: number;
  cell: number; // 渲染格边长 px（board 恒宽 288 = cols × cell）
}

export const DIFFICULTIES: Difficulty[] = [
  { id: 'easy', name: '初级', cols: 9, rows: 9, mines: 10, cell: 32 },
  { id: 'medium', name: '中级', cols: 12, rows: 16, mines: 30, cell: 24 },
  { id: 'hard', name: '高级', cols: 16, rows: 24, mines: 80, cell: 18 },
];

export interface Cell {
  mine: boolean;
  revealed: boolean;
  flagged: boolean;
  adj: number;
}

export type MineStatus = 'ready' | 'playing' | 'won' | 'lost';

export interface MineState {
  diff: Difficulty;
  grid: Cell[];
  status: MineStatus;
  flags: number;
  revealed: number;
}

export interface MineEvents {
  revealedSome: boolean;
  exploded: boolean;
  won: boolean;
}

export function createState(diff: Difficulty): MineState {
  return {
    diff,
    grid: Array.from({ length: diff.cols * diff.rows }, () => ({
      mine: false,
      revealed: false,
      flagged: false,
      adj: 0,
    })),
    status: 'ready',
    flags: 0,
    revealed: 0,
  };
}

export function neighbors(diff: Difficulty, idx: number): number[] {
  const c = idx % diff.cols;
  const r = Math.floor(idx / diff.cols);
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < diff.rows && nc >= 0 && nc < diff.cols) out.push(nr * diff.cols + nc);
    }
  }
  return out;
}

export function computeAdjacency(s: MineState): void {
  for (let i = 0; i < s.grid.length; i++) {
    s.grid[i].adj = neighbors(s.diff, i).filter((n) => s.grid[n].mine).length;
  }
}

function placeMines(s: MineState, safeIdx: number, rand: () => number): void {
  const banned = new Set([safeIdx, ...neighbors(s.diff, safeIdx)]);
  const candidates: number[] = [];
  for (let i = 0; i < s.grid.length; i++) if (!banned.has(i)) candidates.push(i);
  // 部分 Fisher-Yates：洗出前 mines 个
  for (let i = 0; i < s.diff.mines; i++) {
    const j = i + Math.floor(rand() * (candidates.length - i));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    s.grid[candidates[i]].mine = true;
  }
  computeAdjacency(s);
}

export function reveal(s: MineState, idx: number, rand: () => number = Math.random): MineEvents {
  const ev: MineEvents = { revealedSome: false, exploded: false, won: false };
  if (s.status !== 'ready' && s.status !== 'playing') return ev;
  const cell = s.grid[idx];
  if (cell.revealed || cell.flagged) return ev;

  if (s.status === 'ready') {
    placeMines(s, idx, rand);
    s.status = 'playing';
  }

  if (cell.mine) {
    s.status = 'lost';
    for (const c of s.grid) if (c.mine) c.revealed = true;
    ev.exploded = true;
    return ev;
  }

  // 洪水展开（迭代栈式 DFS，无递归；展开结果与 BFS 相同）：零格扩张，数字格作为边界揭开但不扩张；跳过插旗格
  const queue = [idx];
  while (queue.length > 0) {
    const i = queue.pop()!;
    const c = s.grid[i];
    if (c.revealed || c.flagged || c.mine) continue;
    c.revealed = true;
    s.revealed += 1;
    if (c.adj === 0) {
      for (const n of neighbors(s.diff, i)) {
        if (!s.grid[n].revealed) queue.push(n);
      }
    }
  }
  ev.revealedSome = true;

  // 胜利以棋盘实际雷数为准（而非难度配置值）：语义上"所有非雷格全开"才是赢，
  // 也让手工构造棋盘的测试与生产路径共享同一条判定
  const totalMines = s.grid.reduce((n, c) => n + (c.mine ? 1 : 0), 0);
  if (s.revealed === s.grid.length - totalMines) {
    s.status = 'won';
    ev.won = true;
  }
  return ev;
}

export function toggleFlag(s: MineState, idx: number): boolean {
  if (s.status !== 'ready' && s.status !== 'playing') return false;
  const c = s.grid[idx];
  if (c.revealed) return false;
  c.flagged = !c.flagged;
  s.flags += c.flagged ? 1 : -1;
  return true;
}
```

- [ ] **Step 4: 运行确认通过**

```bash
npm test -- tests/minesweeper-logic.test.ts
```
Expected: 14 passed。

- [ ] **Step 5: Commit**

```bash
git add tests/minesweeper-logic.test.ts src/games/minesweeper/logic.ts
git commit -m "feat: add minesweeper pure logic with safe first click"
```

---

### Task 3: 扫雷渲染 + 注册表接入

**Files:**
- Create: `src/games/minesweeper/index.ts`
- Modify: `src/games/registry.ts`（仅 minesweeper 条目）

- [ ] **Step 1: 创建 `src/games/minesweeper/index.ts`**

```ts
import type { Game, GameContext } from '../../core/game';
import { GameLoop } from '../../core/loop';
import { THEME } from '../../core/theme';
import * as L from './logic';

const MENU_W = 320;
const MENU_H = 480;
const MARGIN = 16; // board 左右留白：cols×cell 恒为 288，288+32=320
const HUD_H = 56;

// 1-8 数字的经典风配色（映射到霓虹主题）
const NUM_COLORS = ['', '#4d96ff', '#6bcb77', '#ff6b6b', '#c084fc', '#ffb86c', '#00e5ff', '#ff2fd6', '#e8e6ff'];

interface MenuButton {
  diff: L.Difficulty;
  x: number;
  y: number;
  w: number;
  h: number;
}

export function createMinesweeper(): Game {
  let state: L.MineState | null = null; // null = 难度菜单
  let canvas: HTMLCanvasElement | null = null;
  let g: CanvasRenderingContext2D | null = null;
  let loop: GameLoop | null = null;
  let ctx: GameContext | null = null;
  let paused = false;
  let endedAt = 0;
  let viewW = MENU_W;
  let viewH = MENU_H;

  const menuButtons: MenuButton[] = L.DIFFICULTIES.map((d, i) => ({
    diff: d,
    x: 60,
    y: 160 + i * 80,
    w: 200,
    h: 56,
  }));

  function setCanvasSize(w: number, h: number): void {
    if (!canvas || !g) return;
    viewW = w;
    viewH = h;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    g.setTransform(dpr, 0, 0, dpr, 0, 0); // 重设尺寸会清空变换，用 setTransform 而非叠加 scale
  }

  function startGame(diff: L.Difficulty): void {
    state = L.createState(diff);
    setCanvasSize(MENU_W, HUD_H + diff.rows * diff.cell + MARGIN);
    ctx?.audio.play('click');
  }

  function backToMenu(): void {
    state = null;
    setCanvasSize(MENU_W, MENU_H);
    ctx?.audio.play('click');
  }

  /** CSS 坐标 → 当前视图逻辑坐标 */
  function toLogical(cssX: number, cssY: number): [number, number] {
    if (!canvas) return [0, 0];
    const rect = canvas.getBoundingClientRect();
    return [(cssX / rect.width) * viewW, (cssY / rect.height) * viewH];
  }

  /** 逻辑坐标 → 格子下标；不在棋盘内返回 -1 */
  function cellAt(x: number, y: number): number {
    if (!state) return -1;
    const { cols, rows, cell } = state.diff;
    const cx = Math.floor((x - MARGIN) / cell);
    const cy = Math.floor((y - HUD_H) / cell);
    if (cx < 0 || cx >= cols || cy < 0 || cy >= rows) return -1;
    return cy * cols + cx;
  }

  function onTapGesture(cssX: number, cssY: number): void {
    if (paused) return;
    const [x, y] = toLogical(cssX, cssY);
    if (!state) {
      for (const b of menuButtons) {
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
          startGame(b.diff);
          return;
        }
      }
      return;
    }
    if (state.status === 'won' || state.status === 'lost') {
      if (performance.now() - endedAt < 400) return;
      backToMenu();
      return;
    }
    // HUD 右侧"菜单"热区
    if (y < HUD_H && x > viewW - 72) {
      backToMenu();
      return;
    }
    const idx = cellAt(x, y);
    if (idx < 0) return;
    const ev = L.reveal(state, idx);
    if (ev.exploded) {
      endedAt = performance.now();
      ctx?.audio.play('over');
    } else if (ev.won) {
      endedAt = performance.now();
      ctx?.audio.play('win');
    } else if (ev.revealedSome) {
      ctx?.audio.play('click');
    }
  }

  function onFlagGesture(cssX: number, cssY: number): void {
    if (paused || !state) return;
    const [x, y] = toLogical(cssX, cssY);
    const idx = cellAt(x, y);
    if (idx < 0) return;
    if (L.toggleFlag(state, idx)) ctx?.audio.play('action');
  }

  function renderMenu(): void {
    if (!g) return;
    g.fillStyle = THEME.bg;
    g.fillRect(0, 0, viewW, viewH);
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    g.fillStyle = THEME.neonYellow;
    g.font = `bold 30px ${THEME.font}`;
    g.fillText('扫 雷', viewW / 2, 90);
    g.fillStyle = THEME.dim;
    g.font = `12px ${THEME.font}`;
    g.fillText('点开格子 · 长按/右键插旗', viewW / 2, 118);
    for (const b of menuButtons) {
      g.strokeStyle = THEME.neonCyan;
      g.lineWidth = 2;
      g.strokeRect(b.x, b.y, b.w, b.h);
      g.fillStyle = THEME.neonCyan;
      g.font = `bold 18px ${THEME.font}`;
      g.fillText(b.diff.name, viewW / 2, b.y + 24);
      g.fillStyle = THEME.dim;
      g.font = `11px ${THEME.font}`;
      g.fillText(`${b.diff.cols}×${b.diff.rows} · ${b.diff.mines} 雷`, viewW / 2, b.y + 44);
    }
  }

  function renderBoard(s: L.MineState): void {
    if (!g) return;
    const { cols, rows, cell, mines, name } = s.diff;
    g.fillStyle = THEME.bg;
    g.fillRect(0, 0, viewW, viewH);

    // HUD
    g.textBaseline = 'alphabetic';
    g.textAlign = 'left';
    g.fillStyle = THEME.neonPink;
    g.font = `bold 16px ${THEME.font}`;
    g.fillText(`💣 ${Math.max(0, mines - s.flags)}`, MARGIN, 36);
    g.textAlign = 'center';
    g.fillStyle = THEME.dim;
    g.font = `12px ${THEME.font}`;
    g.fillText(name, viewW / 2, 36);
    g.textAlign = 'right';
    g.fillStyle = THEME.neonCyan;
    g.fillText('☰ 菜单', viewW - MARGIN, 36);

    // 格子
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (let i = 0; i < s.grid.length; i++) {
      const c = s.grid[i];
      const px = MARGIN + (i % cols) * cell;
      const py = HUD_H + Math.floor(i / cols) * cell;
      if (c.revealed) {
        g.fillStyle = c.mine ? '#5e0b0b' : '#141220';
        g.fillRect(px, py, cell - 1, cell - 1);
        if (c.mine) {
          g.fillStyle = THEME.neonPink;
          g.beginPath();
          g.arc(px + cell / 2, py + cell / 2, cell * 0.28, 0, Math.PI * 2);
          g.fill();
        } else if (c.adj > 0) {
          g.fillStyle = NUM_COLORS[c.adj];
          g.font = `bold ${Math.floor(cell * 0.55)}px ${THEME.font}`;
          g.fillText(String(c.adj), px + cell / 2, py + cell / 2 + 1);
        }
      } else {
        g.fillStyle = '#242038';
        g.fillRect(px, py, cell - 1, cell - 1);
        if (c.flagged) {
          // 小旗：粉色三角 + 旗杆
          g.strokeStyle = THEME.text;
          g.lineWidth = 1.5;
          g.beginPath();
          g.moveTo(px + cell * 0.35, py + cell * 0.2);
          g.lineTo(px + cell * 0.35, py + cell * 0.8);
          g.stroke();
          g.fillStyle = THEME.neonPink;
          g.beginPath();
          g.moveTo(px + cell * 0.35, py + cell * 0.2);
          g.lineTo(px + cell * 0.75, py + cell * 0.35);
          g.lineTo(px + cell * 0.35, py + cell * 0.5);
          g.closePath();
          g.fill();
        }
      }
    }

    // 终局横幅
    if (s.status === 'won' || s.status === 'lost') {
      const cy = HUD_H + (rows * cell) / 2;
      g.fillStyle = 'rgba(13, 13, 22, 0.85)';
      g.fillRect(0, cy - 44, viewW, 88);
      g.textBaseline = 'alphabetic';
      g.fillStyle = s.status === 'won' ? THEME.neonGreen : THEME.neonPink;
      g.font = `bold 24px ${THEME.font}`;
      g.fillText(s.status === 'won' ? '扫雷成功！' : '💥 踩雷了', viewW / 2, cy);
      g.fillStyle = THEME.neonCyan;
      g.font = `13px ${THEME.font}`;
      g.fillText('点按返回难度选择', viewW / 2, cy + 28);
    }
  }

  function render(): void {
    if (!g) return;
    if (state) renderBoard(state);
    else renderMenu();
  }

  return {
    meta: { id: 'minesweeper', name: '扫雷', icon: '💣' },

    mount(container: HTMLElement, context: GameContext): void {
      ctx = context;
      canvas = document.createElement('canvas');
      canvas.style.touchAction = 'none';
      canvas.style.userSelect = 'none';
      canvas.style.setProperty('-webkit-touch-callout', 'none'); // iOS 长按放大镜/呼出菜单兜底
      container.appendChild(canvas);
      g = canvas.getContext('2d')!;
      setCanvasSize(MENU_W, MENU_H);

      ctx.input.onPress(canvas, {
        tap: onTapGesture,
        long: onFlagGesture,
        right: onFlagGesture,
      });

      loop = new GameLoop(() => {}, render); // 无时间模拟，仅驱动渲染
      loop.start();
    },

    pause(): void {
      paused = true;
      loop?.pause();
    },

    resume(): void {
      paused = false;
      loop?.resume();
    },

    destroy(): void {
      loop?.stop();
      loop = null;
      canvas?.remove();
      canvas = null;
      g = null;
      ctx = null; // 事件监听（含 onPress 的长按定时器）由 frame 的 InputService.dispose() 统一清理
    },
  };
}
```

- [ ] **Step 2: 修改 `src/games/registry.ts` 的 minesweeper 条目**

将

```ts
  { meta: { id: 'minesweeper', name: '扫雷', icon: '💣' } },
```

改为

```ts
  {
    meta: { id: 'minesweeper', name: '扫雷', icon: '💣' },
    load: async () => (await import('./minesweeper')).createMinesweeper(),
  },
```

（其余条目不动。）

- [ ] **Step 3: 验证**

```bash
npx tsc && npm test && npm run build
```
Expected: tsc 干净；89 单测通过（75 + minesweeper 14）；build 成功且 minesweeper 为独立懒加载 chunk。

- [ ] **Step 4: Commit**

```bash
git add src/games/minesweeper/ src/games/registry.ts
git commit -m "feat: add playable Minesweeper with three difficulties"
```

---

### Task 4: e2e 冒烟更新

**Files:**
- Modify: `e2e/smoke.spec.ts`

- [ ] **Step 1: 在"未实装游戏卡片为禁用状态"用例之前插入：**

```ts
test('进入扫雷有画布渲染，返回首页正常', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-id="minesweeper"]');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('.frame-title')).toContainText('扫雷');
  await page.click('[data-act="back"]');
  await expect(page.locator('.hub-title')).toBeVisible();
});
```

（tetris 仍未实装，禁用检查继续有效。）

- [ ] **Step 2: 运行并提交**

```bash
npm run e2e
```
Expected: 7 passed。

```bash
git add e2e/smoke.spec.ts
git commit -m "test: cover minesweeper in e2e smoke"
```

---

### Task 5: 合并回 main 并推送备份（由协调者执行）

- [ ] **Step 1: 最终全量验证**

```bash
npx tsc && npm test && npm run build && npm run e2e
```
Expected: 全部通过（89 单测 + 7 e2e）。

- [ ] **Step 2: 合并并推送**

```bash
git checkout main
git merge --no-ff feature/minesweeper -m "Merge feature/minesweeper: playable Minesweeper"
git push origin main
```
