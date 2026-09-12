# 子项目 B：深色屏三款（TETRIS / BREAKOUT / FLAPPY）

来源：`design_handoff_sunset_arcade_homepage_2/README.md` 的 Game Screens 一节，
以及 `Game Screens.dc.html` 的 artboard **2a**（TETRIS）、**2b**（BREAKOUT）、**2c**（FLAPPY）。

## 前置

子项目 A（机柜外壳 + 结算浮层 + `SCREEN` 暖霓虹调色板，以 SNAKE 为样板）已合并（`a53780d`）。
B 沿用 A 建立的全部基础设施：`cabinetHtml` / `settleHtml` / `GameContext.settle` /
`GameMeta.hints|screen|displayName` / `SCREEN`。

B 完成后 `THEME` 只剩 4 款纸盘游戏在用，C 做完即可删除。

## 已确认的范围决策

1. **TETRIS 侧栏改 DOM 五张卡**（NEXT / HOLD / SCORE / LEVEL / BEST）。设计稿只画了四张，
   现有游戏的 HOLD 玩法按同样式补第五张——**不删功能**。
2. **机柜同时支持「隐藏暂停」与「动态提示条」**，两个能力 B/C 的其他游戏也用得上。
3. **保持现有画布逻辑尺寸**，只换配色不动网格。设计稿的 BREAKOUT 360×480 与 FLAPPY 360×540
   是等比放大，改尺寸会动到碰撞与难度手感，风险不值得。这与 A 里 SNAKE 的处理一致。

## 机柜的四处扩展

A 的外壳是按 SNAKE 那种「一块画布 + 静态提示」设计的，B 的三个游戏各撞破一条。

### 1. 侧栏插槽

`GameMeta` 增加：

```ts
/** 需要屏幕井右侧的侧栏时置 true，内容由游戏自己填 */
side?: boolean;
```

`GameContext` 增加：

```ts
/** 侧栏容器；meta.side 为 true 时可用，否则为 null */
side: HTMLElement | null;
```

frame 只负责渲染空的 `.cab-side` 容器并提供卡片样式（`.side-card` / `.side-label` /
`.side-value`），**不定义内容结构**。只有 TETRIS 一个消费者，此时抽象「统计卡片」数据结构
属于过度设计；等 C 出现第二个消费者再看是否需要共用件。

### 2. 可选暂停

`GameMeta` 增加：

```ts
/** 顶栏是否渲染暂停按钮，缺省 true。FLAPPY 按设计稿不显示 */
pausable?: boolean;
```

`cabinetHtml` 据此决定是否渲染 `[data-act="pause"]`，`frame.ts` 的按钮绑定相应改为可缺省
（现在 `btn(act)` 用的是非空断言，必须改）。

### 3. 控制垫插槽

**这条是写计划时才发现的，设计稿里看不出来。** TETRIS 的画布底部有一排 6 个触屏按钮
（`◀ ▶ ⟳ ▼ ⤓ ⇄`，即 `BTNS` 常量），是它在手机上**唯一**的操作方式。artboard 2a 是桌面稿，
底部提示条写的全是键盘按键，压根没画这排按钮。若照原计划把画布缩成纯棋盘，这排按钮会无处安放，
等于删掉 TETRIS 的手机可玩性。

因此把它们也搬到 DOM，渲染在屏幕井与提示条之间：

`GameMeta` 增加：

```ts
/** 需要屏幕下方的触屏控制垫时置 true，内容由游戏自己填 */
pad?: boolean;
```

`GameContext` 增加：

```ts
/** 控制垫容器；meta.pad 为 true 时可用，否则为 null */
pad: HTMLElement | null;
```

这与已定的 C 方向（控件改 DOM）一致，而且比画在画布里更好：可 Tab、有焦点环、触屏命中率高。
BREAKOUT 与 FLAPPY 不需要——它们用拖动和点按整块画布。

`side` 与 `pad` 是两个独立的布尔与两个独立的插槽，位置不同（屏幕右侧 vs 屏幕下方），
不合并成通用的「插槽列表」——那是为一个消费者造框架。

### 4. 动态提示条

`GameContext` 增加：

```ts
/** 替换底部按键提示条 */
setHints(hints: string[]): void;
```

把 A 里已有的私有 `setHints` 开放出去。**关键细节**：公开版本必须同时更新 frame 内部的
`baseHints`，否则结算浮层收起时 `setHints(this.baseHints)` 会把游戏动态设置的文案冲掉。

## 版面核算

TETRIS 是三者中唯一有侧栏的，需要确认不超出机柜 464px 的内容区上限：

```
屏幕 220 + 边框 6 = 226
侧栏 110
间隙 16
屏幕井左右内边距 22 × 2 = 44
合计 396 ≤ 464 ✓
```

**不需要加宽变体**。A 的 spec 里留的那条「TETRIS 可能需要更宽的机柜」预警不成立，可以划掉。

控制垫：`6 × 48 + 5 × 8 + 12 × 2 = 352 ≤ 458`（机柜内容区），不会换行。

**窄屏为什么也不溢出**：上面两个算式只对着 464px 桌面上限算。手机 390px 下 396px 本应溢出，
救回来的是 A 留下的 `.screen-body canvas { max-width: 100%; height: auto }`——canvas 作为
替换元素按内在比例等比缩小，`.screen` 随之收缩。BREAKOUT 的拖动用 `rect.width` 归一化、
TETRIS 已不再读点击坐标，都不受缩放影响。**动那条 CSS 会连带破坏窄屏布局。**

## TETRIS（artboard 2a）

- **画布缩成纯棋盘** `220×440`（`COLS 10 × CELL 22`、`ROWS 20 × CELL 22`），
  去掉原来的 `BOARD_X/BOARD_Y` 内边距与 `SIDE_X` 侧栏绘制。边框圆角由 `.screen` 提供。
- 方块配色由 `PIECE_COLORS` 的冷色盘换成暖霓虹，七种方块循环取
  `SCREEN` 的 teal / gold / pink / orange 四色（设计稿的 `NE` 对象就是这四色）。
- 每格加设计稿的斜面与辉光：
  `inset -3px -3px rgba(0,0,0,.3)` + `inset 3px 3px rgba(255,255,255,.25)` + `0 0 8px <同色>`。
  canvas 没有 inset 阴影，用两条半透明矩形（右下暗、左上亮）模拟，辉光用 `shadowBlur`。
- **触屏按钮排改 DOM**（`.cab-pad` 内 6 个 `.pad-btn`），沿用 `cab-btn` 的视觉语言。
  画布点按只保留「开始 / 重开」（原 `tapAt` 里的按钮命中判定连同 `BTNS`/`Btn`/`BTN_Y` 一并删除）。
- **侧栏五张 DOM 卡**，自上而下 NEXT / HOLD / SCORE / LEVEL / BEST。卡片样式：
  `#fffaf0` 底、2px ink 描边、radius 10、投影 `3px 3px 0`、padding 12、纵向居中。
  标签 Bungee 10px `--dim`；数值 JetBrains Mono 700 16px ink，LEVEL 用 `--orange`，
  BEST 用 14px `--dim`。NEXT / HOLD 的迷你方块用 DOM 小方块拼（44×30 区域，13px 格）。
- hints：`['←→ MOVE', '↑ ROTATE', '↓ DROP', 'SPACE HARD DROP']`
- 结算：`GAME OVER`（`lose`）/ `NEW HIGH SCORE`（`record`），
  lines 为 `SCORE ??????` 与 `LINES ???`、`BEST ??????`，主按钮 `▶ RETRY`，
  结算态 hints 为 `['SPACE / TAP TO RETRY']`。

## BREAKOUT（artboard 2b）

全部留在画布，不需要侧栏。

- 砖块四行由上至下 pink / orange / gold / teal（现有 `ROW_COLORS` 是 5 色，改为 4 色循环）。
  砖块加与 TETRIS 同款斜面 + 同色辉光，radius 3。
- 球 `SCREEN.white` 圆形，辉光 `rgba(255,250,240,.8)`；挡板 `SCREEN.teal`，radius 6，
  辉光 teal 50%，加右下暗面。
- HUD 留在画布内：`SCORE 0980` 金色 JetBrains Mono 700 15px 左上（12,16），
  `♥♥♡` 粉色右上——实心数量取 `state.lives`，总数 3。
- hints：`['←→ / MOUSE MOVE', 'SPACE LAUNCH']`
- 结算：只有 `GAME OVER` / `NEW HIGH SCORE`。**清关不是结束**——
  `logic.ts` 里 `bricks.every(!alive)` 走的是 `level += 1` 换布局继续，
  所以 B 里用不到 `tone: 'win'`（留给 C 的 SUDOKU）。

## FLAPPY（artboard 2c）

- 背景改竖向渐变 `#1a1410` 0–60% → `#241a12` 100%。
- 管道 `#0b7285` 填充 + `#075a68` 3px 描边，左侧 `inset 4px 0 rgba(255,255,255,.12)` 高光
  （canvas 用一条半透明竖条模拟）。
- 小鸟：身体 `SCREEN.gold` radius 5，喙 `SCREEN.orange`，眼 `SCREEN.ground` 圆点，
  辉光 gold 60%。
- 地面：高 28px，`#3a2c1c` / `#2e2316` 18px 交替条纹，顶边 3px ink。
- 分数：Bungee 34px `SCREEN.white`，`3px 3px 0` 墨色投影，居中靠上。
- idle 提示 `TAP / SPACE TO FLAP`，JetBrains Mono 700 14px `SCREEN.gold`，ls 2px。
- **顶栏无暂停**（`pausable: false`）。
- **底部提示条显示实时 `BEST ??????`**，通过 `ctx.setHints()` 在挂载时与刷新纪录时更新。
- 结算：`GAME OVER` / `NEW HIGH SCORE`，结算态 hints 为 `['SPACE / TAP TO RETRY']`。

实现比本节写得更合理的两处（**以实现为准，勿"改回"**）：小鸟辉光复用 `SCREEN.glow.gold`（50%）
而非本节写的 60% 字面量；idle 提示省掉了 `ls 2px`，因为 Canvas 2D 的 `letterSpacing`
跨浏览器支持不齐。

## 会推翻的现有断言

- 三个游戏拿到 `displayName`（`TETRIS` / `BREAKOUT` / `FLAPPY`），
  `e2e/smoke.spec.ts` 中对应断言由中文改英文。FLAPPY 那条本来就断言 `'FLAPPY'`，不受影响。
- `tests/cabinet-view.test.ts` 需要补：`pausable: false` 时不渲染 pause 按钮、
  `side: true` 时渲染 `.cab-side`。

## 测试

- `tests/cabinet-view.test.ts` 补上述两条能力。
- 新增 e2e：进入 TETRIS 断言 `.cab-side` 里有 5 张 `.side-card`、`.cab-pad` 里有 6 个 `.pad-btn`
  且点其中的旋转键能被游戏收到；
  进入 FLAPPY 断言顶栏没有 `[data-act="pause"]` 且 `.cab-hints` 含 `BEST`。
- 三个游戏各自的既有逻辑单测（`tetris-logic` / `breakout-logic` / `flappy-logic`）
  **不应有任何改动**——本子项目只改渲染与外壳，不动玩法。这是判断有没有越界的判据。

## 文件清单

修改：
- `src/core/game.ts` — `GameMeta` 加 `side`/`pausable`；`GameContext` 加 `side`/`setHints`
- `src/shell/cabinet-view.ts` — 可选 pause、侧栏容器、控制垫容器
- `src/shell/frame.ts` — 侧栏与控制垫引用、pause 可缺省、开放 setHints
- `src/styles/arcade.css` — `.cab-side` / `.side-card` / `.cab-pad` / `.pad-btn` 系列
- `src/games/tetris/index.ts`、`src/games/breakout/index.ts`、`src/games/flappy/index.ts`
- `e2e/smoke.spec.ts`、`tests/cabinet-view.test.ts`

## 留给 C 的已知问题

- `THEME` 在 B 之后只剩 SUDOKU / 2048 / MINES / GOMOKU 引用，C 迁完即可删除。
- 侧栏与控制垫的**机制**不需要抽象（两个插槽的位置、布局、CSS 三重不共享）。真正可能重复的是
  `.side-card` / `.side-label` / `.side-value` 这套**卡片标记**——它现在是 tetris 里手写的
  HTML 字符串。C 的 MINES HUD 若形态相近，重复会落在那里。
- **canvas 建立的样板在四个游戏里各有一份**（dpr 上限 3、只设 `style.width` 不设 height、
  `touchAction`、`g.scale`）。里面藏着两个不显眼的约定，改一份就会不一致。C 会把这个数字推到 8，
  届时提取 `createScreenCanvas()` 到 core。本次未做，因为它要动 SNAKE（属 A 的范围）。
- **BREAKOUT 的砖块行号靠 `(b.y - 60) / 18` 反推 `logic.ts` 的私有布局常量**（`y0` 与 `bh+gap`，
  两者都没导出）。改砖块布局会让配色静默错位且无测试报警。C 若有机会给 `Brick` 加 `row` 字段，
  一并解决。代码里已加注释钉住出处。
- `GameFrame` 至今没有单测（A 遗留）。B 往里塞了 `applyHints` 的结算态优先逻辑，目前只由一条
  e2e 守着。C 的 SUDOKU 数字键盘、MINES 的 HUD、GOMOKU 的回合筹
  若形态相近，届时再考虑抽公共件。
- `SCREEN.orange` / `white` 在 B 中首次被真正渲染（BREAKOUT 的砖块与球、FLAPPY 的喙），
  需要目视核对——A 里它们没有任何消费者。
