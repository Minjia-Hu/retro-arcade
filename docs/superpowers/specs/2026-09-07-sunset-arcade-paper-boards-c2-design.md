# 子项目 C2：浅色纸盘余下三款（2048 / MINES / GOMOKU）

来源：`design_handoff_sunset_arcade_homepage_2/Game Screens.dc.html` 的 artboard
**2d**（2048）、**2e**（MINES）、**2f**（GOMOKU）。

## 前置

A（机柜外壳 + 结算浮层 + `SCREEN`）、B（深色屏三款 + 侧栏/控制垫/可选暂停/动态提示条）、
C1（机柜补完 + SUDOKU 样板）均已合并。

**C2 不新增任何机柜 API。** C1 已经把能力配齐：多动作浮层、控制垫插槽、顶栏工具按钮、
状态药丸、`ctx.overlayOpen()`。C2 是把同一套模式重复应用到剩下三个游戏，
这也是敢一轮做完三个的依据。

C2 完成后 `THEME` 将没有任何消费者，可以删除。

## 交接体检的发现

**1. GOMOKU 的菜单是 4 项**：双人对战 / AI·简单 / AI·中等 / AI·困难。
artboard 2f 完全没画菜单。浮层要放 4 个按钮 + QUIT TO HUB。

**2. artboard 2f 的回合筹假设了 AI 模式**：`● YOU — YOUR TURN` / `○ CPU · WINS 012`，
但双人模式下没有 CPU。筹码文案须随模式变。

**3. MINES 缺计时器，但这次可以做。** artboard 2e 有 `00:47`，代码里没有。
与 SUDOKU 那次的关键区别：**MINES 不存档**，所以在渲染层从 `startGame` 开始计时是
准确的，不存在「恢复存档后少算」的谎。已确认实现。旗数 `⚑ 04` 有数据源（`state.flags`）。

**4. GOMOKU 的 `WINS 012` 依旧没有数据源**，仓库里没有任何胜场持久化。
按首页那轮以来的惯例当示意数据处理，不实现。

**5. 两处 artboard 与现状的错位**（已定「保留功能找位置」）：
2048 的撤销按钮稿子没画（现在画在画布里）；artboard 给 2048 加了个现在没有的 `↺ NEW`。

**6. 一处澄清 C1 审查的说法。** 上轮审查说 SUDOKU 与 MINES 的 `DIFFICULTIES` 会逐字重复，
**只对了一半**：两张表的 `id`/`name` 相同，但字段不同（`clues` vs `cols/rows/mines/cell`）。
真正重复的只有 `id → 英文标签` 的映射。**抽 `DIFF_LABEL`，不抽整张表。**

## 三处共用件（现在抽，否则会从 2 份变 4 份）

### 1. `DIFF_LABEL`

移到 `src/core/format.ts`：

```ts
/** 难度 id → 顶栏药丸用的英文标签。logic 里的 name 是中文，顶栏按设计稿用英文 */
export const DIFF_LABEL: Record<'easy' | 'medium' | 'hard', string> = {
  easy: 'EASY', medium: 'MEDIUM', hard: 'HARD',
};
```

SUDOKU 与 MINES 共用。**不要抽 `DIFFICULTIES`**——两张表除 id/name 外字段完全不同。

### 2. `padButtons`

TETRIS 与 SUDOKU 各有一份「拼 `innerHTML` → `querySelectorAll` → 点击里 `blur`」，
C2 会再加两份。抽到 `src/shell/pad.ts`：

```ts
export interface PadButton {
  id: string;
  label: string;
  aria: string;
  /** 额外 class，如 pad-btn-digit / pad-btn-wide */
  variant?: string;
}

/**
 * 在控制垫里渲染一排按钮并接上点击。点完统一 blur——与顶栏 wire() 同一约定，
 * 避免残留焦点让空格键既触发按钮又触发游戏逻辑。
 */
export function padButtons(
  host: HTMLElement,
  buttons: PadButton[],
  onPress: (id: string) => void,
): void;
```

### 3. 难度菜单流程

MINES 会把 SUDOKU 的 `showMenu / startGame / setPill / frozen()` 原样重来。
第二个实例出现了，抽到 `src/shell/difficulty-menu.ts`：

```ts
/**
 * 难度菜单浮层。进行中时给一个回到当前局的出口——玩到一半误触 ☰ 不该只能弃局。
 * 返回的 open() 供 ctx.onTool('menu', ...) 与首次挂载共用。
 */
export function difficultyMenu<D extends { id: 'easy' | 'medium' | 'hard' }>(opts: {
  ctx: GameContext;
  difficulties: D[];
  /** 当前是否有进行中的局（决定要不要渲染 ✕ RESUME） */
  resumable: () => boolean;
  onPick: (d: D) => void;
}): { open: () => void };
```

SUDOKU 一并改用它——不能只让新代码用而把旧的留成第二份。

## 2048（artboard 2d）

- **画布缩成纯棋盘 320×320**（`4 × 71 + 5 × 7 = 319`，取 320）。去掉 `BOARD_Y = 100`
  的上方留白与 `UNDO_RECT` 那一带。
- 井底 `#efe5d3`，3px ink 描边，radius 10，格间距 8。
- 方块色阶（设计稿脚本的 `T` 对象）：
  `2 #f6efe3` / `4 #efe0c3` / `8 #ffd9a8` / `16 #ffbe76` / `32 #ff8c42` /
  `64 #e8590c` / `128 #d6336c` / `256+ #0b7285`。
  `≤4` 文字 `#8a7a66` + 2px `#ddd1bc` 软描边；`≥8` 文字 ink 或 `#fffaf0` + 2px ink 描边；
  空格 2px `#ddd1bc` 虚线。字号 `≥128` 用 22，否则 26。
- **DOM**：棋盘上方一行三件——`SCORE` 卡、`BEST` 卡、`↩ UNDO` 按钮。
  卡片样式沿用 `.side-card` 那套（`#f6efe3` 底、2px ink、radius 8）。
  顶栏加 `↺ NEW` 工具按钮；不声明 `pausable`。
- hints：`['↑↓←→ / SWIPE TO MERGE', 'Z UNDO']`
- 结算：`GAME OVER` / `NEW HIGH SCORE`；`won` 态（拼出 2048）用 `tone: 'win'`、
  标题 `2048!`、主按钮 `▶ KEEP GOING`（继续当前局）+ 次按钮 `↺ NEW GAME`。

## MINES（artboard 2e）

- **画布缩成纯雷区**（`cols × cell`，随难度变，用 `resizeScreenCanvas`）。
  去掉 `HUD_H = 56` 那条与画布内的难度菜单。
- 未翻开格：`#fffaf0` + `inset -2px -2px #ddd1bc, inset 2px 2px #fff` 凸起感
  （canvas 无 inset 阴影，用两条半透明边模拟）；已翻开：平的 `#efe5d3`。
  格线 `#ddd1bc` 0.5px。
- 数字 1–5：`#0b7285` / `#5c940d` / `#d6336c` / `#7048e8` / `#e8590c`；6–8 沿用第 5 色系。
  旗 `⚑` 用 `#d6336c`。
- **DOM**：棋盘上方一行三件——`⚑ NN` 计数卡、🙂 重开按钮（`#ffe08a` 底）、`MM:SS` 计时卡。
  **🙂 是重开本局**（artboard 语义）；「返回难度菜单」另走顶栏 `☰` 工具按钮——
  这两件事现在挤在同一个 HUD 热区里，分开更清楚。
- **计时器放渲染层**：`index.ts` 里从 `startGame` 开始计，`logic.ts` 不动。
  首次点击才起表（扫雷惯例），胜负后停表。
- hints：`['CLICK REVEAL', 'LONG-PRESS / RIGHT-CLICK FLAG']`
- 结算：`CLEARED!`（`tone: 'win'`）/ `BOOM`（`tone: 'lose'`），
  lines 为难度与用时，主按钮 `▶ NEW GAME`。

## GOMOKU（artboard 2f）

- **画布缩成纯棋盘 320×320**，去掉 `HUD_Y = 372` 那条 HUD 与画布内的模式菜单。
- 盘面 `#efe0c3`，格线 `#b5a88f` 1px，星位 ink 实心小点。
- 棋子直径 22：黑 = ink + 内侧白高光；白 = `#fffaf0` + 内侧 `#ddd1bc` 阴影；
  都带 2px ink 描边与投影。悬停虚影 = `#d6336c` 虚线圆。
- **DOM**：棋盘上方两个回合筹。**文案随模式变**——
  AI 模式 `● YOU` / `○ CPU`；双人模式 `● BLACK` / `○ WHITE`。
  轮到谁谁高亮（ink 底白字），另一个是描边灰字。
  artboard 的 `WINS 012` 不做（无数据源）。
  顶栏加 `↺ NEW` 工具按钮；不声明 `pausable`。
- **模式菜单是 4 项**：`2 PLAYERS` / `AI EASY` / `AI MEDIUM` / `AI HARD`。
  它不是难度菜单（选的是对局模式），**不复用 `difficultyMenu`**，直接用多动作浮层。
  卡片放 4 个按钮 + 标题 + QUIT 约 300px 高，而棋盘 320px——落地时实测，
  若过挤则把三档 AI 收成一行。
- hints：`['CLICK TO PLACE', 'FIVE IN A ROW WINS']`
- 结算：`BLACK WINS` / `WHITE WINS` / `DRAW`，`tone` 按人类是否获胜取 `win`/`lose`。

## 会推翻的现有断言

- 三个游戏拿到 `displayName`（`2048` / `MINES` / `GOMOKU`），e2e 断言由中文改英文。
- SUDOKU 改用抽出来的 `DIFF_LABEL` 与 `difficultyMenu`，行为不变但代码位置变。
- TETRIS 与 SUDOKU 改用 `padButtons`。

## 测试

- `tests/pad.test.ts`（新）：`padButtons` 渲染与 blur 约定。
- e2e 补：2048 的 SCORE/BEST/UNDO 三件套与 `↺ NEW`；MINES 的难度菜单、🙂 重开与 ☰ 返回
  是两件不同的事、计时器会走；GOMOKU 的 4 项模式菜单、回合筹随模式变。
- **三个游戏的 `logic.ts` 与 `tests/*-logic.test.ts` 零改动**，判据同前几轮。

## 文件清单

新增：`src/shell/pad.ts`、`src/shell/difficulty-menu.ts`、`tests/pad.test.ts`
修改：`src/core/format.ts`（加 `DIFF_LABEL`）、`src/games/{g2048,minesweeper,gomoku}/index.ts`、
`src/games/{sudoku,tetris}/index.ts`（改用共用件）、`src/styles/arcade.css`、
`e2e/smoke.spec.ts`

## 收尾

C2 完成后 `THEME` 无消费者，**在最后一个任务里删除它**，并同步删掉
`tests/hub-model.test.ts` 里那条守着它的整体快照断言。
