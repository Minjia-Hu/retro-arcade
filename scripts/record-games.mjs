// Records one short GIF per game into docs/screenshots/<id>.gif, cropped to the cabinet.
//
//   node scripts/record-games.mjs            # all eight
//   node scripts/record-games.mjs snake 2048 # just these
//
// Needs the dev server on 5183 (`npm run dev -- --port 5183`) and ffmpeg on PATH.
// Each game gets a fresh browser context: Playwright records a webm, ffmpeg trims the
// lead-in, crops to the cabinet (plus its 8px drop shadow) and builds a palette GIF with
// no dithering — the page is flat color, dithering only adds noise and bytes.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { BASE, GAMES, seedScores, wait } from './game-drivers.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('@playwright/test');

const OUT_DIR = new URL('../docs/screenshots/', import.meta.url).pathname;
const VIEW = { width: 540, height: 1000 };
const FPS = 12;
const SHADOW = 8; // .cabinet's hard drop shadow, outside its box

try {
  await fetch(BASE);
} catch {
  console.error(`dev server not reachable at ${BASE} — run: npm run dev -- --port 5183`);
  process.exit(1);
}

const wanted = process.argv.slice(2);
const ids = wanted.length ? wanted : Object.keys(GAMES);
for (const id of ids) {
  if (!GAMES[id]) { console.error(`unknown game: ${id}`); process.exit(1); }
}

const browser = await chromium.launch();

for (const id of ids) {
  const videoDir = mkdtempSync(join(tmpdir(), `arcade-${id}-`));
  const ctx = await browser.newContext({
    viewport: VIEW,
    deviceScaleFactor: 1,
    recordVideo: { dir: videoDir, size: VIEW },
  });
  const page = await ctx.newPage();
  const t0 = Date.now(); // the video timeline starts with the page
  const since = () => (Date.now() - t0) / 1000;

  await seedScores(page); // BEST reads as something; then land on the game
  await page.goto(`${BASE}/#/${id}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.cabinet');
  await page.evaluate(() => document.fonts.ready);
  await wait(page, 400);

  const box = await page.locator('.cabinet').boundingBox();
  const crop = {
    w: Math.round(box.width + SHADOW),
    h: Math.round(box.height + SHADOW),
    x: Math.round(box.x),
    y: Math.round(box.y),
  };
  const start = since();
  await GAMES[id](page);
  const end = since();

  await ctx.close();
  const webm = join(videoDir, readdirSync(videoDir)[0]);
  const out = join(OUT_DIR, `${id === 'g2048' ? '2048' : id === 'minesweeper' ? 'mines' : id}.gif`);
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-ss', Math.max(0, start - 0.1).toFixed(2), '-t', (end - start + 0.1).toFixed(2), '-i', webm,
    '-vf', `crop=${crop.w}:${crop.h}:${crop.x}:${crop.y},fps=${FPS},split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=none`,
    out,
  ], { stdio: 'inherit' });
  console.log(`${id}: ${(end - start).toFixed(1)}s → ${out}`);
}

await browser.close();
