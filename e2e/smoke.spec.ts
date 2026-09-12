import { test, expect } from '@playwright/test';

test('the hub shows 8 game cards', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.hub-title')).toBeVisible();
  await expect(page.locator('.card')).toHaveCount(8);
});

test('flappy renders a canvas and returns to the hub', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-id="flappy"]');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('.cab-name')).toContainText('FLAPPY');
  await page.click('[data-act="back"]');
  await expect(page.locator('.hub-title')).toBeVisible();
});

test('snake renders a canvas and returns to the hub', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-id="snake"]');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('.cab-name')).toContainText('SNAKE');
  await page.click('[data-act="back"]');
  await expect(page.locator('.hub-title')).toBeVisible();
});

test('2048 renders a canvas and returns to the hub', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-id="g2048"]');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('.cab-name')).toContainText('2048');
  await page.click('[data-act="back"]');
  await expect(page.locator('.hub-title')).toBeVisible();
});

test('breakout renders a canvas and returns to the hub', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-id="breakout"]');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('.cab-name')).toContainText('BREAKOUT');
  await page.click('[data-act="back"]');
  await expect(page.locator('.hub-title')).toBeVisible();
});

test('minesweeper renders a canvas and returns to the hub', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-id="minesweeper"]');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('.cab-name')).toContainText('MINES');
  await page.click('[data-act="back"]');
  await expect(page.locator('.hub-title')).toBeVisible();
});

test('tetris renders a canvas and returns to the hub', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-id="tetris"]');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('.cab-name')).toContainText('TETRIS');
  await page.click('[data-act="back"]');
  await expect(page.locator('.hub-title')).toBeVisible();
});

test('sudoku renders a canvas and returns to the hub', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-id="sudoku"]');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('.cab-name')).toContainText('SUDOKU');
  await page.click('[data-act="back"]');
  await expect(page.locator('.hub-title')).toBeVisible();
});

test('gomoku renders a canvas and returns to the hub', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-id="gomoku"]');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('.cab-name')).toContainText('GOMOKU');
  await page.click('[data-act="back"]');
  await expect(page.locator('.hub-title')).toBeVisible();
});

test('all 8 cards are enterable (none disabled)', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.card:not([disabled])')).toHaveCount(8);
});

test('SNAKE shows the result overlay on death; RETRY dismisses it and restarts', async ({ page }) => {
  await page.goto('/#/snake');
  await expect(page.locator('canvas')).toBeVisible();

  // The snake starts heading right; up is a perpendicular turn (left would be rejected as a 180°), straight into the top wall
  await page.keyboard.press('ArrowUp');
  await expect(page.locator('.settle-card')).toBeVisible({ timeout: 20000 });

  // Food is random: if the snake happens to eat before hitting the wall, it sets a record and
  // the title becomes NEW HIGH SCORE. Accept both titles — never bake random game content into a test.
  await expect(page.locator('.settle-title')).toHaveText(/GAME OVER|NEW HIGH SCORE/);
  await expect(page.locator('.screen')).toHaveClass(/is-settled/);
  // The result hints differ from the in-game hints (mockup artboards 1a vs 1b)
  await expect(page.locator('.cab-hints')).toHaveText('SPACE / TAP TO RETRY');

  await page.click('[data-act="overlay:0"]');
  await expect(page.locator('.settle-card')).toBeHidden();
  await expect(page.locator('.screen')).not.toHaveClass(/is-settled/);
  await expect(page.locator('.cab-hints')).toContainText('SPACE START');
});

test('QUIT TO HUB on the result overlay returns to the hub', async ({ page }) => {
  await page.goto('/#/snake');
  await expect(page.locator('canvas')).toBeVisible();
  await page.keyboard.press('ArrowUp');
  await expect(page.locator('.settle-card')).toBeVisible({ timeout: 20000 });
  await page.click('[data-act="overlay-quit"]');
  await expect(page.locator('.hub-title')).toBeVisible();
});

test('TETRIS side panel and touch pad are DOM and work', async ({ page }) => {
  await page.goto('/#/tetris');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('.cab-side .side-card')).toHaveCount(5);
  await expect(page.locator('.cab-pad .pad-btn')).toHaveCount(6);

  // Assert real behaviour, not "didn't throw": hardDrop always scores, so a changed score proves the button reached the game
  await page.locator('canvas').click();
  await expect(page.locator('[data-ref="score"]')).toHaveText('000000');
  await page.locator('[data-pad="hard"]').click();
  await expect(page.locator('[data-ref="score"]')).not.toHaveText('000000');
});

test('FLAPPY has no pause button and shows the live best in the hint bar', async ({ page }) => {
  await page.goto('/#/flappy');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('[data-act="pause"]')).toHaveCount(0);
  await expect(page.locator('[data-act="mute"]')).toHaveCount(1);
  await expect(page.locator('.cab-hints')).toContainText('BEST');
});

test('the hint bar restores the game\'s text after result → dismiss', async ({ page }) => {
  // FLAPPY is the only game that uses ctx.setHints. This covers the full setHints → overlay →
  // overlay(null) restore chain: without frame's baseHints bookkeeping, dismissing falls back to the meta.hints placeholder.
  //
  // A non-zero best must be seeded: the meta.hints placeholder is exactly 'BEST 000000', and when
  // the bird hits the ground score and best are both 0 — "restored the live value" and "fell back to
  // the placeholder" would be indistinguishable.
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('arcade.best.flappy', '42'));
  await page.goto('/#/flappy');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('.cab-hints')).toHaveText('BEST 000042');

  // FLAPPY runs no physics while ready: flap once to start, then do nothing and gravity brings the bird down
  await page.keyboard.press('Space');
  await expect(page.locator('.settle-card')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('.cab-hints')).toHaveText('SPACE / TAP TO RETRY');

  await page.click('[data-act="overlay:0"]');
  await expect(page.locator('.settle-card')).toBeHidden();
  await expect(page.locator('.cab-hints')).toHaveText('BEST 000042');
});

test('SUDOKU opens with the difficulty menu; the digit pad appears after picking', async ({ page }) => {
  await page.goto('/#/sudoku');
  await expect(page.locator('canvas')).toBeVisible();

  // The difficulty menu is a multi-action overlay
  await expect(page.locator('.settle-title')).toHaveText('DIFFICULTY');
  await expect(page.locator('.settle-actions .settle-action')).toHaveCount(3);
  await expect(page.locator('[data-act="pause"]')).toHaveCount(0);

  await page.click('[data-act="overlay:0"]');
  await expect(page.locator('.settle-card')).toBeHidden();
  await expect(page.locator('.cab-pill')).toHaveText('EASY');
  await expect(page.locator('.pad-btn-digit')).toHaveCount(9);
  await expect(page.locator('.pad-btn-wide')).toHaveCount(3);

  // ☰ reopens the menu
  await page.click('[data-act="tool:menu"]');
  await expect(page.locator('.settle-title')).toHaveText('DIFFICULTY');
});

test('SUDOKU notes toggle shares one state between keyboard and button', async ({ page }) => {
  await page.goto('/#/sudoku');
  await page.click('[data-act="overlay:0"]');
  const notes = page.locator('[data-pad="notes"]');
  await expect(notes).not.toHaveClass(/is-on/);

  await notes.click();
  await expect(notes).toHaveClass(/is-on/);

  // A keyboard toggle must update the button's active state too — the plan once missed this sync
  await page.keyboard.press('KeyN');
  await expect(notes).not.toHaveClass(/is-on/);
});

test('SUDOKU freezes the board while the menu is open; RESUME returns to the current game', async ({ page }) => {
  await page.goto('/#/sudoku');
  await page.click('[data-act="overlay:0"]');           // pick EASY to start
  await expect(page.locator('.settle-card')).toBeHidden();

  // Select a cell and enter a digit as the reference for "was the board touched"
  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.click(box.x + 16, box.y + 16);       // cell 0

  // Hitting ☰ mid-game: a game in progress needs a way back, not only abandonment
  await page.click('[data-act="tool:menu"]');
  await expect(page.locator('.settle-title')).toHaveText('DIFFICULTY');
  await expect(page.locator('.settle-actions .settle-action').first()).toHaveText('✕ RESUME');
  await expect(page.locator('.cab-hints')).toHaveText('RESUME OR PICK A DIFFICULTY');

  // The overlay covers only .screen; the pad sits outside — its buttons are clickable but must not change the covered board
  await page.click('[data-pad="notes"]');
  await expect(page.locator('[data-pad="notes"]')).not.toHaveClass(/is-on/);

  await page.click('[data-act="overlay:0"]');           // ✕ RESUME
  await expect(page.locator('.settle-card')).toBeHidden();
  await expect(page.locator('.cab-pill')).toHaveText('EASY'); // still the same game
});

test('SUDOKU menu has no RESUME before a game starts', async ({ page }) => {
  await page.goto('/#/sudoku');
  await expect(page.locator('.settle-title')).toHaveText('DIFFICULTY');
  await expect(page.locator('.settle-actions .settle-action')).toHaveCount(3);
  await expect(page.locator('.cab-hints')).toHaveText('PICK A DIFFICULTY TO BEGIN');
});

test('2048 score cards and undo live in the DOM', async ({ page }) => {
  await page.goto('/#/g2048');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('.cab-head .head-card')).toHaveCount(2);
  await expect(page.locator('[data-act="tool:new"]')).toHaveCount(1);

  // Nothing to undo at the start; one move later there is.
  // The two starting tiles are random, and ← is not a move when both sit flush left; ← and ↑ can't both be no-ops
  await expect(page.locator('[data-ref="undo"]')).toBeDisabled();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowUp');
  await expect(page.locator('[data-ref="undo"]')).toBeEnabled();
});

test('MINES 🙂 restarts the board; ☰ is what returns to the difficulty menu', async ({ page }) => {
  await page.goto('/#/minesweeper');
  await page.click('[data-act="overlay:0"]');            // pick the first difficulty
  await expect(page.locator('.settle-card')).toBeHidden();
  await expect(page.locator('.cab-pill')).toHaveText('EASY');

  // 🙂 restarts the board: no menu, same difficulty
  await page.click('[data-ref="face"]');
  await expect(page.locator('.settle-card')).toBeHidden();
  await expect(page.locator('.cab-pill')).toHaveText('EASY');

  // ☰ is what returns to the difficulty menu — the two used to share one hit area
  await page.click('[data-act="tool:menu"]');
  await expect(page.locator('.settle-title')).toHaveText('DIFFICULTY');
});

test('MINES clock starts on the first reveal', async ({ page }) => {
  await page.goto('/#/minesweeper');
  await page.click('[data-act="overlay:0"]');
  await expect(page.locator('[data-ref="time"]')).toHaveText('00:00');

  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.click(box.x + 16, box.y + 16);
  await expect(page.locator('[data-ref="time"]')).not.toHaveText('00:00', { timeout: 3000 });
});

test('GOMOKU mode menu has four items; turn chips follow the mode', async ({ page }) => {
  await page.goto('/#/gomoku');
  await expect(page.locator('.settle-title')).toHaveText('GOMOKU');
  await expect(page.locator('.settle-actions .settle-action')).toHaveCount(4);

  await page.click('[data-act="overlay:0"]');            // 2 PLAYERS
  await expect(page.locator('[data-ref="black"]')).toHaveText('● BLACK');
  await expect(page.locator('[data-ref="white"]')).toHaveText('○ WHITE');
  await expect(page.locator('[data-ref="black"]')).toHaveClass(/is-turn/);

  // With a game in progress the menu gains ✕ RESUME at the top, so AI EASY is index 2, not 1
  await page.click('[data-act="tool:menu"]');
  await expect(page.locator('.settle-actions .settle-action').first()).toHaveText('✕ RESUME');
  await page.click('[data-act="overlay:2"]');            // AI EASY
  await expect(page.locator('[data-ref="white"]')).toHaveText('○ CPU');
});

// ---- Paper boards: if the result overlay says SPACE / TAP, it has to work ----

test('SUDOKU: Space after solving returns to the difficulty menu', async ({ page }) => {
  // Seed a save one cell from solved: the restore path skips the menu, and the last digit means SOLVED
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
  await page.mouse.click(box.x + 16, box.y + 16); // cell 0
  await page.keyboard.press('Digit5');
  await expect(page.locator('.settle-title')).toHaveText('SOLVED!');

  await page.waitForTimeout(450); // 400ms debounce
  await page.keyboard.press('Space');
  await expect(page.locator('.settle-title')).toHaveText('DIFFICULTY');
});

test('GOMOKU: Space after a result returns to the mode menu', async ({ page }) => {
  await page.goto('/#/gomoku');
  await page.click('[data-act="overlay:0"]'); // 2 PLAYERS
  await expect(page.locator('.settle-card')).toBeHidden();

  // The canvas is 320×320 logical; intersections at px(c) = 20 + c*20. Black makes five on row 7, white tags along on row 8
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

test('MINES: Space after the game ends restarts at the same difficulty', async ({ page }) => {
  await page.goto('/#/minesweeper');
  await page.click('[data-act="overlay:0"]'); // EASY 9×9
  await expect(page.locator('.settle-card')).toBeHidden();

  // Mines are random: click cell by cell until either a mine or a clear; both endings are accepted
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
  await expect(page.locator('.cab-pill')).toHaveText('EASY'); // same difficulty
  await expect(page.locator('[data-ref="time"]')).toHaveText('00:00'); // new game
});

test('2048: Space after game over starts a new game', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/#/g2048');
  await expect(page.locator('canvas')).toBeVisible();

  // Tiles are random: cycle the four directions until stuck. If 2048! comes first (very unlikely), click NEW GAME and continue
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

test('the hub footer SOUND toggle shares state with the in-game SND button', async ({ page }) => {
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

  // The exit link: points at the repo, new tab, no opener leak
  const link = page.locator('.hub-link');
  await expect(link).toHaveAttribute('href', /github\.com\/Minjia-Hu\/retro-arcade/);
  await expect(link).toHaveAttribute('rel', 'noopener');
});
