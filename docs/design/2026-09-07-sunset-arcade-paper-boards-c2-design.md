# 子项目 C2：浅色纸盘余下三款（2048 / MINES / GOMOKU）

来源：`design_handoff_sunset_arcade_homepage_2/Game Screens.dc.html` 的 artboard
**2d**（2048）、**2e**（MINES）、**2f**（GOMOKU）。

## 前置

A（机柜外壳 + 结算浮层 + `SCREEN`）、B（深色屏三款 + 侧栏/控制垫/可选暂停/动态提示条）、
C1（机柜补完 + SUDOKU 样板）均已合并。

**C2 需要给机柜补一个插槽。** C1 的能力（多动作浮层、控制垫、顶栏工具按钮、状态药丸、
`ctx.overlayOpen()`）大部分够用，但**三个游戏都有一行位于棋盘上方的 DOM**——
2048 的 SCORE/BEST/UNDO、MINES 的 ⚑/🙂/计时、GOMOKU 的回合筹——
而机柜只有屏幕右侧的 `.cab-side` 与下方的 `.cab-pad`，没有上方的槽。

三个消费者同时出现，是真需求而非投机抽象，因此新增 `head` 插槽：

```ts
// GameMeta
/** 需要屏幕井上方的一行 DOM 时置 true，内容由游戏自己填 */
head?: boolean;
// GameContext
/** 上方栏容器；meta.head 为 true 时可用，否则为 null */
head: HTMLElement | null;
```

机柜结构相应改为「纵向堆叠 head + screen」，再与 side 横向并列：

```html
<div class="cab-screen">
  <div class="cab-stack">
    <div class="cab-head"></div>   <!-- 可选 -->
    <div class="screen">…</div>
  </div>
  <div class="cab-side"></div>     <!-- 可选 -->
</div>
```

`.cab-stack` **无条件渲染**（不按 `head` 有无切换两种结构）——一种形状比两种好推理，
且对 TETRIS 的侧栏布局无视觉影响。

除此之外 C2 是把 C1 的模式重复应用到剩下三个游戏。

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

## 执行中定下的几条判断（审查后补记）

- **MINES 的表在 ☰ 菜单期间继续走。** `pausable: false` 意味着没有别的暂停入口，而 ☰ 是
  玩家最可能当暂停用的按钮。真实扫雷的计时器也不因开菜单而停，所以不改——但这是一条判断，
  不是疏漏，记在这里免得下一个人当 bug 修。
- **`.cab-screen` 的 stretch 落点变了。** 加 `.cab-stack` 之后被拉伸的是 stack 而非
  `.screen`。今天唯一的侧栏消费者 TETRIS 的侧栏比屏幕矮，所以无视觉差异；将来侧栏若高过
  屏幕，屏幕井不会再跟着拉高。
- **2048 画布是 324×324 不是 spec 正文写的 320×320**：格间距取 8（`4×71 + 5×8 = 324`），
  正文那个算式用的是 7。以实现为准。
- **`quit: false` 的绕行已撤销。** GOMOKU 曾因菜单卡片被裁而隐藏 QUIT TO HUB；根因是
  `.settle` 用 `align-items: center` + `overflow: auto` 这个 flex 居中溢出陷阱——溢出的
  上半部分不在可滚动区内。改用 `.settle-card { margin: auto }` 后三种形态顶边都完整可见，
  绕行随之删除，退路恢复常驻。

## 留给后续的已知问题

- **浮层形状已有三份**（SUDOKU / MINES 的难度菜单、GOMOKU 的模式菜单）：
  「标题 + 可选 RESUME + N 个选项 + 可选 QUIT」。此刻不抽是对的（语义确实不同），
  但**第 4 份出现时**应把 `difficultyMenu` 泛化成 `pickerMenu({ title, items, resumable, quit, hints })`，
  让 `difficultyMenu` 退化成一层薄包装。
- **四款游戏各有一份同文的 `frozen()`**。不该抽成第五个共用函数——它闭包在两个各游戏私有的
  局部变量上，传参的噪音比省下的一行还多。真正的归宿是上移到 shell：frame 自己持有
  `this.paused`、也已经有 `overlayOpen()`，加一个 `ctx.frozen()` 就能让四个游戏一起删掉
  `paused` 镜像。属 shell 改动，应另立项。
- **2048 的一个静默僵局**：`logic.ts` 的 `move()` 里 `won` 判定在 `canMove` 之前，
  若最后一步同时拼出 2048 且填满棋盘，`▶ KEEP GOING` 之后棋盘既动不了也不出结算卡
  （可用 ↩ UNDO / ↺ NEW 脱身）。`L.canMove` 已导出，在 `index.ts` 里就能关掉，不必碰 logic。
- **`difficultyMenu` 没有直接单测**，只由 SUDOKU 的 e2e 间接覆盖。
- **GOMOKU 的 `MODES` 与 `PILL_LABEL` 是两张同 id 的表**，`reportEnd` 里还有一处
  `find(...)!` 非空断言。合成一张 `Record<Mode, { label, pill }>` 可同时消掉两者。
