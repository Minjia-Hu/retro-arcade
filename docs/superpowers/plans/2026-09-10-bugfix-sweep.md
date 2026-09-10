# 2026-09-10 bug 清扫：实现计划

对应 spec：`docs/superpowers/specs/2026-09-10-bugfix-sweep.md`。分支 `feature/bugfix-sweep`，
四个批次各一次提交。每批次先写会红的测试，再改代码。

## 批次 1：shell / core

- `src/core/input.ts`
  - `onKey`：`Arrow*` / `Space` 调 `e.preventDefault()`，再交给 handler。
  - 新增 `onBlur(handler)`：window `blur` 时触发，返回解绑函数，纳入 `dispose()`。
- `src/shell/frame.ts`
  - `showOverlay(view)` 打开时暂停按钮 `disabled = true`，收起与 `close()` 时恢复。
  - `close()` 清空 `.cab-head` / `.cab-side` / `.cab-pad` 的 `innerHTML`。
- `src/styles/arcade.css`：`.settle { pointer-events: none }`、`.settle-card { pointer-events: auto }`。
- `src/main.ts`：`storage.set('lastPlayed', …)` 移到 `frame.open()` 之后。
- 测试：`tests/input.test.ts`（preventDefault 白名单、blur）；`tests/frame.test.ts`
  （浮层期间暂停按钮 disabled、close 后插槽为空、CSS 的 pointer-events 映射）。
- 验证：`npm test`、`npm run e2e`。

## 批次 2：深色屏四款

- `src/games/tetris/index.ts`：`afterEvents` 末尾无条件 `saveBest()`；`act()` 加
  `overlayOpen()` 守卫；`onBlur` 复位全部 held；`destroy()` 删掉清 pad 那行（frame 已管）。
- `src/games/breakout/index.ts`：`onBlur` 复位 held；`dragBy` 的 `rect.width` 缓存，
  `ctx.onResize` 失效。
- `src/games/flappy/logic.ts`：导出 `GROUND_H = 28`、`BIRD_RY = 9`；致死线与缺口范围以
  `H - GROUND_H` 为底；管道碰撞纵向用 `BIRD_RY`。
- `src/games/flappy/index.ts`：地面读 `L.GROUND_H`。
- 测试：`tests/flappy-logic.test.ts` 补「缺口不低于地面」「落地即死」「纵向擦边不死」。
- 验证：`git diff --stat main -- 'src/games/*/logic.ts' 'tests/*-logic.test.ts'` 只出现 flappy 两个文件。

## 批次 3：浅色纸盘四款

- `g2048` / `minesweeper` / `gomoku`：`onKey` 与画布 tap 各加一支
  「`overlayOpen()` 且局已结束且距结束 ≥ 400ms → 新局」。菜单浮层（状态未结束）不受影响。
- `sudoku`：`won` 分支挪到 `overlayOpen()` 早退之前。
- `gomoku`：`thinking = false` 挪到 token 校验之后。
- 测试：e2e 给四款各加「结束 → Space 重开」。
- 验证：`npm run e2e`。

## 批次 4：文档

- README 的 `loop.ts` 描述改为「变步长（dt 上限 50ms）游戏循环」。

## 后续优化清单（非 bug）

- 重复：`padScore`（`core/format.ts` vs `hub/model.ts`）；`frozen()` 四份；GAME OVER 浮层
  构造四份；`best` 读写八份；gomoku `showMenu` 与 `shell/difficulty-menu.ts`；等宽字体栈字符串 4 次。
- 性能：纸盘四款 `GameLoop(() => {}, render)` 60fps 驱动静态盘面；数独 `conflicts()` 每帧
  重算；2048 每帧 `setLineDash`；Flappy 每帧新建渐变；Tetris 逐格 shadowBlur；Snake / Flappy
  每得 1 分同步写 localStorage；数独每键落盘。
- DPR 变化不重设画布。
- 测试缺口：Tetris `aboveTop` / 等级倍率 / `holdPiece` 出生碰撞；Breakout 右墙与反弹轴；
  Sudoku hard 档唯一解、`deserialize` 拒绝路径；Gomoku `evaluateBoard`、随机抖动、Worker 竞态。
- 基础设施：CI、GitHub Pages、lint、依赖升级（Vite 5 → 8、Vitest 2 → 4）。
- 杂项：favicon / description / theme-color、`user-scalable=no`、Google Fonts 外链、
  `onSwipe` / `onTapAt` 不过滤 pointerId。
