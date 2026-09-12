# 首页重设计：Sunset Arcade

来源：`design_handoff_sunset_arcade_homepage/README.md` + `Homepage Redesigns.dc.html` 中的
artboard **3a · SUNSET ARCADE — 终版**。其余 artboard（1a–1d、2a–2c）是被否决的探索，忽略。

## 目标

把首页从深色霓虹主题换成暖奶油「Sunset Arcade」风格：纸感底色、墨色描边 + 硬投影、四个暖色
accent 轮转、CSS/SVG 绘制的像素图标；新增 Continue Playing 主卡、Daily Challenge、Hall of Fame。

**范围严格限定在首页。** 不改动任何游戏模块的玩法或存档逻辑，不改 router，不改 frame。

## 已确认的三个范围决策

1. **游戏名**：`GameMeta` 增加可选 `displayName`（英文大写），仅首页使用；游戏内 frame 标题仍用
   中文 `name`。现有 e2e 对中文标题的断言零改动。
2. **战绩数据**：只做首页。minesweeper / sudoku / gomoku 当前没有持久化战绩，因此这三张卡片
   显示灰色 `NO RECORD` 药丸。设计稿中 `MINES BEST 000099`、`GOMOKU WINS 012` 是示意数据，
   本次不实现——这是与设计稿唯一的可见差异。
3. **Daily Challenge**：纯展示 + `ACCEPT ▸` 跳转到当日游戏。不做完成判定、不显示 ✔、不自动写入
   Hall of Fame。README 中描述的完成检测需要在 8 个游戏里埋点上报，超出首页范围。

## 与 handoff 的其他偏差（有意为之）

- **路由**：README 写 `#/game/<id>`，本仓库 router 实际是 `#/<id>`。沿用现有约定，不动
  `src/shell/router.ts`。
- **「随机推荐」改为按日确定性**：README 说无 lastPlayed 时 feature 一个随机游戏。改用日期哈希
  （与 Daily Challenge 不同的 salt）选取——当天稳定、跨天变化，且可单测。
- **Footer 文案取实际状态**：`8 GAMES LOADED` 取 `GAMES.length`；`SOUND ON` 读实际
  `storage.get('muted')` 输出 `SOUND ON` / `SOUND OFF`，不写死。

## 架构

`src/shell/hub.ts` 拆成目录，`main.ts` 的 `import { renderHub } from './shell/hub'` 保持不变：

```
src/shell/hub/
  index.ts   renderHub(root, storage)：拼装 view + 绑定事件。唯一碰 DOM 的文件
  model.ts   纯函数 buildHubModel(storage, now) → HubModel。零 DOM、零副作用、可单测
  view.ts    hubHtml(model) → HTML 字符串。零逻辑
  icons.ts   8 组 8×8 像素坐标 + pixelIconSvg(id) → inline SVG
```

数据流：`storage` + `now` → `model.ts` 算出 `HubModel` → `view.ts` 渲染字符串 →
`index.ts` 写入 DOM 并绑定 click。全部业务判断集中在 `model.ts`，视图只做字符串拼接。

### HubModel

```ts
interface HubModel {
  featured: {
    mode: 'continue' | 'newcomer';   // 决定标签与按钮文案
    label: string;                    // '◆ CONTINUE PLAYING ◆' | '◆ NEW CHALLENGER? ◆'
    button: string;                   // 'PRESS START' | 'INSERT COIN'
    id: string; name: string; accent: string; meta: string;
  };
  daily: { dateLabel: string; prefix: string; name: string; suffix: string; id: string };
  hall: Array<{ rank: string; name: string; score: string; color: string; empty: boolean }>; // 恒 3 项
  cards: Array<{ id: string; name: string; accent: string; pill: string; hasRecord: boolean }>;
  footer: string;
}
```

### model.ts 的纯函数

- `padScore(n, width)` — 补零；6 位用于分数。
- `accentAt(index)` — `ACCENTS[index % 4]`，顺序 teal / magenta / orange / gold。
- `relativeTime(at, now)` — `< 1min` → `JUST NOW`；`< 60min` → `{n}M AGO`；`< 24h` → `{n}H AGO`；
  `< 7d` → `{n}D AGO`；否则 `A WHILE AGO`。
- `hashDate(dateKey)` — 对 `YYYY-MM-DD` 做确定性字符串哈希，返回非负整数。
- `buildHall(storage)` — 遍历 `GAMES` 读 `best.<id>`，只保留有限且 > 0 的数字，按分数降序、
  同分按 registry 顺序排序，取前 3；不足 3 条用 `{ name: '— EMPTY —', score: '······' }` 补齐。
  排名 1 用 `#e67700`，2/3 用 `#8a7a66`，空位用 `#b5a88f`。
- `buildFeatured(storage, now)` — 读 `lastPlayed`；若缺失或 id 不在 registry 中，进入 newcomer
  模式并用 `hashDate(dateKey + ':new') % GAMES.length` 选游戏。
- `buildDaily(now)` — `hashDate(dateKey) % GAMES.length` 选游戏；文案取自下方常量表。
  日期标签为 `DAILY CHALLENGE · {WEEKDAY} {DD}`，星期用三字母大写缩写，日补零两位。

### Daily Challenge 文案表

渲染为 `{prefix} {NAME} {suffix}`，`NAME` 用 `#ffe08a` 加粗。

| id | prefix | suffix |
|---|---|---|
| snake | SURVIVE | FOR 20 APPLES STRAIGHT |
| tetris | CLEAR 10 LINES IN | |
| breakout | BREAK 60 BRICKS IN | ON ONE LIFE |
| flappy | PASS 15 PIPES IN | WITHOUT A SCRATCH |
| g2048 | REACH THE 512 TILE IN | |
| minesweeper | CLEAR | IN UNDER 60 SECONDS |
| sudoku | FINISH | WITH ZERO MISTAKES |
| gomoku | BEAT THE AI AT | AS BLACK |

minesweeper 一行与设计稿 `CLEAR MINES IN UNDER 60 SECONDS` 完全一致。

## 数据写入

`lastPlayed` 由 `src/main.ts` 在路由命中 game 且 `entry.load` 存在时写入：

```ts
storage.set('lastPlayed', { id: route.id, at: Date.now() });
```

写在 main.ts 而非 frame.ts —— frame 不知道 id 的来源，且加载可能失败。读取端必须容忍存量脏数据
（非对象、id 不存在、at 非数字），任一不合法即退回 newcomer 模式。

## 设计令牌

handoff 写的是「替换 `src/core/theme.ts` 的 THEME」，但 `THEME` 实际是**游戏画布的调色板**——
被 8 个游戏的 canvas 渲染代码引用 163 次（`THEME.font` 53 次、`THEME.neonCyan` 36 次、
`neonPink` / `neonGreen` / `neonYellow` / `bg` / `text` / `dim` 共 74 次）。整体替换会删掉
`neon*` 键，导致 8 个游戏模块编译失败，并把所有画布刷成奶油底。

因此改为**新增** `export const SUNSET`，`THEME` 原样保留。首页只用 `SUNSET`，游戏画布继续用
`THEME`。这是 handoff 作者不知情的约束，属于必要偏差。

`SUNSET` 内容：

| 名称 | 值 |
|---|---|
| bg | `#f6efe3` |
| panel | `#fffaf0` |
| panelAlt / hover | `#f6efe3` / `#fff3dd` |
| ink（描边 + 主文字） | `#2b2118` |
| dim / faint / 禁用药丸底 | `#8a7a66` / `#b5a88f` / `#e6dcc8` |
| accents（按 `index % 4`） | teal `#0b7285`、magenta `#d6336c`、orange `#e8590c`、gold `#e67700` |
| 深青上的高亮 | `#ffe08a` |

圆角：卡片 14px、内嵌井 10px、按钮 8–10px、药丸 6px。
描边：卡片 3px、药丸与内部元素 2px。
硬投影（无模糊）：hero 卡 `8px 8px 0 #2b2118`，游戏卡 `6px 6px 0`，主按钮 `4px 4px 0`。
焦点环：在静止投影之上追加 `0 0 0 4px rgba(232,89,12,.35)`。

字体：Display 用 **Bungee**，正文/UI 用 **Space Grotesk** 400/500/700。通过 `index.html` 的
Google Fonts `<link>` 引入，CSS 中给足回退栈，断网时降级到系统字体而不是整页失版。

## 版面

外层容器 max-width 1440px 居中，左右 48px 内边距（窄屏收缩），底色 `#f6efe3`。

1. **Marquee 头卡** — panel 卡片，上下各一条 10px 条纹条（2px 描边、圆角 5、
   `repeating-linear-gradient(90deg, …0 14px, #fffaf0 14px 28px, …28px 42px, #fffaf0 42px 56px)`；
   上条 gold+magenta，下条 teal+gold）夹住 H1 `GAME CENTER`（Bungee 46px `#e8590c`，
   text-shadow `3px 3px 0 #2b2118`）与副标题 `THE SUNSET ARCADE — OPEN 24/7`（14px/700/ls 5px）。
2. **Hero 行** — `grid-template-columns: 1.25fr .75fr`，gap 22px。左为 Continue Playing 卡
   （内含 2px 虚线井：64px 像素图标 / Bungee 30px 游戏名 / 主按钮 / 13px dim 元信息行）；
   右列纵向堆叠 Daily Challenge 卡（底 `#0b7285`、文字 `#fffaf0`）与 Hall of Fame 卡。
3. **游戏网格** — 标题 `◆ SELECT YOUR CABINET ◆`（Bungee 14px 居中）；
   `repeat(auto-fill, minmax(300px, 1fr))`，gap 20px，1440 下 4 列，自动降到 2/1 列。
   卡片为居中纵向布局：36px 像素图标 / Bungee 14px 名称 / 分数药丸。
   有记录时药丸底色 = accent、文字 `#fffaf0`、描边 ink；无记录时底 `#e6dcc8`、文字 `#8a7a66`、
   描边 `#b5a88f`、文案 `NO RECORD`。
4. **Footer** — 12px `#8a7a66` ls 3px 居中。

窄屏：hero 网格在 900px 以下塌成单列；侧边距收到 20px。

## 交互

- hover：`translate(3px,3px)`，投影减半（6→3 / 4→2），卡片底色 `#fff3dd`。
- active：位移等于完整投影量，投影 `0 0 0`（完全「按下」）。
- focus-visible：静止投影 + 橙色焦点环。所有卡片与按钮可 Tab 到达。
- 过渡：`transform .1s, box-shadow .1s`。
- `prefers-reduced-motion: reduce` 下关闭这些过渡。

卡片是 `<button>`，点击后 `location.hash = '#/' + id`。

## 像素图标

8 个 8×8 单色图标，坐标数据抄自 DC 文件内联脚本的 `pat` 对象（snake / tetris / breakout /
flappy / g2048 / mines / sudoku / gomoku）。生产环境渲染为 inline SVG：`viewBox="0 0 8 8"`，
每个像素一个 `<rect width="1" height="1">`，`fill: currentColor`，颜色由父元素 `color` 控制。
同一份数据在 hero 用 64px、在卡片用 36px。

图标 id 与 registry id 的映射：`mines → minesweeper`，其余同名。

## 测试

新增 `tests/hub-model.test.ts`，覆盖 `model.ts` 的纯函数：

- `padScore` 补零与超长不截断。
- `accentAt` 四色轮转。
- `relativeTime` 五个分支边界。
- `buildHall`：降序排序、同分按 registry 顺序、少于 3 条时补 `— EMPTY —`、忽略非数字脏数据。
- `buildDaily`：同一日期两次调用结果相同；不同日期能选出不同游戏；文案表覆盖全部 8 个 id。
- `buildFeatured`：有合法 lastPlayed 时进入 continue 模式；缺失 / id 不存在 / at 非数字时退回
  newcomer 模式且当日结果稳定。

现有 14 个单测与 10 个 e2e 全部保持通过。为此 `view.ts` 必须保留三个选择器：`.hub-title`、
`.card`、`data-id="<id>"`。

## 游戏框的连带影响

`body` 底色从 `#0d0d16` 变成 `#f6efe3` 后，原本依赖 body 底色的游戏框会露出奶油底，与画布内的
深色游戏画面冲突。最小必要处理：把深色显式下沉到 `.frame` 自身（`background: #0d0d16`），
`.frame-bar` / `.btn` / `.frame-error` 保持原有深色配色不变。**不重新设计游戏框** —— 本次只保证
它在新底色下不破相。

## 文件清单

修改：
- `src/core/theme.ts` — 新增 `SUNSET` 导出，`THEME` 不动
- `src/core/game.ts` — `GameMeta` 增加可选 `displayName`
- `src/games/registry.ts` — 8 条 meta 补 `displayName`
- `src/main.ts` — 写入 `lastPlayed`
- `src/styles/arcade.css` — 首页样式整体重写；`.frame` / `.frame-bar` / `.btn` / `.frame-error`
  改为自带深色底色（见下方「游戏框的连带影响」）
- `index.html` — Google Fonts link

新增：
- `src/shell/hub/{index,model,view,icons}.ts`（替换原 `src/shell/hub.ts`）
- `tests/hub-model.test.ts`
