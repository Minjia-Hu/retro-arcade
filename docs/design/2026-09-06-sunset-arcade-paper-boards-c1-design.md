# 子项目 C1：机柜补完 + SUDOKU 样板

来源：`design_handoff_sunset_arcade_homepage_2/README.md` 的 Game Screens 一节，
以及 `Game Screens.dc.html` 的 artboard **1c**（SUDOKU 游戏中）与 **1d**（SUDOKU 完成结算）。

## 前置

子项目 A（机柜外壳 + 结算浮层 + `SCREEN`）与 B（深色屏三款 + 侧栏/控制垫/可选暂停/动态提示条）
均已合并。C 沿用全部基础设施。

## 交接体检的发现

按新定的流程，收到设计稿先做体检。artboard 有四处表达不了的缺口，处理方式如下：

1. **artboard 只画了「游戏中」，三个游戏的「开始前菜单」一张没画。** SUDOKU / MINES 有难度菜单，
   GOMOKU 有模式菜单（双人 / AI），都是进入游戏的必经界面，现在画在画布里。
   → **改成 DOM 浮层，复用结算卡片的视觉与基础设施。**
2. **纸盘游戏顶栏右侧与深色屏完全不同**：2d/2e/2f 只有 `↺ NEW`，1c 只有 `☰`，都没有 SND 与暂停。
   照做会让这四个游戏失去静音能力。→ **游戏可声明额外按钮，SND 保留，纸盘不声明 pausable。**
3. **两处 artboard 没画但现存的功能**：2048 的撤销按钮、MINES 的 🙂（稿子里是重开本局，
   现有对应位置是返回难度菜单）。→ **保留功能，另找位置安置。** 与 B 里 Tetris 触屏键同一处理。
4. **2f 的 `WINS 012` 是示意数据**，GOMOKU 没有持久化胜场（首页那轮已确认）。

另已确认：**棋盘一律留 canvas**，只有周边控件改 DOM。artboard 把 81 格画成 DOM 网格只是因为
它本身是 HTML 原型。

## 为什么再拆一次

C 的完整范围（四个游戏 + 机柜扩展 + B 的三个欠债）比 B 大。照搬 A 里奏效的结构：

- **C1（本文档）** — 还清 B 的欠债、机柜两处扩展、**SUDOKU 端到端**
- **C2** — 2048 / MINES / GOMOKU

选 SUDOKU 当样板是因为它**唯一同时用到全部三项新能力**：开始菜单（多动作浮层）、
数字盘与 ERASE/NOTES/CHECK（DOM 控件）、顶栏 `☰` 与 `MEDIUM` 药丸（自定义按钮）。
2048 只会用到其中一项，验证不了另外两项。

## 先还 B 的三个欠债

### 1. canvas 建立样板提取到 core

现在 4 个游戏各有一份逐字相同的九行（dpr 上限 3 → 设 `width/height` 属性 →
**只设 `style.width` 不设 height** → `touchAction` → `g.scale`）。C 会推到 8 份。
其中「不设 CSS height」是窄屏不溢出的唯一依赖，复制多份意味着有人改一份就会不一致。

提取到 `src/core/screen.ts`：

```ts
/**
 * 建立游戏画布。刻意只设 style.width：高度靠替换元素的内在比例推导，
 * 配合 arcade.css 的 `.screen-body canvas { height: auto }`，窄屏才能等比缩小不溢出。
 * dpr 上限 3：再高只增显存不增观感。
 */
export function createScreenCanvas(
  host: HTMLElement, w: number, h: number,
): { canvas: HTMLCanvasElement; g: CanvasRenderingContext2D };
```

四个已迁移的游戏（snake / tetris / breakout / flappy）改用它。tetris 额外设的
`userSelect: 'none'` 一并纳入（那是复制过程中的漂移，统一设上无害）。

### 2. `GameFrame` 补单测

新增 `tests/frame.test.ts`（jsdom）。用一个假 `Game` 覆盖目前只有 e2e 守着的逻辑：

- `overlay(view)` → `overlay(null)` 的提示条还原链路（`baseHints` 记账）
- 结算态优先：浮层展示期间调 `ctx.setHints` 不会冲掉浮层提示条
- `meta.pausable === false` 时不绑定暂停
- `close()` 收起浮层
- `side` / `pad` 按 meta 提供或为 null

`vite.config.ts` 需要 `environment: 'jsdom'`（当前未设，默认 node）。按测试文件级
`// @vitest-environment jsdom` 注释开启，避免影响其余 19 个纯逻辑测试文件的速度。
需要 `jsdom` 作为 devDependency。

### 3. BREAKOUT 砖块行号

`breakout/index.ts` 现在用 `Math.floor((b.y - 60) / 18)` 反推 `logic.ts` 里 `makeBricks`
的私有常量（`y0` 与 `bh + gap`），改布局会让配色静默错位且无测试报警。

**给 `Brick` 加 `row: number` 字段**，`makeBricks` 填入，渲染直接读。

这是 C1 里**唯一一次故意改 `logic.ts`**：纯增加字段，不改任何状态转移或碰撞规则。
判据是 `tests/breakout-logic.test.ts` **零改动且全绿**。

## 机柜的两处扩展

### 1. 顶栏自定义按钮

`GameMeta` 增加：

```ts
/** 顶栏右侧的额外按钮，排在 SND 之前。id 会作为 data-act 值 */
tools?: { id: string; label: string; aria: string }[];
```

`GameContext` 增加：

```ts
/** 注册顶栏自定义按钮的点击处理；id 需与 meta.tools 中的一致 */
onTool(id: string, handler: () => void): void;
```

SUDOKU 声明 `tools: [{ id: 'menu', label: '☰', aria: '难度菜单' }]`，不声明 `pausable`
（数独是回合制，暂停无意义，与 FLAPPY 同理由）。

`data-act` 的命名空间要避开现有的 `back` / `pause` / `mute` / `settle-action` / `settle-quit`，
因此工具按钮渲染为 `data-act="tool:<id>"`。

### 2. `settle` 泛化为 `overlay`

开始菜单与结算浮层是同一个视觉模式——盖在棋盘上的一张卡片，区别只是菜单要多个按钮。
不为此新造第二套机制。

```ts
export interface OverlayAction {
  label: string;
  onPress: () => void;
  /**
   * 主按钮（accent 底色）还是次按钮（描边）。**缺省 primary**。
   * 本节初稿写的是「缺省首个为 primary，其余 secondary」，实现时改掉了：
   * 按位置定主次在 diff 里读不出来，显式标 kind 更清楚。C2 的菜单照这条做。
   */
  kind?: 'primary' | 'secondary';
}

export interface OverlayView {
  title: string;
  tone: 'lose' | 'win' | 'record';
  lines: string[];
  actions: OverlayAction[];
  hints?: string[];
  /** 是否显示 QUIT TO HUB。开始菜单显示，结算浮层也显示。缺省 true */
  quit?: boolean;
}
```

`GameContext.settle` 改名为 `overlay`，`SettleView` 改名为 `OverlayView`，
`action` 改为 `actions` 数组。A/B 的四个游戏各改一处调用。

**为什么改名**：拿一个叫 `settle`（结算）的接口渲染开始菜单是说谎，而说谎的名字正是
这个仓库反复在清理的东西（`registry.ts` 的注释、`THEME` 的键名）。

CSS 沿用 `.settle-*` 类名不变（改类名会连带动 A/B 的测试与样式，收益为零）。
按钮容器加 `.settle-actions` 承载多个按钮的纵向排列。

## SUDOKU（artboard 1c / 1d）

### 画布：只剩棋盘

画布从 320×480 缩成纯 9×9 棋盘 `288×288`（`CELL 32` 不变）。原来画在画布里的
难度菜单、数字盘、功能按钮行、HUD 全部搬出。边框圆角由 `.screen` 提供。

- 底 `#f6efe3`，格线 `#ddd1bc` 0.5px，3×3 分隔线 2px ink
- 给定数字 ink 700；玩家填入 teal `#0b7285` 500；笔记小字 `#b5a88f`
- 选中格 `rgba(11,114,133,.18)`；冲突格文字 `#d6336c`、底 `rgba(214,51,108,.12)`
- `screen: 'paper'`

### DOM 控件

**顶栏**：`☰`（tools）+ `SND`，无暂停。游戏名右侧加难度药丸（`EASY` / `MEDIUM` / `HARD`，
accent 底、2px ink 描边）——用机柜已有的 `.cab-pill`？**当前不存在，需新增**。

**控制垫**（`pad: true`）：两行。第一行数字 1-9（9 个 `.pad-btn` 变体，33×38）；
第二行 `⌫ ERASE` / `✎ NOTES` / `⚑ CHECK`，激活态底色 `#ffe08a`。

### 浮层

**难度菜单**（进入游戏时、点 `☰` 时）：`title: 'SELECT DIFFICULTY'`、`tone: 'win'`、
`actions` 为三个难度，`quit: true`。

**完成结算**（artboard 1d）：`title: 'SOLVED!'`、`tone: 'win'`、
`actions: [{ label: '▶ NEW PUZZLE' }]`。
——`tone: 'win'` 在 A/B 里始终没有消费者（BREAKOUT 清关是进下一关而非结束），
SUDOKU 是第一个真正用到它的游戏，实现时要专门核对这条分支的观感。

**artboard 1d 的两行文案有一行做不出来。** 稿子写 `MEDIUM · 12:34` 与
`0 MISTAKES · PERSONAL BEST`，但 `SudokuState` 里既没有计时器也没有失误计数，
更没有个人最佳记录。计时看似可以在 `index.ts` 里做，但数独支持存档恢复——
从挂载开始计时会少算此前时长，等于在界面上撒谎。

因此 C1 的 `lines` 只放难度一行（`MEDIUM`）。用时、失误数、个人最佳都需要
`logic.ts` 与存储支持，属功能新增而非改版，与首页那轮的 `WINS 012`、`BEST 000099`
同样按示意数据处理。

### hints

游戏中 `['TAP CELL', 'THEN A NUMBER']`；结算态 `['SPACE / TAP FOR A NEW PUZZLE']`。

## 会推翻的现有断言

- `settle` → `overlay` 改名会碰 `frame.ts`、`cabinet-view.ts`、`core/game.ts`、
  `tests/cabinet-view.test.ts`，以及 snake / tetris / breakout / flappy 四个游戏各一处。
- SUDOKU 拿到 `displayName: 'SUDOKU'`，e2e 断言由中文改英文。
- `tests/cabinet-view.test.ts` 需补：`tools` 渲染、`pausable: false` 与 `tools` 并存、
  多动作浮层、`quit: false`。

## 测试

- `tests/frame.test.ts`（新，jsdom）：见「欠债 2」。
- `tests/cabinet-view.test.ts`：补上述四条。
- e2e 补：进入 SUDOKU 断言难度菜单浮层出现且有三个动作；选一个难度后浮层消失、
  控制垫出现 9+3 个按钮；点 `☰` 菜单浮层重新出现。
- `tests/sudoku-logic.test.ts` **零改动**。`tests/breakout-logic.test.ts` **零改动**
  （尽管 `logic.ts` 加了字段）。

## 文件清单

新增：`src/core/screen.ts`、`tests/frame.test.ts`
修改：`src/core/game.ts`、`src/shell/frame.ts`、`src/shell/cabinet-view.ts`、
`src/styles/arcade.css`、`src/games/{snake,tetris,breakout,flappy}/index.ts`（改名 + 用 screen.ts）、
`src/games/breakout/logic.ts`（加 `row` 字段）、`src/games/sudoku/index.ts`、
`e2e/smoke.spec.ts`、`tests/cabinet-view.test.ts`、`vite.config.ts`、`package.json`（jsdom）

## 留给 C2 的已知问题

- 2048 的撤销按钮、MINES 的 🙂 与「返回菜单」的语义区分，在 C2 落地。
- GOMOKU 的 `WINS 012` 无数据源；若要显示需要新增胜场持久化，属功能新增而非改版。
- SUDOKU 结算卡的用时、失误数、个人最佳同样无数据源。三者都需要动 `logic.ts` 与
  `SudokuSave`（时长必须随存档持久化，否则恢复后的计时是错的）。
- `.side-card` 那套卡片标记仍是 tetris 里手写的 HTML 字符串。若 MINES 的 HUD 形态相近，
  届时再考虑抽公共件。
