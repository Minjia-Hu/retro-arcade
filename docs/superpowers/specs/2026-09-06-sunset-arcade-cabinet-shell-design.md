# 子项目 A：Sunset Arcade 机柜外壳 + 结算浮层

来源：`design_handoff_sunset_arcade_homepage_2/README.md` 的 **Game Screens** 一节，
以及 `Game Screens.dc.html` 的 artboard **1a**（SNAKE 游戏中）与 **1b**（SNAKE 结算弹层）。

## 与 v1 交接文档的关系

v2 交接文档的首页部分与 v1 **完全相同**（README 首页段落逐字一致，`Homepage Redesigns.dc.html`
二进制相同），那部分已在 `15b8dd8` 合并。v2 的新增内容只有 Game Screens 一节。

## 范围拆分

Game Screens 涉及 `frame.ts`、8 个游戏模块（约 1900 行）、CSS 和调色板，太大，拆成三个子项目：

- **A（本文档）** — 机柜外壳、结算浮层基础设施、暖霓虹调色板，以 SNAKE 作为端到端样板。
- **B** — 其余三款深色屏游戏（TETRIS / BREAKOUT / FLAPPY）。
- **C** — 四款浅色纸盘游戏（SUDOKU / 2048 / MINES / GOMOKU）。

A 交付的是一个**完整的垂直切片**而不是待用的脚手架：一套没有消费者的接口是没被验证过的接口，
`settle()` 和 `SCREEN` 调色板必须有一个真实游戏跑通，才能确认它对 B/C 的 7 个游戏够用。

## 已确认的范围决策

1. **结算浮层用 DOM**，通过 `GameContext.settle()` 统一上报，frame 统一渲染。8 个游戏共用一套。
2. **浅色纸盘游戏的棋盘留在 canvas，控件改 DOM**（属于 C，此处仅记录方向）。
3. **先做 A，验收后再议 B/C。**

## 架构

### 共享代码上移

`accentAt()` 与 `pixelIconSvg()` 目前在 `src/shell/hub/` 内，但顶栏也要用。让 `frame.ts`
反向依赖 hub 页面模块是错误的方向，因此上移为 `shell` 层的共享模块：

```
src/shell/accent.ts       AccentTone、accentAt(index)、accentOf(gameId)
src/shell/pixel-icons.ts  由 src/shell/hub/icons.ts 移入
```

`src/shell/hub/{model,view}.ts` 改为从这两个新模块导入。`hub/icons.ts` 删除。

### 机柜 DOM 结构

`frame.ts` 的 `open()` 产出：

```html
<div class="cabinet">
  <div class="cab-bar">
    <button class="cab-btn" data-act="back">◀ BACK</button>
    <span class="cab-id">
      <span class="px px-xs accent-teal"><!-- 像素图标 SVG --></span>
      <span class="cab-name">SNAKE</span>
    </span>
    <span class="cab-tools">
      <button class="cab-btn" data-act="pause">❚❚</button>
      <button class="cab-btn" data-act="mute">SND</button>
    </span>
  </div>
  <div class="cab-screen">
    <div class="screen screen-dark">
      <div class="screen-body"><!-- 游戏 mount 到这里 --></div>
      <div class="screen-glass"></div>
      <div class="settle" hidden><!-- 结算卡片 --></div>
    </div>
  </div>
  <p class="cab-hints">↑↓←→ / WASD MOVE<span>·</span>SPACE START</p>
</div>
```

**`screen-glass` 是必要的**：设计稿要求屏幕井有 `inset 0 0 0 2px <accent 30%>` 与
`inset 0 0 40px rgba(0,0,0,.6)` 暗角。CSS 的 inset 阴影绘制在元素背景之上、内容之下，
而 canvas 位图就是内容，会把它整个盖住。因此暗角必须由一个覆盖在 canvas 之上、
`pointer-events: none` 的兄弟元素承载。

### 结算浮层接口

`src/core/game.ts` 新增：

```ts
export interface SettleView {
  /** 标题文案，如 GAME OVER / SOLVED! / NEW HIGH SCORE */
  title: string;
  /** 决定标题颜色：lose→magenta、win→teal、record→gold */
  tone: 'lose' | 'win' | 'record';
  /** 分数行，JetBrains Mono 渲染 */
  lines: string[];
  /** 主操作按钮 */
  action: { label: string; onPress: () => void };
}
```

`GameContext` 增加：

```ts
/** 上报结算状态；传 null 收起浮层 */
settle(view: SettleView | null): void;
```

frame 持有浮层 DOM，`QUIT TO HUB` 恒定跳 `#/`，不经过游戏。游戏 `destroy()` 时 frame 清空浮层。

**不自动聚焦主按钮。** 游戏的 Space 键处理器仍然在监听（设计稿底部提示写着
`SPACE / TAP TO RETRY`），若自动聚焦按钮，一次 Space 会同时触发按钮点击和游戏自身的重开逻辑。
按钮保持可 Tab 到达即可。

### 每屏元数据

`GameMeta` 增加两个可选字段：

```ts
/** 底部按键提示，用 · 分隔渲染 */
hints?: string[];
/** 屏幕井风格：深色屏或浅色纸盘，缺省 dark */
screen?: 'dark' | 'paper';
```

只有游戏模块自己的 meta 需要填——`registry.ts` 那份是懒加载前给 hub 用的，hub 用不到这两个字段。

### 调色板

`src/core/theme.ts` 新增，`THEME` 暂时保留：

```ts
/**
 * 深色屏游戏的画布内配色（Sunset Arcade 暖霓虹）。
 * 逐个游戏从 THEME 迁移过来（A 迁 SNAKE，B 迁其余三款），迁完后删除 THEME。
 */
export const SCREEN = {
  ground: '#1a1410',
  teal: '#2ee6c8',
  gold: '#ffc93c',
  pink: '#ff5c9e',
  orange: '#ff8c42',
  white: '#fffaf0',
  mono: "'JetBrains Mono', ui-monospace, monospace",
} as const;
```

**为什么新增而不是改 `THEME` 的值**：`THEME` 的键名是 `neonGreen / neonPink / neonCyan /
neonYellow`，被 8 个游戏引用 163 次。只改值不改名会让 `neonCyan` 存着橙色，名字开始说谎；
一次性改名则要在一个提交里动全部 8 个游戏。新增 `SCREEN` 让每一步都不留说谎的名字，
迁移也能逐游戏推进。

## 设计令牌（机柜外壳）

沿用首页已有的 `:root` 自定义属性（`--paper`、`--panel`、`--ink`、`--dim` 等），新增：

| 名称 | 值 | 用途 |
|---|---|---|
| `--well` | `#efe5d3` | 屏幕井底色 |
| `--screen-ground` | `#1a1410` | 深色屏画布底（与 `SCREEN.ground` 对应） |

- 机柜卡片：`#fffaf0`，3px ink 描边，radius 14，投影 `8px 8px 0`，`overflow: hidden`，
  居中，内容区最大宽度 464px。
- 顶栏：`padding: 14px 18px`，`border-bottom: 3px solid ink`。
- `cab-btn`：13px/700/ls 1px，底 `--paper`，2px ink 描边，radius 8，投影 `3px 3px 0`；
  hover `translate(2px,2px)` + 投影 `1px 1px 0`；active 完全压平；focus-visible 加橙色焦点环。
- `cab-name`：Bungee 17px ink。像素图标约 20px，取该游戏的 accent 色。
- 屏幕井：`padding: 22px`，底 `--well`，flex 居中。
- `screen`：`#1a1410` 底、3px ink 描边、radius 10、`overflow: hidden`、`position: relative`。
- `screen-glass`：绝对定位铺满，`pointer-events: none`，
  `box-shadow: inset 0 0 0 2px <accent 30%>, inset 0 0 40px rgba(0,0,0,.6)`。
  accent 由 `--accent` 局部变量提供（机柜根节点带 `accent-<tone>` class）。
- 底部提示条：`border-top: 3px solid ink`，JetBrains Mono 11px `--dim`，ls 1px，
  居中，`·` 分隔。
- 结算浮层卡片：`#fffaf0`，3px ink 描边，radius 14，投影 `6px 6px 0 rgba(0,0,0,.55)`，
  宽 280px，居中，`padding: 26px 24px`。标题 Bungee 24px（lose `#d6336c` / win `#0b7285` /
  record `#e67700`）；分数行 JetBrains Mono 14px ink 700 与 12px `--dim`；主按钮沿用首页
  `.btn-start` 样式；`QUIT TO HUB` 为 12px/700/ls 2px `--dim` 下划线文本按钮。
  浮层出现时 canvas `opacity: .25`（深色屏）。

字体：`index.html` 的 Google Fonts 链接增加 **JetBrains Mono**（400/700）。

## SNAKE 的改造

- 画布内配色由 `THEME` 换成 `SCREEN`：底 `ground`，边界墙 `teal`，蛇身 `teal`、蛇头 `gold`、
  食物 `pink`（radius 3），分数 `gold`（JetBrains Mono 700 24px，居中靠上，
  `shadowColor` 为 gold 50% 透明、blur 10）。发光统一为同色 50% alpha、blur 8–12。
- 分数按设计稿补零到 4 位（`0042`）。
- **画布内不再绘制 GAME OVER 与提示文案**，改为通过 `ctx.settle()` 上报：
  - `title: 'GAME OVER'`、`tone: 'lose'`（若刷新了最高分则 `'NEW HIGH SCORE'` + `'record'`）
  - `lines: ['SCORE 0042', 'BEST 003840']`
  - `action: { label: '▶ RETRY', onPress: 重开 }`
  - 重开时调用 `ctx.settle(null)`
- `ready` 状态的「滑动 / 方向键 开始」提示移到底部提示条，画布内不再画。
- `meta` 补 `displayName: 'SNAKE'`、`hints`、`screen: 'dark'`。

**画布逻辑尺寸不变**（320×480）。设计稿的 360×540 与之同为 2:3，是等比放大，
视觉上等价，不值得为此改动逻辑网格。

## 会推翻的现有断言

- 顶栏游戏名改为英文 `displayName`，`e2e/smoke.spec.ts` 中 8 处中文标题断言需同步更新；
  选择器 `.frame-title` 改名为 `.cab-name`，`[data-act="back"]` 保留。
- SNAKE 的 e2e 断言由 `贪吃蛇` 改为 `SNAKE`。
- `tests/hub-model.test.ts` 中 `THEME` 的整体快照测试保持不变——`THEME` 在 A 中不改动，
  仍被其余 7 个游戏使用。

## 测试

新增 `tests/frame-view.test.ts`，覆盖 frame 的纯渲染部分（把 HTML 拼接从 `frame.ts` 抽成
可测的 `cabinetHtml(meta, accent)` 与 `settleHtml(view)`）：

- 顶栏三区齐全，`data-act` 三个按钮各一个。
- 游戏名取 `displayName`，缺省时回退 `name`。
- `hints` 按 `·` 分隔渲染；无 hints 时不渲染提示条。
- `screen: 'paper'` 时 `.screen` 带 `screen-paper` class。
- 结算卡片：三种 tone 对应三种标题 class；`lines` 逐行渲染；文案被转义。
- 色调 class 与 `arcade.css` 的对应关系（沿用首页已有的同类断言）。

现有 194 个单测与 10 个 e2e 在更新断言后须全部通过。

## 文件清单

修改：
- `src/core/game.ts` — `GameMeta` 加 `hints`/`screen`；新增 `SettleView`；`GameContext` 加 `settle`
- `src/core/theme.ts` — 新增 `SCREEN`，`THEME` 不动
- `src/shell/frame.ts` — 机柜外壳重写 + 浮层宿主
- `src/shell/hub/model.ts` / `view.ts` — 改从新的共享模块导入
- `src/games/snake/index.ts` — 换 `SCREEN` 配色、接入 `settle`、补 meta
- `src/styles/arcade.css` — 机柜与浮层样式
- `index.html` — 字体加 JetBrains Mono
- `e2e/smoke.spec.ts` — 标题选择器与文案
- `tests/hub-icons.test.ts` — 导入路径

新增：
- `src/shell/accent.ts`、`src/shell/pixel-icons.ts`（由 `hub/icons.ts` 移入）
- `src/shell/cabinet-view.ts`（`cabinetHtml` / `settleHtml`）
- `tests/frame-view.test.ts`

删除：
- `src/shell/hub/icons.ts`

## 留给 B/C 的已知问题

- 机柜内容区限宽 464px。TETRIS 有侧栏（NEXT / SCORE / LEVEL / BEST），B 里很可能需要更宽的变体。
- `SND` 按钮在静音时的样式设计稿未给。A 采用压平 + 变暗表示关闭，B/C 沿用。
- `THEME` 待 8 个游戏全部迁移到 `SCREEN` 或纸盘配色后删除。
