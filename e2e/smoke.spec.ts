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
  await expect(page.locator('.frame-title')).toContainText('FLAPPY');
  await page.click('[data-act="back"]');
  await expect(page.locator('.hub-title')).toBeVisible();
});

test('进入 snake 有画布渲染，返回首页正常', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-id="snake"]');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('.frame-title')).toContainText('贪吃蛇');
  await page.click('[data-act="back"]');
  await expect(page.locator('.hub-title')).toBeVisible();
});

test('进入 2048 有画布渲染，返回首页正常', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-id="g2048"]');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('.frame-title')).toContainText('2048');
  await page.click('[data-act="back"]');
  await expect(page.locator('.hub-title')).toBeVisible();
});

test('进入打砖块有画布渲染，返回首页正常', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-id="breakout"]');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('.frame-title')).toContainText('打砖块');
  await page.click('[data-act="back"]');
  await expect(page.locator('.hub-title')).toBeVisible();
});

test('未实装游戏卡片为禁用状态', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-id="tetris"]')).toBeDisabled();
});
