# 2026-09-12 玩法调参：实现计划

对应 spec：`docs/superpowers/specs/2026-09-12-gameplay-tuning.md`。分支 `feature/gameplay-tuning`，
先写会红的测试再改 logic，五条一个提交（都是常量级改动，拆开反而碎）。

| # | 文件 | 改动 | 测试（`tests/…`） |
|---|---|---|---|
| 1 | `sudoku/logic.ts` | `DIFFICULTIES` clues 40/32/26 | `sudoku-logic`: 三档值断言；hard 用 `mulberry32(7)` 生成一局，givens ≤ 28 且 `solutionCount(…, 2) === 1` |
| 2 | `gomoku/ai.ts` | `shapeScore` 冲四 1000 → 3000 | `gomoku-ai`: `evaluatePoint` 冲四（三连一端被白封）> 活三 |
| 3 | `snake/logic.ts` | `SPEEDUP` 0.004 → 0.002 | `snake-logic`: `stepInterval(30)` 未到封顶、`stepInterval(45)` 等于封顶 |
| 4 | `breakout/logic.ts` | `speedFor` 封顶 `MAX_SPEED = 400`；`launch` 按挡板半场定 `vx` 符号 | `breakout-logic`: `speedFor(7) === speedFor(20)`、`speedFor(6) < speedFor(7)`；挡板在 100 发球 vx>0、在 220 发球 vx<0 |
| 5 | `g2048/logic.ts` | 状态加 `seed`，`move` 不传 `rand` 时用 mulberry32 派生并推进；`prev` 存 seed，`undo` 恢复；`createState` 在两次开局生砖之后从 `rand()` 取种子 | `g2048-logic`: 同一局面 `move('left')` → `undo` → `move('left')` 两次盘面相同；`prev` 恢复后 seed 相同 |

验证：`npm test` → `npx tsc --noEmit` → `npm run e2e`（GOMOKU 那条依赖 AI 走法）→
`git diff --stat main -- 'src/games/*/logic.ts' 'tests/*-logic.test.ts'` 应列出且仅列出这五款。
