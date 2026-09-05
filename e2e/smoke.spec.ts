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
  await expect(page.locator('.cab-name')).toContainText('打砖块');
  await page.click('[data-act="back"]');
  await expect(page.locator('.hub-title')).toBeVisible();
});

test('进入扫雷有画布渲染，返回首页正常', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-id="minesweeper"]');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('.cab-name')).toContainText('扫雷');
  await page.click('[data-act="back"]');
  await expect(page.locator('.hub-title')).toBeVisible();
});

test('进入俄罗斯方块有画布渲染，返回首页正常', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-id="tetris"]');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('.cab-name')).toContainText('俄罗斯方块');
  await page.click('[data-act="back"]');
  await expect(page.locator('.hub-title')).toBeVisible();
});

test('进入数独有画布渲染，返回首页正常', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-id="sudoku"]');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('.cab-name')).toContainText('数独');
  await page.click('[data-act="back"]');
  await expect(page.locator('.hub-title')).toBeVisible();
});

test('进入五子棋有画布渲染，返回首页正常', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-id="gomoku"]');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('.cab-name')).toContainText('五子棋');
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

  await expect(page.locator('.settle-title')).toHaveText('GAME OVER');
  await expect(page.locator('.screen')).toHaveClass(/is-settled/);
  // 结算态的提示条与游戏态不同（设计稿 artboard 1a vs 1b）
  await expect(page.locator('.cab-hints')).toHaveText('SPACE / TAP TO RETRY');

  await page.click('[data-act="settle-action"]');
  await expect(page.locator('.settle-card')).toBeHidden();
  await expect(page.locator('.screen')).not.toHaveClass(/is-settled/);
  await expect(page.locator('.cab-hints')).toContainText('SPACE START');
});

test('结算浮层的 QUIT TO HUB 回首页', async ({ page }) => {
  await page.goto('/#/snake');
  await expect(page.locator('canvas')).toBeVisible();
  await page.keyboard.press('ArrowUp');
  await expect(page.locator('.settle-card')).toBeVisible({ timeout: 20000 });
  await page.click('[data-act="settle-quit"]');
  await expect(page.locator('.hub-title')).toBeVisible();
});
