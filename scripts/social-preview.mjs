// Renders docs/screenshots/social.png — the 2:1 card GitHub shows when the repo is linked
// (Settings → Social preview; 1280×640 recommended, this is 2880×1440).
//
//   node scripts/social-preview.mjs
//
// Needs the dev server on 5183 (`npm run dev -- --port 5183`). Plays each game with the
// drivers from game-drivers.mjs, shoots its canvas mid-game, then lays the eight shots out
// on a page styled after the hub (Bungee title, ink borders, hard shadows) and screenshots
// that at 2× — so the card stays in step with the site's fonts and colours.

import { existsSync, mkdtempSync, renameSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { BASE, GAMES, GOLD, findColor, seedScores, wait } from './game-drivers.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('@playwright/test');

const OUT = new URL('../docs/screenshots/social.png', import.meta.url).pathname;
const VIEW = { width: 540, height: 1000 };
const VIEW_CANVAS_H = 480; // Snake's and Flappy's canvas height in CSS px at this viewport
const anchorY = {}; // per-game vertical crop anchor in %, filled while shooting

// The dark-screen games are shot mid-run, before a game-over overlay can appear; the paper
// boards after their driver finishes (nothing ends them). Gomoku stops short of the win.
const SNAP_AT = { breakout: 3000, tetris: 3500, gomoku: 3200 };

// Snake and Flappy can die early under their scripted players: keep re-shooting while alive
// and stop once the settle overlay (a DOM layer over the canvas, `.settle[hidden]` while
// playing) shows, so the last shot is the last living frame.
const KEEP_LAST_ALIVE = new Set(['snake', 'flappy']);
const DEAD = () => !document.querySelector('.settle').hidden;

// Layout: 4×2 tiles. Dark screens are portrait and get cropped (`cover`), anchored where the
// action is; paper boards are square and shown whole (`contain`) on their own paper tone.
const TILES = [
  { id: 'snake', label: 'SNAKE', tone: 'teal' },
  { id: 'tetris', label: 'TETRIS', tone: 'magenta', anchor: 'bottom' }, // the stack, not the void above it
  { id: 'breakout', label: 'BREAKOUT', tone: 'orange', anchor: 'top' }, // the brick wall
  { id: 'flappy', label: 'FLAPPY', tone: 'gold' },
  { id: 'g2048', label: '2048', tone: 'teal', paper: '#efe5d3' },
  { id: 'minesweeper', label: 'MINES', tone: 'magenta', paper: '#efe5d3' },
  { id: 'sudoku', label: 'SUDOKU', tone: 'orange', paper: '#f6efe3' },
  { id: 'gomoku', label: 'GOMOKU', tone: 'gold', paper: '#efe0c3' },
];

try {
  await fetch(BASE);
} catch {
  console.error(`dev server not reachable at ${BASE} — run: npm run dev -- --port 5183`);
  process.exit(1);
}

const dir = mkdtempSync(join(tmpdir(), 'arcade-social-'));
const browser = await chromium.launch();

for (const { id } of TILES) {
  // The colour-reading drivers poll the whole canvas every 40ms; at DPR 2 that is too slow to
  // steer, so the real-time games are shot at DPR 1 (as the GIFs are) and upscaled in the card.
  const dpr = ['snake', 'tetris', 'breakout', 'flappy'].includes(id) ? 1 : 2;
  const ctx = await browser.newContext({ viewport: VIEW, deviceScaleFactor: dpr });
  const page = await ctx.newPage();
  await seedScores(page);
  await page.goto(`${BASE}/#/${id}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.cabinet canvas');
  await page.evaluate(() => document.fonts.ready);
  await wait(page, 400);

  const final = join(dir, `${id}.png`);
  const shot = (path = final) => page.locator('canvas').first().screenshot({ path });
  if (KEEP_LAST_ALIVE.has(id)) {
    // A frame is only promoted to the final shot once the *next* poll still finds the game
    // alive: the overlay can appear between a poll and the screenshot that follows it.
    const pending = join(dir, `${id}.pending.png`);
    let pendingAnchor = null;
    const promote = () => {
      if (!existsSync(pending)) return;
      renameSync(pending, final);
      if (pendingAnchor != null) anchorY[id] = pendingAnchor;
    };
    const run = GAMES[id](page).catch(() => {});
    for (let t = 0; t < 8000; t += 400) {
      await wait(page, 400);
      if (await page.evaluate(DEAD)) break;
      promote();
      // Both are portrait and get cropped in the card: note where the gold sprite (Flappy's
      // bird, Snake's head) is in this frame so the crop can be anchored on it, not the centre.
      // No sprite means the death frame: the game wipes it before the overlay appears.
      const sprite = await findColor(page, GOLD, id === 'snake' ? 10 : 4);
      if (!sprite) break;
      pendingAnchor = Math.round((sprite.y / VIEW_CANVAS_H) * 100);
      await shot(pending);
    }
    if (!(await page.evaluate(DEAD))) promote();
    await run;
  } else if (id === 'minesweeper') {
    // The scripted clicks can hit a mine (BOOM overlay); reload and try again.
    for (let attempt = 0; attempt < 6; attempt++) {
      await GAMES[id](page);
      if (!(await page.evaluate(DEAD))) break;
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForSelector('.cabinet canvas');
      await wait(page, 400);
    }
    await shot();
  } else if (SNAP_AT[id]) {
    const run = GAMES[id](page).catch(() => {});
    await wait(page, SNAP_AT[id]);
    await shot();
    await run;
  } else {
    await GAMES[id](page);
    await shot();
  }
  await ctx.close();
  console.log(`${id}: shot`);
}

const tile = (t) => `
    <div class="cell">
      <div class="tile${t.paper ? ' fit' : ''}${t.anchor ? ' ' + t.anchor : ''}"${t.paper ? ` style="background:${t.paper}"` : ''}>
        <img src="${t.id}.png"${anchorY[t.id] != null ? ` style="object-position:center ${anchorY[t.id]}%"` : ''}>
      </div>
      <div class="cap ${t.tone}">${t.label}</div>
    </div>`;

writeFileSync(join(dir, 'card.html'), `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Bungee&family=Space+Grotesk:wght@700&display=swap" rel="stylesheet">
<style>
  /* Mirrors :root in src/styles/arcade.css — keep in step when the palette changes */
  :root { --paper:#f6efe3; --ink:#2b2118; --orange:#e8590c; --teal:#0b7285; --magenta:#d6336c; --gold:#e67700; --screen-ground:#1a1410; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { width:1440px; height:720px; background:var(--paper); color:var(--ink); font-family:'Space Grotesk',sans-serif; overflow:hidden; }
  .wrap { padding:20px 28px 26px; height:100%; display:flex; flex-direction:column; }
  .head { text-align:center; margin-bottom:14px; }
  .title { font-family:'Bungee','Space Grotesk',sans-serif; font-weight:400; font-size:50px; color:var(--orange); text-shadow:4px 4px 0 var(--ink); line-height:1; }
  .sub { margin-top:10px; font-size:14px; font-weight:700; letter-spacing:5px; }
  .grid { flex:1; min-height:0; display:grid; grid-template-columns:repeat(4,1fr); grid-template-rows:repeat(2,1fr); gap:14px 16px; }
  .cell { display:flex; flex-direction:column; min-height:0; }
  .tile { position:relative; flex:1; min-height:0; min-width:0; border:3px solid var(--ink); border-radius:12px; box-shadow:6px 6px 0 var(--ink); overflow:hidden; background:var(--screen-ground); }
  .tile img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; object-position:center; display:block; }
  .tile.top img { object-position:center top; }
  .tile.bottom img { object-position:center bottom; }
  .tile.fit img { object-fit:contain; }
  .cap { margin-top:9px; text-align:center; font-family:'Bungee',sans-serif; font-size:12px; letter-spacing:2px; line-height:1; }
  .cap.teal { color:var(--teal); } .cap.magenta { color:var(--magenta); } .cap.orange { color:var(--orange); } .cap.gold { color:var(--gold); }
</style></head><body><div class="wrap">
  <div class="head"><div class="title">GAME CENTER</div><div class="sub">8 CLASSIC GAMES · ONE CABINET · NO FRAMEWORK</div></div>
  <div class="grid">${TILES.map(tile).join('')}
  </div>
</div></body></html>
`);

const page = await browser.newPage({ viewport: { width: 1440, height: 720 }, deviceScaleFactor: 2 });
await page.goto(`file://${join(dir, 'card.html')}`, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await wait(page, 300);
await page.screenshot({ path: OUT });
await browser.close();
console.log(`wrote ${OUT}`);
