# 2026-09-12 首页 footer：声音开关 + 仓库链接

## 背景

首页 footer 原是一行只读文本 `8 GAMES LOADED · SOUND ON · © 2026 SUNSET ARCADE`。两个问题：
显示了静音状态却不能在首页改（唯一开关是游戏顶栏的 SND）；从分享链接进来玩的人没有任何入口
知道代码在哪——这是 demo 到仓库的唯一转化路径。

## 决定

- `SOUND ON` 变成开关按钮，与游戏顶栏 SND 共用 `AudioFx` 的同一份状态。
- 末尾加 `SOURCE ON GITHUB ↗`，accent 橙色，hover 下划线，新标签打开。
- **不用带星数的第三方小组件**（ghbtns 之类）：会加载外部脚本，与 README 里「唯一外部请求是
  Google Fonts」冲突；而且 0 星时显示 `Star 0` 是减分。
- **写 SOURCE 不写 STAR**：页脚只负责带路，README 负责卖。求星的措辞放在 0 星项目的页脚上
  读起来是求关注。若以后想加推力，更合适的位置是结算浮层，等有用户反馈再议。

## 实现

`hub/model.ts` 的 `footer` 从字符串改为结构（`games / muted / copyright / repoUrl`），
`hub/view.ts` 渲染按钮与链接，`hub/index.ts` 接 click 并接收 `AudioFx`，样式在 `arcade.css`
的 `.hub-toggle` / `.hub-link`。单测覆盖模型与视图，e2e 覆盖「首页切静音 → 游戏顶栏同步」。
