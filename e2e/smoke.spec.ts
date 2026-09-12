import { test, expect } from '@playwright/test';

test('首页显示 8 张游戏卡片', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.hub-title')).toBeVisible();
  await expect(page.locator('.card')).toHaveCount(8);
});

test('进入 flappy 有画布渲染，返回首页正常', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-id="flappy"]');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('.cab-name')).toContainText('FLAPPY');
  await page.click('[data-act="back"]');
  await expect(page.locator('.hub-title')).toBeVisible();
});

test('进入 snake 有画布渲染，返回首页正常', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-id="snake"]');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('.cab-name')).toContainText('SNAKE');
  await page.click('[data-act="back"]');
  await expect(page.locator('.hub-title')).toBeVisible();
});

test('进入 2048 有画布渲染，返回首页正常', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-id="g2048"]');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('.cab-name')).toContainText('2048');
  await page.click('[data-act="back"]');
  await expect(page.locator('.hub-title')).toBeVisible();
});

test('进入打砖块有画布渲染，返回首页正常', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-id="breakout"]');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('.cab-name')).toContainText('BREAKOUT');
  await page.click('[data-act="back"]');
  await expect(page.locator('.hub-title')).toBeVisible();
});

test('进入扫雷有画布渲染，返回首页正常', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-id="minesweeper"]');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('.cab-name')).toContainText('MINES');
  await page.click('[data-act="back"]');
  await expect(page.locator('.hub-title')).toBeVisible();
});

test('进入俄罗斯方块有画布渲染，返回首页正常', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-id="tetris"]');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('.cab-name')).toContainText('TETRIS');
  await page.click('[data-act="back"]');
  await expect(page.locator('.hub-title')).toBeVisible();
});

test('进入数独有画布渲染，返回首页正常', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-id="sudoku"]');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('.cab-name')).toContainText('SUDOKU');
  await page.click('[data-act="back"]');
  await expect(page.locator('.hub-title')).toBeVisible();
});

test('进入五子棋有画布渲染，返回首页正常', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-id="gomoku"]');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('.cab-name')).toContainText('GOMOKU');
  await page.click('[data-act="back"]');
  await expect(page.locator('.hub-title')).toBeVisible();
});

test('全部 8 张卡片均可进入（无禁用）', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.card:not([disabled])')).toHaveCount(8);
});

test('SNAKE 死亡后弹出结算浮层，RETRY 收起并重开', async ({ page }) => {
  await page.goto('/#/snake');
  await expect(page.locator('canvas')).toBeVisible();

  // 蛇初始朝右，按上是垂直转向（按左会被当作 180° 掉头拒绝），一路撞顶墙
  await page.keyboard.press('ArrowUp');
  await expect(page.locator('.settle-card')).toBeVisible({ timeout: 20000 });

  // 食物位置是随机的：蛇撞墙前若恰好吃到，就会刷新纪录、标题变成 NEW HIGH SCORE。
  // 断言两种结算标题都接受，别把随机的游戏内容写死进测试。
  await expect(page.locator('.settle-title')).toHaveText(/GAME OVER|NEW HIGH SCORE/);
  await expect(page.locator('.screen')).toHaveClass(/is-settled/);
  // 结算态的提示条与游戏态不同（设计稿 artboard 1a vs 1b）
  await expect(page.locator('.cab-hints')).toHaveText('SPACE / TAP TO RETRY');

  await page.click('[data-act="overlay:0"]');
  await expect(page.locator('.settle-card')).toBeHidden();
  await expect(page.locator('.screen')).not.toHaveClass(/is-settled/);
  await expect(page.locator('.cab-hints')).toContainText('SPACE START');
});

test('结算浮层的 QUIT TO HUB 回首页', async ({ page }) => {
  await page.goto('/#/snake');
  await expect(page.locator('canvas')).toBeVisible();
  await page.keyboard.press('ArrowUp');
  await expect(page.locator('.settle-card')).toBeVisible({ timeout: 20000 });
  await page.click('[data-act="overlay-quit"]');
  await expect(page.locator('.hub-title')).toBeVisible();
});

test('TETRIS 的侧栏与触屏控制垫是 DOM 且可用', async ({ page }) => {
  await page.goto('/#/tetris');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('.cab-side .side-card')).toHaveCount(5);
  await expect(page.locator('.cab-pad .pad-btn')).toHaveCount(6);

  // 断言真实行为而非「没抛错」：hardDrop 必然加分，分数变了才证明按钮接到了游戏
  await page.locator('canvas').click();
  await expect(page.locator('[data-ref="score"]')).toHaveText('000000');
  await page.locator('[data-pad="hard"]').click();
  await expect(page.locator('[data-ref="score"]')).not.toHaveText('000000');
});

test('FLAPPY 没有暂停按钮，提示条显示实时最高分', async ({ page }) => {
  await page.goto('/#/flappy');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('[data-act="pause"]')).toHaveCount(0);
  await expect(page.locator('[data-act="mute"]')).toHaveCount(1);
  await expect(page.locator('.cab-hints')).toContainText('BEST');
});

test('提示条在 结算 → 收起 之后还原成游戏设的文案', async ({ page }) => {
  // FLAPPY 是唯一走 ctx.setHints 的游戏。这条覆盖 setHints → settle → settle(null)
  // 的完整还原链路：少了 frame 里的 baseHints 记账，收起后会退回 meta.hints 的占位。
  //
  // 必须种一个非零最高分：meta.hints 的占位恰好是 'BEST 000000'，而鸟撞地时
  // 得分为 0、best 也是 0，不种的话「还原成实时值」与「退回占位」肉眼无法区分。
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('arcade.best.flappy', '42'));
  await page.goto('/#/flappy');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('.cab-hints')).toHaveText('BEST 000042');

  // FLAPPY 停在 ready 态不跑物理，先扇一下开局，之后不再操作，重力会把鸟送到地面
  await page.keyboard.press('Space');
  await expect(page.locator('.settle-card')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('.cab-hints')).toHaveText('SPACE / TAP TO RETRY');

  await page.click('[data-act="overlay:0"]');
  await expect(page.locator('.settle-card')).toBeHidden();
  await expect(page.locator('.cab-hints')).toHaveText('BEST 000042');
});

test('SUDOKU 先弹难度菜单，选完出现数字盘', async ({ page }) => {
  await page.goto('/#/sudoku');
  await expect(page.locator('canvas')).toBeVisible();

  // 难度菜单是多动作浮层
  await expect(page.locator('.settle-title')).toHaveText('DIFFICULTY');
  await expect(page.locator('.settle-actions .settle-action')).toHaveCount(3);
  await expect(page.locator('[data-act="pause"]')).toHaveCount(0);

  await page.click('[data-act="overlay:0"]');
  await expect(page.locator('.settle-card')).toBeHidden();
  await expect(page.locator('.cab-pill')).toHaveText('EASY');
  await expect(page.locator('.pad-btn-digit')).toHaveCount(9);
  await expect(page.locator('.pad-btn-wide')).toHaveCount(3);

  // ☰ 重新打开菜单
  await page.click('[data-act="tool:menu"]');
  await expect(page.locator('.settle-title')).toHaveText('DIFFICULTY');
});

test('SUDOKU 的笔记开关键盘与按钮共用同一状态', async ({ page }) => {
  await page.goto('/#/sudoku');
  await page.click('[data-act="overlay:0"]');
  const notes = page.locator('[data-pad="notes"]');
  await expect(notes).not.toHaveClass(/is-on/);

  await notes.click();
  await expect(notes).toHaveClass(/is-on/);

  // 键盘切换也要让按钮激活态跟着变——计划里漏掉过这条同步
  await page.keyboard.press('KeyN');
  await expect(notes).not.toHaveClass(/is-on/);
});

test('SUDOKU 菜单开着时冻结盘面，RESUME 能回到当前局', async ({ page }) => {
  await page.goto('/#/sudoku');
  await page.click('[data-act="overlay:0"]');           // 选 EASY 开局
  await expect(page.locator('.settle-card')).toBeHidden();

  // 选一格填个数，作为"盘面有没有被改"的参照
  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.click(box.x + 16, box.y + 16);       // 第 0 格

  // 中途误触 ☰：进行中的局要有回去的出口，而不是只能弃局
  await page.click('[data-act="tool:menu"]');
  await expect(page.locator('.settle-title')).toHaveText('DIFFICULTY');
  await expect(page.locator('.settle-actions .settle-action').first()).toHaveText('✕ RESUME');
  await expect(page.locator('.cab-hints')).toHaveText('RESUME OR PICK A DIFFICULTY');

  // 浮层只覆盖 .screen，控制垫在它外面——按钮点得到，但不该改到被盖住的盘面
  await page.click('[data-pad="notes"]');
  await expect(page.locator('[data-pad="notes"]')).not.toHaveClass(/is-on/);

  await page.click('[data-act="overlay:0"]');           // ✕ RESUME
  await expect(page.locator('.settle-card')).toBeHidden();
  await expect(page.locator('.cab-pill')).toHaveText('EASY'); // 仍是原来那局
});

test('SUDOKU 尚未开局时菜单没有 RESUME', async ({ page }) => {
  await page.goto('/#/sudoku');
  await expect(page.locator('.settle-title')).toHaveText('DIFFICULTY');
  await expect(page.locator('.settle-actions .settle-action')).toHaveCount(3);
  await expect(page.locator('.cab-hints')).toHaveText('PICK A DIFFICULTY TO BEGIN');
});

test('2048 的分数卡与撤销在 DOM 里', async ({ page }) => {
  await page.goto('/#/g2048');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('.cab-head .head-card')).toHaveCount(2);
  await expect(page.locator('[data-act="tool:new"]')).toHaveCount(1);

  // 开局无步可撤；走一步后可撤。
  // 起手两块位置随机，恰好都贴左时 ← 不算一步；← 与 ↑ 不可能同时无效
  await expect(page.locator('[data-ref="undo"]')).toBeDisabled();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowUp');
  await expect(page.locator('[data-ref="undo"]')).toBeEnabled();
});

test('MINES 的 🙂 重开本局，☰ 才回难度菜单', async ({ page }) => {
  await page.goto('/#/minesweeper');
  await page.click('[data-act="overlay:0"]');            // 选第一档难度
  await expect(page.locator('.settle-card')).toBeHidden();
  await expect(page.locator('.cab-pill')).toHaveText('EASY');

  // 🙂 是重开本局：不回菜单、难度不变
  await page.click('[data-ref="face"]');
  await expect(page.locator('.settle-card')).toBeHidden();
  await expect(page.locator('.cab-pill')).toHaveText('EASY');

  // ☰ 才是回难度菜单 —— 这两件事以前挤在同一个热区里
  await page.click('[data-act="tool:menu"]');
  await expect(page.locator('.settle-title')).toHaveText('DIFFICULTY');
});

test('MINES 的计时器首次翻格才起表', async ({ page }) => {
  await page.goto('/#/minesweeper');
  await page.click('[data-act="overlay:0"]');
  await expect(page.locator('[data-ref="time"]')).toHaveText('00:00');

  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.click(box.x + 16, box.y + 16);
  await expect(page.locator('[data-ref="time"]')).not.toHaveText('00:00', { timeout: 3000 });
});

test('GOMOKU 的模式菜单有四项，回合筹随模式变', async ({ page }) => {
  await page.goto('/#/gomoku');
  await expect(page.locator('.settle-title')).toHaveText('GOMOKU');
  await expect(page.locator('.settle-actions .settle-action')).toHaveCount(4);

  await page.click('[data-act="overlay:0"]');            // 2 PLAYERS
  await expect(page.locator('[data-ref="black"]')).toHaveText('● BLACK');
  await expect(page.locator('[data-ref="white"]')).toHaveText('○ WHITE');
  await expect(page.locator('[data-ref="black"]')).toHaveClass(/is-turn/);

  // 局面进行中，菜单会多一个 ✕ RESUME 排在最前，所以 AI EASY 的下标是 2 不是 1
  await page.click('[data-act="tool:menu"]');
  await expect(page.locator('.settle-actions .settle-action').first()).toHaveText('✕ RESUME');
  await page.click('[data-act="overlay:2"]');            // AI EASY
  await expect(page.locator('[data-ref="white"]')).toHaveText('○ CPU');
});

// ---- 纸盘四款：结算浮层写着「SPACE / TAP …」，就得真的能按 ----

test('SUDOKU 解完后按 Space 回到难度菜单', async ({ page }) => {
  // 种一个只差一格的存档：读档路径不弹菜单，填上最后一格就 SOLVED
  const solution = [
    5, 3, 4, 6, 7, 8, 9, 1, 2,
    6, 7, 2, 1, 9, 5, 3, 4, 8,
    1, 9, 8, 3, 4, 2, 5, 6, 7,
    8, 5, 9, 7, 6, 1, 4, 2, 3,
    4, 2, 6, 8, 5, 3, 7, 9, 1,
    7, 1, 3, 9, 2, 4, 8, 5, 6,
    9, 6, 1, 5, 3, 7, 2, 8, 4,
    2, 8, 7, 4, 1, 9, 6, 3, 5,
    3, 4, 5, 2, 8, 6, 1, 7, 9,
  ];
  const puzzle = solution.slice();
  puzzle[0] = 0;
  await page.goto('/');
  await page.evaluate((save) => localStorage.setItem('arcade.sudoku.save', JSON.stringify(save)), {
    p: puzzle, s: solution, v: puzzle.slice(), n: Array.from({ length: 81 }, () => []), d: 'easy', st: 'playing',
  });
  await page.goto('/#/sudoku');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('.settle-card')).toBeHidden();

  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.click(box.x + 16, box.y + 16); // 第 0 格
  await page.keyboard.press('Digit5');
  await expect(page.locator('.settle-title')).toHaveText('SOLVED!');

  await page.waitForTimeout(450); // 400ms 防误触
  await page.keyboard.press('Space');
  await expect(page.locator('.settle-title')).toHaveText('DIFFICULTY');
});

test('GOMOKU 分出胜负后按 Space 回到模式菜单', async ({ page }) => {
  await page.goto('/#/gomoku');
  await page.click('[data-act="overlay:0"]'); // 2 PLAYERS
  await expect(page.locator('.settle-card')).toBeHidden();

  // 画布逻辑 320×320，交叉点 px(c) = 20 + c*20；黑子第 7 行连五，白子第 8 行陪跑
  const box = (await page.locator('canvas').boundingBox())!;
  const k = box.width / 320;
  const at = (c: number, r: number) => page.mouse.click(box.x + (20 + c * 20) * k, box.y + (20 + r * 20) * k);
  for (let c = 0; c < 5; c++) {
    await at(c, 7);
    if (c < 4) await at(c, 8);
  }
  await expect(page.locator('.settle-title')).toHaveText('BLACK WINS');

  await page.waitForTimeout(450);
  await page.keyboard.press('Space');
  await expect(page.locator('.settle-title')).toHaveText('GOMOKU');
});

test('MINES 结束后按 Space 同难度重开', async ({ page }) => {
  await page.goto('/#/minesweeper');
  await page.click('[data-act="overlay:0"]'); // EASY 9×9
  await expect(page.locator('.settle-card')).toBeHidden();

  // 雷是随机的：逐格点过去，要么踩雷要么清盘，两种结算都接受
  const box = (await page.locator('canvas').boundingBox())!;
  const cell = box.width / 9;
  outer: for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      await page.mouse.click(box.x + (c + 0.5) * cell, box.y + (r + 0.5) * cell);
      if (await page.locator('.settle-card').isVisible()) break outer;
    }
  }
  await expect(page.locator('.settle-title')).toHaveText(/BOOM|CLEARED!/);

  await page.waitForTimeout(450);
  await page.keyboard.press('Space');
  await expect(page.locator('.settle-card')).toBeHidden();
  await expect(page.locator('.cab-pill')).toHaveText('EASY'); // 同难度
  await expect(page.locator('[data-ref="time"]')).toHaveText('00:00'); // 新局
});

test('2048 结束后按 Space 开新局', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/#/g2048');
  await expect(page.locator('canvas')).toBeVisible();

  // 方块序列是随机的：循环四个方向直到走投无路。若先摸到 2048!（极小概率）就点 NEW GAME 继续
  const dirs = ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'];
  const settle = page.locator('.settle-card');
  for (let i = 0; i < 4000; i++) {
    await page.keyboard.press(dirs[i % 4]);
    if (i % 25 === 0 && await settle.isVisible()) {
      if ((await page.locator('.settle-title').textContent()) === '2048!') {
        await page.click('[data-act="overlay:1"]');
        continue;
      }
      break;
    }
  }
  await expect(page.locator('.settle-title')).toHaveText(/GAME OVER|NEW HIGH SCORE/);

  await page.waitForTimeout(450);
  await page.keyboard.press('Space');
  await expect(settle).toBeHidden();
  await expect(page.locator('[data-ref="score"]')).toHaveText('000000');
});

test('首页 footer 的 SOUND 开关与游戏顶栏的 SND 共用一份状态', async ({ page }) => {
  await page.goto('/');
  const sound = page.locator('[data-act="sound"]');
  await expect(sound).toHaveText('SOUND ON');
  await sound.click();
  await expect(sound).toHaveText('SOUND OFF');
  await expect(sound).toHaveAttribute('aria-pressed', 'true');

  await page.click('[data-id="snake"]');
  await expect(page.locator('[data-act="mute"]')).toHaveClass(/is-off/);
  await page.click('[data-act="back"]');
  await expect(page.locator('[data-act="sound"]')).toHaveText('SOUND OFF');

  // 出口链接：指向仓库、新标签、不泄露 opener
  const link = page.locator('.hub-link');
  await expect(link).toHaveAttribute('href', /github\.com\/Minjia-Hu\/retro-arcade/);
  await expect(link).toHaveAttribute('rel', 'noopener');
});
