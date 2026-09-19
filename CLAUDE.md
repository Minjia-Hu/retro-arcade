# CLAUDE.md

给 Claude Code 的项目约定。这里只写**读代码看不出来、但踩过的**东西；常规信息见 `README.md`。

## 工作流

改动前先写 spec 再写 plan，命名 `YYYY-MM-DD-<主题>.md`。spec 进仓库：`docs/design/`；
plan 是施工脚手架（大段代码转录），**只放本地** `docs/plans/`（已 gitignore），不提交。
范围决策、刻意的取舍、与设计稿的偏离都记在 spec 里——不记的话下一个人（或下一个会话）
会把它们当 bug「修」回去。

## 硬约定

### 1. `logic.ts` 与 `index.ts` 严格分离

每个游戏 `src/games/<id>/` 下：`logic.ts` 是纯逻辑（零 DOM、零 Canvas、可完整单测），
`index.ts` 只做渲染与输入翻译。

**视觉类改动一律不许碰 `logic.ts` 与 `tests/*-logic.test.ts`。** 判据：

```bash
git diff --stat <基线> -- 'src/games/*/logic.ts' 'tests/*-logic.test.ts'   # 必须为空
```

需要 `logic.ts` 没导出的常量时（例如砖块行高），**在 `index.ts` 里加注释钉住出处，
不要为了迎合渲染去改 logic**。

### 2. 画布配色与页面色板是两回事

**页面色板的唯一真相源是 `src/styles/arcade.css` 的 `:root`**；TS 侧只持有必须由 JS
内联的那部分。两边都有的值（accent 四色、`--screen-ground`）在两处都写了交叉引用注释。

**画布内配色不在那里**：深色屏四款（SNAKE / TETRIS / BREAKOUT / FLAPPY）共用
`src/core/theme.ts` 的 `SCREEN`；浅色纸盘四款（SUDOKU / 2048 / MINES / GOMOKU）**各自**
在自己的 `index.ts` 里持有 `PAPER` 常量——它们的配色互不相同，硬凑成一张表只会得到一个
谁都不合身的抽象。**不要合并它们。**

（历史：曾有一个叫 `THEME` 的画布调色板被 8 个游戏共用。设计交接文档反复写「替换 THEME」，
照做会让游戏编译失败并把画布刷成页面底色。八个游戏全部迁走后它已被删除，
文档里再提到它的都是历史记录。）

### 3. 路由是 `#/<id>`

不是 `#/game/<id>`。设计文档里写错过，以代码为准。

### 4. 设计稿冲突时以 artboard 为准

`design_handoff_*/README.md` 的散文与 `.dc.html` 的 artboard 有过实际冲突（例如结算按钮
底色）。**artboard 是权威**，并且要在 spec 里记一笔，否则后人读散文会「改回去」。

`.dc.html` 是 HTML 原型，不是可直接抄的生产代码——它把很多东西画成 DOM 只是因为它本身
就是 HTML。是否照搬要单独判断。

## 容易踩的坑

- **artboard 是桌面稿，可能漏掉触屏控件。** Tetris 画布里那排触屏按钮在设计稿上不存在，
  照稿缩画布会直接删掉手机可玩性。改版前先确认画布里有没有承载交互的东西。
- **CSS 的 inset 阴影盖不到 canvas 上。** inset 阴影绘制在背景之上、内容之下，而 canvas
  位图就是内容。屏幕井的暗角靠 `.screen-glass` 这个 `pointer-events: none` 的覆盖层，
  别把它当多余的空 div 删掉。
- **canvas 只设 `style.width`，不设 height。** 靠替换元素的内在比例推高度，配合
  `.screen-body canvas { height: auto }`。窄屏不溢出全靠这条，动它会连带破坏移动端布局。
- **不要自动聚焦结算浮层的按钮。** 游戏的 Space 处理器仍在监听，聚焦后一次 Space 会同时
  触发按钮点击和游戏自身的重开。
- **浮层按钮的 `onPress` 不要直接指向游戏的 tap 处理器。** 那里常有给画布误触准备的
  防连点去抖，会把一次明确的按钮点击吞掉。共用 `paused` 卫语句即可。

## 测试

- 断言**行为**，不要断言「没抛错」或只数数量。写完问自己：把被测的那行删掉，这条测试会红吗？
  不确定就真的注入一次回归验证。
- 不要把随机的游戏内容写死进断言（食物位置、方块序列）。
- 用 `indexOf` 比顺序时先断言两者都存在——缺席时返回 `-1`，恒小于任何真实位置。
- CSS 相关断言用正则匹配映射关系，别锁死整条规则的格式。
- Vitest 默认把 CSS 导入桩成空串；需要读 `arcade.css` 内容的测试依赖 `vite.config.ts` 里的
  `test.css: true`。

## 提交信息

commit message 一律英文（标题与正文），祈使语气，正文写「为什么」。

## 命令

```bash
npm test         # 单测
npm run e2e      # 端到端（改了渲染或 DOM 结构就要跑）
npx tsc --noEmit # 类型检查
npm run build    # tsc + vite build
```

## 本地目录（已 gitignore，不进仓库）

- `design_handoff_*/` — 设计参考资料（artboard 与 handoff 说明），硬约定 4 引用的就是它。
- `docs/plans/` — 实现计划，施工脚手架。
- `docs/posts/` — 发到各社区的推广稿与封面图，`docs/posts/README.md` 是索引（平台、日期、线上链接）。
  线上为准；稿子里的平台特有写法（例如 V2EX 版的「俄方块」）是有意为之，别当错字改。
