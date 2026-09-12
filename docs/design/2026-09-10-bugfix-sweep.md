# 2026-09-10 全项目体检：bug 清单与范围决策

## 背景

对整个仓库做了一轮只读审查（core / shell / CSS / 配置 + 8 个游戏）。基线
`tsc` 零错误、单测 249/249 全绿，但有十几处**行为与文案、行为与设计意图不符**的地方。
本轮只修确认的 bug，**不重构、不加功能**。

## 范围决策（记在这里，防止后人当 bug「修」回去）

- **MINES / SUDOKU / GOMOKU 永远 NO RECORD**。三款不写 `best.<id>`，首页卡片、Hall of Fame
  对它们恒为空。设计稿就是这样；hub 的排序假定「分数越大越好」，记用时需要改 hub model
  与测试，另开 spec。本轮不动。
- **扫雷计时器在 ☰ 菜单开着时继续走**。菜单不是暂停，视为有意。
- **2048 的 `undo` 在终局态逻辑支持但 UI 不可达**。留作后续。
- **`GameLoop.stop()` 不取消已排队的 rAF**。所有游戏都在 `mount` 里 `new` 新实例，不可达。
- **Gomoku `paused` 时丢弃 AI 回复会死锁**。`pausable: false` 使其不可达；将来若开暂停要改成暂存。
- **Flappy 的 logic 改动是玩法修正，不是视觉改动**。CLAUDE.md 的「视觉类改动不许碰 logic.ts」
  不适用；`tests/flappy-logic.test.ts` 随之更新。其余七款的 `logic.ts` 与其单测一行不动。

## 确认的 bug

### shell / core

1. **方向键 / Space 滚动页面**。`InputService.onKey` 只把 `e.code` 交给游戏，全仓没有任何
   键盘 `preventDefault`。机柜高于视口时（手机、Tetris 带侧栏+控制垫）玩着玩着页面在滚。
2. **失焦时 keyup 丢失，按住态卡死**。Tetris / Breakout 用 `heldX` 标志驱动自建重复；按住 ←
   时 Cmd+Tab 切走，回来后方块/挡板一直往左滑。没有任何 `blur` 处理。
3. **浮层期间暂停按钮仍可点**。四款深色屏游戏的 `retry()` 带 `if (paused) return`：
   「死亡 → 浮层 → 点暂停 → 点 RETRY」按钮无反应。浮层期间暂停没有意义，直接禁用按钮。
4. **`.settle` 吞掉画布指针事件**。它是 `position:absolute; inset:0` 且没有
   `pointer-events:none`（对比 `.screen-glass` 有）。四款深色屏的「SPACE / TAP TO RETRY」
   在手机上 TAP 是假的；`diedAt < 400` 防连点在指针路径成了死代码。
5. **`close()` 到下一次 `open()` 之间 head / side / pad 仍留在页面**。`close()` 只清了浮层；
   Tetris 的 `destroy()` 清 pad 不清 side，自相矛盾。统一由 `close()` 清。
6. **加载失败也写 `lastPlayed`**。`main.ts` 在 `await entry.load()` 之前写，动态 import 失败
   时首页 CONTINUE 仍指向这款。

### 深色屏

7. **Tetris 软降/硬降的分只在消行或终局时落盘**，中途 BACK 会丢。
8. **Tetris 结算浮层期间 pad 按钮任意一颗都会重开**（pad 在浮层覆盖范围之外，`act()` 不查
   `overlayOpen()`）。
9. **Breakout `dragBy` 每次 pointermove 调 `getBoundingClientRect()`**，高刷屏每秒上百次强制布局。
10. **Flappy 三处判定与画面不符**：判定圆 r=12 而画的是 24×18；地面画在 y=452 起但致死线是
    480（小鸟穿地 25px 才死）；缺口范围 `[80,400]` 让缺口下沿最大到 465，低于地面。

### 浅色纸盘

11. **四款结算提示写 `SPACE / TAP FOR A NEW ...`，没有一款实现**。g2048 的 `onKey` 先
    `frozen()` 早退；minesweeper / gomoku 根本没注册 `onKey`；sudoku 的 `won` 分支排在
    `overlayOpen()` 早退之后成了死代码。
12. **Gomoku `worker.onmessage` 在 token 校验之前就 `thinking = false`**。过期回复会清掉新局的
    thinking；目前靠 `turn` 兜底没成可见故障，但是脆弱的。

### 文档

13. README 说 `loop.ts` 是「固定步长游戏循环」，实际是变步长 + 50ms 上限。

## 与设计稿的关系

- #3 禁用暂停按钮：设计稿的浮层 artboard 里顶栏按钮外观不变，只是加 `disabled`。
- #4 让点击穿透：浮层视觉不变。
- #10 Flappy 地面：以画面为准修判定，不是改画面。
- 提示文案一律不改，改行为去兑现文案。

## 后续（本轮不做）

重复代码（`padScore` 两份、`frozen()` 四份、GAME OVER 浮层四份、gomoku 菜单与
`difficulty-menu.ts` 重复）、纸盘四款 60fps 驱动静态盘面、每帧分配、DPR 变化不重设画布、
CI / 部署 / lint、依赖大版本落后、`index.html` 缺 favicon 等。清单见
本文「后续」一节。
