// Records docs/screenshots/tour.gif: hub → Tetris → 2048 → Gomoku → hub.
//
// Needs the dev server on 5183 (`npm run dev -- --port 5183`) and ffmpeg on PATH.
// Playwright records a webm of the whole session; ffmpeg trims the blank lead-in and
// converts it to a palette GIF. Scores are seeded into localStorage first so the hall
// of fame and the cards are not all NO RECORD.
//
// Game routes are recorded with CSS `zoom` on <body>: the cabinet is only 464px wide
// and would be tiny in a 1440px viewport. The canvas gets stretched 1.8× and then the
// GIF scales everything down to 800px wide, so the net canvas scale is about 1:1.

import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('@playwright/test');

const BASE = 'http://localhost:5183';
const OUT = new URL('../docs/screenshots/tour.gif', import.meta.url).pathname;
const VIEW = { width: 1440, height: 1120 };
const ZOOM = '1.8';

try {
  await fetch(BASE);
} catch {
  console.error(`dev server not reachable at ${BASE} — run: npm run dev -- --port 5183`);
  process.exit(1);
}

const videoDir = mkdtempSync(join(tmpdir(), 'arcade-tour-'));
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: VIEW,
  deviceScaleFactor: 1,
  recordVideo: { dir: videoDir, size: VIEW },
});
const page = await ctx.newPage();
const t0 = Date.now(); // video timeline starts with the page
const since = () => (Date.now() - t0) / 1000;
const wait = (ms) => page.waitForTimeout(ms);

async function zoomBody(z) {
  await page.evaluate((z) => { document.body.style.zoom = z; }, z);
}

/**
 * Click a hub card, then zoom in on the cabinet once it has rendered. Tall cabinets
 * (Tetris: side panel + touch pad) get less zoom so the whole thing stays in frame.
 */
async function enter(id) {
  await page.hover(`[data-id="${id}"]`);
  await wait(350);
  await page.click(`[data-id="${id}"]`);
  await page.waitForSelector('.cabinet');
  const h = (await page.locator('.cabinet').boundingBox()).height + 2 * 28; // margins
  await zoomBody(String(Math.min(Number(ZOOM), VIEW.height / h)));
  await wait(500);
}

async function back() {
  await page.click('[data-act="back"]');
  await page.waitForSelector('.hub-title');
  await zoomBody('');
  await wait(1000);
}

// ---- hub, seeded ----
await page.goto(`${BASE}/#/`, { waitUntil: 'networkidle' });
await page.evaluate(() => {
  const set = (k, v) => localStorage.setItem(`arcade.${k}`, JSON.stringify(v));
  set('best.snake', 3840);
  set('best.tetris', 12750);
  set('best.breakout', 5620);
  set('best.flappy', 47);
  set('best.g2048', 8124);
  set('lastPlayed', { id: 'tetris', at: Date.now() - 2 * 60 * 60 * 1000 });
  set('muted', false);
});
await page.reload({ waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await wait(300);
const start = since(); // everything before this is a blank page
await page.mouse.move(700, 1000);
await wait(2000);

// ---- Tetris: left/right a few, rotate, hard drop ----
await enter('tetris');
await page.keyboard.press('Space'); // START
await wait(400);
const shifts = [-2, 3, 0, -4, 2, -1, 4, -3, 1, 0, -2, 3];
for (const dx of shifts) {
  const key = dx < 0 ? 'ArrowLeft' : 'ArrowRight';
  for (let i = 0; i < Math.abs(dx); i++) { await page.keyboard.press(key); await wait(70); }
  if (dx % 2 === 0) { await page.keyboard.press('ArrowUp'); await wait(120); }
  await wait(120);
  await page.keyboard.press('Space');
  await wait(220);
}
await wait(400);
await back();

// ---- 2048: cycle directions ----
await enter('g2048');
const dirs = ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowUp'];
for (let i = 0; i < 26; i++) {
  await page.keyboard.press(dirs[i % dirs.length]);
  await wait(150);
}
await wait(400);
await back();

// ---- Gomoku vs AI EASY ----
await enter('gomoku');
await page.click('[data-act="overlay:1"]'); // AI EASY
await wait(400);
const box = await page.locator('canvas').boundingBox();
const k = box.width / 320; // canvas is 320 logical px; intersections at 20 + c*20
const stone = async (c, r) => {
  await page.mouse.click(box.x + (20 + c * 20) * k, box.y + (20 + r * 20) * k);
  await wait(900); // leave room for the AI reply
};
await stone(7, 7);
await stone(7, 8);
await stone(8, 8);
await stone(6, 8);
await stone(8, 7);
await wait(300);
await back();

await wait(500);
const end = since();
await ctx.close();
await browser.close();

const webm = join(videoDir, (await import('node:fs')).readdirSync(videoDir)[0]);
const ss = Math.max(0, start - 0.2).toFixed(2);
const t = (end - start + 0.2).toFixed(2);
execFileSync('ffmpeg', [
  '-y', '-loglevel', 'error',
  '-ss', ss, '-t', t, '-i', webm,
  '-vf', 'fps=12,scale=800:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=none',
  OUT,
], { stdio: 'inherit' });
console.log(`wrote ${OUT} (${t}s from ${webm})`);
