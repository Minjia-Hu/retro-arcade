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
