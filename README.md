# Retro Arcade

[English](README.md) · [中文](README.zh-CN.md)

[![CI](https://github.com/Minjia-Hu/retro-arcade/actions/workflows/ci.yml/badge.svg)](https://github.com/Minjia-Hu/retro-arcade/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A mini arcade that runs in the browser: 8 classic games, one shared cabinet shell, no framework.

- **Play it** — https://minjia-hu.github.io/retro-arcade/
- **Stack** — Vite 5 + TypeScript 5, plain DOM + Canvas 2D. No React/Vue, no runtime dependencies.
- **Tests** — Vitest for game logic and pure functions, Playwright for end-to-end.
- **Privacy** — no backend, no tracking. Scores live in `localStorage`; the only external request is Google Fonts.

<p align="center">
  <img src="docs/screenshots/hub.png" alt="Home: the Sunset Arcade hub — continue playing, daily challenge and hall of fame on top, 8 cabinet cards below" width="900">
</p>

## Games

All 8 games share the same cabinet shell — top bar, screen well, result overlay and key hints come from
`src/shell/frame.ts`. A game only draws itself into the screen and fills the slots it asks for.

<table>
<tr>
  <td width="50%"><img src="docs/screenshots/snake.png" alt="Snake" width="100%"></td>
  <td width="50%"><img src="docs/screenshots/tetris.png" alt="Tetris" width="100%"></td>
</tr>
<tr>
  <td align="center"><b>SNAKE</b></td>
  <td align="center"><b>TETRIS</b><br><sub>side panel and touch pad are DOM, not drawn on the canvas</sub></td>
</tr>
<tr>
  <td><img src="docs/screenshots/breakout.png" alt="Breakout" width="100%"></td>
  <td><img src="docs/screenshots/flappy.png" alt="Flappy Bird" width="100%"></td>
</tr>
<tr>
  <td align="center"><b>BREAKOUT</b></td>
  <td align="center"><b>FLAPPY</b> · hint bar shows the live high score</td>
</tr>
<tr>
  <td><img src="docs/screenshots/2048.png" alt="2048" width="100%"></td>
  <td><img src="docs/screenshots/mines.png" alt="Minesweeper" width="100%"></td>
</tr>
<tr>
  <td align="center"><b>2048</b> · score cards and undo in the head bar</td>
  <td align="center"><b>MINES</b></td>
</tr>
<tr>
  <td><img src="docs/screenshots/sudoku.png" alt="Sudoku" width="100%"></td>
  <td><img src="docs/screenshots/gomoku.png" alt="Gomoku" width="100%"></td>
</tr>
<tr>
  <td align="center"><b>SUDOKU</b> · the digit pad is real buttons: focusable, tabbable</td>
  <td align="center"><b>GOMOKU</b> · five in a row, with an AI opponent</td>
</tr>
</table>

The Gomoku AI runs in a Web Worker so it never blocks the main thread. Every game supports keyboard and
touch. Scores persist in `localStorage` and fall back to in-memory storage in private mode.

### Dark screens and paper boards

The 8 games fall into two visual families:

- **Dark screens** (SNAKE / TETRIS / BREAKOUT / FLAPPY) — glowing warm neon on a dark canvas, sharing
  `SCREEN` from `src/core/theme.ts`; the screen well has an inner stroke and vignette.
- **Paper boards** (SUDOKU / 2048 / MINES / GOMOKU) — cream paper, ink strokes. Each game keeps its own
  `PAPER` constant in its `index.ts` (the four palettes really are different; merging them would give
  an abstraction that fits none).

Boards are always drawn on canvas. Peripheral controls — digit pad, difficulty menu, score cards,
turn chips — are always **DOM**: tabbable, with focus rings and good touch targets, which a canvas can't give you.

## Getting started

Requires Node 18+. Modern browsers only (uses `roundRect`, Pointer Events, Web Workers — Chrome 99+,
Safari 16+, Firefox 112+).

```bash
npm install
npm run dev      # dev server
npm test         # unit tests
npm run e2e      # end-to-end tests (run `npx playwright install` once first)
npm run build    # type-check + production build
npm run preview  # preview the build
```

## Code layout

```
src/
  core/          infrastructure with no knowledge of any specific game
    loop.ts        variable-step game loop, dt capped at 50ms (pause/resume)
    input.ts       keyboard, tap, swipe, drag and long-press gestures
    audio.ts       WebAudio sound synthesis (no audio files)
    storage.ts     localStorage wrapper, falls back to memory when unavailable
    screen.ts      canvas creation and DPR-aware sizing
    theme.ts       palette constants for the dark screens
    game.ts        Game / GameMeta / GameContext interfaces
    format.ts      score padding, difficulty labels
  shell/         page shell
    router.ts      hash router (#/ is the hub, #/<id> is a game)
    hub/           home page: model (pure) / view (HTML string) / index (DOM and events)
    frame.ts       the cabinet: top bar, screen well, result overlay, key hints
    cabinet-view.ts  pure render functions for the cabinet
    difficulty-menu.ts  shared difficulty overlay (Sudoku, Minesweeper)
    pad.ts         renders a row of touch-pad buttons
    accent.ts      accent color rotation
    pixel-icons.ts 8×8 pixel icons → inline SVG
    escape.ts      HTML escaping (views build HTML as strings)
  games/<id>/
    logic.ts       pure logic: state and rules, no DOM/Canvas, fully unit-testable
    index.ts       rendering and input: draws logic state onto the canvas
```

### One rule that runs through everything: logic and rendering are separate

Every game is split into `logic.ts` and `index.ts`. **`logic.ts` has no DOM or Canvas calls** — state
transitions are pure functions, so it can be tested without a browser; that's where `tests/*-logic.test.ts`
comes from. `index.ts` only draws state and translates input into logic calls.

The payoff: a whole visual redesign can touch only `index.ts`, with `logic.ts` and its tests unchanged.
"Did we accidentally change gameplay?" becomes a runnable check:

```bash
git diff --stat <base> -- 'src/games/*/logic.ts' 'tests/*-logic.test.ts'   # should be empty
```

### How a game plugs into the cabinet

A game implements the `Game` interface (`src/core/game.ts`) and is mounted by `frame.ts`. The cabinet
hands the game a `GameContext` with audio, storage, input, the result overlay and optional slots
(head bar, side panel, touch pad):

```ts
ctx.overlay({
  title: 'GAME OVER',
  tone: 'lose',
  lines: ['SCORE 000420', 'BEST 001330'],
  actions: [{ label: '▶ RETRY', onPress: retry }],
  hints: ['SPACE / TAP TO RETRY'],
});
ctx.overlay(null);              // dismiss
ctx.setHints(['BEST 000042']);  // replace the bottom hint bar
```

`GameMeta` fields (`head` / `side` / `pad` / `pausable` / `hints` / `screen` / `tools`) decide what the
cabinet renders for a game. To add a game, register it in `src/games/registry.ts` — the hub picks it up.

## Design docs

`docs/superpowers/` holds the design notes and implementation plans for every round of work:

- `specs/` — what to build, scope decisions, deliberate trade-offs and departures from the mockups
- `plans/` — implementation plans broken into independently verifiable tasks

Writing the spec before the plan, and the plan before the code, is how this repo has always worked.
Scope decisions and "why we didn't follow the mockup here" live in the spec; in code, comments pin the
things that would otherwise get "fixed" back by the next person.

## Visual theme

The theme is **Sunset Arcade**: cream paper, ink strokes with hard drop shadows, four warm accent colors
in rotation, and CSS-drawn pixel icons (one 8×8 grid per game, rendered as inline SVG).

**The single source of truth for the page palette is `:root` in `src/styles/arcade.css`**; TypeScript
holds only the values JavaScript has to inline. Canvas colors are a separate matter — see "Dark screens
and paper boards" above. Values that exist on both sides (the four accents, `--screen-ground`) carry
cross-reference comments in both places.

## License

[MIT](LICENSE)
