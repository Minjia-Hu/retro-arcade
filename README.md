# 🕹️ Retro Arcade

**8 classic games in one browser cabinet. No framework, 34 KB gzipped, fully tested.**

[English](README.md) · [中文](README.zh-CN.md)

[![Play](https://img.shields.io/badge/▶_Play-minjia--hu.github.io%2Fretro--arcade-e8590c?style=for-the-badge)](https://minjia-hu.github.io/retro-arcade/)

[![CI](https://github.com/Minjia-Hu/retro-arcade/actions/workflows/ci.yml/badge.svg)](https://github.com/Minjia-Hu/retro-arcade/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)
![No dependencies](https://img.shields.io/badge/runtime_deps-0-2ee6c8)

<p align="center">
  <img src="docs/screenshots/hub.png" alt="The Sunset Arcade hub: continue playing, daily challenge and hall of fame on top, eight cabinet cards below" width="900">
</p>

## Highlights

- **Tiny.** The whole arcade — eight games, the Gomoku AI, the UI — ships as **34 KB gzipped**. Smaller than most single screenshots.
- **Zero runtime dependencies.** Vite + TypeScript at build time; in the browser it's plain DOM and Canvas 2D. No React, no game engine.
- **Every rule is a pure function.** Each game's logic has no DOM or Canvas calls, so it is tested without a browser: **269 unit tests** across the game rules, shared modules and UI logic, plus **28 Playwright tests** in a real browser, all in CI.
- **Keyboard and touch, everywhere.** Swipe to steer the snake, long-press to flag a mine, tap a real button to enter a digit. Controls that need to be accessible are DOM, not pixels.
- **A Gomoku opponent that thinks off the main thread.** Minimax with α-β pruning in a Web Worker, three strengths.
- **No backend, no tracking.** Scores live in `localStorage`. The only network request is Google Fonts.

## Games

<table>
<tr>
  <td width="50%"><img src="docs/screenshots/snake.gif" alt="Snake" width="100%"></td>
  <td width="50%"><img src="docs/screenshots/tetris.gif" alt="Tetris" width="100%"></td>
</tr>
<tr>
  <td align="center"><b>SNAKE</b><br><sub>speeds up as you eat · arrows / WASD / swipe</sub></td>
  <td align="center"><b>TETRIS</b><br><sub>7-bag, hold, hard drop · ← → ↑ ↓ Space C, or the on-screen pad</sub></td>
</tr>
<tr>
  <td><img src="docs/screenshots/breakout.gif" alt="Breakout" width="100%"></td>
  <td><img src="docs/screenshots/flappy.gif" alt="Flappy Bird" width="100%"></td>
</tr>
<tr>
  <td align="center"><b>BREAKOUT</b><br><sub>three brick layouts, ball speeds up per level · ← → / drag, Space to launch</sub></td>
  <td align="center"><b>FLAPPY</b><br><sub>live high score in the hint bar · Space / ↑ / tap</sub></td>
</tr>
<tr>
  <td><img src="docs/screenshots/2048.gif" alt="2048" width="100%"></td>
  <td><img src="docs/screenshots/mines.gif" alt="Minesweeper" width="100%"></td>
</tr>
<tr>
  <td align="center"><b>2048</b><br><sub>one-step undo that can't be used to reroll · arrows / swipe, Z to undo</sub></td>
  <td align="center"><b>MINES</b><br><sub>three sizes, first click is always safe · click, long-press or right-click to flag</sub></td>
</tr>
<tr>
  <td><img src="docs/screenshots/sudoku.gif" alt="Sudoku" width="100%"></td>
  <td><img src="docs/screenshots/gomoku.gif" alt="Gomoku" width="100%"></td>
</tr>
<tr>
  <td align="center"><b>SUDOKU</b><br><sub>unique-solution puzzles generated on the spot, pencil notes, auto-save · tap a cell, then 1–9; N for notes</sub></td>
  <td align="center"><b>GOMOKU</b><br><sub>two players or AI easy / medium / hard · click to place</sub></td>
</tr>
</table>

## Run it locally

Node 20.19+ (or 22.12+). Modern browsers only (Chrome 99+, Safari 16+, Firefox 112+).

```bash
git clone https://github.com/Minjia-Hu/retro-arcade.git
cd retro-arcade
npm install
npm run dev        # http://localhost:5173
```

```bash
npm test           # unit tests (Vitest)
npm run e2e        # end-to-end (Playwright; run `npx playwright install` once)
npm run build      # type-check + production build
```

## How it's built

**One cabinet, eight games.** The shell (`src/shell/frame.ts`) owns the top bar, the screen well, the
result overlay and the hint bar. A game implements one interface and gets a `GameContext` back:
audio, storage, input gestures, the overlay, and optional DOM slots (head bar, side panel, touch pad).

```ts
ctx.overlay({
  title: 'GAME OVER',
  tone: 'lose',
  lines: ['SCORE 000420', 'BEST 001330'],
  actions: [{ label: '▶ RETRY', onPress: retry }],
  hints: ['SPACE / TAP TO RETRY'],
});
```

**Logic and rendering never mix.** Every game is `logic.ts` + `index.ts`. `logic.ts` is state and
rules only — no DOM, no Canvas, random sources injectable — so the whole rule set is unit-tested
without a browser. `index.ts` draws the state and turns input into logic calls. A full visual redesign
of this project touched only `index.ts` files; the rules and their tests didn't change by a line.

**Boards on canvas, controls in the DOM.** Grids and sprites are drawn; anything a person has to hit —
digit pad, difficulty menu, undo button — is a real `<button>` with focus rings and proper touch targets.

**Two visual families.** Dark screens (Snake, Tetris, Breakout, Flappy) glow in warm neon; paper boards
(2048, Mines, Sudoku, Gomoku) are ink on cream. The theme is called *Sunset Arcade*: hard drop shadows,
four rotating accent colors, 8×8 pixel icons rendered as inline SVG.

```
src/
  core/      game loop, input gestures, WebAudio synth, storage, canvas sizing
  shell/     hash router, hub page, the cabinet frame
  games/<id>/
    logic.ts   pure rules, fully unit-tested
    index.ts   rendering + input
```

## Add a game

1. Create `src/games/<id>/logic.ts` (pure state + rules) and `index.ts` (implements `Game` from `src/core/game.ts`).
2. Register it in `src/games/registry.ts` — the hub card, the accent color and the route appear on their own.
3. Add an 8×8 pixel icon in `src/shell/pixel-icons.ts` and a `tests/<id>-logic.test.ts`.

Conventions and the testing rules are in [CONTRIBUTING.md](CONTRIBUTING.md). The per-feature design docs in `docs/design/` are written in Chinese.

## License

[MIT](LICENSE)
