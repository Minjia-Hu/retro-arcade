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
  await expect(page.locator('.cab-name')).toContainText('贪吃蛇');
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
