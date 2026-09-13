// The eight scripted players shared by scripts/record-games.mjs (GIFs) and
// scripts/social-preview.mjs (the social card). Each driver takes a Playwright page that is
// already on the game's route and plays a few seconds of a plausible-looking game.
//
// Needs the dev server on 5183 (`npm run dev -- --port 5183`).

export const BASE = 'http://localhost:5183';

/** The scores seeded before every capture, so BEST reads as something. Same set as the hub
 *  screenshot in the README: a few dozen is what a real Snake game looks like. */
export async function seedScores(page) {
  await page.goto(`${BASE}/#/`, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    const set = (k, v) => localStorage.setItem(`arcade.${k}`, JSON.stringify(v));
    set('best.snake', 38);
    set('best.tetris', 12750);
    set('best.breakout', 5620);
    set('best.flappy', 47);
    set('best.g2048', 8124);
    set('muted', false);
  });
}

export const wait = (page, ms) => page.waitForTimeout(ms);

/** Click the canvas at a fraction of its size — games map CSS px to their own grid. */
async function tapCanvas(page, fx, fy) {
  const box = await page.locator('canvas').boundingBox();
  await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
}

/**
 * Read the game canvas and return the centre (in canvas CSS px) of the first pixel
 * matching an exact colour. The dark-screen games draw sprites in flat SCREEN colours
 * (food pink, head gold, ball white) with a glow around them; the glow is blended, so an
 * exact match only ever hits the sprite itself. Lets the demos actually play.
 */
export async function findColor(page, rgb, block = 0) {
  return page.evaluate(([r, g, b, block]) => {
    const c = document.querySelector('canvas');
    const w = c.width;
    const d = c.getContext('2d').getImageData(0, 0, w, c.height).data;
    const k = w / c.clientWidth; // backing store / CSS px
    const bs = Math.round(block * k);
    const hit = (x, y) => {
      const i = (y * w + x) * 4;
      return d[i] === r && d[i + 1] === g && d[i + 2] === b;
    };
    for (let y = 0; y < c.height - bs; y++) {
      for (let x = 0; x < w - bs; x++) {
        // `block`: also require a solid square of that colour to the lower right, so a
        // sprite is not confused with text drawn in the same colour (Snake's gold score)
        if (hit(x, y) && (!bs || (hit(x + bs, y) && hit(x, y + bs) && hit(x + bs, y + bs)))) {
          return { x: (x + bs / 2) / k, y: (y + bs / 2) / k };
        }
      }
    }
    return null;
  }, [...rgb, block]);
}
const PINK = [255, 92, 158];
export const GOLD = [255, 201, 60];
const WHITE = [255, 250, 240];

export const GAMES = {
  async snake(page) {
    // Greedy chase: every ~step, find the head (gold) and the food (pink) on the canvas and
    // turn toward the food, one axis at a time. 20×30 grid, 16px cells, 0.16s/step. The
    // snake stays short in 7s, so ignoring its own body is fine.
    await page.keyboard.press('Space');
    const opposite = { right: 'left', left: 'right', up: 'down', down: 'up' };
    const KEY = { right: 'ArrowRight', left: 'ArrowLeft', up: 'ArrowUp', down: 'ArrowDown' };
    const STEP = { right: [1, 0], left: [-1, 0], up: [0, -1], down: [0, 1] };
    const inside = (x, y) => x >= 0 && x < 20 && y >= 0 && y < 30;
    // The game only applies a turn on its next step, so the direction is read back from
    // how the head actually moved (a locally tracked one drifts after a rejected press),
    // and at most one key goes out per step. Polling is much faster than the 160ms step so
    // the turn lands before the head takes another one.
    let dir = 'right';
    let prev = null;
    let pressed = false;
    for (let i = 0; i < 175; i++) {
      await wait(page, 40);
      const head = await findColor(page, GOLD, 10); // 14px square; the score text is thin
      const food = await findColor(page, PINK, 8);
      if (!head || !food) continue;
      const hx = Math.floor(head.x / 16);
      const hy = Math.floor(head.y / 16);
      if (prev && (prev.x !== hx || prev.y !== hy)) {
        if (hx !== prev.x) dir = hx > prev.x ? 'right' : 'left';
        else dir = hy > prev.y ? 'down' : 'up';
        pressed = false;
      }
      prev = { x: hx, y: hy };
      if (pressed) continue;
      const dx = Math.floor(food.x / 16) - hx;
      const dy = Math.floor(food.y / 16) - hy;
      const prefs = [];
      if (Math.abs(dx) >= Math.abs(dy)) {
        if (dx) prefs.push(dx > 0 ? 'right' : 'left');
        if (dy) prefs.push(dy > 0 ? 'down' : 'up');
      } else {
        if (dy) prefs.push(dy > 0 ? 'down' : 'up');
        if (dx) prefs.push(dx > 0 ? 'right' : 'left');
      }
      prefs.push(dir, 'up', 'down', 'left', 'right');
      const want = prefs.find((d) => d !== opposite[dir] && inside(hx + STEP[d][0], hy + STEP[d][1]));
      if (want && want !== dir) {
        pressed = true;
        await page.keyboard.press(KEY[want]);
      }
    }
  },

  async tetris(page) {
    await page.keyboard.press('Space'); // START
    await wait(page, 400);
    const shifts = [-2, 3, 0, -4, 2, -1, 4, -3, 1, 0, -2, 3];
    for (const dx of shifts) {
      const key = dx < 0 ? 'ArrowLeft' : 'ArrowRight';
      for (let i = 0; i < Math.abs(dx); i++) { await page.keyboard.press(key); await wait(page, 70); }
      if (dx % 2 === 0) { await page.keyboard.press('ArrowUp'); await wait(page, 120); }
      await wait(page, 120);
      await page.keyboard.press('Space');
      await wait(page, 220);
    }
    await wait(page, 400);
  },

  async breakout(page) {
    // The paddle follows the ball: every 40ms read the ball (white) and hold ← / → toward
    // it. The paddle is teal so the ball is the only white sprite on screen.
    await page.keyboard.press('Space'); // launch
    let held = null;
    const hold = async (key) => {
      if (held === key) return;
      if (held) await page.keyboard.up(held);
      held = key;
      if (key) await page.keyboard.down(key);
    };
    let paddleX = 160; // paddle starts centred; keyboard moves it at 300px/s
    let last = Date.now();
    for (let i = 0; i < 150; i++) {
      await wait(page, 40);
      const now = Date.now();
      if (held === 'ArrowLeft') paddleX -= 300 * (now - last) / 1000;
      if (held === 'ArrowRight') paddleX += 300 * (now - last) / 1000;
      paddleX = Math.max(28, Math.min(292, paddleX));
      last = now;
      const ball = await findColor(page, WHITE, 4);
      if (!ball) continue;
      const d = ball.x - paddleX;
      await hold(Math.abs(d) < 6 ? null : d > 0 ? 'ArrowRight' : 'ArrowLeft');
    }
    await hold(null);
  },

  async flappy(page) {
    // A flap returns the bird to the same height after ≈0.63s; 560ms keeps it roughly level
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Space');
      await wait(page, 560);
    }
  },

  async g2048(page) {
    const dirs = ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowUp'];
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press(dirs[i % dirs.length]);
      await wait(page, 150);
    }
    await wait(page, 500);
  },

  async minesweeper(page) {
    await page.click('[data-act="overlay:0"]'); // EASY, 9×9
    await wait(page, 500);
    const cell = 1 / 9;
    const at = (c, r) => [(c + 0.5) * cell, (r + 0.5) * cell];
    await tapCanvas(page, ...at(0, 0)); // corners tend to open a big region
    await wait(page, 900);
    await tapCanvas(page, ...at(8, 8));
    await wait(page, 900);
    await tapCanvas(page, ...at(4, 4));
    await wait(page, 900);
    // long-press to flag
    const box = await page.locator('canvas').boundingBox();
    await page.mouse.move(box.x + box.width * 7.5 * cell, box.y + box.height * 1.5 * cell);
    await page.mouse.down();
    await wait(page, 550);
    await page.mouse.up();
    await wait(page, 900);
    await tapCanvas(page, ...at(2, 6));
    await wait(page, 900);
  },

  async sudoku(page) {
    await page.click('[data-act="overlay:0"]'); // EASY
    await wait(page, 500);
    const cell = 1 / 9;
    const at = (c, r) => [(c + 0.5) * cell, (r + 0.5) * cell];
    // Fill two empty-looking cells, then drop a couple of pencil notes in a third.
    // Which cells are empty is random; a wrong guess is still a visible action.
    await tapCanvas(page, ...at(4, 4));
    await wait(page, 500);
    await page.keyboard.press('Digit5');
    await wait(page, 800);
    await tapCanvas(page, ...at(1, 7));
    await wait(page, 500);
    await page.keyboard.press('Digit3');
    await wait(page, 800);
    await tapCanvas(page, ...at(6, 2));
    await wait(page, 500);
    await page.keyboard.press('KeyN'); // notes on
    await wait(page, 300);
    await page.keyboard.press('Digit2');
    await wait(page, 400);
    await page.keyboard.press('Digit7');
    await wait(page, 800);
    await page.keyboard.press('KeyN'); // notes off
    await wait(page, 500);
  },

  async gomoku(page) {
    await page.click('[data-act="overlay:1"]'); // AI EASY
    await wait(page, 400);
    const box = await page.locator('canvas').boundingBox();
    const k = box.width / 320; // 320 logical px; intersections at 20 + c*20
    const stone = async (c, r) => {
      await page.mouse.click(box.x + (20 + c * 20) * k, box.y + (20 + r * 20) * k);
      await wait(page, 900); // leave room for the AI reply
    };
    // Black builds a row. Easy AI may or may not block; either way white cannot get five
    // first, and if black does the win banner is a fine ending.
    for (const c of [7, 8, 6, 9, 5]) await stone(c, 7);
    await wait(page, 500);
  },
};
