import { test, expect, type Page } from '@playwright/test';

async function place(page: Page, c: number, r: number): Promise<void> {
  const canvas = page.locator('canvas');
  const box = (await canvas.boundingBox())!;
  await canvas.click({ position: { x: (20 + c * 20) * box.width / 320, y: (20 + r * 20) * box.height / 320 } });
}

async function boardImage(page: Page): Promise<string> {
  return page.locator('canvas').evaluate(async (canvas: HTMLCanvasElement) => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    return canvas.toDataURL();
  });
}

const wins = [
  { name: 'black horizontal desktop', white: false, width: 1280, dx: 1, dy: 0 },
  { name: 'white diagonal mobile', white: true, width: 375, dx: 1, dy: 1 },
  { name: 'white vertical desktop', white: true, width: 1280, dx: 0, dy: 1 },
  { name: 'black anti-diagonal narrow mobile', white: false, width: 320, dx: 1, dy: -1 },
];

for (const scenario of wins) {
  test(`GOMOKU final-board review: ${scenario.name}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: scenario.width, height: 900 });
    await page.goto('/#/gomoku');
    await page.getByRole('button', { name: '2 PLAYERS', exact: true }).click();
    const empty = await boardImage(page);
    for (let i = 0; i < 5; i++) {
      // Opponent stones are separated, so only the intended player can win.
      if (scenario.white) await place(page, i * 2, 13);
      await place(page, 4 + i * scenario.dx, 7 + i * scenario.dy);
      if (!scenario.white && i < 4) await place(page, i * 2, 13);
    }
    const result = scenario.white ? 'WHITE WINS' : 'BLACK WINS';
    await expect(page.locator('.settle-title')).toHaveText(result);
    const finished = await boardImage(page);
    expect(finished).not.toBe(empty);
    await page.screenshot({ path: testInfo.outputPath('result.png'), fullPage: true });

    // Explicit buttons must work immediately, without the board-tap debounce.
    await page.locator('.settle').getByRole('button', { name: 'VIEW BOARD', exact: true }).click();
    await expect(page.locator('.settle-card')).toBeHidden();
    await expect(page.locator('.screen')).not.toHaveClass(/is-settled/);
    await expect(page.locator('[data-ref="result"]')).toHaveText(result);
    await expect(page.locator('[data-ref="new-game"]')).toBeVisible();
    expect(await boardImage(page)).toBe(finished);

    // Assert that the winning line and last-move ring were actually painted.
    const last = { x: 20 + (4 + 4 * scenario.dx) * 20, y: 20 + (7 + 4 * scenario.dy) * 20 };
    const middle = { x: 20 + (4 + 1.5 * scenario.dx) * 20, y: 20 + (7 + 1.5 * scenario.dy) * 20 };
    const markerPixels = await page.locator('canvas').evaluate((canvas: HTMLCanvasElement, points) => {
      const g = canvas.getContext('2d')!;
      const scale = canvas.width / 320;
      return points.map(({ x, y }) => Array.from(g.getImageData(Math.round(x * scale), Math.round(y * scale), 1, 1).data).slice(0, 3));
    }, [middle, { x: last.x + 5, y: last.y }]);
    for (const pixel of markerPixels) expect(pixel).toEqual([214, 51, 108]);

    await place(page, 14, 0);
    await page.keyboard.press('Space');
    await page.keyboard.press('Enter');
    await expect(page.locator('.settle-card')).toBeHidden();
    expect(await boardImage(page)).toBe(finished);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('review.png'), fullPage: true });

    // Opening the menu must not discard the final board; keyboard can return to it.
    await page.getByRole('button', { name: 'Mode menu' }).click();
    await expect(page.locator('.settle-title')).toHaveText('GOMOKU');
    const review = page.locator('.settle').getByRole('button', { name: 'VIEW BOARD', exact: true });
    await review.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.settle-card')).toBeHidden();
    expect(await boardImage(page)).toBe(finished);

    await page.locator('[data-ref="new-game"]').focus();
    await page.keyboard.press('Space');
    await expect(page.locator('.settle-title')).toHaveText('GOMOKU');
    await page.getByRole('button', { name: '2 PLAYERS', exact: true }).click();
    await expect(page.locator('[data-ref="result"]')).toBeHidden();
    await expect(page.locator('[data-ref="black"]')).toBeVisible();
    await expect(page.locator('.cab-hints')).toContainText('CLICK TO PLACE');
    // Move the mouse outside before checking a fresh board (no hover ghost).
    await page.mouse.move(0, 0);
    expect(await boardImage(page)).toBe(empty);
    await place(page, 7, 7);
    await expect(page.locator('[data-ref="white"]')).toHaveClass(/is-turn/);
  });
}

test('GOMOKU draw can be reviewed and the result menu can return to the board', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/#/gomoku');
  await page.getByRole('button', { name: '2 PLAYERS', exact: true }).click();
  const black: [number, number][] = [];
  const white: [number, number][] = [];
  // Two-column stripes flip color each row: no horizontal, vertical or diagonal five.
  for (let r = 0; r < 15; r++) for (let c = 0; c < 15; c++) {
    ((Math.floor(c / 2) + r) % 2 === 0 ? black : white).push([c, r]);
  }
  for (let i = 0; i < black.length; i++) {
    await place(page, ...black[i]);
    if (i < white.length) await place(page, ...white[i]);
  }
  await expect(page.locator('.settle-title')).toHaveText('DRAW');
  const finished = await boardImage(page);
  await page.locator('.settle').getByRole('button', { name: '▶ NEW GAME', exact: true }).click();
  await page.locator('.settle').getByRole('button', { name: 'VIEW BOARD', exact: true }).click();
  await expect(page.locator('[data-ref="result"]')).toHaveText('DRAW');
  await expect(page.locator('.cab-hints')).not.toContainText('WINNING');
  expect(await boardImage(page)).toBe(finished);
});
