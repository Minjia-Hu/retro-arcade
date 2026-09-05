# Sunset Arcade 首页重设计 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `retro-arcade` 首页从深色霓虹主题重做成暖奶油「Sunset Arcade」风格，新增 Continue Playing、Daily Challenge、Hall of Fame 三个模块。

**Architecture:** 把单文件 `src/shell/hub.ts` 拆成 `src/shell/hub/` 目录：`model.ts` 用纯函数从 `ArcadeStorage` + 当前时间算出 `HubModel`（零 DOM、可单测），`view.ts` 把 model 渲染成 HTML 字符串，`icons.ts` 把 8×8 像素坐标渲染成 inline SVG，`index.ts` 负责写 DOM 和绑事件。游戏画布调色板 `THEME` 完全不动，首页用新增的 `SUNSET` 令牌。

**Tech Stack:** Vite 5 + TypeScript 5 + Vitest 2 + Playwright 1.46，无前端框架，DOM 直出。

**Spec:** `docs/superpowers/specs/2026-09-05-sunset-arcade-homepage-design.md`

---

## 背景：读计划前必须知道的事

1. **`THEME` 不能改。** `src/core/theme.ts` 的 `THEME` 被 8 个游戏的 canvas 渲染代码引用 163 次。本计划**新增** `SUNSET` 导出，`THEME` 一个字符都不动。
2. **路由是 `#/<id>`，不是 `#/game/<id>`。** 见 `src/shell/router.ts`。不要动 router。
3. **e2e 依赖三个选择器**：`.hub-title`、`.card`、`card 上的 data-id="<id>"`。`e2e/smoke.spec.ts` 里有
   `page.click('[data-id="flappy"]')` 这类调用，Playwright 是 strict mode——**如果 `[data-id="flappy"]`
   同时匹配到网格卡片和 hero 按钮，测试会直接报错**。所以 hero 的两个按钮用 `data-goto` 属性，
   只有网格卡片用 `data-id`。
4. **存档可能是脏的。** `ArcadeStorage.get` 只做 `JSON.parse`，不校验类型。所有读取都要防非法值。
5. **游戏名有两套。** `meta.name` 是中文（游戏内标题用，e2e 断言它），首页用新增的 `meta.displayName`（英文大写）。
6. **颜色的真相源分工**（Task 1 评审后调整）：`SUNSET` 只保留 `accents` 四色——featured 卡片的
   accent 取决于是哪个游戏，只能由 JS 内联。其余色板全部是 `src/styles/arcade.css` 里 `:root`
   自定义属性的唯一真相源，TS 不再持有。Hall of Fame 的三种颜色走 CSS class，不走内联 hex。

## 文件结构

| 文件 | 职责 |
|---|---|
| `src/core/theme.ts`（改） | 新增 `SUNSET` 令牌导出；`THEME` 不动 |
| `src/core/game.ts`（改） | `GameMeta` 增加可选 `displayName` |
| `src/games/registry.ts`（改） | 8 条 meta 补 `displayName` |
| `src/shell/hub/icons.ts`（新） | 8×8 像素坐标 + `pixelIconSvg(id)` |
| `src/shell/hub/model.ts`（新） | 纯函数，`buildHubModel(storage, now) → HubModel` |
| `src/shell/hub/view.ts`（新） | `hubHtml(model) → string` |
| `src/shell/hub/index.ts`（新） | `renderHub(root, storage)`，唯一碰 DOM 的文件 |
| `src/shell/hub.ts`（删） | 被上面四个文件取代 |
| `src/main.ts`（改） | 进入游戏时写 `lastPlayed` |
| `src/styles/arcade.css`（改） | 首页样式重写 + 游戏框自带深色底 |
| `index.html`（改） | Google Fonts link |
| `tests/hub-model.test.ts`（新） | model 层单测 |
| `tests/hub-icons.test.ts`（新） | icons 层单测 |

---

## Task 1: SUNSET 令牌与 displayName

**Files:**
- Modify: `src/core/theme.ts`
- Modify: `src/core/game.ts:5-9`
- Modify: `src/games/registry.ts`
- Test: `tests/hub-model.test.ts`（本任务只建文件写第一个用例）

- [ ] **Step 1: 写失败测试**

创建 `tests/hub-model.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { SUNSET } from '../src/core/theme';
import { THEME } from '../src/core/theme';
import { GAMES } from '../src/games/registry';

describe('SUNSET 令牌', () => {
  it('提供四个 accent 颜色，顺序为 teal/magenta/orange/gold', () => {
    expect(SUNSET.accents).toEqual(['#0b7285', '#d6336c', '#e8590c', '#e67700']);
  });

  it('不破坏游戏画布使用的 THEME', () => {
    expect(THEME.neonCyan).toBe('#00e5ff');
    expect(THEME.font).toContain('Courier New');
  });
});

describe('registry displayName', () => {
  it('八个游戏都有英文大写展示名', () => {
    expect(GAMES.map((g) => g.meta.displayName)).toEqual([
      'SNAKE', 'TETRIS', 'BREAKOUT', 'FLAPPY', '2048', 'MINES', 'SUDOKU', 'GOMOKU',
    ]);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/hub-model.test.ts`
Expected: FAIL —— `SUNSET` 不存在（导入报错）。

- [ ] **Step 3: 加 SUNSET 令牌**

在 `src/core/theme.ts` **末尾追加**（不要改 `THEME`）：

```ts
/** 首页 Sunset Arcade 主题令牌。游戏画布仍用上面的 THEME，两者互不影响。 */
export const SUNSET = {
  bg: '#f6efe3',
  panel: '#fffaf0',
  panelAlt: '#f6efe3',
  hover: '#fff3dd',
  ink: '#2b2118',
  dim: '#8a7a66',
  faint: '#b5a88f',
  pillOff: '#e6dcc8',
  highlight: '#ffe08a',
  /** 按游戏在 registry 中的下标 % 4 轮转 */
  accents: ['#0b7285', '#d6336c', '#e8590c', '#e67700'],
} as const;
```

- [ ] **Step 4: 给 GameMeta 加 displayName**

`src/core/game.ts` 中把 `GameMeta` 改成：

```ts
export interface GameMeta {
  id: string;
  name: string;
  icon: string;
  /** 首页展示用的英文大写名；缺省时回退到 name */
  displayName?: string;
}
```

- [ ] **Step 5: 给 registry 补 displayName**

`src/games/registry.ts` 中 8 条 `meta` 逐条加字段：

```ts
{ id: 'snake', name: '贪吃蛇', icon: '🐍', displayName: 'SNAKE' },
{ id: 'tetris', name: '俄罗斯方块', icon: '🧱', displayName: 'TETRIS' },
{ id: 'breakout', name: '打砖块', icon: '🕹️', displayName: 'BREAKOUT' },
{ id: 'flappy', name: 'FLAPPY BIRD', icon: '🐦', displayName: 'FLAPPY' },
{ id: 'g2048', name: '2048', icon: '🔢', displayName: '2048' },
{ id: 'minesweeper', name: '扫雷', icon: '💣', displayName: 'MINES' },
{ id: 'sudoku', name: '数独', icon: '✏️', displayName: 'SUDOKU' },
{ id: 'gomoku', name: '五子棋', icon: '⚫', displayName: 'GOMOKU' },
```

只加字段，`load` 那行保持原样。

- [ ] **Step 6: 跑测试确认通过**

Run: `npx vitest run tests/hub-model.test.ts`
Expected: PASS，3 passed。

- [ ] **Step 7: 提交**

```bash
git add src/core/theme.ts src/core/game.ts src/games/registry.ts tests/hub-model.test.ts
git commit -m "feat: add SUNSET tokens and English displayName for hub"
```

---

## Task 2: 像素图标

坐标数据抄自 `design_handoff_sunset_arcade_homepage/Homepage Redesigns.dc.html` 内联脚本的 `pat` 对象。
注意设计稿的 key 是 `mines`，registry 的 id 是 `minesweeper`——本文件统一用 registry id。

**Files:**
- Create: `src/shell/hub/icons.ts`
- Test: `tests/hub-icons.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `tests/hub-icons.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { pixelIconSvg, PIXELS } from '../src/shell/hub/icons';
import { GAMES } from '../src/games/registry';

describe('pixelIconSvg', () => {
  it('registry 里每个游戏 id 都有像素数据', () => {
    for (const g of GAMES) {
      expect(PIXELS[g.meta.id], `缺少 ${g.meta.id} 的像素数据`).toBeDefined();
      expect(PIXELS[g.meta.id].length).toBeGreaterThan(0);
    }
  });

  it('所有像素坐标都落在 0..7 的 8x8 网格内', () => {
    for (const cells of Object.values(PIXELS)) {
      for (const [x, y] of cells) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(7);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(7);
      }
    }
  });

  it('渲染成 viewBox 8x8、fill 跟随 currentColor 的 SVG', () => {
    const svg = pixelIconSvg('snake');
    expect(svg).toContain('viewBox="0 0 8 8"');
    expect(svg).toContain('fill="currentColor"');
    expect(svg.match(/<rect /g)!.length).toBe(PIXELS.snake.length);
  });

  it('未知 id 返回空 SVG 而不是抛错', () => {
    const svg = pixelIconSvg('nope');
    expect(svg).toContain('viewBox="0 0 8 8"');
    expect(svg).not.toContain('<rect');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/hub-icons.test.ts`
Expected: FAIL —— 找不到模块 `../src/shell/hub/icons`。

- [ ] **Step 3: 实现 icons.ts**

创建 `src/shell/hub/icons.ts`：

```ts
export type Cell = [number, number];

/** 横向连续填充 y 行上 x∈[a,b] 的像素 */
const row = (a: number, b: number, y: number): Cell[] => {
  const out: Cell[] = [];
  for (let x = a; x <= b; x++) out.push([x, y]);
  return out;
};

const g2048Cells: Cell[] = [];
for (const [ox, oy] of [[0, 0], [4, 0], [0, 4], [4, 4]] as const) {
  for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) g2048Cells.push([ox + x, oy + y]);
}

const sudokuCells: Cell[] = [];
for (let y = 0; y < 8; y++) sudokuCells.push([2, y], [5, y]);
for (let x = 0; x < 8; x++) if (x !== 2 && x !== 5) sudokuCells.push([x, 2], [x, 5]);

/** 8×8 单色像素图标，key 为 registry 中的游戏 id */
export const PIXELS: Record<string, Cell[]> = {
  snake: [...row(1, 6, 0), [6, 1], ...row(1, 6, 2), [1, 3], ...row(1, 6, 4), [6, 5], ...row(1, 6, 6)],
  tetris: [...row(1, 6, 1), ...row(1, 6, 2), ...row(3, 4, 3), ...row(3, 4, 4), ...row(3, 4, 5), ...row(3, 4, 6)],
  breakout: [
    ...row(0, 1, 0), ...row(3, 4, 0), ...row(6, 7, 0),
    ...row(0, 1, 1), ...row(3, 4, 1), ...row(6, 7, 1),
    [3, 4], ...row(2, 5, 7),
  ],
  flappy: [
    ...row(2, 5, 1), ...row(1, 6, 2).filter(([x]) => x !== 4),
    ...row(1, 7, 3), ...row(1, 6, 4), ...row(2, 4, 5),
  ],
  g2048: g2048Cells,
  minesweeper: [
    [3, 0], [4, 0], ...row(2, 5, 1), ...row(1, 6, 2).filter(([x]) => x !== 2),
    ...row(0, 7, 3), ...row(1, 6, 4), ...row(2, 5, 5), [3, 6], [4, 6],
  ],
  sudoku: sudokuCells,
  gomoku: [
    ...row(2, 5, 1), ...row(1, 6, 2).filter(([x]) => x !== 2),
    ...row(1, 6, 3), ...row(1, 6, 4), ...row(2, 5, 5),
  ],
};

/** 渲染为 inline SVG，颜色由父元素的 color 决定 */
export function pixelIconSvg(id: string): string {
  const rects = (PIXELS[id] ?? [])
    .map(([x, y]) => `<rect x="${x}" y="${y}" width="1" height="1"/>`)
    .join('');
  return `<svg viewBox="0 0 8 8" fill="currentColor" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run tests/hub-icons.test.ts`
Expected: PASS，4 passed。

- [ ] **Step 5: 提交**

```bash
git add src/shell/hub/icons.ts tests/hub-icons.test.ts
git commit -m "feat: add 8x8 pixel icon SVG renderer for hub"
```

---

## Task 3: model 层基础纯函数

**Files:**
- Create: `src/shell/hub/model.ts`
- Modify: `tests/hub-model.test.ts`

- [ ] **Step 1: 写失败测试**

在 `tests/hub-model.test.ts` **末尾追加**（保留 Task 1 已有内容），并在文件顶部补一行导入：

```ts
import { padScore, accentAt, relativeTime, dateKey, hashDate } from '../src/shell/hub/model';
```

追加用例：

```ts
describe('padScore', () => {
  it('默认补到 6 位', () => {
    expect(padScore(0)).toBe('000000');
    expect(padScore(12750)).toBe('012750');
  });

  it('超过位数时不截断', () => {
    expect(padScore(1234567)).toBe('1234567');
  });

  it('负数和小数向下取整到非负整数', () => {
    expect(padScore(-5)).toBe('000000');
    expect(padScore(47.9)).toBe('000047');
  });
});

describe('accentAt', () => {
  it('四色轮转', () => {
    expect(accentAt(0)).toBe('#0b7285');
    expect(accentAt(1)).toBe('#d6336c');
    expect(accentAt(2)).toBe('#e8590c');
    expect(accentAt(3)).toBe('#e67700');
    expect(accentAt(4)).toBe('#0b7285');
    expect(accentAt(7)).toBe('#e67700');
  });
});

describe('relativeTime', () => {
  const M = 60_000, H = 3_600_000, D = 86_400_000;
  it('一分钟内是 JUST NOW', () => {
    expect(relativeTime(1000, 1000)).toBe('JUST NOW');
    expect(relativeTime(0, 59_999)).toBe('JUST NOW');
  });
  it('一小时内按分钟', () => {
    expect(relativeTime(0, M)).toBe('1M AGO');
    expect(relativeTime(0, 59 * M)).toBe('59M AGO');
  });
  it('一天内按小时', () => {
    expect(relativeTime(0, H)).toBe('1H AGO');
    expect(relativeTime(0, 2 * H)).toBe('2H AGO');
    expect(relativeTime(0, 23 * H)).toBe('23H AGO');
  });
  it('一周内按天', () => {
    expect(relativeTime(0, D)).toBe('1D AGO');
    expect(relativeTime(0, 6 * D)).toBe('6D AGO');
  });
  it('超过一周是 A WHILE AGO', () => {
    expect(relativeTime(0, 7 * D)).toBe('A WHILE AGO');
  });
  it('未来时间戳不产生负数', () => {
    expect(relativeTime(5000, 0)).toBe('JUST NOW');
  });
});

describe('dateKey / hashDate', () => {
  it('dateKey 按本地日期输出 YYYY-MM-DD', () => {
    expect(dateKey(new Date(2026, 8, 5))).toBe('2026-09-05');
    expect(dateKey(new Date(2026, 11, 31))).toBe('2026-12-31');
  });
  it('hashDate 对同一输入稳定，且非负', () => {
    expect(hashDate('2026-09-05')).toBe(hashDate('2026-09-05'));
    expect(hashDate('2026-09-05')).toBeGreaterThanOrEqual(0);
  });
  it('hashDate 对不同输入给出不同结果', () => {
    expect(hashDate('2026-09-05')).not.toBe(hashDate('2026-09-06'));
    expect(hashDate('2026-09-05')).not.toBe(hashDate('2026-09-05:new'));
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/hub-model.test.ts`
Expected: FAIL —— 找不到模块 `../src/shell/hub/model`。

- [ ] **Step 3: 实现基础函数**

创建 `src/shell/hub/model.ts`：

```ts
import { SUNSET } from '../../core/theme';

/** 分数补零；位数不够时保留原样，不截断 */
export function padScore(n: number, width = 6): string {
  const safe = Math.max(0, Math.floor(n));
  return String(safe).padStart(width, '0');
}

/** 按 registry 下标轮转 accent 颜色 */
export function accentAt(index: number): string {
  return SUNSET.accents[index % SUNSET.accents.length];
}

/** 相对时间文案，全大写以配合街机风格 */
export function relativeTime(at: number, now: number): string {
  const ms = Math.max(0, now - at);
  const min = Math.floor(ms / 60_000);
  if (min < 1) return 'JUST NOW';
  if (min < 60) return `${min}M AGO`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours}H AGO`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}D AGO`;
  return 'A WHILE AGO';
}

/** 本地日期键，用作每日内容的种子 */
export function dateKey(now: Date): string {
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${m}-${d}`;
}

/** djb2 变体，返回非负整数 */
export function hashDate(key: string): number {
  let h = 5381;
  for (let i = 0; i < key.length; i++) h = ((h * 33) ^ key.charCodeAt(i)) >>> 0;
  return h >>> 0;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run tests/hub-model.test.ts`
Expected: PASS，全部 through。若 `hashDate('2026-09-05') !== hashDate('2026-09-06')` 断言意外失败，
说明哈希退化——不要改测试，改哈希实现。

- [ ] **Step 5: 提交**

```bash
git add src/shell/hub/model.ts tests/hub-model.test.ts
git commit -m "feat: add hub model primitives (padScore, accentAt, relativeTime, hashDate)"
```

---

## Task 4: Hall of Fame

**Files:**
- Modify: `src/shell/hub/model.ts`
- Modify: `tests/hub-model.test.ts`

**注意：** 行颜色不放在 model 里。model 只输出语义化的 `tone`，具体颜色由 Task 9 的 CSS class
决定。这样色板的唯一真相源留在 CSS。

- [ ] **Step 1: 写失败测试**

在 `tests/hub-model.test.ts` 顶部补导入：

```ts
import { ArcadeStorage, memoryBackend } from '../src/core/storage';
import { buildHall } from '../src/shell/hub/model';
```

末尾追加：

```ts
function freshStorage(seed: Record<string, unknown> = {}): ArcadeStorage {
  const backend = memoryBackend();
  for (const [k, v] of Object.entries(seed)) backend.setItem(`arcade.${k}`, JSON.stringify(v));
  return new ArcadeStorage(backend);
}

describe('buildHall', () => {
  it('没有任何成绩时给出三行空位', () => {
    const rows = buildHall(freshStorage());
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.empty)).toBe(true);
    expect(rows[0]).toEqual({ rank: '1', name: '— EMPTY —', score: '······', tone: 'faint', empty: true });
  });

  it('按分数降序取前三，并补齐到三行', () => {
    const rows = buildHall(freshStorage({ 'best.snake': 3840, 'best.tetris': 12750 }));
    expect(rows.map((r) => r.name)).toEqual(['TETRIS', 'SNAKE', '— EMPTY —']);
    expect(rows.map((r) => r.score)).toEqual(['012750', '003840', '······']);
    expect(rows[2].empty).toBe(true);
  });

  it('第一名是 gold 色调，二三名是 dim 色调', () => {
    const rows = buildHall(freshStorage({ 'best.snake': 100, 'best.tetris': 200 }));
    expect(rows.map((r) => r.tone)).toEqual(['gold', 'dim', 'faint']);
  });

  it('只取前三名', () => {
    const rows = buildHall(freshStorage({
      'best.snake': 10, 'best.tetris': 20, 'best.breakout': 30, 'best.flappy': 40,
    }));
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.name)).toEqual(['FLAPPY', 'BREAKOUT', 'TETRIS']);
  });

  it('同分时按 registry 顺序排', () => {
    const rows = buildHall(freshStorage({ 'best.tetris': 500, 'best.snake': 500 }));
    expect(rows.map((r) => r.name)).toEqual(['SNAKE', 'TETRIS', '— EMPTY —']);
  });

  it('忽略脏数据与 0 分', () => {
    const rows = buildHall(freshStorage({
      'best.snake': 'oops', 'best.tetris': null, 'best.breakout': 0, 'best.flappy': 47,
    }));
    expect(rows.map((r) => r.name)).toEqual(['FLAPPY', '— EMPTY —', '— EMPTY —']);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/hub-model.test.ts`
Expected: FAIL —— `buildHall` 未导出。

- [ ] **Step 3: 实现 buildHall**

在 `src/shell/hub/model.ts` 顶部补导入（`SUNSET` 已经导入过，不要重复）：

```ts
import { GAMES } from '../../games/registry';
import type { GameEntry } from '../../games/registry';
import type { ArcadeStorage } from '../../core/storage';
```

并追加：

```ts
/** 行的语义色调，具体颜色由 CSS 的 .hall-row-* 决定 */
export type HallTone = 'gold' | 'dim' | 'faint';

export interface HallRow {
  rank: string;
  name: string;
  score: string;
  tone: HallTone;
  empty: boolean;
}

/** 首页展示名，缺 displayName 时回退中文名 */
function label(entry: GameEntry): string {
  return entry.meta.displayName ?? entry.meta.name;
}

/** 读单个游戏最高分；存量脏数据一律当作没有成绩 */
function bestOf(storage: ArcadeStorage, id: string): number | null {
  const raw = storage.get<unknown>(`best.${id}`, null);
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
}

export function buildHall(storage: ArcadeStorage): HallRow[] {
  const top = GAMES
    .map((entry, index) => ({ index, name: label(entry), best: bestOf(storage, entry.meta.id) }))
    .filter((e): e is { index: number; name: string; best: number } => e.best !== null && e.best > 0)
    .sort((a, b) => b.best - a.best || a.index - b.index)
    .slice(0, 3);

  const rows: HallRow[] = top.map((e, i) => ({
    rank: String(i + 1),
    name: e.name,
    score: padScore(e.best),
    tone: i === 0 ? 'gold' : 'dim',
    empty: false,
  }));

  while (rows.length < 3) {
    rows.push({
      rank: String(rows.length + 1),
      name: '— EMPTY —',
      score: '······',
      tone: 'faint',
      empty: true,
    });
  }
  return rows;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run tests/hub-model.test.ts`
Expected: PASS，6 个 buildHall 用例全绿。

- [ ] **Step 5: 提交**

```bash
git add src/shell/hub/model.ts tests/hub-model.test.ts
git commit -m "feat: add Hall of Fame model with dirty-data guards"
```

---

## Task 5: Daily Challenge

**Files:**
- Modify: `src/shell/hub/model.ts`
- Modify: `tests/hub-model.test.ts`

- [ ] **Step 1: 写失败测试**

顶部补导入：

```ts
import { buildDaily, CHALLENGES } from '../src/shell/hub/model';
```

末尾追加：

```ts
describe('buildDaily', () => {
  it('八个游戏都有挑战文案', () => {
    for (const g of GAMES) {
      expect(CHALLENGES[g.meta.id], `缺少 ${g.meta.id} 的挑战文案`).toBeDefined();
      expect(CHALLENGES[g.meta.id].prefix.length).toBeGreaterThan(0);
    }
  });

  it('同一天两次调用结果完全相同', () => {
    const a = buildDaily(new Date(2026, 8, 5, 9, 0));
    const b = buildDaily(new Date(2026, 8, 5, 23, 30));
    expect(a).toEqual(b);
  });

  it('日期标签是 星期缩写 + 两位日', () => {
    // 2026-09-05 是星期六
    expect(buildDaily(new Date(2026, 8, 5)).dateLabel).toBe('DAILY CHALLENGE · SAT 05');
  });

  it('选中的游戏 id 一定在 registry 中', () => {
    for (let d = 1; d <= 28; d++) {
      const daily = buildDaily(new Date(2026, 8, d));
      expect(GAMES.some((g) => g.meta.id === daily.id)).toBe(true);
    }
  });

  it('一个月内不会永远是同一个游戏', () => {
    const ids = new Set<string>();
    for (let d = 1; d <= 28; d++) ids.add(buildDaily(new Date(2026, 8, d)).id);
    expect(ids.size).toBeGreaterThan(1);
  });

  it('轮到扫雷时文案与设计稿一致', () => {
    expect(CHALLENGES.minesweeper).toEqual({ prefix: 'CLEAR', suffix: 'IN UNDER 60 SECONDS' });
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/hub-model.test.ts`
Expected: FAIL —— `buildDaily` / `CHALLENGES` 未导出。

- [ ] **Step 3: 实现 buildDaily**

在 `src/shell/hub/model.ts` 追加：

```ts
export interface DailyModel {
  dateLabel: string;
  prefix: string;
  name: string;
  suffix: string;
  id: string;
}

/** 渲染为「prefix 游戏名 suffix」，suffix 可为空 */
export const CHALLENGES: Record<string, { prefix: string; suffix: string }> = {
  snake: { prefix: 'SURVIVE', suffix: 'FOR 20 APPLES STRAIGHT' },
  tetris: { prefix: 'CLEAR 10 LINES IN', suffix: '' },
  breakout: { prefix: 'BREAK 60 BRICKS IN', suffix: 'ON ONE LIFE' },
  flappy: { prefix: 'PASS 15 PIPES IN', suffix: 'WITHOUT A SCRATCH' },
  g2048: { prefix: 'REACH THE 512 TILE IN', suffix: '' },
  minesweeper: { prefix: 'CLEAR', suffix: 'IN UNDER 60 SECONDS' },
  sudoku: { prefix: 'FINISH', suffix: 'WITH ZERO MISTAKES' },
  gomoku: { prefix: 'BEAT THE AI AT', suffix: 'AS BLACK' },
};

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

export function buildDaily(now: Date): DailyModel {
  const entry = GAMES[hashDate(dateKey(now)) % GAMES.length];
  const copy = CHALLENGES[entry.meta.id] ?? { prefix: 'PLAY', suffix: 'TODAY' };
  const day = String(now.getDate()).padStart(2, '0');
  return {
    dateLabel: `DAILY CHALLENGE · ${WEEKDAYS[now.getDay()]} ${day}`,
    prefix: copy.prefix,
    name: label(entry),
    suffix: copy.suffix,
    id: entry.meta.id,
  };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run tests/hub-model.test.ts`
Expected: PASS。若「一个月内不会永远是同一个游戏」失败，说明 `hashDate` 的低位分布退化，
调整 `hashDate`（例如混入 `h ^= h >>> 15`）而不是改测试。

- [ ] **Step 5: 提交**

```bash
git add src/shell/hub/model.ts tests/hub-model.test.ts
git commit -m "feat: add date-seeded daily challenge model"
```

---

## Task 6: Featured / Cards / buildHubModel

**Files:**
- Modify: `src/shell/hub/model.ts`
- Modify: `tests/hub-model.test.ts`

- [ ] **Step 1: 写失败测试**

顶部补导入：

```ts
import { buildFeatured, buildCards, buildHubModel } from '../src/shell/hub/model';
```

末尾追加：

```ts
describe('buildFeatured', () => {
  const now = new Date(2026, 8, 5, 12, 0);

  it('有合法 lastPlayed 时进入 continue 模式', () => {
    const at = now.getTime() - 2 * 3_600_000;
    const s = freshStorage({ lastPlayed: { id: 'tetris', at }, 'best.tetris': 12750 });
    expect(buildFeatured(s, now)).toEqual({
      mode: 'continue',
      label: '◆ CONTINUE PLAYING ◆',
      button: 'PRESS START',
      id: 'tetris',
      name: 'TETRIS',
      accent: '#d6336c',
      meta: 'YOUR BEST 012750 · LAST PLAYED 2H AGO',
    });
  });

  it('玩过但没有成绩时元信息降级', () => {
    const s = freshStorage({ lastPlayed: { id: 'sudoku', at: now.getTime() } });
    expect(buildFeatured(s, now).meta).toBe('NO RECORD YET · LAST PLAYED JUST NOW');
  });

  it('从未玩过时进入 newcomer 模式', () => {
    const f = buildFeatured(freshStorage(), now);
    expect(f.mode).toBe('newcomer');
    expect(f.label).toBe('◆ NEW CHALLENGER? ◆');
    expect(f.button).toBe('INSERT COIN');
    expect(f.meta).toBe('NO RECORD YET · BE THE FIRST');
    expect(GAMES.some((g) => g.meta.id === f.id)).toBe(true);
  });

  it('newcomer 模式当天结果稳定', () => {
    const a = buildFeatured(freshStorage(), new Date(2026, 8, 5, 1, 0));
    const b = buildFeatured(freshStorage(), new Date(2026, 8, 5, 22, 0));
    expect(a).toEqual(b);
  });

  it('lastPlayed 脏数据一律退回 newcomer', () => {
    for (const bad of ['nope', 42, null, {}, { id: 'ghost', at: 1 }, { id: 'snake', at: 'x' }]) {
      expect(buildFeatured(freshStorage({ lastPlayed: bad }), now).mode).toBe('newcomer');
    }
  });
});

describe('buildCards', () => {
  it('八张卡片，accent 按下标轮转', () => {
    const cards = buildCards(freshStorage());
    expect(cards).toHaveLength(8);
    expect(cards.map((c) => c.accent)).toEqual([
      '#0b7285', '#d6336c', '#e8590c', '#e67700', '#0b7285', '#d6336c', '#e8590c', '#e67700',
    ]);
  });

  it('无成绩显示 NO RECORD，有成绩显示补零分数', () => {
    const cards = buildCards(freshStorage({ 'best.snake': 3840 }));
    expect(cards[0]).toMatchObject({ id: 'snake', name: 'SNAKE', pill: 'BEST 003840', hasRecord: true });
    expect(cards[6]).toMatchObject({ id: 'sudoku', pill: 'NO RECORD', hasRecord: false });
  });
});

describe('buildHubModel', () => {
  it('footer 反映游戏数量与静音状态', () => {
    const on = buildHubModel(freshStorage(), new Date(2026, 8, 5));
    expect(on.footer).toBe('8 GAMES LOADED · SOUND ON · © 2026 SUNSET ARCADE');
    const off = buildHubModel(freshStorage({ muted: true }), new Date(2026, 8, 5));
    expect(off.footer).toBe('8 GAMES LOADED · SOUND OFF · © 2026 SUNSET ARCADE');
  });

  it('聚合四个区块', () => {
    const m = buildHubModel(freshStorage(), new Date(2026, 8, 5));
    expect(m.hall).toHaveLength(3);
    expect(m.cards).toHaveLength(8);
    expect(m.featured.mode).toBe('newcomer');
    expect(m.daily.dateLabel).toContain('DAILY CHALLENGE');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/hub-model.test.ts`
Expected: FAIL —— `buildFeatured` 未导出。

- [ ] **Step 3: 实现剩余 model**

在 `src/shell/hub/model.ts` 追加：

```ts
export interface FeaturedModel {
  mode: 'continue' | 'newcomer';
  label: string;
  button: string;
  id: string;
  name: string;
  accent: string;
  meta: string;
}

export interface CardModel {
  id: string;
  name: string;
  accent: string;
  pill: string;
  hasRecord: boolean;
}

export interface HubModel {
  featured: FeaturedModel;
  daily: DailyModel;
  hall: HallRow[];
  cards: CardModel[];
  footer: string;
}

interface LastPlayed { id: string; at: number }

/** 读上次游玩记录；任何不合法都当作没玩过 */
function readLastPlayed(storage: ArcadeStorage): LastPlayed | null {
  const raw = storage.get<unknown>('lastPlayed', null);
  if (raw === null || typeof raw !== 'object') return null;
  const { id, at } = raw as Partial<LastPlayed>;
  if (typeof id !== 'string' || typeof at !== 'number' || !Number.isFinite(at)) return null;
  return GAMES.some((g) => g.meta.id === id) ? { id, at } : null;
}

export function buildFeatured(storage: ArcadeStorage, now: Date): FeaturedModel {
  const last = readLastPlayed(storage);
  if (last) {
    const index = GAMES.findIndex((g) => g.meta.id === last.id);
    const entry = GAMES[index];
    const best = bestOf(storage, entry.meta.id);
    const bestText = best === null ? 'NO RECORD YET' : `YOUR BEST ${padScore(best)}`;
    return {
      mode: 'continue',
      label: '◆ CONTINUE PLAYING ◆',
      button: 'PRESS START',
      id: entry.meta.id,
      name: label(entry),
      accent: accentAt(index),
      meta: `${bestText} · LAST PLAYED ${relativeTime(last.at, now.getTime())}`,
    };
  }
  // 没有历史时按日期挑一个，保证当天稳定、跨天变化
  const index = hashDate(`${dateKey(now)}:new`) % GAMES.length;
  const entry = GAMES[index];
  return {
    mode: 'newcomer',
    label: '◆ NEW CHALLENGER? ◆',
    button: 'INSERT COIN',
    id: entry.meta.id,
    name: label(entry),
    accent: accentAt(index),
    meta: 'NO RECORD YET · BE THE FIRST',
  };
}

export function buildCards(storage: ArcadeStorage): CardModel[] {
  return GAMES.map((entry, index) => {
    const best = bestOf(storage, entry.meta.id);
    return {
      id: entry.meta.id,
      name: label(entry),
      accent: accentAt(index),
      pill: best === null ? 'NO RECORD' : `BEST ${padScore(best)}`,
      hasRecord: best !== null,
    };
  });
}

export function buildHubModel(storage: ArcadeStorage, now: Date): HubModel {
  const muted = storage.get<unknown>('muted', false);
  return {
    featured: buildFeatured(storage, now),
    daily: buildDaily(now),
    hall: buildHall(storage),
    cards: buildCards(storage),
    footer: `${GAMES.length} GAMES LOADED · SOUND ${muted ? 'OFF' : 'ON'} · © 2026 SUNSET ARCADE`,
  };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run tests/hub-model.test.ts`
Expected: PASS，全文件通过。

- [ ] **Step 5: 提交**

```bash
git add src/shell/hub/model.ts tests/hub-model.test.ts
git commit -m "feat: add featured/cards/hub model aggregation"
```

---

## Task 7: view 与 renderHub

**Files:**
- Create: `src/shell/hub/view.ts`
- Create: `src/shell/hub/index.ts`
- Delete: `src/shell/hub.ts`

**关键约束**：网格卡片用 `data-id`，hero 的两个按钮用 `data-goto`。
两者都用 `data-id` 会让 `e2e/smoke.spec.ts` 的 `page.click('[data-id="flappy"]')` 触发
Playwright strict mode 报错。

- [ ] **Step 1: 实现 view.ts**

创建 `src/shell/hub/view.ts`：

```ts
import { pixelIconSvg } from './icons';
import type { HubModel } from './model';

const ESCAPES: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
};
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ESCAPES[c]);

function dailyBody(prefix: string, name: string, suffix: string): string {
  return [esc(prefix), `<b>${esc(name)}</b>`, esc(suffix)].filter(Boolean).join(' ');
}

export function hubHtml(m: HubModel): string {
  const hall = m.hall.map((r) => `
        <div class="hall-row hall-row-${r.tone}">
          <span><b>${esc(r.rank)}</b> ${esc(r.name)}</span>
          <span class="hall-score">${esc(r.score)}</span>
        </div>`).join('');

  const cards = m.cards.map((c) => `
        <button class="card" data-id="${esc(c.id)}">
          <span class="px px-sm" style="color:${c.accent}">${pixelIconSvg(c.id)}</span>
          <span class="card-name">${esc(c.name)}</span>
          <span class="card-pill ${c.hasRecord ? 'card-pill-on' : 'card-pill-off'}"${
            c.hasRecord ? ` style="background:${c.accent}"` : ''
          }>${esc(c.pill)}</span>
        </button>`).join('');

  return `
    <div class="hub">
      <header class="marquee">
        <div class="marquee-bar marquee-bar-top"></div>
        <h1 class="hub-title">GAME CENTER</h1>
        <p class="hub-sub">THE SUNSET ARCADE — OPEN 24/7</p>
        <div class="marquee-bar marquee-bar-bottom"></div>
      </header>

      <section class="hero">
        <div class="panel continue">
          <span class="panel-label continue-label">${esc(m.featured.label)}</span>
          <div class="continue-well">
            <span class="px px-lg" style="color:${m.featured.accent}">${pixelIconSvg(m.featured.id)}</span>
            <span class="continue-name">${esc(m.featured.name)}</span>
            <button class="btn-start" data-goto="${esc(m.featured.id)}">${esc(m.featured.button)}</button>
            <span class="continue-meta">${esc(m.featured.meta)}</span>
          </div>
        </div>

        <div class="hero-side">
          <div class="panel daily">
            <span class="panel-label daily-label">${esc(m.daily.dateLabel)}</span>
            <span class="daily-body">${dailyBody(m.daily.prefix, m.daily.name, m.daily.suffix)}</span>
            <span class="daily-hint">BEAT IT → YOUR NAME JOINS THE HALL ▼</span>
            <button class="btn-accept" data-goto="${esc(m.daily.id)}">ACCEPT ▸</button>
          </div>

          <div class="panel hall">
            <span class="panel-label hall-label">HALL OF FAME</span>${hall}
            <span class="hall-note">TOP SCORES ACROSS ALL GAMES</span>
          </div>
        </div>
      </section>

      <p class="grid-heading">◆ SELECT YOUR CABINET ◆</p>
      <div class="hub-grid">${cards}</div>
      <p class="hub-footer">${esc(m.footer)}</p>
    </div>`;
}
```

- [ ] **Step 2: 实现 index.ts**

创建 `src/shell/hub/index.ts`：

```ts
import type { ArcadeStorage } from '../../core/storage';
import { buildHubModel } from './model';
import { hubHtml } from './view';

export function renderHub(root: HTMLElement, storage: ArcadeStorage): void {
  root.innerHTML = hubHtml(buildHubModel(storage, new Date()));

  // 网格卡片用 data-id，hero 按钮用 data-goto，避免 e2e 选择器歧义
  root.querySelectorAll<HTMLElement>('[data-id], [data-goto]').forEach((el) => {
    el.addEventListener('click', () => {
      const id = el.dataset.id ?? el.dataset.goto;
      if (id) location.hash = `#/${id}`;
    });
  });
}
```

- [ ] **Step 3: 删除旧文件**

```bash
git rm src/shell/hub.ts
```

`src/main.ts` 的 `import { renderHub } from './shell/hub'` 无需修改——会自动解析到
`src/shell/hub/index.ts`。

- [ ] **Step 4: 类型检查通过**

Run: `npx tsc --noEmit`
Expected: 无输出（无错误）。若报找不到 `./shell/hub`，检查 `src/shell/hub/index.ts` 是否
确实导出了 `renderHub`。

- [ ] **Step 5: 单测仍全绿**

Run: `npm test`
Expected: 全部 PASS。

- [ ] **Step 6: 提交**

```bash
git add src/shell/hub/view.ts src/shell/hub/index.ts
git commit -m "feat: render Sunset Arcade hub from model"
```

---

## Task 8: 记录 lastPlayed

**Files:**
- Modify: `src/main.ts:26-32`

- [ ] **Step 1: 写入 lastPlayed**

在 `src/main.ts` 的路由回调中，找到这段：

```ts
  const entry = GAMES.find((g) => g.meta.id === route.id);
  if (!entry?.load) {
    location.hash = '#/';
    return;
  }
  try {
```

改成：

```ts
  const entry = GAMES.find((g) => g.meta.id === route.id);
  if (!entry?.load) {
    location.hash = '#/';
    return;
  }
  // 写在这里而不是 frame：frame 不知道 id 的来源，且加载可能失败
  storage.set('lastPlayed', { id: entry.meta.id, at: Date.now() });
  try {
```

- [ ] **Step 2: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无输出。

- [ ] **Step 3: 提交**

```bash
git add src/main.ts
git commit -m "feat: record lastPlayed on game launch"
```

---

## Task 9: 样式与字体

**Files:**
- Modify: `index.html`
- Modify: `src/styles/arcade.css`（首页部分整体替换）

- [ ] **Step 1: 引入字体**

`index.html` 的 `<head>` 中，在 `<title>` 之前插入：

```html
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bungee&family=Space+Grotesk:wght@400;500;700&display=swap" />
```

- [ ] **Step 2: 重写 arcade.css**

把 `src/styles/arcade.css` **整体替换**为下面内容。三个要点：

1. `:root` 里的自定义属性是首页色板的**唯一真相源**。四个 `--accent-*` 与
   `src/core/theme.ts` 的 `SUNSET.accents` 一一对应，改一处要同步另一处；其余颜色 TS 侧不持有。
2. Hall of Fame 的三种色调走 `.hall-row-gold` / `.hall-row-dim` / `.hall-row-faint`，
   model 只给语义 tone。
3. 游戏框的深色底从 `body` 下沉到 `.frame` 自身，且 `.frame` 改用 `flex: 1` 而不是
   `height: 100%`（因为 `#app` 不再有确定高度）。

```css
:root {
  --paper: #f6efe3;
  --panel: #fffaf0;
  --panel-hover: #fff3dd;
  --ink: #2b2118;
  --dim: #8a7a66;
  --faint: #b5a88f;
  --pill-off: #e6dcc8;
  --highlight: #ffe08a;
  /* 与 src/core/theme.ts 的 SUNSET.accents 一一对应 */
  --accent-teal: #0b7285;
  --accent-magenta: #d6336c;
  --accent-orange: #e8590c;
  --accent-gold: #e67700;
  --focus-ring: 0 0 0 4px rgba(232, 89, 12, .35);
}

* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { min-height: 100%; }
body {
  background: var(--paper);
  color: var(--ink);
  font-family: 'Space Grotesk', ui-sans-serif, system-ui, sans-serif;
  -webkit-tap-highlight-color: transparent;
}
#app { min-height: 100vh; display: flex; flex-direction: column; }
button { font-family: inherit; cursor: pointer; }

/* ---- 首页：marquee ---- */
.hub { max-width: 1440px; margin: 0 auto; width: 100%; padding: 36px 48px 32px; }
.marquee {
  background: var(--panel); border: 3px solid var(--ink); border-radius: 14px;
  box-shadow: 8px 8px 0 var(--ink); padding: 30px 32px; text-align: center;
}
.marquee-bar { height: 10px; border: 2px solid var(--ink); border-radius: 5px; }
.marquee-bar-top {
  background: repeating-linear-gradient(90deg,
    var(--accent-gold) 0 14px, var(--panel) 14px 28px,
    var(--accent-magenta) 28px 42px, var(--panel) 42px 56px);
}
.marquee-bar-bottom {
  background: repeating-linear-gradient(90deg,
    var(--accent-teal) 0 14px, var(--panel) 14px 28px,
    var(--accent-gold) 28px 42px, var(--panel) 42px 56px);
}
.hub-title {
  margin: 24px 0 0; font-family: 'Bungee', 'Space Grotesk', sans-serif; font-weight: 400;
  font-size: clamp(28px, 5vw, 46px); color: var(--accent-orange);
  text-shadow: 3px 3px 0 var(--ink);
}
.hub-sub {
  margin: 14px 0 24px; font-size: 14px; font-weight: 700;
  letter-spacing: clamp(1px, .6vw, 5px);
}

/* ---- 首页：hero ---- */
.hero { display: grid; grid-template-columns: 1.25fr .75fr; gap: 22px; margin-top: 26px; }
.hero-side { display: flex; flex-direction: column; gap: 22px; }
.panel {
  background: var(--panel); border: 3px solid var(--ink); border-radius: 14px;
  box-shadow: 8px 8px 0 var(--ink); padding: 24px 28px;
  display: flex; flex-direction: column; gap: 13px;
}
.panel-label { font-family: 'Bungee', 'Space Grotesk', sans-serif; font-size: 13px; }

.continue { align-items: center; gap: 18px; padding: 28px; }
.continue-label { color: var(--accent-magenta); }
.continue-well {
  align-self: stretch; background: var(--paper); border: 2px dashed var(--ink);
  border-radius: 10px; padding: 32px;
  display: flex; flex-direction: column; align-items: center; gap: 20px;
}
.continue-name {
  font-family: 'Bungee', 'Space Grotesk', sans-serif; font-size: 30px; text-align: center;
}
.continue-meta {
  font-size: 13px; color: var(--dim); letter-spacing: 2px; font-weight: 500; text-align: center;
}
.btn-start {
  font-family: 'Bungee', 'Space Grotesk', sans-serif; font-size: 15px;
  background: var(--accent-orange); color: var(--panel);
  border: 3px solid var(--ink); border-radius: 10px;
  box-shadow: 4px 4px 0 var(--ink); padding: 14px 28px;
  transition: transform .1s, box-shadow .1s;
}
.btn-start:hover { transform: translate(2px, 2px); box-shadow: 2px 2px 0 var(--ink); }
.btn-start:active { transform: translate(4px, 4px); box-shadow: 0 0 0 var(--ink); }
.btn-start:focus-visible {
  outline: none; box-shadow: 4px 4px 0 var(--ink), var(--focus-ring);
}

.daily { background: var(--accent-teal); color: var(--panel); }
.daily-label { color: var(--highlight); }
.daily-body { font-size: 16px; line-height: 1.5; font-weight: 500; }
.daily-body b { color: var(--highlight); }
.daily-hint { font-size: 13px; font-weight: 700; }
.btn-accept {
  align-self: flex-start; background: var(--panel); border: 2px solid var(--ink);
  border-radius: 8px; color: var(--ink); padding: 9px 18px;
  font-size: 13px; font-weight: 700; letter-spacing: 2px;
  transition: transform .1s, background .1s;
}
.btn-accept:hover { background: var(--highlight); }
.btn-accept:active { transform: translateY(2px); }
.btn-accept:focus-visible { outline: none; box-shadow: 0 0 0 4px rgba(255, 224, 138, .5); }

.hall { flex: 1; }
.hall-label { color: var(--accent-orange); }
.hall-row { display: flex; justify-content: space-between; font-size: 14px; font-weight: 500; }
.hall-row-gold { color: var(--accent-gold); }
.hall-row-dim { color: var(--dim); }
.hall-row-faint { color: var(--faint); }
.hall-score { font-weight: 700; }
.hall-note { font-size: 11px; color: var(--faint); letter-spacing: 1px; margin-top: auto; }

/* ---- 首页：游戏网格 ---- */
.grid-heading {
  text-align: center; font-family: 'Bungee', 'Space Grotesk', sans-serif;
  font-size: 14px; margin: 34px 0 18px;
}
.hub-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; }
.card {
  background: var(--panel); border: 3px solid var(--ink); border-radius: 14px;
  box-shadow: 6px 6px 0 var(--ink); padding: 24px 16px 20px;
  display: flex; flex-direction: column; align-items: center; gap: 14px;
  color: var(--ink); transition: transform .1s, box-shadow .1s, background .1s;
}
.card:hover {
  transform: translate(3px, 3px); box-shadow: 3px 3px 0 var(--ink); background: var(--panel-hover);
}
.card:active { transform: translate(6px, 6px); box-shadow: 0 0 0 var(--ink); }
.card:focus-visible {
  outline: none; box-shadow: 6px 6px 0 var(--ink), var(--focus-ring);
}
.card-name { font-family: 'Bungee', 'Space Grotesk', sans-serif; font-size: 14px; }
.card-pill {
  font-size: 11px; border-radius: 6px; padding: 3px 9px;
  letter-spacing: 1px; font-weight: 700; border: 2px solid var(--ink);
}
.card-pill-on { color: var(--panel); }
.card-pill-off { background: var(--pill-off); color: var(--dim); border-color: var(--faint); }

.px { display: block; }
.px svg { display: block; width: 100%; height: 100%; }
.px-lg { width: 64px; height: 64px; }
.px-sm { width: 36px; height: 36px; }

.hub-footer {
  text-align: center; font-size: 12px; color: var(--dim);
  letter-spacing: 3px; font-weight: 500; margin-top: 24px;
}

@media (max-width: 900px) {
  .hub { padding: 24px 20px 28px; }
  .hero { grid-template-columns: 1fr; }
}
@media (prefers-reduced-motion: reduce) {
  .btn-start, .btn-accept, .card { transition: none; }
}

/* ---- 游戏外框：保持原深色，底色下沉到 .frame 自身 ---- */
.frame {
  flex: 1; min-height: 0; display: flex; flex-direction: column;
  background: #0d0d16; color: #e8e6ff;
  font-family: 'Courier New', ui-monospace, monospace;
}
.frame-bar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 12px; background: #16121f; border-bottom: 1px solid #2a2438;
}
.frame-title { color: #e8e6ff; letter-spacing: 2px; font-size: 14px; }
.frame-right { display: flex; gap: 8px; }
.btn {
  background: none; border: 1px solid #00e5ff; border-radius: 4px;
  color: #00e5ff; padding: 4px 10px; font-size: 13px;
}
.frame-body { flex: 1; display: flex; align-items: center; justify-content: center; overflow: hidden; }
.frame-body canvas { max-width: 100%; max-height: 100%; object-fit: contain; }

/* ---- 错误兜底 ---- */
.frame-error {
  flex: 1; display: flex; flex-direction: column; gap: 16px;
  align-items: center; justify-content: center;
  background: #0d0d16; color: #ff2fd6;
  font-family: 'Courier New', ui-monospace, monospace;
}
```

- [ ] **Step 3: 构建通过**

Run: `npm run build`
Expected: `tsc` 无错误，vite 构建成功。

- [ ] **Step 4: 提交**

```bash
git add index.html src/styles/arcade.css
git commit -m "feat: restyle hub as Sunset Arcade, keep game frame dark"
```

---

## Task 10: 全量验证

**Files:** 无改动（除非发现问题）

- [ ] **Step 1: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无输出。

- [ ] **Step 2: 单元测试**

Run: `npm test`
Expected: 全部 PASS。原有 14 个测试文件 + 新增 2 个，一个不许失败。

- [ ] **Step 3: e2e**

Run: `npm run e2e`
Expected: 10 passed。

重点确认这两条：
- 「首页显示 8 张游戏卡片」——`.hub-title` 可见、`.card` 恰好 8 个。
- 「进入 flappy 有画布渲染」——`[data-id="flappy"]` 必须唯一匹配到网格卡片。若报
  strict mode violation，说明 hero 按钮误用了 `data-id`，改回 `data-goto`。

- [ ] **Step 4: 人工目视核对**

Run: `npm run dev`，浏览器打开首页，对照
`design_handoff_sunset_arcade_homepage/Homepage Redesigns.dc.html` 的 artboard **3a** 逐项确认：

- marquee 上下条纹配色（上 gold+magenta，下 teal+gold）与 `GAME CENTER` 的 3px 墨色投影
- hero 左右列宽比 1.25 : 0.75，卡片硬投影 8px
- Daily Challenge 深青底、`#ffe08a` 高亮游戏名
- Hall of Fame 初始三行 `— EMPTY —`（这是预期，见 spec 的范围决策 2）
- 网格 1440px 下 4 列；MINES / SUDOKU / GOMOKU 显示灰色 `NO RECORD` 药丸
- 悬停卡片位移 3px、投影减半、底色转 `#fff3dd`；按下时完全「压平」
- Tab 键可依次聚焦所有卡片与按钮，焦点环为橙色
- 进入任一游戏再返回首页，Continue Playing 变为该游戏且元信息显示 `JUST NOW`

- [ ] **Step 5: 提交（若有修补）**

```bash
git add -A
git commit -m "fix: address issues found in final verification"
```

若无改动则跳过。
